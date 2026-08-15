import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchExpenses } from '../services/financeExpenseService';
import { fetchInvoices } from '../services/invoiceService';
import { fetchPayrollPeriods } from '../services/payrollService';
import type { CurrencyCode, FinanceExpense, FinanceInvoice, FinanceInvoiceStatus, PayrollPeriod } from '../types';
import {
  convertPriceFromUsdToCurrency,
  convertPriceToUsd,
  formatPriceWithCurrency,
  normalizeCurrency,
  readGuestCurrencySettings,
} from '../utils/currency';
import { validateFinanceDateRange } from '../utils/financeReporting';
import { buildOperationalLossDashboardReport } from '../utils/financeAdjustmentMeta';

type PeriodGroup = 'daily' | 'monthly' | 'yearly';

type ProfitLossData = {
  invoices: FinanceInvoice[];
  expenses: FinanceExpense[];
  payrollPeriods: PayrollPeriod[];
};

type PeriodRow = {
  key: string;
  label: string;
  revenue: number;
  cogs: number;
  operating: number;
  payroll: number;
  netProfit: number;
};

const INVOICE_PAGE_SIZE = 200;
const EXPENSE_PAGE_SIZE = 200;
const REVENUE_STATUSES = new Set<FinanceInvoiceStatus>(['draft', 'issued', 'paid']);
const INCLUDED_EXPENSE_STATUSES = new Set(['approved', 'paid']);
const INCLUDED_PAYROLL_STATUSES = new Set(['approved', 'paid']);

