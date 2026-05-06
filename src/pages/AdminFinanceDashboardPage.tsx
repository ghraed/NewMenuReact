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
  fetchInvoiceRevenueTrends,
  fetchInvoices,
  updateInvoice,
  type CreateInvoiceItemInput,
} from '../services/invoiceService';
import { fetchProfitAndLossSummary, fetchTaxSummary } from '../services/financeReportingService';
import { fetchPayrollPeriods, fetchPayrollSummary } from '../services/payrollService';
import { fetchStaffSchedules } from '../services/staffScheduleService';
import type {
  FinanceInvoice,
  FinanceInvoiceStatus,
  FinanceProfitAndLossSummary,
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
  const [chartRevenues, setChartRevenues] = useState<number[]>([]);
  const [chartInvoiceCounts, setChartInvoiceCounts] = useState<number[]>([]);
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
      const [invoiceResponse, trendResponse] = await Promise.all([
        fetchInvoices({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          status: statusFilter || undefined,
          per_page: 200,
        }),
        fetchInvoiceRevenueTrends({
          range,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      ]);

      setInvoices(sortFinanceInvoicesNewestFirst(invoiceResponse.invoices));
      setChartLabels(trendResponse.points.map((point) => point.label));
      setChartRevenues(trendResponse.points.map((point) => point.revenue));
      setChartInvoiceCounts(trendResponse.points.map((point) => point.invoice_count));
      setTotalRevenue(trendResponse.totals.revenue);
      setTotalInvoicesInRange(trendResponse.totals.invoice_count);

      const [payrollSummaryResult, payrollPeriodsResult, shiftsResult, pnlResult, taxResult] = await Promise.allSettled([
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
        fetchProfitAndLossSummary({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          group_by: range,
        }),
        fetchTaxSummary({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      ]);

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

      if (pnlResult.status === 'fulfilled') {
        setPnlSummary(pnlResult.value);
      } else {
        setPnlSummary(emptyPnl());
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
    datasets: [
      {
        label: 'Revenue',
        data: chartRevenues,
        backgroundColor: 'rgba(215, 180, 106, 0.82)',
        borderColor: 'rgba(243, 215, 154, 0.98)',
        borderWidth: 1.5,
        borderRadius: 10,
        barPercentage: 0.72,
        categoryPercentage: 0.72,
      },
    ],
  }), [chartLabels, chartRevenues]);

  const chartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(10, 16, 32, 0.92)',
        borderColor: 'rgba(243, 215, 154, 0.3)',
        borderWidth: 1,
        titleColor: '#f3d79a',
        bodyColor: '#ffffff',
        callbacks: {
          label: (context) => ` ${formatPriceWithCurrency(Number(context.parsed.y ?? 0), currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(215, 180, 106, 0.12)',
        },
        ticks: {
          color: 'rgba(243, 215, 154, 0.9)',
          font: {
            weight: 600,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(215, 180, 106, 0.14)',
        },
        ticks: {
          color: 'rgba(243, 215, 154, 0.85)',
          font: {
            weight: 600,
          },
          callback: (value) => formatPriceWithCurrency(Number(value), currency),
        },
      },
    },
  }), [currency]);

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

      const trendResponse = await fetchInvoiceRevenueTrends({
        range,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });

      setChartLabels(trendResponse.points.map((point) => point.label));
      setChartRevenues(trendResponse.points.map((point) => point.revenue));
      setChartInvoiceCounts(trendResponse.points.map((point) => point.invoice_count));
      setTotalRevenue(trendResponse.totals.revenue);
      setTotalInvoicesInRange(trendResponse.totals.invoice_count);
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
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Revenue Trend</p>
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

            <div className="h-[320px] w-full">
              <Bar data={chartData} options={chartOptions} />
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
                Revenue bars reflect non-cancelled finalized invoice states (`issued`, `paid`) for clear operational tracking.
              </p>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/80">
                Total Bars: {chartLabels.length} • Volume: {chartInvoiceCounts.reduce((sum, count) => sum + count, 0)}
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
