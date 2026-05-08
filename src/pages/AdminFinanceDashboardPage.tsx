import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import {
  createInvoice,
  fetchInvoices,
  updateInvoice,
  type CreateInvoiceItemInput,
} from '../services/invoiceService';
import { fetchTaxSummary } from '../services/financeReportingService';
import { fetchExpenses } from '../services/financeExpenseService';
import { fetchPayrollPeriods, fetchPayrollSummary } from '../services/payrollService';
import { fetchStaffSchedules } from '../services/staffScheduleService';
import type {
  FinanceInvoice,
  FinanceInvoiceStatus,
  FinanceProfitAndLossSummary,
  FinanceExpense,
  FinanceTaxSummary,
  PayrollSummaryTotals,
} from '../types';
import { formatPriceWithCurrency } from '../utils/currency';
import { buildFinanceReportCsv, validateFinanceDateRange } from '../utils/financeReporting';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const INVOICE_STATUS_OPTIONS: Array<{ value: FinanceInvoiceStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

type RevenueRange = 'daily' | 'monthly' | 'yearly';

interface DraftInvoiceItem {
  name: string;
  quantity: string;
  unit_price: string;
}

const emptyPayrollTotals = (): PayrollSummaryTotals => ({
  gross_pay: 0,
  deductions: 0,
  tax: 0,
  net_pay: 0,
  employee_count: 0,
});

const emptyPnl = (): FinanceProfitAndLossSummary => ({
  date_from: '',
  date_to: '',
  group_by: 'monthly',
  revenue: 0,
  cogs: 0,
  gross_profit: 0,
  operating_expenses: 0,
  net_profit: 0,
});

const emptyTax = (): FinanceTaxSummary => ({
  date_from: '',
  date_to: '',
  taxable_sales: 0,
  output_vat: 0,
  input_vat: 0,
  net_vat_payable: 0,
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  const maybeAxios = error as { response?: { data?: { message?: string } } };
  const message = maybeAxios?.response?.data?.message;
  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallback;
};

const todayDate = (): string => new Date().toISOString().slice(0, 10);

const parsePositiveNumber = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseNonNegativeNumber = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const sortFinanceInvoicesNewestFirst = (records: FinanceInvoice[]): FinanceInvoice[] => (
  [...records].sort((left, right) => {
    const leftCreated = left.created_at ? Date.parse(left.created_at) : Number.NaN;
    const rightCreated = right.created_at ? Date.parse(right.created_at) : Number.NaN;

    if (Number.isFinite(leftCreated) || Number.isFinite(rightCreated)) {
      const safeLeft = Number.isFinite(leftCreated) ? leftCreated : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightCreated) ? rightCreated : Number.NEGATIVE_INFINITY;
      if (safeLeft !== safeRight) {
        return safeRight - safeLeft;
      }
    }

    const leftInvoiceDate = left.invoice_date ? Date.parse(`${left.invoice_date}T00:00:00Z`) : Number.NaN;
    const rightInvoiceDate = right.invoice_date ? Date.parse(`${right.invoice_date}T00:00:00Z`) : Number.NaN;
    if (Number.isFinite(leftInvoiceDate) || Number.isFinite(rightInvoiceDate)) {
      const safeLeft = Number.isFinite(leftInvoiceDate) ? leftInvoiceDate : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightInvoiceDate) ? rightInvoiceDate : Number.NEGATIVE_INFINITY;
      if (safeLeft !== safeRight) {
        return safeRight - safeLeft;
      }
    }

    return right.id - left.id;
  })
);

type MetricKey = 'revenue' | 'totalCosts' | 'netProfit' | 'cogs' | 'operatingExpenses' | 'payroll';

const DEFAULT_SELECTED_METRICS: MetricKey[] = ['revenue', 'totalCosts', 'netProfit'];
const VALID_REVENUE_STATUSES: FinanceInvoiceStatus[] = ['issued', 'paid'];
const INCLUDED_EXPENSE_STATUSES = new Set(['approved', 'paid']);
const INCLUDED_PAYROLL_STATUSES = new Set(['approved', 'paid']);

