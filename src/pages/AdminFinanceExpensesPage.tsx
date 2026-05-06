import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import {
  createExpense,
  createExpenseCategory,
  createVendor,
  fetchExpenseCategories,
  fetchExpenses,
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

const AdminFinanceExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const currency = user?.restaurant?.currency ?? 'USD';

  const [categories, setCategories] = useState<FinanceExpenseCategory[]>([]);
  const [vendors, setVendors] = useState<FinanceVendor[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [totalExpensesCount, setTotalExpensesCount] = useState(0);

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
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
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

  const loadReferenceData = useCallback(async () => {
    const [categoriesResponse, vendorsResponse] = await Promise.all([
      fetchExpenseCategories(),
      fetchVendors(),
    ]);

    setCategories(categoriesResponse);
    setVendors(vendorsResponse);
  }, []);

  const loadExpenses = useCallback(async () => {
    const response = await fetchExpenses({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      status: statusFilter || undefined,
      category_id: categoryFilter ? Number(categoryFilter) : undefined,
      vendor_id: vendorFilter ? Number(vendorFilter) : undefined,
      per_page: 200,
    });
    setExpenses(expenseSortNewestFirst(response.expenses));
    setTotalExpensesCount(response.meta.total);
  }, [categoryFilter, dateFrom, dateTo, statusFilter, vendorFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadReferenceData(), loadExpenses()]);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load expense management data.'));
    } finally {
      setLoading(false);
    }
  }, [loadExpenses, loadReferenceData]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
        const created = await createExpense(expensePayloadFromDraft(expenseDraft));
        setExpenses((current) => expenseSortNewestFirst([created, ...current]));
        setTotalExpensesCount((current) => current + 1);
        setSuccess('Expense created.');
        resetExpenseForm();
      } else {
        const updatePayload: UpdateExpensePayload = expensePayloadFromDraft(expenseDraft);
        const updated = await updateExpense(editingExpenseId, updatePayload);
        setExpenses((current) => expenseSortNewestFirst(current.map((expense) => (
          expense.id === updated.id ? updated : expense
        ))));
        setSuccess('Expense updated.');
      }
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
      setExpenses((current) => expenseSortNewestFirst(current.map((item) => (
        item.id === updated.id ? updated : item
      ))));
      setSuccess(`Expense ${updated.id} moved to ${nextStatus}.`);
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
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadAll()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh All'}
              </LiquidButton>
              <LiquidButton type="button" tone="tertiary" onClick={resetExpenseForm}>
                New Expense
              </LiquidButton>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-5 xl:grid-cols-3">
          <GlassCard>
            <h3 className="text-lg font-semibold text-text">Create Expense Category</h3>
            <form className="mt-4 space-y-3" onSubmit={handleCreateCategory}>
              <input
                type="text"
                value={categoryCode}
                onChange={(event) => setCategoryCode(event.target.value)}
                placeholder="Code (e.g. utilities)"
                className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                required
              />
              <input
                type="text"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Display Name"
                className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                required
              />
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
              <input
                type="text"
                value={vendorName}
                onChange={(event) => setVendorName(event.target.value)}
                placeholder="Vendor Name"
                className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                required
              />
              <input
                type="text"
                value={vendorContactName}
                onChange={(event) => setVendorContactName(event.target.value)}
                placeholder="Contact Name"
                className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />
              <input
                type="text"
                value={vendorPhone}
                onChange={(event) => setVendorPhone(event.target.value)}
                placeholder="Phone"
                className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />
              <input
                type="email"
                value={vendorEmail}
                onChange={(event) => setVendorEmail(event.target.value)}
                placeholder="Email"
                className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />
              <input
                type="text"
                value={vendorTaxNumber}
                onChange={(event) => setVendorTaxNumber(event.target.value)}
                placeholder="Tax Number"
                className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />
              <label className="inline-flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={vendorActive}
                  onChange={(event) => setVendorActive(event.target.checked)}
                />
                Active
              </label>
              <textarea
                value={vendorNotes}
                onChange={(event) => setVendorNotes(event.target.value)}
                placeholder="Notes"
                rows={2}
                className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55 md:col-span-2"
              />
              <LiquidButton type="submit" className="md:col-span-2" disabled={savingVendor}>
                {savingVendor ? 'Saving...' : 'Create Vendor'}
              </LiquidButton>
            </form>
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <GlassCard className="xl:col-span-1">
            <h3 className="text-lg font-semibold text-text">{editingExpenseId ? `Edit Expense #${editingExpenseId}` : 'Create Expense'}</h3>
            <form className="mt-4 space-y-3" onSubmit={handleSaveExpense}>
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

              <input
                type="date"
                value={expenseDraft.expense_date}
                onChange={(event) => setExpenseDraft((current) => ({ ...current, expense_date: event.target.value }))}
                className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                required
              />

              <div className="grid grid-cols-2 gap-2">
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
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseDraft.tax_amount}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, tax_amount: event.target.value }))}
                  placeholder="Tax Amount"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={expenseDraft.currency}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  maxLength={3}
                  placeholder="USD"
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text uppercase outline-none focus:border-gold/55"
                  required
                />
                <select
                  value={expenseDraft.status}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, status: event.target.value as FinanceExpenseStatus }))}
                  className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
                >
                  {EXPENSE_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

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

              <input
                type="text"
                value={expenseDraft.reference_no}
                onChange={(event) => setExpenseDraft((current) => ({ ...current, reference_no: event.target.value }))}
                placeholder="Reference Number"
                className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />
              <input
                type="text"
                value={expenseDraft.description}
                onChange={(event) => setExpenseDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description"
                className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />
              <textarea
                value={expenseDraft.notes}
                onChange={(event) => setExpenseDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Notes"
                rows={2}
                className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={expenseDraft.due_date}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, due_date: event.target.value }))}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
                <input
                  type="date"
                  value={expenseDraft.paid_at}
                  onChange={(event) => setExpenseDraft((current) => ({ ...current, paid_at: event.target.value }))}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
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

          <GlassCard className="xl:col-span-2">
            <div className="mb-4 grid gap-3 md:grid-cols-5 md:items-end">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Date From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-gold2/85">Date To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text outline-none focus:border-gold/55"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as FinanceExpenseStatus | '')}
                className="themed-native-select rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
              >
                <option value="">All statuses</option>
                {EXPENSE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="themed-native-select rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
                className="themed-native-select rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm outline-none focus:border-gold/55"
              >
                <option value="">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadExpenses()}>
                Apply Filters
              </LiquidButton>
              <LiquidButton
                type="button"
                tone="tertiary"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setStatusFilter('');
                  setCategoryFilter('');
                  setVendorFilter('');
                }}
              >
                Clear
              </LiquidButton>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stroke">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-bg1/90 text-xs uppercase tracking-[0.14em] text-gold2/85">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-muted" colSpan={6}>
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
                        <LiquidButton type="button" tone="tertiary" onClick={() => startEditExpense(expense)}>
                          Edit
                        </LiquidButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
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
