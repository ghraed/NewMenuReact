import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarElement,
  CategoryScale,
  LineElement,
  PointElement,
  LineController,
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import PageSkeleton from '../components/Common/PageSkeleton';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
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
  CurrencyCode,
  FinanceInvoice,
  FinanceInvoiceStatus,
  FinanceProfitAndLossSummary,
  FinanceExpense,
  FinanceTaxSummary,
  PayrollSummaryTotals,
} from '../types';
import {
  convertPriceFromUsdToCurrency,
  convertPriceToUsd,
  formatPriceWithCurrency,
  normalizeCurrency,
  CURRENCY_OPTIONS,
  readGuestCurrencySettings,
} from '../utils/currency';
import { validateFinanceDateRange } from '../utils/financeReporting';
import { downloadFinanceExecutiveWorkbook } from '../utils/financeReportWorkbook';
import {
  buildOperationalLossDashboardReport,
  type OperationalLossDashboardReport,
} from '../utils/financeAdjustmentMeta';
import {
  ADJUSTMENT_ACTION_LABELS,
  OPERATIONAL_LOSS_CATEGORY_LABELS,
} from '../utils/orderItemCompensation';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, LineController, Tooltip, Legend);

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

const emptyOperationalLossReport = (): OperationalLossDashboardReport => ({
  totalAdjustmentCost: 0,
  issueRefundCost: 0,
  complimentaryGiftCost: 0,
  serviceRecoveryCost: 0,
  dailyLosses: [],
  weeklyLosses: [],
  monthlyLosses: [],
  byCategory: [],
  byAction: [],
  approvers: [],
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
const parsePositiveRate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

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
const VALID_REVENUE_STATUSES: FinanceInvoiceStatus[] = ['draft', 'issued', 'paid'];
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

const formatFinanceCurrencyValue = (amount: number, currency: CurrencyCode): string => {
  if (currency === 'AED') {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const money = safeAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${money} AED`;
  }
  return formatPriceWithCurrency(amount, currency);
};

const financeCurrencyBadge = (code: CurrencyCode): string => {
  if (code === 'AED') {
    return 'AED';
  }
  const symbol = CURRENCY_OPTIONS.find((option) => option.value === code)?.symbol ?? code;
  return `${symbol} ${code}`;
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

const normalizeInvoiceStatusValue = (status: unknown): FinanceInvoiceStatus | null => {
  if (typeof status !== 'string') {
    return null;
  }
  const normalized = status.trim().toLowerCase();
  if (
    normalized === 'draft'
    || normalized === 'issued'
    || normalized === 'paid'
    || normalized === 'cancelled'
  ) {
    return normalized as FinanceInvoiceStatus;
  }
  return null;
};

const INVOICE_PAGE_SIZE = 200;
const EXPENSE_PAGE_SIZE = 200;

const AnimatedCurrencyValue: React.FC<{
  value: number;
  currency: CurrencyCode;
  className?: string;
}> = ({ value, currency, className }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-12% 0px -12% 0px' });
  const [progress, setProgress] = useState(0);

  const targetText = useMemo(
    () => formatFinanceCurrencyValue(Number.isFinite(value) ? value : 0, currency),
    [value, currency]
  );

  const animatedText = useMemo(() => {
    const eased = 0.5 - (Math.cos(Math.PI * progress) / 2);

    return targetText
      .split('')
      .map((char) => {
        if (!/[0-9]/.test(char)) {
          return char;
        }
        const targetDigit = Number(char);
        const nextDigit = Math.floor(targetDigit * eased);
        return String(Math.min(targetDigit, Math.max(0, nextDigit)));
      })
      .join('');
  }, [targetText, progress]);

  useEffect(() => {
    if (!isInView) {
      return;
    }

    const durationMs = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const nextProgress = Math.min(1, elapsed / durationMs);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [isInView, targetText]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ y: value < 0 ? -16 : 16, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : undefined}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
    >
      {animatedText}
    </motion.span>
  );
};

const AnimatedIntegerValue: React.FC<{
  value: number;
  className?: string;
}> = ({ value, className }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-12% 0px -12% 0px' });
  const [progress, setProgress] = useState(0);

  const targetText = useMemo(
    () => Math.max(0, Math.round(Number.isFinite(value) ? value : 0)).toLocaleString(),
    [value]
  );

  const animatedText = useMemo(() => {
    const eased = 0.5 - (Math.cos(Math.PI * progress) / 2);
    return targetText
      .split('')
      .map((char) => {
        if (!/[0-9]/.test(char)) {
          return char;
        }
        const targetDigit = Number(char);
        const nextDigit = Math.floor(targetDigit * eased);
        return String(Math.min(targetDigit, Math.max(0, nextDigit)));
      })
      .join('');
  }, [targetText, progress]);

  useEffect(() => {
    if (!isInView) {
      return;
    }
    const durationMs = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const nextProgress = Math.min(1, elapsed / durationMs);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, [isInView, targetText]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ y: 12, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : undefined}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
    >
      {animatedText}
    </motion.span>
  );
};

const AdminFinanceDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const storedCurrencySettings = readGuestCurrencySettings();
  const initialBaseCurrency = normalizeCurrency(storedCurrencySettings?.currency || user?.restaurant?.currency || 'USD');
  const initialOtherCurrency = normalizeCurrency(
    storedCurrencySettings?.other_currency
    || user?.restaurant?.other_currency
    || (initialBaseCurrency === 'USD' ? 'EUR' : 'USD')
  );
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(initialBaseCurrency);
  const [otherCurrency, setOtherCurrency] = useState<CurrencyCode>(
    initialOtherCurrency === initialBaseCurrency ? (initialBaseCurrency === 'USD' ? 'EUR' : 'USD') : initialOtherCurrency
  );
  const [currency, setCurrency] = useState<CurrencyCode>(initialBaseCurrency);
  const [dollarRate, setDollarRate] = useState<number>(() => (
    parsePositiveRate(user?.restaurant?.dollar_rate) ?? 1
  ));

  const [range, setRange] = useState<RevenueRange>('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinanceInvoiceStatus | ''>('');
  const [invoiceTableRows, setInvoiceTableRows] = useState<FinanceInvoice[]>([]);
  const [invoiceTablePage, setInvoiceTablePage] = useState(1);
  const [invoiceTablePerPage, setInvoiceTablePerPage] = useState(25);
  const [invoiceTableLastPage, setInvoiceTableLastPage] = useState(1);
  const [invoiceTableTotal, setInvoiceTableTotal] = useState(0);
  const [invoiceTableLoading, setInvoiceTableLoading] = useState(false);
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
  const [operationalLossReport, setOperationalLossReport] = useState<OperationalLossDashboardReport>(emptyOperationalLossReport);
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

  useEffect(() => {
    const userRate = parsePositiveRate(user?.restaurant?.dollar_rate);
    if (userRate) {
      setDollarRate(userRate);
    }

    const loadCurrencySettings = async () => {
      try {
        const response = await api.get<{
          currency?: string | null;
          other_currency?: string | null;
          dollar_rate?: number | string | null;
          restaurant?: {
            currency?: string | null;
            other_currency?: string | null;
            dollar_rate?: number | string | null;
          };
        }>('/restaurant/currency-settings');
        const payload = response.data;
        const resolvedBase = normalizeCurrency(payload?.currency || payload?.restaurant?.currency || initialBaseCurrency);
        const resolvedOtherRaw = normalizeCurrency(
          payload?.other_currency
          || payload?.restaurant?.other_currency
          || (resolvedBase === 'USD' ? 'EUR' : 'USD')
        );
        const resolvedOther = resolvedOtherRaw === resolvedBase
          ? (resolvedBase === 'USD' ? 'EUR' : 'USD')
          : resolvedOtherRaw;
        const resolved = parsePositiveRate(payload?.dollar_rate)
          ?? parsePositiveRate(payload?.restaurant?.dollar_rate);
        setBaseCurrency(resolvedBase);
        setOtherCurrency(resolvedOther);
        setCurrency(resolvedBase);
        if (resolved) {
          setDollarRate(resolved);
        }
      } catch {
        const fallbackBase = normalizeCurrency(storedCurrencySettings?.currency || user?.restaurant?.currency || 'USD');
        const fallbackOtherRaw = normalizeCurrency(
          storedCurrencySettings?.other_currency
          || user?.restaurant?.other_currency
          || (fallbackBase === 'USD' ? 'EUR' : 'USD')
        );
        const fallbackOther = fallbackOtherRaw === fallbackBase
          ? (fallbackBase === 'USD' ? 'EUR' : 'USD')
          : fallbackOtherRaw;
        setBaseCurrency(fallbackBase);
        setOtherCurrency(fallbackOther);
        setCurrency(fallbackBase);
      }
    };

    void loadCurrencySettings();
  }, [initialBaseCurrency, storedCurrencySettings?.currency, storedCurrencySettings?.other_currency, user?.restaurant?.currency, user?.restaurant?.dollar_rate, user?.restaurant?.other_currency]);

  const convertFinanceAmount = useCallback((amount: number): number => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    if (currency === baseCurrency) {
      return safeAmount;
    }
    const usdValue = convertPriceToUsd(safeAmount, baseCurrency, dollarRate);
    return convertPriceFromUsdToCurrency(usdValue, currency, dollarRate);
  }, [baseCurrency, currency, dollarRate]);

  const formatFinanceAmount = useCallback((amount: number): string => (
    formatFinanceCurrencyValue(convertFinanceAmount(amount), currency)
  ), [convertFinanceAmount, currency]);

  const latestDailyComplaintLoss = operationalLossReport.dailyLosses[operationalLossReport.dailyLosses.length - 1]?.amount ?? 0;
  const latestWeeklyComplaintLoss = operationalLossReport.weeklyLosses[operationalLossReport.weeklyLosses.length - 1]?.amount ?? 0;
  const latestMonthlyComplaintLoss = operationalLossReport.monthlyLosses[operationalLossReport.monthlyLosses.length - 1]?.amount ?? 0;

  const loadInvoiceTablePage = useCallback(async () => {
    setInvoiceTableLoading(true);
    try {
      const firstPage = await fetchInvoices({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter || undefined,
        per_page: INVOICE_PAGE_SIZE,
        page: 1,
      });

      const allInvoices = [...firstPage.invoices];
      const totalPages = Math.max(1, firstPage.meta.last_page || 1);
      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) => fetchInvoices({
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            status: statusFilter || undefined,
            per_page: INVOICE_PAGE_SIZE,
            page: index + 2,
          }))
        );
        remainingPages.forEach((result) => allInvoices.push(...result.invoices));
      }

      const sortedInvoices = sortFinanceInvoicesNewestFirst(allInvoices);
      const totalInvoices = sortedInvoices.length;
      const computedLastPage = Math.max(1, Math.ceil(totalInvoices / invoiceTablePerPage));
      const safePage = Math.min(invoiceTablePage, computedLastPage);
      const startIndex = (safePage - 1) * invoiceTablePerPage;
      const endIndex = startIndex + invoiceTablePerPage;

      if (safePage !== invoiceTablePage) {
        setInvoiceTablePage(safePage);
      }

      setInvoiceTableRows(sortedInvoices.slice(startIndex, endIndex));
      setInvoiceTableTotal(totalInvoices);
      setInvoiceTableLastPage(computedLastPage);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load invoice table data.'));
    } finally {
      setInvoiceTableLoading(false);
    }
  }, [dateFrom, dateTo, invoiceTablePage, invoiceTablePerPage, statusFilter]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setOperationsLoading(true);
    setError(null);

    const dateRangeError = validateFinanceDateRange(dateFrom, dateTo);
    if (dateRangeError) {
      setError(dateRangeError);
      setOperationalLossReport(emptyOperationalLossReport());
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
      const filteredOperationalLossExpenses = allExpenses.filter((expense) => (
        INCLUDED_EXPENSE_STATUSES.has(expense.status)
        && isValidDateWithinRange(expense.expense_date, dateFrom, dateTo)
      ));
      setOperationalLossReport(buildOperationalLossDashboardReport(filteredOperationalLossExpenses));

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
        const normalizedStatus = normalizeInvoiceStatusValue(invoice.status);
        if (!normalizedStatus || !VALID_REVENUE_STATUSES.includes(normalizedStatus) || !invoice.invoice_date) {
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
      setOperationalLossReport(emptyOperationalLossReport());
    } finally {
      setOperationsLoading(false);
      setLoading(false);
    }
  }, [dateFrom, dateTo, range, statusFilter]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    void loadInvoiceTablePage();
  }, [loadInvoiceTablePage]);

  const chartData = useMemo<ChartData<'bar' | 'line'>>(() => ({
    labels: chartLabels,
    datasets: selectedMetrics.map((metric) => {
      const palette: Record<MetricKey, { bg: string; border: string }> = {
        revenue: { bg: 'rgba(201, 162, 90, 0.78)', border: 'rgba(232, 205, 146, 0.95)' },
        totalCosts: { bg: 'rgba(220, 53, 69, 0.18)', border: 'rgba(220, 53, 69, 0.98)' },
        netProfit: { bg: 'rgba(76, 175, 80, 0.16)', border: 'rgba(76, 175, 80, 0.98)' },
        cogs: { bg: 'rgba(170, 121, 73, 0.74)', border: 'rgba(217, 175, 133, 0.94)' },
        operatingExpenses: { bg: 'rgba(189, 163, 138, 0.72)', border: 'rgba(227, 204, 182, 0.94)' },
        payroll: { bg: 'rgba(164, 201, 152, 0.7)', border: 'rgba(205, 229, 197, 0.95)' },
      };
      const isLineMetric = metric === 'netProfit' || metric === 'totalCosts';
      const baseData = chartMetrics[metric].map((value) => convertFinanceAmount(value));
      if (isLineMetric) {
        return {
          type: 'line' as const,
          order: 1,
          label: metricLabels[metric],
          data: baseData,
          borderColor: palette[metric].border,
          backgroundColor: palette[metric].bg,
          borderWidth: 2.5,
          borderCapStyle: 'butt' as const,
          borderJoinStyle: 'miter' as const,
          pointRadius: 3.5,
          pointHoverRadius: 5,
          pointHitRadius: 8,
          pointStyle: 'circle' as const,
          pointBackgroundColor: palette[metric].border,
          pointBorderColor: palette[metric].border,
          pointBorderWidth: 0,
          tension: 0.35,
          fill: false,
          yAxisID: 'y',
        };
      }
      return {
        type: 'bar' as const,
        order: 2,
        label: metricLabels[metric],
        data: baseData,
        backgroundColor: palette[metric].bg,
        borderColor: palette[metric].border,
        borderWidth: 1.1,
        borderRadius: 8,
        borderSkipped: false as const,
        barPercentage: 0.68,
        categoryPercentage: 0.68,
        hoverBackgroundColor: palette[metric].border,
        hoverBorderColor: '#ffffff',
      };
    }),
  }), [chartLabels, chartMetrics, selectedMetrics, convertFinanceAmount]);

  const chartOptions = useMemo<ChartOptions<'bar' | 'line'>>(() => ({
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
          color: '#525252',
          boxWidth: 11,
          boxHeight: 11,
          borderRadius: 3,
          useBorderRadius: true,
          padding: 14,
          font: {
            size: 11,
            weight: 500,
            family: 'IBM Plex Sans, Segoe UI, sans-serif',
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(38, 38, 38, 0.98)',
        borderColor: 'rgba(82, 87, 92, 0.95)',
        borderWidth: 1,
        titleColor: '#f4f4f4',
        bodyColor: '#f4f4f4',
        cornerRadius: 2,
        padding: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatFinanceCurrencyValue(Number(context.parsed.y ?? 0), currency)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(198, 198, 198, 0.72)',
          drawBorder: false,
        },
        ticks: {
          color: '#525252',
          font: {
            family: 'IBM Plex Sans, Segoe UI, sans-serif',
            size: 12,
            weight: 500,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(224, 224, 224, 0.9)',
          drawBorder: false,
        },
        ticks: {
          color: '#525252',
          font: {
            family: 'IBM Plex Sans, Segoe UI, sans-serif',
            size: 12,
            weight: 500,
          },
          callback: (value) => formatFinanceCurrencyValue(Number(value), currency),
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
      await Promise.all([loadDashboardData(), loadInvoiceTablePage()]);
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
      setInvoiceTableRows((previous) => sortFinanceInvoicesNewestFirst(previous.map((invoice) => (
        invoice.id === updatedInvoice.id ? updatedInvoice : invoice
      ))));

      await loadDashboardData();
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update invoice status.'));
    } finally {
      setStatusSavingInvoiceId(null);
    }
  };

  const handleDownloadFinanceReport = async () => {
    await downloadFinanceExecutiveWorkbook({
      companyName: user?.restaurant?.name ?? 'Executive Finance',
      currency,
      dateFrom,
      dateTo,
      pnl: {
        ...pnlSummary,
        revenue: convertFinanceAmount(pnlSummary.revenue),
        cogs: convertFinanceAmount(pnlSummary.cogs),
        gross_profit: convertFinanceAmount(pnlSummary.gross_profit),
        operating_expenses: convertFinanceAmount(pnlSummary.operating_expenses),
        net_profit: convertFinanceAmount(pnlSummary.net_profit),
      },
      tax: {
        ...taxSummary,
        taxable_sales: convertFinanceAmount(taxSummary.taxable_sales),
        output_vat: convertFinanceAmount(taxSummary.output_vat),
        input_vat: convertFinanceAmount(taxSummary.input_vat),
        net_vat_payable: convertFinanceAmount(taxSummary.net_vat_payable),
      },
      payroll: {
        ...payrollTotals,
        gross_pay: convertFinanceAmount(payrollTotals.gross_pay),
        deductions: convertFinanceAmount(payrollTotals.deductions),
        tax: convertFinanceAmount(payrollTotals.tax),
        net_pay: convertFinanceAmount(payrollTotals.net_pay),
      },
      chartLabels,
      chartMetrics: {
        revenue: chartMetrics.revenue.map((value) => convertFinanceAmount(value)),
        totalCosts: chartMetrics.totalCosts.map((value) => convertFinanceAmount(value)),
        netProfit: chartMetrics.netProfit.map((value) => convertFinanceAmount(value)),
        cogs: chartMetrics.cogs.map((value) => convertFinanceAmount(value)),
        operatingExpenses: chartMetrics.operatingExpenses.map((value) => convertFinanceAmount(value)),
        payroll: chartMetrics.payroll.map((value) => convertFinanceAmount(value)),
      },
    });
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
              <div className="rounded-2xl border border-gold/30 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Currency</p>
                <button
                  type="button"
                  onClick={() => setCurrency((current) => (current === baseCurrency ? otherCurrency : baseCurrency))}
                  className="mt-1 rounded-full border border-gold/70 bg-gold/20 px-3 py-1 text-xs font-semibold text-text transition hover:bg-gold/30"
                  title={`Toggle finance currency between ${baseCurrency} and ${otherCurrency}`}
                >
                  {financeCurrencyBadge(currency)}
                  <span aria-hidden="true" className="mx-1 inline-flex h-5 w-5 items-center justify-center text-lg leading-none">↔</span>
                  {financeCurrencyBadge(currency === baseCurrency ? otherCurrency : baseCurrency)}
                </button>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Revenue</p>
                <p className="mt-1 text-xl font-semibold text-text">
                  <AnimatedCurrencyValue value={convertFinanceAmount(totalRevenue)} currency={currency} />
                </p>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Invoices In Range</p>
                <p className="mt-1 text-xl font-semibold text-text">
                  <AnimatedIntegerValue value={totalInvoicesInRange} />
                </p>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-bg1/65 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Net Payroll</p>
                <p className="mt-1 text-xl font-semibold text-text">
                  <AnimatedCurrencyValue value={convertFinanceAmount(payrollTotals.net_pay)} currency={currency} />
                </p>
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
                <label key={metric} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-stroke bg-bg1/55 px-3 py-1.5 text-xs text-text">
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
                className="rounded-md border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 transition hover:bg-gold/20"
              >
                {showDetailedCosts ? 'Hide Cost Details' : 'Show Cost Details'}
              </button>
            </div>
            {showDetailedCosts ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(['cogs', 'operatingExpenses', 'payroll'] as MetricKey[]).map((metric) => (
                  <label key={metric} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-stroke bg-bg1/55 px-3 py-1.5 text-xs text-text">
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

            <div className="finance-chart-shell h-[320px] w-full rounded-xl border border-gold/20 bg-gradient-to-b from-[#fff9ed]/35 via-bg1/32 to-bg1/45 p-3 shadow-[inset_0_1px_0_rgba(255,245,220,0.26)]">
              {chartHasData ? (
                <Chart type="bar" data={chartData} options={chartOptions} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-stroke/70 bg-bg1/35 px-4 text-center text-sm text-muted">
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
                <button
                  type="button"
                  aria-label={operationsLoading ? 'Refreshing snapshot' : 'Refresh snapshot'}
                  title={operationsLoading ? 'Refreshing snapshot' : 'Refresh snapshot'}
                  onClick={() => void loadDashboardData()}
                  disabled={operationsLoading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Download finance excel"
                  title="Download finance excel"
                  onClick={() => void handleDownloadFinanceReport()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                    <path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Gross Payroll</p>
                <p className="mt-1 text-base font-semibold text-text">
                  <AnimatedCurrencyValue value={convertFinanceAmount(payrollTotals.gross_pay)} currency={currency} />
                </p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Employees Paid</p>
                <p className="mt-1 text-base font-semibold text-text">
                  <AnimatedIntegerValue value={payrollTotals.employee_count} />
                </p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Payroll Periods</p>
                <p className="mt-1 text-base font-semibold text-text">
                  <AnimatedIntegerValue value={payrollPeriodCount} />
                </p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Scheduled Shifts</p>
                <p className="mt-1 text-base font-semibold text-text">
                  <AnimatedIntegerValue value={scheduledShiftsCount} />
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-text">Operational Loss Tracking</h3>
              <p className="mt-1 text-sm text-muted">Backend-synced losses from invoice/order refunds, complimentary gifts, and guest recovery actions.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Internal Loss Total</p>
                <p className="mt-1 text-base font-semibold text-text">{formatFinanceAmount(operationalLossReport.totalAdjustmentCost)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Issue / Refund Cost</p>
                <p className="mt-1 text-base font-semibold text-[#b42318] dark:text-[#ff6b6b]">{formatFinanceAmount(operationalLossReport.issueRefundCost)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Complimentary / Recovery Cost</p>
                <p className="mt-1 text-base font-semibold text-[#067647] dark:text-[#32d583]">{formatFinanceAmount(operationalLossReport.complimentaryGiftCost + operationalLossReport.serviceRecoveryCost)}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Daily Loss</p>
                <p className="mt-1 text-sm font-semibold text-[#b42318] dark:text-[#ff6b6b]">{formatFinanceAmount(latestDailyComplaintLoss)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Weekly Loss</p>
                <p className="mt-1 text-sm font-semibold text-[#b42318] dark:text-[#ff6b6b]">{formatFinanceAmount(latestWeeklyComplaintLoss)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Monthly Loss</p>
                <p className="mt-1 text-sm font-semibold text-[#b42318] dark:text-[#ff6b6b]">{formatFinanceAmount(latestMonthlyComplaintLoss)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted2">Operational Loss Categories</p>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  {operationalLossReport.byCategory.length === 0 ? (
                    <p>No complaint records yet.</p>
                  ) : operationalLossReport.byCategory.slice(0, 5).map((row) => (
                    <p key={row.category} className="flex items-center justify-between">
                      <span className="text-text">{OPERATIONAL_LOSS_CATEGORY_LABELS[row.category]}</span>
                      <span className="text-[#b42318] dark:text-[#ff6b6b]">{formatFinanceAmount(row.amount)}</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted2">Loss Action Types</p>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  {operationalLossReport.byAction.length === 0 ? (
                    <p>No reason data yet.</p>
                  ) : operationalLossReport.byAction.slice(0, 5).map((row) => (
                    <p key={row.action} className="flex items-center justify-between">
                      <span className="text-text">{ADJUSTMENT_ACTION_LABELS[row.action]}</span>
                      <span>{formatFinanceAmount(row.amount)}</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted2">Top Approvals</p>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  {operationalLossReport.approvers.length === 0 ? (
                    <p>No approvals recorded yet.</p>
                  ) : operationalLossReport.approvers.slice(0, 5).map((staff) => (
                    <p key={staff.name} className="flex items-center justify-between">
                      <span className="text-text">{staff.name}</span>
                      <span>{staff.approvals}</span>
                    </p>
                  ))}
                </div>
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
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(pnlSummary.revenue)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">COGS</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(pnlSummary.cogs)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Gross Profit</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(pnlSummary.gross_profit)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Operating Expenses</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(pnlSummary.operating_expenses)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Payroll</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(chartMetrics.payroll.reduce((sum, val) => sum + val, 0))} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-gold/35 bg-gold/8 px-4 py-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Net Profit</p>
                  <p className="mt-1 text-lg font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(pnlSummary.net_profit)} currency={currency} />
                  </p>
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
                    <AnimatedCurrencyValue value={convertFinanceAmount(taxSummary.taxable_sales)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Output VAT</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(taxSummary.output_vat)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Input VAT</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(taxSummary.input_vat)} currency={currency} />
                  </p>
                </div>
                <div className="rounded-2xl border border-gold/35 bg-gold/8 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Net VAT Payable</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    <AnimatedCurrencyValue value={convertFinanceAmount(taxSummary.net_vat_payable)} currency={currency} />
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
                  {formatFinanceAmount(draftInvoiceTotal)}
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
                  {invoiceTableTotal} invoice{invoiceTableTotal === 1 ? '' : 's'} in current filter range.
                </p>
              </div>
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadDashboardData()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </LiquidButton>
            </div>

            {loading ? (
              <PageSkeleton rows={6} columns={1} className="mt-4" loadingText="Loading finance records..." />
            ) : (
              <div className="mt-4 space-y-3">
                <div className="overflow-x-auto rounded-xl border border-stroke">
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
                    {invoiceTableLoading ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-muted" colSpan={5}>
                          Loading invoices...
                        </td>
                      </tr>
                    ) : invoiceTableRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-muted" colSpan={5}>
                          No invoices found for the current filters.
                        </td>
                      </tr>
                    ) : invoiceTableRows.map((invoice) => (
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
                          {formatFinanceAmount(Number(invoice.total))}
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
                            className="themed-native-select rounded-md border border-gold/35 bg-bg1/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 outline-none transition focus:border-gold disabled:opacity-60"
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted">
                    Page {invoiceTablePage} of {invoiceTableLastPage} • {invoiceTableTotal} total
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={String(invoiceTablePerPage)}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        const nextPerPage = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
                        setInvoiceTablePage(1);
                        setInvoiceTablePerPage(nextPerPage);
                      }}
                      className="themed-native-select rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                    >
                      {[25, 50, 100].map((size) => (
                        <option key={size} value={size}>{size} / page</option>
                      ))}
                    </select>
                    <LiquidButton
                      type="button"
                      tone="tertiary"
                      disabled={invoiceTableLoading || invoiceTablePage <= 1}
                      onClick={() => setInvoiceTablePage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      tone="tertiary"
                      disabled={invoiceTableLoading || invoiceTablePage >= invoiceTableLastPage}
                      onClick={() => setInvoiceTablePage((current) => Math.min(invoiceTableLastPage, current + 1))}
                    >
                      Next
                    </LiquidButton>
                  </div>
                </div>
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
                Financial performance reflects revenue (`draft`, `issued`, `paid`) vs costs (COGS + operating + payroll) to show true profit/loss.
              </p>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/80">
                Total Bars: <AnimatedIntegerValue value={chartLabels.length} className="inline-block" /> • Invoices Counted: <AnimatedIntegerValue value={totalInvoicesInRange} className="inline-block" />
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