const metricLabels: Record<MetricKey, string> = {
  revenue: 'Revenue',
  totalCosts: 'Total Costs',
  netProfit: 'Net Profit',
  cogs: 'COGS',
  operatingExpenses: 'Operating Expenses',
  payroll: 'Payroll',
};

const isValidDateWithinRange = (date: string, dateFrom: string, dateTo: string): boolean => {
  if (!date) {
    return false;
  }
  if (dateFrom && date < dateFrom) {
    return false;
  }
  if (dateTo && date > dateTo) {
    return false;
  }
  return true;
};

const toPeriodKey = (date: string, range: RevenueRange): string => {
  const normalized = date.slice(0, 10);
  if (range === 'daily') {
    return normalized;
  }
  if (range === 'monthly') {
    return normalized.slice(0, 7);
  }
  return normalized.slice(0, 4);
};

const toPeriodLabel = (periodKey: string, range: RevenueRange): string => {
  if (range === 'daily') {
    return periodKey;
  }
  if (range === 'monthly') {
    const [year, month] = periodKey.split('-').map((value) => Number(value));
    if (!year || !month) {
      return periodKey;
    }
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return periodKey;
};

const isExpenseCogs = (expense: FinanceExpense): boolean => {
  const code = expense.category?.code?.toLowerCase() ?? '';
  const name = expense.category?.name?.toLowerCase() ?? '';
  if (expense.linked_stock_movement) {
    return true;
  }
  return code.includes('cogs')
    || code.includes('cost_of_goods')
    || code.includes('ingredient')
    || code.includes('inventory')
    || code.includes('stock')
    || name.includes('cogs')
    || name.includes('cost of goods')
    || name.includes('ingredient')
    || name.includes('inventory')
    || name.includes('stock');
};
const INVOICE_PAGE_SIZE = 200;
const EXPENSE_PAGE_SIZE = 200;

const AdminFinanceDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currency = user?.restaurant?.currency ?? 'USD';

  const [range, setRange] = useState<RevenueRange>('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinanceInvoiceStatus | ''>('');
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [chartMetrics, setChartMetrics] = useState<Record<MetricKey, number[]>>({
    revenue: [],
    totalCosts: [],
    netProfit: [],
    cogs: [],
    operatingExpenses: [],
    payroll: [],
  });
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(DEFAULT_SELECTED_METRICS);
  const [showDetailedCosts, setShowDetailedCosts] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalInvoicesInRange, setTotalInvoicesInRange] = useState(0);
  const [payrollTotals, setPayrollTotals] = useState<PayrollSummaryTotals>(emptyPayrollTotals);
  const [pnlSummary, setPnlSummary] = useState<FinanceProfitAndLossSummary>(emptyPnl);
  const [taxSummary, setTaxSummary] = useState<FinanceTaxSummary>(emptyTax);
  const [payrollPeriodCount, setPayrollPeriodCount] = useState(0);
  const [scheduledShiftsCount, setScheduledShiftsCount] = useState(0);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSavingInvoiceId, setStatusSavingInvoiceId] = useState<number | null>(null);

  const [newInvoiceDate, setNewInvoiceDate] = useState(todayDate());
  const [newInvoiceStatus, setNewInvoiceStatus] = useState<FinanceInvoiceStatus>('issued');
  const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
  const [newInvoiceItems, setNewInvoiceItems] = useState<DraftInvoiceItem[]>([
    { name: '', quantity: '1', unit_price: '' },
  ]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setOperationsLoading(true);
    setError(null);

    const dateRangeError = validateFinanceDateRange(dateFrom, dateTo);
    if (dateRangeError) {
      setError(dateRangeError);
      setLoading(false);
      setOperationsLoading(false);
      return;
    }

    try {
      const fetchAllInvoices = async (): Promise<FinanceInvoice[]> => {
        const firstPage = await fetchInvoices({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          status: statusFilter || undefined,
          per_page: INVOICE_PAGE_SIZE,
          page: 1,
        });
        const allInvoices = [...firstPage.invoices];
        const lastPage = Math.max(1, firstPage.meta?.last_page || 1);
        if (lastPage > 1) {
          const remainingPages = await Promise.all(
            Array.from({ length: lastPage - 1 }, (_, index) => fetchInvoices({
              date_from: dateFrom || undefined,
              date_to: dateTo || undefined,
              status: statusFilter || undefined,
              per_page: INVOICE_PAGE_SIZE,
              page: index + 2,
            }))
          );
          remainingPages.forEach((pageResult) => allInvoices.push(...pageResult.invoices));
        }
        return allInvoices;
      };

      const fetchAllExpenses = async (): Promise<FinanceExpense[]> => {
        const firstPage = await fetchExpenses({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          per_page: EXPENSE_PAGE_SIZE,
          page: 1,
        });
        const allExpenses = [...firstPage.expenses];
        const lastPage = Math.max(1, firstPage.meta?.last_page || 1);
        if (lastPage > 1) {
          const remainingPages = await Promise.all(
            Array.from({ length: lastPage - 1 }, (_, index) => fetchExpenses({
              date_from: dateFrom || undefined,
              date_to: dateTo || undefined,
              per_page: EXPENSE_PAGE_SIZE,
              page: index + 2,
            }))
          );
          remainingPages.forEach((pageResult) => allExpenses.push(...pageResult.expenses));
        }
        return allExpenses;
      };

      const [allInvoices, allExpenses] = await Promise.all([fetchAllInvoices(), fetchAllExpenses()]);

      setInvoices(sortFinanceInvoicesNewestFirst(allInvoices));

      const [payrollSummaryResult, payrollPeriodsResult, shiftsResult, taxResult] = await Promise.allSettled([
        fetchPayrollSummary({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          period_status: 'approved_paid',
        }),
        fetchPayrollPeriods(),
        fetchStaffSchedules({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        fetchTaxSummary({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      ]);

      const payrollPeriods = payrollPeriodsResult.status === 'fulfilled' ? payrollPeriodsResult.value : [];
      const allPeriods = new Set<string>();
      const metricsByPeriod = new Map<string, Record<MetricKey, number>>();

      const ensurePeriod = (periodKey: string) => {
        if (!metricsByPeriod.has(periodKey)) {
          metricsByPeriod.set(periodKey, {
            revenue: 0,
            totalCosts: 0,
            netProfit: 0,
            cogs: 0,
            operatingExpenses: 0,
            payroll: 0,
          });
        }
        allPeriods.add(periodKey);
        return metricsByPeriod.get(periodKey)!;
      };

      let invoiceCount = 0;
      for (const invoice of allInvoices) {
        if (!VALID_REVENUE_STATUSES.includes(invoice.status) || !invoice.invoice_date) {
          continue;
        }
        const periodKey = toPeriodKey(invoice.invoice_date, range);
        const bucket = ensurePeriod(periodKey);
        bucket.revenue += Number(invoice.total ?? 0);
        invoiceCount += 1;
      }

      for (const expense of allExpenses) {
        if (!INCLUDED_EXPENSE_STATUSES.has(expense.status) || !isValidDateWithinRange(expense.expense_date, dateFrom, dateTo)) {
          continue;
        }
        const periodKey = toPeriodKey(expense.expense_date, range);
        const bucket = ensurePeriod(periodKey);
        const expenseAmount = (expense.total_cents ?? 0) / 100;
        if (isExpenseCogs(expense)) {
          bucket.cogs += expenseAmount;
        } else {
          bucket.operatingExpenses += expenseAmount;
        }
      }

      for (const period of payrollPeriods) {
        if (!INCLUDED_PAYROLL_STATUSES.has(period.status)) {
          continue;
        }
        const payrollDate = (period.paid_at || period.period_end || '').slice(0, 10);
        if (!isValidDateWithinRange(payrollDate, dateFrom, dateTo)) {
          continue;
        }
        const periodKey = toPeriodKey(payrollDate, range);
        const bucket = ensurePeriod(periodKey);
        const finalSalary = Number(period.final_salary ?? period.totals.net_pay ?? 0);
        bucket.payroll += finalSalary;
      }

      const orderedPeriodKeys = [...allPeriods].sort();
      const labels = orderedPeriodKeys.map((periodKey) => toPeriodLabel(periodKey, range));
      const nextMetrics: Record<MetricKey, number[]> = {
        revenue: [],
        totalCosts: [],
        netProfit: [],
        cogs: [],
        operatingExpenses: [],
        payroll: [],
      };

      let nextRevenue = 0;
      let nextCogs = 0;
      let nextOperating = 0;
      let nextPayroll = 0;

      orderedPeriodKeys.forEach((periodKey) => {
        const bucket = metricsByPeriod.get(periodKey)!;
        const totalCosts = bucket.cogs + bucket.operatingExpenses + bucket.payroll;
        const netProfit = bucket.revenue - totalCosts;
        nextMetrics.revenue.push(bucket.revenue);
        nextMetrics.cogs.push(bucket.cogs);
        nextMetrics.operatingExpenses.push(bucket.operatingExpenses);
        nextMetrics.payroll.push(bucket.payroll);
        nextMetrics.totalCosts.push(totalCosts);
        nextMetrics.netProfit.push(netProfit);
        nextRevenue += bucket.revenue;
        nextCogs += bucket.cogs;
        nextOperating += bucket.operatingExpenses;
        nextPayroll += bucket.payroll;
      });

      setChartLabels(labels);
      setChartMetrics(nextMetrics);
      setTotalRevenue(nextRevenue);
      setTotalInvoicesInRange(invoiceCount);
      setPnlSummary({
        date_from: dateFrom,
        date_to: dateTo,
        group_by: range,
        revenue: nextRevenue,
        cogs: nextCogs,
        gross_profit: nextRevenue - nextCogs,
        operating_expenses: nextOperating + nextPayroll,
        net_profit: nextRevenue - (nextCogs + nextOperating + nextPayroll),
      });

      if (payrollSummaryResult.status === 'fulfilled') {
        setPayrollTotals(payrollSummaryResult.value.totals);
      } else {
        setPayrollTotals(emptyPayrollTotals());
      }

      if (payrollPeriodsResult.status === 'fulfilled') {
        setPayrollPeriodCount(payrollPeriodsResult.value.length);
      } else {
        setPayrollPeriodCount(0);
      }

      if (shiftsResult.status === 'fulfilled') {
        setScheduledShiftsCount(shiftsResult.value.filter((shift) => shift.status === 'scheduled').length);
      } else {
        setScheduledShiftsCount(0);
      }

      if (taxResult.status === 'fulfilled') {
        setTaxSummary(taxResult.value);
      } else {
        setTaxSummary(emptyTax());
      }
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load finance dashboard data.'));
    } finally {
      setOperationsLoading(false);
      setLoading(false);
    }
  }, [dateFrom, dateTo, range, statusFilter]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const chartData = useMemo<ChartData<'bar'>>(() => ({
    labels: chartLabels,
    datasets: selectedMetrics.map((metric) => {
      const palette: Record<MetricKey, { bg: string; border: string }> = {
        revenue: { bg: 'rgba(201, 162, 90, 0.8)', border: 'rgba(233, 203, 147, 0.96)' },
        totalCosts: { bg: 'rgba(188, 132, 86, 0.78)', border: 'rgba(226, 171, 119, 0.95)' },
        netProfit: { bg: 'rgba(122, 156, 115, 0.34)', border: 'rgba(164, 201, 152, 0.94)' },
        cogs: { bg: 'rgba(170, 121, 73, 0.76)', border: 'rgba(207, 163, 114, 0.94)' },
        operatingExpenses: { bg: 'rgba(143, 122, 102, 0.74)', border: 'rgba(189, 163, 138, 0.94)' },
        payroll: { bg: 'rgba(144, 113, 91, 0.72)', border: 'rgba(188, 152, 126, 0.94)' },
      };
      const isNetProfit = metric === 'netProfit';
      return {
        type: 'bar' as const,
        label: metricLabels[metric],
        data: chartMetrics[metric],
        backgroundColor: palette[metric].bg,
        borderColor: palette[metric].border,
        borderWidth: isNetProfit ? 2.4 : 1.4,
        borderRadius: isNetProfit ? 14 : 12,
        borderSkipped: false as const,
        barPercentage: isNetProfit ? 0.48 : 0.7,
        categoryPercentage: 0.68,
        hoverBackgroundColor: palette[metric].border,
        hoverBorderColor: '#fff4d6',
      };
    }),
  }), [chartLabels, chartMetrics, selectedMetrics]);

  const chartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: 'rgba(205, 168, 109, 0.98)',
          boxWidth: 12,
          boxHeight: 12,
          borderRadius: 4,
          useBorderRadius: true,
          padding: 16,
          font: {
            size: 11,
            weight: 600,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(36, 31, 24, 0.92)',
        borderColor: 'rgba(216, 180, 120, 0.42)',
        borderWidth: 1,
        titleColor: '#f2d8a1',
        bodyColor: '#fff7e8',
        cornerRadius: 10,
        padding: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatPriceWithCurrency(Number(context.parsed.y ?? 0), currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(213, 179, 120, 0.07)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(206, 168, 106, 0.9)',
          font: {
            family: 'Cormorant Garamond, serif',
            size: 13,
            weight: 600,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(213, 179, 120, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(206, 168, 106, 0.9)',
          font: {
            family: 'Cormorant Garamond, serif',
            size: 12,
            weight: 600,
          },
          callback: (value) => formatPriceWithCurrency(Number(value), currency),
        },
      },
    },
  }), [currency]);

  const chartHasData = useMemo(
    () => chartLabels.length > 0 && selectedMetrics.some((metric) => chartMetrics[metric].some((value) => value !== 0)),
    [chartLabels, chartMetrics, selectedMetrics]
  );

  const toggleMetric = (metric: MetricKey) => {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== metric);
      }
      return [...current, metric];
    });
  };

  const draftInvoiceTotal = useMemo(() => newInvoiceItems.reduce((sum, item) => {
    const quantity = parsePositiveNumber(item.quantity);
    const unitPrice = parseNonNegativeNumber(item.unit_price);
    if (quantity === null || unitPrice === null) {
      return sum;
    }
    return sum + (quantity * unitPrice);
  }, 0), [newInvoiceItems]);

  const addInvoiceItemRow = () => {
    setNewInvoiceItems((previous) => [...previous, { name: '', quantity: '1', unit_price: '' }]);
  };

  const removeInvoiceItemRow = (index: number) => {
    setNewInvoiceItems((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const updateInvoiceItemRow = (index: number, field: keyof DraftInvoiceItem, value: string) => {
    setNewInvoiceItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, [field]: value }
        : item
    )));
  };

  const handleCreateInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const normalizedItems: CreateInvoiceItemInput[] = [];
    for (const [index, item] of newInvoiceItems.entries()) {
      const name = item.name.trim();
      const quantity = parsePositiveNumber(item.quantity);
      const unitPrice = parseNonNegativeNumber(item.unit_price);

      if (name === '' || quantity === null || unitPrice === null) {
        setCreateError(`Please complete item ${index + 1} with valid name, quantity, and unit price.`);
        return;
      }

      normalizedItems.push({
        name,
        quantity,
        unit_price: unitPrice,
      });
    }

    if (normalizedItems.length === 0) {
      setCreateError('Please add at least one invoice item.');
      return;
    }

    setCreatingInvoice(true);

    try {
      await createInvoice({
        invoice_date: newInvoiceDate,
        status: newInvoiceStatus,
        notes: newInvoiceNotes.trim() || undefined,
        items: normalizedItems,
      });

      setCreateSuccess('Invoice created successfully.');
      setNewInvoiceNotes('');
      setNewInvoiceItems([{ name: '', quantity: '1', unit_price: '' }]);
      await loadDashboardData();
    } catch (createInvoiceError: unknown) {
      setCreateError(getErrorMessage(createInvoiceError, 'Failed to create invoice.'));
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleStatusUpdate = async (invoiceId: number, status: FinanceInvoiceStatus) => {
    setStatusSavingInvoiceId(invoiceId);
    setError(null);

    try {
      const updatedInvoice = await updateInvoice(invoiceId, { status });
      setInvoices((previous) => sortFinanceInvoicesNewestFirst(previous.map((invoice) => (
        invoice.id === updatedInvoice.id ? updatedInvoice : invoice
      ))));

      await loadDashboardData();
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update invoice status.'));
    } finally {
      setStatusSavingInvoiceId(null);
    }
  };

  const handleDownloadFinanceReport = () => {
    const csv = buildFinanceReportCsv({
      currency,
      dateFrom,
      dateTo,
      pnl: pnlSummary,
      tax: taxSummary,
      payroll: payrollTotals,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `finance-report-${dateFrom || 'all'}-${dateTo || 'all'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(objectUrl);
  };

  return (
    <DashboardLayout title="Finance Dashboard">
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[26px] border border-stroke bg-gradient-to-r from-bg1/70 via-bg1/55 to-bg1/68 p-6 shadow-lux2"
        >
          <div className="absolute -top-16 right-8 h-56 w-56 rounded-full bg-gold/8 blur-[70px]" />
          <div className="absolute -bottom-12 left-4 h-40 w-40 rounded-full bg-gold2/8 blur-[64px]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-gold2/85">Revenue Intelligence</p>
              <h2 className="mt-2 text-3xl font-semibold text-text sm:text-4xl">
                Luxury Financial Overview
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted">
                Track revenue momentum and manage invoice lifecycle from one elegant control panel.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-gold/25 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Revenue</p>
                <p className="mt-1 text-xl font-semibold text-text">{formatPriceWithCurrency(totalRevenue, currency)}</p>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Invoices In Range</p>
                <p className="mt-1 text-xl font-semibold text-text">{totalInvoicesInRange}</p>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Net Payroll</p>
                <p className="mt-1 text-xl font-semibold text-text">{formatPriceWithCurrency(payrollTotals.net_pay, currency)}</p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.06 }}
          className="space-y-5"
        >
          <GlassCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Financial Performance</p>
                <h3 className="mt-1 text-xl font-semibold text-text">Daily, Monthly, Yearly</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stroke bg-bg1/70 p-1">
                {(['daily', 'monthly', 'yearly'] as RevenueRange[]).map((candidateRange) => (
                  <button
                    key={candidateRange}
                    type="button"
                    onClick={() => setRange(candidateRange)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      range === candidateRange
                        ? 'bg-gold/85 text-bg0 shadow-[0_12px_30px_rgba(215,180,106,0.34)]'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    {candidateRange}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(['revenue', 'totalCosts', 'netProfit'] as MetricKey[]).map((metric) => (
                <label key={metric} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stroke bg-bg1/55 px-3 py-1.5 text-xs text-text">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(metric)}
                    onChange={() => toggleMetric(metric)}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                  {metricLabels[metric]}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setShowDetailedCosts((current) => !current)}
                className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 transition hover:bg-gold/20"
              >
                {showDetailedCosts ? 'Hide Cost Details' : 'Show Cost Details'}
              </button>
            </div>
            {showDetailedCosts ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(['cogs', 'operatingExpenses', 'payroll'] as MetricKey[]).map((metric) => (
                  <label key={metric} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stroke bg-bg1/55 px-3 py-1.5 text-xs text-text">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric)}
                      onChange={() => toggleMetric(metric)}
                      className="h-3.5 w-3.5 accent-gold"
                    />
                    {metricLabels[metric]}
                  </label>
                ))}
              </div>
            ) : null}

            <div className="h-[320px] w-full rounded-2xl border border-gold/20 bg-gradient-to-b from-[#fff9ed]/45 via-bg1/35 to-bg1/45 p-3 shadow-[inset_0_1px_0_rgba(255,245,220,0.35)]">
              {chartHasData ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-stroke/70 bg-bg1/35 px-4 text-center text-sm text-muted">
                  No finance data found for the selected period.
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-text">Filters</h3>
              <p className="mt-1 text-sm text-muted">Refine records by invoice date and status.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4 md:items-end">
              <label className="block md:col-span-1">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Date From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                />
              </label>

              <label className="block md:col-span-1">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Date To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                />
              </label>

              <label className="block md:col-span-1">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as FinanceInvoiceStatus | '')}
                  className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm outline-none transition focus:border-gold/60"
                >
                  <option value="">All statuses</option>
                  {INVOICE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <LiquidButton
                type="button"
                tone="tertiary"
                className="w-full md:col-span-1"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setStatusFilter('');
                }}
              >
                Clear Filters
              </LiquidButton>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text">Operations Snapshot</h3>
                <p className="mt-1 text-sm text-muted">Payroll and staffing metrics for the selected date range.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LiquidButton type="button" tone="tertiary" onClick={() => navigate('/admin/finance/expenses')}>
                  Open Expenses
                </LiquidButton>
                <LiquidButton type="button" tone="tertiary" onClick={() => navigate('/admin/finance/payroll')}>
                  Open Payroll
                </LiquidButton>
                <LiquidButton type="button" tone="tertiary" onClick={() => navigate('/admin/staff/scheduling')}>
                  Open Schedule
                </LiquidButton>
                <LiquidButton type="button" tone="tertiary" onClick={() => void loadDashboardData()} disabled={operationsLoading}>
                  {operationsLoading ? 'Refreshing...' : 'Refresh Snapshot'}
                </LiquidButton>
                <LiquidButton type="button" tone="tertiary" onClick={handleDownloadFinanceReport}>
                  Download Finance CSV
                </LiquidButton>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Gross Payroll</p>
                <p className="mt-1 text-base font-semibold text-text">{formatPriceWithCurrency(payrollTotals.gross_pay, currency)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Employees Paid</p>
                <p className="mt-1 text-base font-semibold text-text">{payrollTotals.employee_count}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Payroll Periods</p>
                <p className="mt-1 text-base font-semibold text-text">{payrollPeriodCount}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Scheduled Shifts</p>
                <p className="mt-1 text-base font-semibold text-text">{scheduledShiftsCount}</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <GlassCard>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-text">Profit &amp; Loss</h3>
                <p className="mt-1 text-sm text-muted">Period performance by revenue, costs, and net outcome.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Revenue</p>
                  <p className="mt-1 text-base font-semibold text-text">{formatPriceWithCurrency(pnlSummary.revenue, currency)}</p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">COGS</p>
                  <p className="mt-1 text-base font-semibold text-text">{formatPriceWithCurrency(pnlSummary.cogs, currency)}</p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Gross Profit</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {formatPriceWithCurrency(pnlSummary.gross_profit, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Operating Expenses</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {formatPriceWithCurrency(pnlSummary.operating_expenses, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Payroll</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {formatPriceWithCurrency(
                      chartMetrics.payroll.reduce((sum, value) => sum + value, 0),
                      currency
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-gold/35 bg-gold/8 px-4 py-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Net Profit</p>
                  <p className="mt-1 text-lg font-semibold text-text">{formatPriceWithCurrency(pnlSummary.net_profit, currency)}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-text">Tax Summary</h3>
                <p className="mt-1 text-sm text-muted">VAT position based on current filter date range.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Taxable Sales</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {formatPriceWithCurrency(taxSummary.taxable_sales, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Output VAT</p>
                  <p className="mt-1 text-base font-semibold text-text">{formatPriceWithCurrency(taxSummary.output_vat, currency)}</p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Input VAT</p>
                  <p className="mt-1 text-base font-semibold text-text">{formatPriceWithCurrency(taxSummary.input_vat, currency)}</p>
                </div>
                <div className="rounded-2xl border border-gold/35 bg-gold/8 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Net VAT Payable</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {formatPriceWithCurrency(taxSummary.net_vat_payable, currency)}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
          className="grid gap-5 xl:grid-cols-3"
        >
          <GlassCard className="xl:col-span-1">
            <h3 className="text-lg font-semibold text-text">Create Invoice</h3>
            <p className="mt-1 text-sm text-muted">Add line items and publish instantly to the dashboard table.</p>

            <form className="mt-4 space-y-4" onSubmit={handleCreateInvoice}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Invoice Date</span>
                <input
                  type="date"
                  value={newInvoiceDate}
                  onChange={(event) => setNewInvoiceDate(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Status</span>
                <select
                  value={newInvoiceStatus}
                  onChange={(event) => setNewInvoiceStatus(event.target.value as FinanceInvoiceStatus)}
                  className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm outline-none transition focus:border-gold/60"
                >
                  {INVOICE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Notes</span>
                <textarea
                  value={newInvoiceNotes}
                  onChange={(event) => setNewInvoiceNotes(event.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  placeholder="Optional notes for your accounting team"
                />
              </label>

              <div className="space-y-3">
                {newInvoiceItems.map((item, index) => (
                  <div key={`draft-item-${index + 1}`} className="rounded-2xl border border-stroke bg-bg1/55 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Item {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeInvoiceItemRow(index)}
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-spicy transition hover:text-spicy/80"
                        disabled={newInvoiceItems.length <= 1}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) => updateInvoiceItemRow(index, 'name', event.target.value)}
                        placeholder="Item name"
                        className="w-full rounded-xl border border-stroke bg-bg1/70 px-3 py-2 text-sm text-text outline-none transition focus:border-gold/60"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(event) => updateInvoiceItemRow(index, 'quantity', event.target.value)}
                          placeholder="Qty"
                          className="w-full rounded-xl border border-stroke bg-bg1/70 px-3 py-2 text-sm text-text outline-none transition focus:border-gold/60"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) => updateInvoiceItemRow(index, 'unit_price', event.target.value)}
                          placeholder="Unit price"
                          className="w-full rounded-xl border border-stroke bg-bg1/70 px-3 py-2 text-sm text-text outline-none transition focus:border-gold/60"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addInvoiceItemRow}
                  className="rounded-full border border-gold/40 bg-gold/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 transition hover:bg-gold/20"
                >
                  Add Item
                </button>
                <p className="text-sm font-semibold text-text">
                  {formatPriceWithCurrency(draftInvoiceTotal, currency)}
                </p>
              </div>

              {createError ? (
                <div className="rounded-xl2 border border-spicy/50 bg-spicy/12 px-3 py-2 text-sm text-spicy">{createError}</div>
              ) : null}

              {createSuccess ? (
                <div className="rounded-xl2 border border-sage/50 bg-sage/12 px-3 py-2 text-sm text-sage">{createSuccess}</div>
              ) : null}

              <LiquidButton type="submit" className="w-full" disabled={creatingInvoice}>
                {creatingInvoice ? 'Creating...' : 'Create Invoice'}
              </LiquidButton>
            </form>
          </GlassCard>

          <GlassCard className="xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text">Invoice Records</h3>
                <p className="mt-1 text-sm text-muted">
                  {invoices.length} invoice{invoices.length === 1 ? '' : 's'} in current filter range.
                </p>
              </div>
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadDashboardData()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </LiquidButton>
            </div>

            {loading ? (
              <div className="py-14 text-center text-muted">Loading finance records...</div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-stroke">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-bg1/90 text-xs uppercase tracking-[0.14em] text-gold2/85">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-muted" colSpan={5}>
                          No invoices found for the current filters.
                        </td>
                      </tr>
                    ) : invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="cursor-pointer border-t border-stroke/70 bg-bg1/45 transition hover:bg-bg1/62"
                        onClick={() => navigate(`/admin/finance/invoices/${invoice.id}`)}
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-text">{invoice.invoice_number}</p>
                          {invoice.notes ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted">{invoice.notes}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-muted">{invoice.invoice_date}</td>
                        <td className="px-4 py-4 text-muted">
                          {invoice.items.length} item{invoice.items.length === 1 ? '' : 's'}
                        </td>
                        <td className="px-4 py-4 font-semibold text-text">
                          {formatPriceWithCurrency(Number(invoice.total), currency)}
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={invoice.status}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              event.stopPropagation();
                              const nextStatus = event.target.value as FinanceInvoiceStatus;
                              void handleStatusUpdate(invoice.id, nextStatus);
                            }}
                            disabled={statusSavingInvoiceId === invoice.id}
                            className="themed-native-select rounded-full border border-gold/35 bg-bg1/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 outline-none transition focus:border-gold disabled:opacity-60"
                          >
                            {INVOICE_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: 'easeOut', delay: 0.12 }}
        >
          <GlassCard className="border-gold/15 bg-gradient-to-r from-bg1/82 via-bg1/72 to-bg1/82">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Financial performance reflects revenue (`issued`, `paid`) vs costs (COGS + operating + payroll) to show true profit/loss.
              </p>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/80">
                Total Bars: {chartLabels.length} • Invoices Counted: {totalInvoicesInRange}
              </p>
            </div>
          </GlassCard>
        </motion.section>

        {error ? (
          <div className="rounded-xl2 border border-spicy/50 bg-spicy/12 px-4 py-3 text-sm text-spicy">{error}</div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceDashboardPage;
