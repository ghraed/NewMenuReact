import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchExpenses } from '../services/financeExpenseService';
import { fetchPayrollPeriods } from '../services/payrollService';
import type { CurrencyCode, FinanceExpense, PayrollPeriod } from '../types';
import {
  convertPriceFromUsdToCurrency,
  convertPriceToUsd,
  formatPriceWithCurrency,
  normalizeCurrency,
  readGuestCurrencySettings,
} from '../utils/currency';
import { parseInvoiceAdjustmentExpenseMeta } from '../utils/financeAdjustmentMeta';
import { validateFinanceDateRange } from '../utils/financeReporting';
import { ADJUSTMENT_ACTION_LABELS, OPERATIONAL_LOSS_CATEGORY_LABELS } from '../utils/orderItemCompensation';

type RecordType = 'cogs' | 'operating' | 'complaints' | 'gifts' | 'payroll';

const EXPENSE_PAGE_SIZE = 200;
const INCLUDED_EXPENSE_STATUSES = new Set(['approved', 'paid']);
const INCLUDED_PAYROLL_STATUSES = new Set(['approved', 'paid']);

const isRecordType = (value: string | undefined): value is RecordType => (
  value === 'cogs' || value === 'operating' || value === 'complaints' || value === 'gifts' || value === 'payroll'
);

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

const isWithinRange = (date: string | null | undefined, dateFrom: string, dateTo: string): boolean => {
  const normalized = date?.slice(0, 10) ?? '';
  return normalized !== '' && (!dateFrom || normalized >= dateFrom) && (!dateTo || normalized <= dateTo);
};

const parseDollarRate = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const expenseSortNewestFirst = (left: FinanceExpense, right: FinanceExpense): number => (
  (right.expense_date || '').localeCompare(left.expense_date || '') || right.id - left.id
);

const payrollSortNewestFirst = (left: PayrollPeriod, right: PayrollPeriod): number => {
  const leftDate = (left.paid_at || left.period_end || '').slice(0, 10);
  const rightDate = (right.paid_at || right.period_end || '').slice(0, 10);
  return rightDate.localeCompare(leftDate) || right.id - left.id;
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-2xl border border-stroke bg-bg1/50 px-4 py-3">
    <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">{label}</p>
    <div className="mt-1 break-words text-sm font-medium text-text">{value || '—'}</div>
  </div>
);