const isExpenseCogs = (expense: FinanceExpense): boolean => {
  const code = expense.category?.code?.toLowerCase() ?? '';
  const name = expense.category?.name?.toLowerCase() ?? '';

  return Boolean(expense.linked_stock_movement)
    || code.includes('cogs')
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

const isWithinDateRange = (date: string | null | undefined, from: string, to: string): boolean => {
  const normalized = date?.slice(0, 10) ?? '';
  return normalized !== '' && (!from || normalized >= from) && (!to || normalized <= to);
};

const toPeriodKey = (date: string, group: PeriodGroup): string => {
  const normalized = date.slice(0, 10);
  if (group === 'daily') return normalized;
  if (group === 'monthly') return normalized.slice(0, 7);
  return normalized.slice(0, 4);
};

const toPeriodLabel = (periodKey: string, group: PeriodGroup): string => {
  if (group === 'daily' || group === 'yearly') return periodKey;
  const [year, month] = periodKey.split('-').map(Number);
  if (!year || !month) return periodKey;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const normalizeStatus = (value: string | null): FinanceInvoiceStatus | '' => (
  value === 'draft' || value === 'issued' || value === 'paid' || value === 'cancelled' ? value : ''
);

const parseDollarRate = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const AdminFinanceProfitLossPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const storedCurrency = readGuestCurrencySettings()?.currency;
  const baseCurrency = normalizeCurrency(user?.restaurant?.currency || storedCurrency || 'USD');
  const selectedCurrency = normalizeCurrency(searchParams.get('currency') || baseCurrency) as CurrencyCode;
  const dollarRate = parseDollarRate(user?.restaurant?.dollar_rate);
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') ?? '');
  const [status, setStatus] = useState<FinanceInvoiceStatus | ''>(normalizeStatus(searchParams.get('status')));
  const [group, setGroup] = useState<PeriodGroup>(
    searchParams.get('group') === 'daily' ? 'daily' : searchParams.get('group') === 'yearly' ? 'yearly' : 'monthly'
  );
  const [data, setData] = useState<ProfitLossData>({ invoices: [], expenses: [], payrollPeriods: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryKey = searchParams.toString();
  const activeDateFrom = searchParams.get('date_from') ?? '';
  const activeDateTo = searchParams.get('date_to') ?? '';
  const activeStatus = normalizeStatus(searchParams.get('status'));
  const activeGroup: PeriodGroup = searchParams.get('group') === 'daily'
    ? 'daily'
    : searchParams.get('group') === 'yearly'
      ? 'yearly'
      : 'monthly';

  const formatAmount = useCallback((amount: number): string => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    if (selectedCurrency === baseCurrency) return formatPriceWithCurrency(safeAmount, selectedCurrency);
    const usdValue = convertPriceToUsd(safeAmount, baseCurrency, dollarRate);
    return formatPriceWithCurrency(convertPriceFromUsdToCurrency(usdValue, selectedCurrency, dollarRate), selectedCurrency);
  }, [baseCurrency, dollarRate, selectedCurrency]);

  const loadData = useCallback(async () => {
    const invalidRange = validateFinanceDateRange(activeDateFrom, activeDateTo);
    if (invalidRange) {
      setError(invalidRange);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const firstInvoicePage = await fetchInvoices({
        date_from: activeDateFrom || undefined,
        date_to: activeDateTo || undefined,
        status: activeStatus || undefined,
        per_page: INVOICE_PAGE_SIZE,
        page: 1,
      });
      const invoices = [...firstInvoicePage.invoices];
      const invoiceLastPage = Math.max(1, firstInvoicePage.meta?.last_page ?? 1);
      if (invoiceLastPage > 1) {
        const pages = await Promise.all(Array.from({ length: invoiceLastPage - 1 }, (_, index) => fetchInvoices({
          date_from: activeDateFrom || undefined,
          date_to: activeDateTo || undefined,
          status: activeStatus || undefined,
          per_page: INVOICE_PAGE_SIZE,
          page: index + 2,
        })));
        pages.forEach((page) => invoices.push(...page.invoices));
      }

      const firstExpensePage = await fetchExpenses({
        date_from: activeDateFrom || undefined,
        date_to: activeDateTo || undefined,
        per_page: EXPENSE_PAGE_SIZE,
        page: 1,
      });
      const expenses = [...firstExpensePage.expenses];
      const expenseLastPage = Math.max(1, firstExpensePage.meta?.last_page ?? 1);
      if (expenseLastPage > 1) {
        const pages = await Promise.all(Array.from({ length: expenseLastPage - 1 }, (_, index) => fetchExpenses({
          date_from: activeDateFrom || undefined,
          date_to: activeDateTo || undefined,
          per_page: EXPENSE_PAGE_SIZE,
          page: index + 2,
        })));
        pages.forEach((page) => expenses.push(...page.expenses));
      }

      const payrollPeriods = await fetchPayrollPeriods();
      setData({ invoices, expenses, payrollPeriods });
    } catch {
      setError(t('adminProfitLossPage.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [activeDateFrom, activeDateTo, activeStatus, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setDateFrom(activeDateFrom);
    setDateTo(activeDateTo);
    setStatus(activeStatus);
    setGroup(activeGroup);
  }, [activeDateFrom, activeDateTo, activeGroup, activeStatus, queryKey]);

  const report = useMemo(() => {
    const revenueInvoices = data.invoices.filter((invoice) => (
      REVENUE_STATUSES.has(invoice.status) && isWithinDateRange(invoice.invoice_date, activeDateFrom, activeDateTo)
    ));
    const includedExpenses = data.expenses.filter((expense) => (
      INCLUDED_EXPENSE_STATUSES.has(expense.status) && isWithinDateRange(expense.expense_date, activeDateFrom, activeDateTo)
    ));
    const includedPayroll = data.payrollPeriods.filter((period) => {
      const paidDate = (period.paid_at || period.period_end || '').slice(0, 10);
      return INCLUDED_PAYROLL_STATUSES.has(period.status) && isWithinDateRange(paidDate, activeDateFrom, activeDateTo);
    });

    const revenue = revenueInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
    const cogsExpenses = includedExpenses.filter(isExpenseCogs);
    const operatingExpenses = includedExpenses.filter((expense) => !isExpenseCogs(expense));
    const cogs = cogsExpenses.reduce((sum, expense) => sum + Number(expense.total_cents ?? 0) / 100, 0);
    const operating = operatingExpenses.reduce((sum, expense) => sum + Number(expense.total_cents ?? 0) / 100, 0);
    const payroll = includedPayroll.reduce((sum, period) => sum + Number(period.final_salary ?? period.totals?.net_pay ?? 0), 0);
    const operationalLosses = buildOperationalLossDashboardReport(operatingExpenses);
    const complaints = operationalLosses.issueRefundCost;
    const gifts = operationalLosses.complimentaryGiftCost + operationalLosses.serviceRecoveryCost;
    const otherOperating = Math.max(0, operating - complaints - gifts);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - operating - payroll;
    const categoryTotals = new Map<string, { cogs: number; operating: number }>();
    includedExpenses.forEach((expense) => {
      const name = expense.category?.name || t('adminProfitLossPage.uncategorized');
      const current = categoryTotals.get(name) ?? { cogs: 0, operating: 0 };
      const amount = Number(expense.total_cents ?? 0) / 100;
      if (isExpenseCogs(expense)) current.cogs += amount;
      else current.operating += amount;
      categoryTotals.set(name, current);
    });
    const expenseCategories = [...categoryTotals.entries()]
      .map(([name, values]) => ({ name, ...values, total: values.cogs + values.operating }))
      .sort((left, right) => right.total - left.total);

    const periods = new Map<string, PeriodRow>();
    const ensurePeriod = (date: string) => {
      const key = toPeriodKey(date, activeGroup);
      const existing = periods.get(key);
      if (existing) return existing;
      const next = { key, label: toPeriodLabel(key, activeGroup), revenue: 0, cogs: 0, operating: 0, payroll: 0, netProfit: 0 };
      periods.set(key, next);
      return next;
    };
    revenueInvoices.forEach((invoice) => { if (invoice.invoice_date) ensurePeriod(invoice.invoice_date).revenue += Number(invoice.total ?? 0); });
    cogsExpenses.forEach((expense) => ensurePeriod(expense.expense_date).cogs += Number(expense.total_cents ?? 0) / 100);
    operatingExpenses.forEach((expense) => ensurePeriod(expense.expense_date).operating += Number(expense.total_cents ?? 0) / 100);
    includedPayroll.forEach((period) => {
      const paidDate = (period.paid_at || period.period_end || '').slice(0, 10);
      if (paidDate) ensurePeriod(paidDate).payroll += Number(period.final_salary ?? period.totals?.net_pay ?? 0);
    });
    const periodRows = [...periods.values()].sort((left, right) => right.key.localeCompare(left.key)).map((row) => ({
      ...row,
      netProfit: row.revenue - row.cogs - row.operating - row.payroll,
    }));

    return { revenue, cogs, operating, payroll, complaints, gifts, otherOperating, grossProfit, netProfit, revenueInvoices, includedExpenses, includedPayroll, expenseCategories, periodRows };
  }, [activeDateFrom, activeDateTo, activeGroup, data, t]);

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (dateFrom) next.set('date_from', dateFrom);
    if (dateTo) next.set('date_to', dateTo);
    if (status) next.set('status', status);
    if (group !== 'monthly') next.set('group', group);
    if (selectedCurrency !== baseCurrency) next.set('currency', selectedCurrency);
    setSearchParams(next);
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatus('');
    setGroup('monthly');
    setSearchParams({});
  };

  const grossMargin = report.revenue === 0 ? 0 : (report.grossProfit / report.revenue) * 100;
  const netMargin = report.revenue === 0 ? 0 : (report.netProfit / report.revenue) * 100;
  const largestCategory = report.expenseCategories[0]?.total ?? 0;
  const recordQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (activeDateFrom) params.set('date_from', activeDateFrom);
    if (activeDateTo) params.set('date_to', activeDateTo);
    if (selectedCurrency !== baseCurrency) params.set('currency', selectedCurrency);
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [activeDateFrom, activeDateTo, baseCurrency, selectedCurrency]);

  return (
    <DashboardLayout title={t('adminProfitLossPage.pageTitle')}>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[26px] border border-stroke bg-gradient-to-r from-bg1/70 via-bg1/55 to-bg1/68 p-6 shadow-lux2">
          <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-gold/10 blur-[80px]" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div>
              <button type="button" onClick={() => navigate('/admin/finance')} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold2/90 transition hover:text-text">
                <span aria-hidden="true">←</span>{t('adminProfitLossPage.backToFinance')}
              </button>
              <p className="mt-5 text-xs uppercase tracking-[0.24em] text-gold2/85">{t('adminProfitLossPage.eyebrow')}</p>
              <h2 className="mt-2 text-3xl font-semibold text-text sm:text-4xl">{t('adminProfitLossPage.title')}</h2>
              <p className="mt-3 max-w-2xl text-sm text-muted">{t('adminProfitLossPage.description')}</p>
            </div>
            <div className={`min-w-[210px] rounded-2xl border px-5 py-4 ${report.netProfit >= 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('adminProfitLossPage.netOutcome')}</p>
              <p className={`mt-1 text-2xl font-semibold ${report.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{formatAmount(report.netProfit)}</p>
              <p className="mt-1 text-xs text-muted">{t('adminProfitLossPage.netMargin', { value: netMargin.toFixed(1) })}</p>
            </div>
          </div>
        </section>

        <GlassCard>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.reportControls')}</h3>
              <p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.reportControlsDescription')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LiquidButton type="button" tone="tertiary" onClick={resetFilters}>{t('adminProfitLossPage.reset')}</LiquidButton>
              <LiquidButton type="button" onClick={applyFilters}>{t('adminProfitLossPage.apply')}</LiquidButton>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4 md:items-end">
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">{t('adminProfitLossPage.dateFrom')}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60" /></label>
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">{t('adminProfitLossPage.dateTo')}</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60" /></label>
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">{t('adminProfitLossPage.invoiceStatus')}</span><select value={status} onChange={(event) => setStatus(normalizeStatus(event.target.value))} className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"><option value="">{t('adminProfitLossPage.allStatuses')}</option><option value="draft">{t('adminFinancePage.invoiceStatus.draft')}</option><option value="issued">{t('adminFinancePage.invoiceStatus.issued')}</option><option value="paid">{t('adminFinancePage.invoiceStatus.paid')}</option><option value="cancelled">{t('adminFinancePage.invoiceStatus.cancelled')}</option></select></label>
            <div><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">{t('adminProfitLossPage.groupBy')}</span><div className="inline-flex w-full rounded-2xl border border-stroke bg-bg1/65 p-1">{(['daily', 'monthly', 'yearly'] as PeriodGroup[]).map((candidate) => <button key={candidate} type="button" onClick={() => setGroup(candidate)} className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${group === candidate ? 'bg-gold/85 text-bg0' : 'text-muted hover:text-text'}`}>{t(`adminFinancePage.ranges.${candidate}`)}</button>)}</div></div>
          </div>
        </GlassCard>

        {error ? <div role="alert" className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t('adminProfitLossPage.revenue'), value: report.revenue, helper: t('adminProfitLossPage.invoiceCount', { count: report.revenueInvoices.length }), tone: 'default' },
            { label: t('adminProfitLossPage.cogs'), value: report.cogs, helper: t('adminProfitLossPage.directCosts'), tone: 'cost' },
            { label: t('adminProfitLossPage.grossProfit'), value: report.grossProfit, helper: t('adminProfitLossPage.grossMargin', { value: grossMargin.toFixed(1) }), tone: report.grossProfit >= 0 ? 'positive' : 'negative' },
            { label: t('adminProfitLossPage.totalOperating'), value: report.operating + report.payroll, helper: t('adminProfitLossPage.operatingAndPayroll'), tone: 'cost' },
          ].map((metric) => <GlassCard key={metric.label}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold2/85">{metric.label}</p><p className={`mt-2 text-2xl font-semibold ${metric.tone === 'positive' ? 'text-emerald-700 dark:text-emerald-300' : metric.tone === 'negative' || metric.tone === 'cost' ? 'text-text' : 'text-text'}`}>{loading ? '—' : formatAmount(metric.value)}</p><p className="mt-1 text-xs text-muted">{metric.helper}</p></GlassCard>)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <GlassCard>
            <div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.statementTitle')}</h3><p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.statementDescription')}</p></div><span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold2">{selectedCurrency}</span></div>
            <div className="divide-y divide-stroke/70 rounded-2xl border border-stroke bg-bg1/35 px-4">
              {[
                { label: t('adminProfitLossPage.revenue'), value: report.revenue, indent: false },
                { label: t('adminProfitLossPage.lessCogs'), value: -report.cogs, indent: true },
                { label: t('adminProfitLossPage.grossProfit'), value: report.grossProfit, strong: true },
                { label: t('adminProfitLossPage.lessOperating'), value: -report.operating, indent: true },
                { label: t('adminProfitLossPage.lessPayroll'), value: -report.payroll, indent: true },
                { label: t('adminProfitLossPage.netProfit'), value: report.netProfit, strong: true, final: true },
              ].map((row) => <div key={row.label} className={`flex items-center justify-between gap-4 py-3.5 ${row.final ? 'my-1 rounded-xl bg-gold/10 px-3' : ''}`}><span className={`${row.indent ? 'pl-4 text-muted' : 'text-text'} ${row.strong ? 'font-semibold' : 'text-sm'}`}>{row.label}</span><span className={`whitespace-nowrap font-semibold ${row.final ? (row.value >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300') : row.value < 0 ? 'text-muted' : 'text-text'}`}>{loading ? '—' : `${row.value < 0 ? '−' : ''}${formatAmount(Math.abs(row.value))}`}</span></div>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><LiquidButton type="button" tone="tertiary" onClick={() => navigate('/admin/finance/expenses')}>{t('adminProfitLossPage.viewExpenses')}</LiquidButton><LiquidButton type="button" tone="tertiary" onClick={() => navigate('/admin/finance/payroll')}>{t('adminProfitLossPage.viewPayroll')}</LiquidButton></div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.costBreakdown')}</h3>
            <p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.costBreakdownDescription')}</p>
            <div className="mt-5 space-y-4">
              {[
                { type: 'cogs', label: t('adminProfitLossPage.cogs'), value: report.cogs, color: 'bg-amber-500' },
                { type: 'operating', label: t('adminProfitLossPage.otherOperating'), value: report.otherOperating, color: 'bg-sky-500' },
                { type: 'complaints', label: t('adminProfitLossPage.complaints'), value: report.complaints, color: 'bg-rose-500' },
                { type: 'gifts', label: t('adminProfitLossPage.gifts'), value: report.gifts, color: 'bg-pink-500' },
                { type: 'payroll', label: t('adminProfitLossPage.payroll'), value: report.payroll, color: 'bg-violet-500' },
              ].map((row) => { const totalCosts = report.cogs + report.operating + report.payroll; const percentage = totalCosts === 0 ? 0 : (row.value / totalCosts) * 100; return <button key={row.type} type="button" onClick={() => navigate(`/admin/finance/profit-loss/records/${row.type}${recordQuery}`)} className="group block w-full rounded-xl p-2 text-left transition hover:bg-bg1/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="text-text">{row.label}<span aria-hidden="true" className="ml-2 inline-block text-gold2 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100">→</span></span><span className="font-medium text-text">{loading ? '—' : formatAmount(row.value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-stroke/60"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /></div><p className="mt-1 text-xs text-muted">{percentage.toFixed(1)}%</p></button>; })}
            </div>
          </GlassCard>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <GlassCard>
            <div className="mb-4"><h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.expenseCategories')}</h3><p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.expenseCategoriesDescription')}</p></div>
            {loading ? <p className="py-8 text-center text-sm text-muted">{t('adminProfitLossPage.loading')}</p> : report.expenseCategories.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t('adminProfitLossPage.noExpenseData')}</p> : <div className="space-y-3">{report.expenseCategories.slice(0, 6).map((category) => <div key={category.name}><div className="flex items-center justify-between gap-4 text-sm"><span className="truncate text-text">{category.name}</span><span className="whitespace-nowrap font-medium text-text">{formatAmount(category.total)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stroke/60"><div className="h-full rounded-full bg-gold/80" style={{ width: `${largestCategory === 0 ? 0 : (category.total / largestCategory) * 100}%` }} /></div><p className="mt-1 text-xs text-muted">{t('adminProfitLossPage.cogsOperatingSplit', { cogs: formatAmount(category.cogs), operating: formatAmount(category.operating) })}</p></div>)}</div>}
          </GlassCard>

          <GlassCard>
            <div className="mb-4"><h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.periodPerformance')}</h3><p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.periodPerformanceDescription')}</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-stroke text-xs uppercase tracking-[0.1em] text-muted"><tr><th className="pb-3 font-medium">{t('adminProfitLossPage.period')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.revenue')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.costs')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.netProfit')}</th></tr></thead><tbody>{loading ? <tr><td colSpan={4} className="py-8 text-center text-muted">{t('adminProfitLossPage.loading')}</td></tr> : report.periodRows.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-muted">{t('adminProfitLossPage.noPeriodData')}</td></tr> : report.periodRows.map((period) => <tr key={period.key} className="border-b border-stroke/60 last:border-0"><td className="py-3 font-medium text-text">{period.label}</td><td className="py-3 text-right text-text">{formatAmount(period.revenue)}</td><td className="py-3 text-right text-muted">{formatAmount(period.cogs + period.operating + period.payroll)}</td><td className={`py-3 text-right font-semibold ${period.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{formatAmount(period.netProfit)}</td></tr>)}</tbody></table></div>
          </GlassCard>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceProfitLossPage;
