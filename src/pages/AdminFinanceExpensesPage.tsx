import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import {
  createExpense,
  createExpenseCategory,
  createVendor,
  fetchExpenseCategories,
  fetchExpenses,
  fetchUnlinkedRestocks,
  fetchVendors,
  updateExpense,
  updateExpenseCategory,
  updateVendor,
  type CreateExpensePayload,
  type UpdateExpensePayload,
} from '../services/financeExpenseService';
import type {
  FinanceExpense,
  FinanceExpenseCategory,
  FinanceExpensePaymentMethod,
  FinanceExpenseStatus,
  FinanceUnlinkedRestockRecord,
  FinanceVendor,
} from '../types';
import { formatPriceWithCurrency } from '../utils/currency';

const EXPENSE_STATUSES: FinanceExpenseStatus[] = ['draft', 'approved', 'paid', 'void'];
const PAYMENT_METHODS: FinanceExpensePaymentMethod[] = ['cash', 'card', 'bank_transfer', 'wallet', 'other'];
const today = new Date().toISOString().slice(0, 10);

const getErrorMessage = (error: unknown, fallback: string): string => {
  const maybeAxios = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };
  };

  const firstFieldError = maybeAxios.response?.data?.errors
    ? Object.values(maybeAxios.response.data.errors)[0]?.[0]
    : null;
  if (firstFieldError) {
    return firstFieldError;
  }

  const message = maybeAxios.response?.data?.message;
  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallback;
};

const centsFromInput = (value: string): number => {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
};

const centsToInput = (value: number): string => (value / 100).toFixed(2);

interface ExpenseDraft {
  expense_category_id: string;
  vendor_id: string;
  expense_date: string;
  amount: string;
  tax_amount: string;
  currency: string;
  status: FinanceExpenseStatus;
  payment_method: string;
  reference_no: string;
  description: string;
  notes: string;
  due_date: string;
  paid_at: string;
}

const blankDraft = (currency: string): ExpenseDraft => ({
  expense_category_id: '',
  vendor_id: '',
  expense_date: today,
  amount: '',
  tax_amount: '0.00',
  currency,
  status: 'draft',
  payment_method: '',
  reference_no: '',
  description: '',
  notes: '',
  due_date: '',
  paid_at: '',
});

const expenseSortNewestFirst = (records: FinanceExpense[]): FinanceExpense[] => (
  [...records].sort((left, right) => {
    const leftDate = left.expense_date ? Date.parse(`${left.expense_date}T00:00:00Z`) : Number.NaN;
    const rightDate = right.expense_date ? Date.parse(`${right.expense_date}T00:00:00Z`) : Number.NaN;

    if (Number.isFinite(leftDate) || Number.isFinite(rightDate)) {
      const safeLeft = Number.isFinite(leftDate) ? leftDate : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightDate) ? rightDate : Number.NEGATIVE_INFINITY;
      if (safeLeft !== safeRight) {
        return safeRight - safeLeft;
      }
    }

    return right.id - left.id;
  })
);

const AnimatedCurrencyValue: React.FC<{
  value: number;
  currency: string;
  className?: string;
}> = ({ value, currency, className }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-12% 0px -12% 0px' });
  const [progress, setProgress] = useState(0);

  const targetText = useMemo(
    () => formatPriceWithCurrency(Number.isFinite(value) ? value : 0, currency),
    [value, currency]
  );

  const animatedText = useMemo(() => {
    const eased = 0.5 - (Math.cos(Math.PI * progress) / 2);
    return targetText
      .split('')
      .map((char) => {
        if (!/[0-9]/.test(char)) return char;
        const targetDigit = Number(char);
        const nextDigit = Math.floor(targetDigit * eased);
        return String(Math.min(targetDigit, Math.max(0, nextDigit)));
      })
      .join('');
  }, [targetText, progress]);

  useEffect(() => {
    if (!isInView) return;
    const durationMs = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - start) / durationMs);
      setProgress(nextProgress);
      if (nextProgress < 1) requestAnimationFrame(tick);
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
        if (!/[0-9]/.test(char)) return char;
        const targetDigit = Number(char);
        const nextDigit = Math.floor(targetDigit * eased);
        return String(Math.min(targetDigit, Math.max(0, nextDigit)));
      })
      .join('');
  }, [targetText, progress]);

  useEffect(() => {
    if (!isInView) return;
    const durationMs = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - start) / durationMs);
      setProgress(nextProgress);
      if (nextProgress < 1) requestAnimationFrame(tick);
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

const AdminFinanceExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const currency = user?.restaurant?.currency ?? 'USD';

  const [categories, setCategories] = useState<FinanceExpenseCategory[]>([]);
  const [vendors, setVendors] = useState<FinanceVendor[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [totalExpensesCount, setTotalExpensesCount] = useState(0);
  const [expensePage, setExpensePage] = useState(1);
  const [expensePerPage, setExpensePerPage] = useState(25);
  const [expenseLastPage, setExpenseLastPage] = useState(1);
  const [unlinkedRestocks, setUnlinkedRestocks] = useState<FinanceUnlinkedRestockRecord[]>([]);
  const [unlinkedRestocksCount, setUnlinkedRestocksCount] = useState(0);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinanceExpenseStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('');

  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);
  const [vendorName, setVendorName] = useState('');
  const [vendorContactName, setVendorContactName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorTaxNumber, setVendorTaxNumber] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');
  const [vendorActive, setVendorActive] = useState(true);

  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => blankDraft(currency));
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [loadingUnlinkedRestocks, setLoadingUnlinkedRestocks] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories]
  );
  const activeVendors = useMemo(
    () => vendors.filter((vendor) => vendor.is_active),
    [vendors]
  );
  const expenseTotals = useMemo(() => {
    const paid = expenses.filter((expense) => expense.status === 'paid');
    const approved = expenses.filter((expense) => expense.status === 'approved');
    const draft = expenses.filter((expense) => expense.status === 'draft');
    const voided = expenses.filter((expense) => expense.status === 'void');
    const sum = (rows: FinanceExpense[]) => rows.reduce((acc, row) => acc + (row.total_cents ?? 0), 0) / 100;

    return {
      totalAmount: sum(expenses),
      paidAmount: sum(paid),
      approvedAmount: sum(approved),
      draftAmount: sum(draft),
      voidAmount: sum(voided),
      paidCount: paid.length,
      approvedCount: approved.length,
      draftCount: draft.length,
      voidCount: voided.length,
    };
  }, [expenses]);

  const loadReferenceData = useCallback(async () => {
    const [categoriesResponse, vendorsResponse] = await Promise.all([
      fetchExpenseCategories(),
      fetchVendors(),
    ]);

    setCategories(categoriesResponse);
    setVendors(vendorsResponse);
  }, []);

  const loadExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const response = await fetchExpenses({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter || undefined,
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        vendor_id: vendorFilter ? Number(vendorFilter) : undefined,
        per_page: expensePerPage,
        page: expensePage,
      });
      setExpenses(expenseSortNewestFirst(response.expenses));
      setTotalExpensesCount(response.meta.total);
      setExpenseLastPage(Math.max(1, response.meta.last_page));
    } finally {
      setLoadingExpenses(false);
    }
  }, [categoryFilter, dateFrom, dateTo, expensePage, expensePerPage, statusFilter, vendorFilter]);

  const loadUnlinkedRestocks = useCallback(async () => {
    setLoadingUnlinkedRestocks(true);
    try {
      const response = await fetchUnlinkedRestocks({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        per_page: 200,
      });
      setUnlinkedRestocks(response.restocks);
      setUnlinkedRestocksCount(response.meta.total);
    } finally {
      setLoadingUnlinkedRestocks(false);
    }
  }, [dateFrom, dateTo]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadReferenceData(), loadUnlinkedRestocks()]);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load expense management data.'));
    } finally {
      setLoading(false);
    }
  }, [loadReferenceData, loadUnlinkedRestocks]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadReferenceData(), loadExpenses(), loadUnlinkedRestocks()]);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load expense management data.'));
    } finally {
      setLoading(false);
    }
  }, [loadExpenses, loadReferenceData, loadUnlinkedRestocks]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseDraft(blankDraft(currency));
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingCategory(true);

    try {
      const created = await createExpenseCategory({
        code: categoryCode.trim(),
        name: categoryName.trim(),
        is_active: categoryActive,
      });
      setCategories((current) => [created, ...current]);
      setCategoryCode('');
      setCategoryName('');
      setCategoryActive(true);
      setSuccess('Expense category created.');
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, 'Failed to create expense category.'));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateVendor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingVendor(true);

    try {
      const created = await createVendor({
        name: vendorName.trim(),
        contact_name: vendorContactName.trim() || undefined,
        phone: vendorPhone.trim() || undefined,
        email: vendorEmail.trim() || undefined,
        tax_number: vendorTaxNumber.trim() || undefined,
        notes: vendorNotes.trim() || undefined,
        is_active: vendorActive,
      });
      setVendors((current) => [created, ...current]);
      setVendorName('');
      setVendorContactName('');
      setVendorPhone('');
      setVendorEmail('');
      setVendorTaxNumber('');
      setVendorNotes('');
      setVendorActive(true);
      setSuccess('Vendor created.');
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, 'Failed to create vendor.'));
    } finally {
      setSavingVendor(false);
    }
  };

  const expensePayloadFromDraft = (draft: ExpenseDraft): CreateExpensePayload => ({
    expense_category_id: Number(draft.expense_category_id),
    vendor_id: draft.vendor_id ? Number(draft.vendor_id) : null,
    expense_date: draft.expense_date,
    amount_cents: centsFromInput(draft.amount),
    tax_amount_cents: centsFromInput(draft.tax_amount),
    currency: draft.currency.trim().toUpperCase(),
    status: draft.status,
    payment_method: draft.payment_method ? (draft.payment_method as FinanceExpensePaymentMethod) : null,
    reference_no: draft.reference_no.trim() || null,
    description: draft.description.trim() || null,
    notes: draft.notes.trim() || null,
    due_date: draft.due_date || null,
    paid_at: draft.paid_at || null,
  });

  const handleSaveExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!expenseDraft.expense_category_id) {
      setError('Please select an expense category.');
      return;
    }
    if (!expenseDraft.expense_date) {
      setError('Please select the expense date.');
      return;
    }
    if (!expenseDraft.amount || centsFromInput(expenseDraft.amount) <= 0) {
      setError('Expense amount must be greater than 0.');
      return;
    }

    setSavingExpense(true);

    try {
      if (editingExpenseId === null) {
        await createExpense(expensePayloadFromDraft(expenseDraft));
        setExpensePage(1);
        await loadExpenses();
        setSuccess('Expense created.');
        resetExpenseForm();
      } else {
        const updatePayload: UpdateExpensePayload = expensePayloadFromDraft(expenseDraft);
        await updateExpense(editingExpenseId, updatePayload);
        await loadExpenses();
        setSuccess('Expense updated.');
      }
      void loadUnlinkedRestocks();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Failed to save expense.'));
    } finally {
      setSavingExpense(false);
    }
  };

  const startEditExpense = (expense: FinanceExpense) => {
    setEditingExpenseId(expense.id);
    setExpenseDraft({
      expense_category_id: String(expense.expense_category_id),
      vendor_id: expense.vendor_id ? String(expense.vendor_id) : '',
      expense_date: expense.expense_date || today,
      amount: centsToInput(expense.amount_cents),
      tax_amount: centsToInput(expense.tax_amount_cents),
      currency: expense.currency || currency,
      status: expense.status,
      payment_method: expense.payment_method ?? '',
      reference_no: expense.reference_no ?? '',
      description: expense.description ?? '',
      notes: expense.notes ?? '',
      due_date: expense.due_date ?? '',
      paid_at: expense.paid_at ? expense.paid_at.slice(0, 10) : '',
    });
  };

  const handleExpenseStatusUpdate = async (expense: FinanceExpense, nextStatus: FinanceExpenseStatus) => {
    setUpdatingStatusId(expense.id);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateExpense(expense.id, { status: nextStatus });
      setExpenses((current) => expenseSortNewestFirst(current.map((item) => (item.id === updated.id ? updated : item))));
      setSuccess(`Expense ${updated.id} moved to ${nextStatus}.`);
      void loadUnlinkedRestocks();
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update expense status.'));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const toggleCategoryActive = async (category: FinanceExpenseCategory) => {
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateExpenseCategory(category.id, { is_active: !category.is_active });
      setCategories((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update category status.'));
    }
  };

  const toggleVendorActive = async (vendor: FinanceVendor) => {
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateVendor(vendor.id, { is_active: !vendor.is_active });
      setVendors((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update vendor status.'));
    }
  };

  return (
    <DashboardLayout title="Expense Management">
      <div className="space-y-6">
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text">Manage Categories, Vendors, and Expenses</h2>
              <p className="mt-1 text-sm text-muted">
                {totalExpensesCount} expense record{totalExpensesCount === 1 ? '' : 's'} in the current filter range.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={loading ? 'Refreshing all' : 'Refresh all'}
                title={loading ? 'Refreshing all' : 'Refresh all'}
                onClick={() => void loadAll()}
                disabled={loading}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="New expense"
                title="New expense"
                onClick={resetExpenseForm}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Expenses Total</p>
            <p className="mt-1 text-base font-semibold text-text"><AnimatedCurrencyValue value={expenseTotals.totalAmount} currency={currency} /></p>
            <p className="text-xs text-muted"><AnimatedIntegerValue value={totalExpensesCount} /> records in range</p>
          </div>
          <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Paid</p>
            <p className="mt-1 text-base font-semibold text-text"><AnimatedCurrencyValue value={expenseTotals.paidAmount} currency={currency} /></p>
            <p className="text-xs text-muted"><AnimatedIntegerValue value={expenseTotals.paidCount} /> on this page</p>
          </div>
          <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Approved</p>
            <p className="mt-1 text-base font-semibold text-text"><AnimatedCurrencyValue value={expenseTotals.approvedAmount} currency={currency} /></p>
            <p className="text-xs text-muted"><AnimatedIntegerValue value={expenseTotals.approvedCount} /> on this page</p>
          </div>
          <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Draft</p>
            <p className="mt-1 text-base font-semibold text-text"><AnimatedCurrencyValue value={expenseTotals.draftAmount} currency={currency} /></p>
            <p className="text-xs text-muted"><AnimatedIntegerValue value={expenseTotals.draftCount} /> on this page</p>
          </div>
          <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Void</p>
            <p className="mt-1 text-base font-semibold text-text"><AnimatedCurrencyValue value={expenseTotals.voidAmount} currency={currency} /></p>
            <p className="text-xs text-muted"><AnimatedIntegerValue value={expenseTotals.voidCount} /> on this page</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <GlassCard>
            <h3 className="text-lg font-semibold text-text">Create Expense Category</h3>
            <form className="mt-4 space-y-3" onSubmit={handleCreateCategory}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Code</span>
                <input
                  type="text"
                  value={categoryCode}
                  onChange={(event) => setCategoryCode(event.target.value)}
                  placeholder="Code (e.g. utilities)"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Display Name</span>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Display Name"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  required
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={categoryActive}
                  onChange={(event) => setCategoryActive(event.target.checked)}
                />
                Active
              </label>
              <LiquidButton type="submit" className="w-full" disabled={savingCategory}>
                {savingCategory ? 'Saving...' : 'Create Category'}
              </LiquidButton>
            </form>
          </GlassCard>

          <GlassCard className="xl:col-span-2">
            <h3 className="text-lg font-semibold text-text">Create Vendor</h3>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateVendor}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Vendor Name</span>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(event) => setVendorName(event.target.value)}
                  placeholder="Vendor Name"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Contact Name</span>
                <input
                  type="text"
                  value={vendorContactName}
                  onChange={(event) => setVendorContactName(event.target.value)}
                  placeholder="Contact Name"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Phone</span>
                <input
                  type="text"
                  value={vendorPhone}
                  onChange={(event) => setVendorPhone(event.target.value)}
                  placeholder="Phone"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Email</span>
                <input
                  type="email"
                  value={vendorEmail}
                  onChange={(event) => setVendorEmail(event.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Tax Number</span>
                <input
                  type="text"
                  value={vendorTaxNumber}
                  onChange={(event) => setVendorTaxNumber(event.target.value)}
                  placeholder="Tax Number"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={vendorActive}
                  onChange={(event) => setVendorActive(event.target.checked)}
                />
                Active
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Notes</span>
                <textarea
                  value={vendorNotes}
                  onChange={(event) => setVendorNotes(event.target.value)}
                  placeholder="Notes"
                  rows={2}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <LiquidButton type="submit" className="md:col-span-2" disabled={savingVendor}>
                {savingVendor ? 'Saving...' : 'Create Vendor'}
              </LiquidButton>
            </form>
          </GlassCard>
        </div>

        <div className="space-y-5">
          <GlassCard>
            <h3 className="text-lg font-semibold text-text">{editingExpenseId ? `Edit Expense #${editingExpenseId}` : 'Create Expense'}</h3>
            <form className="mt-4 space-y-3" onSubmit={handleSaveExpense}>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Category</span>
                <select
                  value={expenseDraft.expense_category_id}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, expense_category_id: event.target.value }))}
                  className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                  required
                >
                  <option value="">Select Category</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Vendor</span>
                <select
                  value={expenseDraft.vendor_id}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, vendor_id: event.target.value }))}
                  className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                >
                  <option value="">No Vendor</option>
                  {activeVendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Expense Date</span>
                <input
                  type="date"
                  value={expenseDraft.expense_date}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, expense_date: event.target.value }))}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseDraft.amount}
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="Amount"
                    className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Tax Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseDraft.tax_amount}
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, tax_amount: event.target.value }))}
                    placeholder="Tax Amount"
                    className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Currency</span>
                  <input
                    type="text"
                    value={expenseDraft.currency}
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                    maxLength={3}
                    placeholder="USD"
                    className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text uppercase outline-none focus:border-gold/55"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Status</span>
                  <select
                    value={expenseDraft.status}
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, status: event.target.value as FinanceExpenseStatus }))}
                    className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                  >
                    {EXPENSE_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Payment Method</span>
                <select
                  value={expenseDraft.payment_method}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, payment_method: event.target.value }))}
                  className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                >
                  <option value="">No Payment Method</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Reference Number</span>
                <input
                  type="text"
                  value={expenseDraft.reference_no}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, reference_no: event.target.value }))}
                  placeholder="Reference Number"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Description</span>
                <input
                  type="text"
                  value={expenseDraft.description}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Description"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Notes</span>
                <textarea
                  value={expenseDraft.notes}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Notes"
                  rows={2}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Due Date</span>
                  <input
                    type="date"
                    value={expenseDraft.due_date}
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, due_date: event.target.value }))}
                    className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Paid At</span>
                  <input
                    type="date"
                    value={expenseDraft.paid_at}
                    onChange={(event) => setExpenseDraft((current) => ({ ...current, paid_at: event.target.value }))}
                    className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <LiquidButton type="submit" className="flex-1" disabled={savingExpense}>
                  {savingExpense ? 'Saving...' : editingExpenseId ? 'Update Expense' : 'Create Expense'}
                </LiquidButton>
                {editingExpenseId ? (
                  <LiquidButton type="button" tone="tertiary" onClick={resetExpenseForm}>
                    Cancel
                  </LiquidButton>
                ) : null}
              </div>
            </form>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 rounded-2xl border border-stroke/80 bg-bg1/35 p-3">
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <label className="block md:col-span-4">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Date From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setExpensePage(1);
                    setDateFrom(event.target.value);
                  }}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
                  <label className="block md:col-span-4">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Date To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setExpensePage(1);
                    setDateTo(event.target.value);
                  }}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
                  <div className="flex items-end justify-start gap-2 md:col-span-4 md:justify-end">
                <button
                  type="button"
                  aria-label="Clear filters"
                  title="Clear filters"
                  onClick={() => {
                    setExpensePage(1);
                    setDateFrom('');
                    setDateTo('');
                    setStatusFilter('');
                    setCategoryFilter('');
                    setVendorFilter('');
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                    <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Refresh report"
                  title="Refresh report"
                  onClick={() => void loadUnlinkedRestocks()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-8 md:items-end">
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => {
                        setExpensePage(1);
                        setStatusFilter(event.target.value as FinanceExpenseStatus | '');
                      }}
                      className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                    >
                      <option value="">All statuses</option>
                      {EXPENSE_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Category</span>
                    <select
                      value={categoryFilter}
                      onChange={(event) => {
                        setExpensePage(1);
                        setCategoryFilter(event.target.value);
                      }}
                      className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                    >
                      <option value="">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Vendor</span>
                    <select
                      value={vendorFilter}
                      onChange={(event) => {
                        setExpensePage(1);
                        setVendorFilter(event.target.value);
                      }}
                      className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                    >
                      <option value="">All vendors</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Rows</span>
                    <select
                      value={String(expensePerPage)}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        const nextPerPage = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
                        setExpensePage(1);
                        setExpensePerPage(nextPerPage);
                      }}
                      className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                    >
                      {[25, 50, 100].map((size) => (
                        <option key={size} value={size}>{size} / page</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stroke">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-bg1/90 text-xs uppercase tracking-[0.14em] text-gold2/85">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Inventory Link</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingExpenses ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-muted" colSpan={7}>
                        Loading expenses...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-muted" colSpan={7}>
                        No expenses found for current filters.
                      </td>
                    </tr>
                  ) : expenses.map((expense) => (
                    <tr key={expense.id} className="border-t border-stroke/70 bg-bg1/45">
                      <td className="px-4 py-3 text-muted">{expense.expense_date}</td>
                      <td className="px-4 py-3 text-text">
                        {expense.category?.name || `Category #${expense.expense_category_id}`}
                      </td>
                      <td className="px-4 py-3 text-muted">{expense.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {expense.linked_stock_movement ? (
                          <div>
                            <p className="text-text">Stock Move #{expense.linked_stock_movement.id}</p>
                            <p>{expense.linked_stock_movement.ingredient_name || '-'}</p>
                          </div>
                        ) : 'Not linked'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-text">
                        {formatPriceWithCurrency(expense.total_cents / 100, expense.currency || currency)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={expense.status}
                          onChange={(event) => void handleExpenseStatusUpdate(expense, event.target.value as FinanceExpenseStatus)}
                          disabled={updatingStatusId === expense.id}
                          className="themed-native-select rounded-full border border-gold/35 bg-bg1/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 outline-none focus:border-gold disabled:opacity-60"
                        >
                          {EXPENSE_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={`Edit expense ${expense.id}`}
                          title={`Edit expense ${expense.id}`}
                          onClick={() => startEditExpense(expense)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:border-gold/35 hover:text-text"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                            <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4zM13 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Page {expensePage} of {expenseLastPage} • {totalExpensesCount} total
              </p>
              <div className="flex gap-2">
                <LiquidButton
                  type="button"
                  tone="tertiary"
                  disabled={loadingExpenses || expensePage <= 1}
                  onClick={() => setExpensePage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </LiquidButton>
                <LiquidButton
                  type="button"
                  tone="tertiary"
                  disabled={loadingExpenses || expensePage >= expenseLastPage}
                  onClick={() => setExpensePage((current) => Math.min(expenseLastPage, current + 1))}
                >
                  Next
                </LiquidButton>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <GlassCard className="xl:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text">Unlinked Restocks</h3>
                <p className="text-sm text-muted">
                  {unlinkedRestocksCount} restock movement{unlinkedRestocksCount === 1 ? '' : 's'} without linked expense.
                </p>
              </div>
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadUnlinkedRestocks()} disabled={loadingUnlinkedRestocks}>
                {loadingUnlinkedRestocks ? 'Refreshing...' : 'Refresh Unlinked'}
              </LiquidButton>
            </div>

            {unlinkedRestocks.length === 0 ? (
              <div className="rounded-xl border border-stroke bg-bg1/55 px-4 py-6 text-center text-sm text-muted">
                No unlinked restocks found.
              </div>
            ) : (
              <div className="space-y-2">
                {unlinkedRestocks.map((restock) => (
                  <div key={restock.id} className={`rounded-xl border px-3 py-2 ${restock.is_flagged ? 'border-spicy/45 bg-spicy/10' : 'border-stroke bg-bg1/55'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text">
                        {restock.ingredient_name} • {restock.quantity_delta} {restock.unit}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${restock.is_flagged ? 'bg-spicy/20 text-spicy' : 'bg-gold/20 text-gold2'}`}>
                        {restock.is_flagged ? `Flagged (${restock.age_days}d)` : `Open (${restock.age_days}d)`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Ref: {restock.reference || '-'} • {restock.created_at ? new Date(restock.created_at).toLocaleString() : '-'}
                    </p>
                    {restock.notes ? <p className="mt-1 text-xs text-muted2">{restock.notes}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <h3 className="mb-3 text-lg font-semibold text-text">Expense Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-xl border border-stroke bg-bg1/55 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-text">{category.name}</p>
                    <p className="text-xs text-muted">{category.code}</p>
                  </div>
                  <LiquidButton type="button" tone="tertiary" onClick={() => void toggleCategoryActive(category)}>
                    {category.is_active ? 'Deactivate' : 'Activate'}
                  </LiquidButton>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="mb-3 text-lg font-semibold text-text">Vendors</h3>
            <div className="space-y-2">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="flex items-center justify-between rounded-xl border border-stroke bg-bg1/55 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-text">{vendor.name}</p>
                    <p className="text-xs text-muted">{vendor.contact_name || vendor.email || '-'}</p>
                  </div>
                  <LiquidButton type="button" tone="tertiary" onClick={() => void toggleVendorActive(vendor)}>
                    {vendor.is_active ? 'Deactivate' : 'Activate'}
                  </LiquidButton>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {error ? (
          <div className="rounded-xl2 border border-spicy/50 bg-spicy/12 px-4 py-3 text-sm text-spicy">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-xl2 border border-sage/50 bg-sage/12 px-4 py-3 text-sm text-sage">{success}</div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceExpensesPage;