const ExpenseRecordDetail: React.FC<{
  expense: FinanceExpense;
  formatAmount: (amount: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ expense, formatAmount, t }) => {
  const adjustment = parseInvoiceAdjustmentExpenseMeta(expense);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label={t('adminProfitLossPage.amount')} value={formatAmount(Number(expense.total_cents ?? 0) / 100)} />
        <DetailItem label={t('adminProfitLossPage.status')} value={<span className="capitalize">{expense.status}</span>} />
        <DetailItem label={t('adminProfitLossPage.expenseDate')} value={expense.expense_date} />
        <DetailItem label={t('adminProfitLossPage.category')} value={expense.category?.name || t('adminProfitLossPage.uncategorized')} />
        <DetailItem label={t('adminProfitLossPage.vendor')} value={expense.vendor?.name || t('adminProfitLossPage.notRecorded')} />
        <DetailItem label={t('adminProfitLossPage.paymentMethod')} value={expense.payment_method ? t(`adminFinanceExpensesPage.paymentMethods.${expense.payment_method}`) : t('adminProfitLossPage.notRecorded')} />
        <DetailItem label={t('adminProfitLossPage.reference')} value={expense.reference_no || t('adminProfitLossPage.notRecorded')} />
        <DetailItem label={t('adminProfitLossPage.paymentDate')} value={expense.paid_at?.slice(0, 10) || t('adminProfitLossPage.notRecorded')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-stroke bg-bg1/35 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.description')}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{expense.description || t('adminProfitLossPage.notRecorded')}</p></div>
        <div className="rounded-2xl border border-stroke bg-bg1/35 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.notes')}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{expense.notes || t('adminProfitLossPage.notRecorded')}</p></div>
      </div>

      {expense.linked_stock_movement ? <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.inventoryLink')}</h4><div className="mt-3 grid gap-3 sm:grid-cols-3"><DetailItem label={t('adminProfitLossPage.stockMovement')} value={`#${expense.linked_stock_movement.id}`} /><DetailItem label={t('adminProfitLossPage.ingredient')} value={expense.linked_stock_movement.ingredient_name || t('adminProfitLossPage.notRecorded')} /><DetailItem label={t('adminProfitLossPage.quantity')} value={`${expense.linked_stock_movement.quantity_delta || '—'} ${expense.linked_stock_movement.unit || ''}`} /></div></div> : null}

      {adjustment.isAdjustment ? <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.adjustmentDetails')}</h4><p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.adjustmentDetailsDescription')}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DetailItem label={t('adminProfitLossPage.adjustmentAction')} value={adjustment.actionType ? ADJUSTMENT_ACTION_LABELS[adjustment.actionType] : t('adminProfitLossPage.notRecorded')} /><DetailItem label={t('adminProfitLossPage.lossCategory')} value={adjustment.operationalLossCategory ? OPERATIONAL_LOSS_CATEGORY_LABELS[adjustment.operationalLossCategory] : t('adminProfitLossPage.notRecorded')} /><DetailItem label={t('adminProfitLossPage.adjustmentReference')} value={adjustment.adjustmentReference || t('adminProfitLossPage.notRecorded')} /><DetailItem label={t('adminProfitLossPage.relatedInvoice')} value={adjustment.invoiceNumber || t('adminProfitLossPage.notRecorded')} /><DetailItem label={t('adminProfitLossPage.approvedBy')} value={adjustment.approvedBy || t('adminProfitLossPage.notRecorded')} /><DetailItem label={t('adminProfitLossPage.approvedAt')} value={adjustment.approvedAt ? new Date(adjustment.approvedAt).toLocaleString() : t('adminProfitLossPage.notRecorded')} /></div></div> : null}
    </div>
  );
};

const PayrollRecordDetail: React.FC<{
  period: PayrollPeriod;
  formatAmount: (amount: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ period, formatAmount, t }) => (
  <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DetailItem label={t('adminProfitLossPage.employee')} value={period.employee?.name || t('adminProfitLossPage.allEmployees')} />
      <DetailItem label={t('adminProfitLossPage.status')} value={<span className="capitalize">{period.status}</span>} />
      <DetailItem label={t('adminProfitLossPage.period')} value={`${period.period_start} – ${period.period_end}`} />
      <DetailItem label={t('adminProfitLossPage.paymentDate')} value={period.paid_at?.slice(0, 10) || t('adminProfitLossPage.notRecorded')} />
      <DetailItem label={t('adminProfitLossPage.grossPay')} value={formatAmount(Number(period.totals?.gross_pay ?? 0))} />
      <DetailItem label={t('adminProfitLossPage.deductions')} value={formatAmount(Number(period.totals?.deductions ?? 0))} />
      <DetailItem label={t('adminProfitLossPage.tax')} value={formatAmount(Number(period.totals?.tax ?? 0))} />
      <DetailItem label={t('adminProfitLossPage.netPay')} value={formatAmount(Number(period.final_salary ?? period.totals?.net_pay ?? 0))} />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-stroke bg-bg1/35 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.notes')}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{period.notes || t('adminProfitLossPage.notRecorded')}</p></div>
      <div className="rounded-2xl border border-stroke bg-bg1/35 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.processedBy')}</h4><p className="mt-2 text-sm text-muted">{period.processed_by?.name || t('adminProfitLossPage.notRecorded')}</p></div>
    </div>
    <div className="rounded-2xl border border-stroke bg-bg1/35 p-4"><h4 className="font-semibold text-text">{t('adminProfitLossPage.payEntries')}</h4><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-stroke text-xs uppercase tracking-[0.1em] text-muted"><tr><th className="pb-3 font-medium">{t('adminProfitLossPage.employee')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.grossPay')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.deductions')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.tax')}</th><th className="pb-3 text-right font-medium">{t('adminProfitLossPage.netPay')}</th></tr></thead><tbody>{period.entries.length === 0 ? <tr><td colSpan={5} className="py-7 text-center text-muted">{t('adminProfitLossPage.noPayEntries')}</td></tr> : period.entries.map((entry) => { const gross = (entry.base_amount_cents + entry.overtime_amount_cents + entry.bonus_amount_cents + entry.allowance_amount_cents + entry.reimbursement_amount_cents) / 100; return <tr key={entry.id} className="border-b border-stroke/60 last:border-0"><td className="py-3 text-text">{entry.employee?.name || `#${entry.user_id}`}</td><td className="py-3 text-right text-text">{formatAmount(gross)}</td><td className="py-3 text-right text-muted">{formatAmount(entry.deduction_amount_cents / 100)}</td><td className="py-3 text-right text-muted">{formatAmount(entry.tax_amount_cents / 100)}</td><td className="py-3 text-right font-semibold text-text">{formatAmount(entry.net_amount_cents / 100)}</td></tr>; })}</tbody></table></div></div>
  </div>
);

const AdminFinanceProfitLossRecordsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { record_type, record_id } = useParams<{ record_type: string; record_id?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const storedCurrency = readGuestCurrencySettings()?.currency;
  const baseCurrency = normalizeCurrency(user?.restaurant?.currency || storedCurrency || 'USD');
  const selectedCurrency = normalizeCurrency(searchParams.get('currency') || baseCurrency) as CurrencyCode;
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const dollarRate = parseDollarRate(user?.restaurant?.dollar_rate);
  const recordType = isRecordType(record_type) ? record_type : null;
  const selectedRecordId = Number(record_id);
  const isDetailView = Boolean(record_id) && Number.isInteger(selectedRecordId) && selectedRecordId > 0;
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const queryKey = searchParams.toString();

  const formatAmount = useCallback((amount: number): string => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    if (selectedCurrency === baseCurrency) return formatPriceWithCurrency(safeAmount, selectedCurrency);
    const usdValue = convertPriceToUsd(safeAmount, baseCurrency, dollarRate);
    return formatPriceWithCurrency(convertPriceFromUsdToCurrency(usdValue, selectedCurrency, dollarRate), selectedCurrency);
  }, [baseCurrency, dollarRate, selectedCurrency]);

  const recordTitle = recordType ? t(`adminProfitLossPage.recordTypes.${recordType}`) : t('adminProfitLossPage.recordNotFound');

  const loadRecords = useCallback(async () => {
    if (!recordType) {
      setLoading(false);
      setError(t('adminProfitLossPage.recordNotFound'));
      return;
    }

    const invalidRange = validateFinanceDateRange(dateFrom, dateTo);
    if (invalidRange) {
      setLoading(false);
      setError(invalidRange);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (recordType === 'payroll') {
        setPayrollPeriods(await fetchPayrollPeriods());
        setExpenses([]);
      } else {
        const firstPage = await fetchExpenses({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          per_page: EXPENSE_PAGE_SIZE,
          page: 1,
        });
        const allExpenses = [...firstPage.expenses];
        const lastPage = Math.max(1, firstPage.meta?.last_page ?? 1);
        if (lastPage > 1) {
          const pages = await Promise.all(Array.from({ length: lastPage - 1 }, (_, index) => fetchExpenses({
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            per_page: EXPENSE_PAGE_SIZE,
            page: index + 2,
          })));
          pages.forEach((result) => allExpenses.push(...result.expenses));
        }
        setExpenses(allExpenses);
        setPayrollPeriods([]);
      }
    } catch {
      setError(t('adminProfitLossPage.failedLoadRecords'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, recordType, t]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, queryKey]);

  const rows = useMemo(() => {
    if (recordType === 'payroll') {
      return payrollPeriods
        .filter((period) => INCLUDED_PAYROLL_STATUSES.has(period.status) && isWithinRange(period.paid_at || period.period_end, dateFrom, dateTo))
        .sort(payrollSortNewestFirst);
    }

    return expenses
      .filter((expense) => INCLUDED_EXPENSE_STATUSES.has(expense.status) && isWithinRange(expense.expense_date, dateFrom, dateTo))
      .filter((expense) => {
        const isCogs = isExpenseCogs(expense);
        const adjustment = parseInvoiceAdjustmentExpenseMeta(expense);
        if (recordType === 'cogs') return isCogs;
        if (recordType === 'operating') return !isCogs && !adjustment.isAdjustment;
        if (recordType === 'gifts') return !isCogs && adjustment.isAdjustment && (adjustment.actionType === 'complimentary_gift' || adjustment.actionType === 'service_recovery');
        return !isCogs && adjustment.isAdjustment && adjustment.actionType !== 'complimentary_gift' && adjustment.actionType !== 'service_recovery';
      })
      .sort(expenseSortNewestFirst);
  }, [dateFrom, dateTo, expenses, payrollPeriods, recordType]);

  useEffect(() => {
    setPage(1);
  }, [recordType, queryKey]);

  const PAGE_SIZE = 25;
  const lastPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedExpense = isDetailView && recordType !== 'payroll'
    ? (rows as FinanceExpense[]).find((expense) => expense.id === selectedRecordId) ?? null
    : null;
  const selectedPayrollPeriod = isDetailView && recordType === 'payroll'
    ? (rows as PayrollPeriod[]).find((period) => period.id === selectedRecordId) ?? null
    : null;
  const total = rows.reduce((sum, row) => (
    sum + ('total_cents' in row
      ? Number(row.total_cents ?? 0) / 100
      : Number(row.final_salary ?? row.totals?.net_pay ?? 0))
  ), 0);
  const backQuery = queryKey ? `?${queryKey}` : '';

  return (
    <DashboardLayout title={recordTitle}>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[26px] border border-stroke bg-gradient-to-r from-bg1/70 via-bg1/55 to-bg1/68 p-6 shadow-lux2">
          <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-gold/10 blur-[80px]" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div>
              <button type="button" onClick={() => navigate(`/admin/finance/profit-loss${backQuery}`)} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold2/90 transition hover:text-text"><span aria-hidden="true">←</span>{t('adminProfitLossPage.backToProfitLoss')}</button>
              <p className="mt-5 text-xs uppercase tracking-[0.24em] text-gold2/85">{t('adminProfitLossPage.recordEyebrow')}</p>
              <h2 className="mt-2 text-3xl font-semibold text-text sm:text-4xl">{isDetailView ? t('adminProfitLossPage.recordDetailTitle', { category: recordTitle, id: selectedRecordId }) : recordTitle}</h2>
              <p className="mt-3 max-w-2xl text-sm text-muted">{t('adminProfitLossPage.recordDescription', { category: recordTitle })}</p>
            </div>
            <div className="min-w-[210px] rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('adminProfitLossPage.totalIncluded')}</p>
              <p className="mt-1 text-2xl font-semibold text-text">{loading ? '—' : formatAmount(total)}</p>
              <p className="mt-1 text-xs text-muted">{t('adminProfitLossPage.recordCount', { count: rows.length })}</p>
            </div>
          </div>
        </section>

        {error ? <div role="alert" className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}

        {isDetailView ? (
          <GlassCard>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.recordDetails')}</h3><p className="mt-1 text-sm text-muted">{t('adminProfitLossPage.recordDetailsDescription')}</p></div>
              <LiquidButton type="button" tone="tertiary" onClick={() => navigate(`/admin/finance/profit-loss/records/${recordType}${backQuery}`)}>{t('adminProfitLossPage.backToRecords')}</LiquidButton>
            </div>
            {loading ? <p className="py-12 text-center text-sm text-muted">{t('adminProfitLossPage.loading')}</p> : null}
            {!loading && !selectedExpense && !selectedPayrollPeriod ? <p className="py-12 text-center text-sm text-muted">{t('adminProfitLossPage.recordUnavailable')}</p> : null}
            {selectedExpense ? <ExpenseRecordDetail expense={selectedExpense} formatAmount={formatAmount} t={t} /> : null}
            {selectedPayrollPeriod ? <PayrollRecordDetail period={selectedPayrollPeriod} formatAmount={formatAmount} t={t} /> : null}
          </GlassCard>
        ) : (<>
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-text">{t('adminProfitLossPage.recordsTitle')}</h3><p className="mt-1 text-sm text-muted">{dateFrom || dateTo ? t('adminProfitLossPage.activeDateRange', { from: dateFrom || '…', to: dateTo || '…' }) : t('adminProfitLossPage.allTime')}</p></div><LiquidButton type="button" tone="tertiary" onClick={() => void loadRecords()}>{t('adminProfitLossPage.refresh')}</LiquidButton></div>
        </GlassCard>

        <GlassCard>
          <div className="overflow-x-auto">
            {recordType === 'payroll' ? (
              <table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-stroke text-xs uppercase tracking-[0.1em] text-muted"><tr><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.date')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.period')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.employee')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.status')}</th><th className="px-3 py-3 text-right font-medium">{t('adminProfitLossPage.amount')}</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-3 py-10 text-center text-muted">{t('adminProfitLossPage.loading')}</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={5} className="px-3 py-10 text-center text-muted">{t('adminProfitLossPage.noRecords')}</td></tr> : (visibleRows as PayrollPeriod[]).map((period) => <tr key={period.id} role="link" tabIndex={0} onClick={() => navigate(`/admin/finance/profit-loss/records/${recordType}/${period.id}${backQuery}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/admin/finance/profit-loss/records/${recordType}/${period.id}${backQuery}`); } }} className="cursor-pointer border-b border-stroke/60 transition hover:bg-bg1/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 last:border-0"><td className="px-3 py-3 text-text">{(period.paid_at || period.period_end || '—').slice(0, 10)}</td><td className="px-3 py-3 text-muted">{period.period_start} – {period.period_end}</td><td className="px-3 py-3 text-text">{period.employee?.name || t('adminProfitLossPage.allEmployees')}</td><td className="px-3 py-3"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold capitalize text-emerald-700 dark:text-emerald-300">{period.status}</span></td><td className="px-3 py-3 text-right font-semibold text-text">{formatAmount(Number(period.final_salary ?? period.totals?.net_pay ?? 0))}</td></tr>)}</tbody></table>
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-stroke text-xs uppercase tracking-[0.1em] text-muted"><tr><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.date')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.category')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.tableDescription')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.reference')}</th><th className="px-3 py-3 font-medium">{t('adminProfitLossPage.status')}</th><th className="px-3 py-3 text-right font-medium">{t('adminProfitLossPage.amount')}</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="px-3 py-10 text-center text-muted">{t('adminProfitLossPage.loading')}</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-muted">{t('adminProfitLossPage.noRecords')}</td></tr> : (visibleRows as FinanceExpense[]).map((expense) => <tr key={expense.id} role="link" tabIndex={0} onClick={() => navigate(`/admin/finance/profit-loss/records/${recordType}/${expense.id}${backQuery}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/admin/finance/profit-loss/records/${recordType}/${expense.id}${backQuery}`); } }} className="cursor-pointer border-b border-stroke/60 transition hover:bg-bg1/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 last:border-0"><td className="px-3 py-3 text-text">{expense.expense_date}</td><td className="px-3 py-3 text-text">{expense.category?.name || t('adminProfitLossPage.uncategorized')}</td><td className="max-w-[240px] px-3 py-3 text-muted"><span className="block truncate" title={expense.description || expense.notes || undefined}>{expense.description || expense.notes || '—'}</span></td><td className="px-3 py-3 text-muted">{expense.reference_no || '—'}</td><td className="px-3 py-3"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold capitalize text-emerald-700 dark:text-emerald-300">{expense.status}</span></td><td className="px-3 py-3 text-right font-semibold text-text">{formatAmount(Number(expense.total_cents ?? 0) / 100)}</td></tr>)}</tbody></table>
            )}
          </div>
          {!loading && rows.length > PAGE_SIZE ? <div className="mt-4 flex items-center justify-between gap-3 border-t border-stroke pt-4"><p className="text-xs text-muted">{t('adminProfitLossPage.pagination', { page: safePage, lastPage, total: rows.length })}</p><div className="flex gap-2"><LiquidButton type="button" tone="tertiary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t('adminProfitLossPage.previous')}</LiquidButton><LiquidButton type="button" tone="tertiary" disabled={safePage >= lastPage} onClick={() => setPage((current) => Math.min(lastPage, current + 1))}>{t('adminProfitLossPage.next')}</LiquidButton></div></div> : null}
        </GlassCard>
        </>)}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceProfitLossRecordsPage;
