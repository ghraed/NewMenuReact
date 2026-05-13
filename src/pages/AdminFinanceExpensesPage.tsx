import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { createPortal } from 'react-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
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
  CurrencyCode,
  FinanceExpense,
  FinanceExpenseCategory,
  FinanceExpensePaymentMethod,
  FinanceExpenseStatus,
  FinanceUnlinkedRestockRecord,
  FinanceVendor,
} from '../types';
import { CURRENCY_OPTIONS, formatPriceWithCurrency, normalizeCurrency } from '../utils/currency';

type ExpenseTab = 'expenses' | 'vendors' | 'categories' | 'unlinked';
type DrawerMode = 'expense' | 'vendor' | 'category' | null;

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
  if (firstFieldError) return firstFieldError;

  const message = maybeAxios.response?.data?.message;
  if (typeof message === 'string' && message.trim() !== '') return message;

  if (error instanceof Error && error.message.trim() !== '') return error.message;

  return fallback;
};

const centsFromInput = (value: string): number => {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
};

const centsToInput = (value: number): string => (value / 100).toFixed(2);
const toDateValue = (value: string): string => value.trim();

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

const validateExpenseDates = (draft: ExpenseDraft): string | null => {
  const expenseDate = toDateValue(draft.expense_date);
  const dueDate = toDateValue(draft.due_date);
  const paidAt = toDateValue(draft.paid_at);

  if (!expenseDate) {
    return 'Expense date is required.';
  }

  if (dueDate && dueDate < expenseDate) {
    return 'Due date must be the same day or after expense date.';
  }

  if (draft.status === 'paid' && !paidAt) {
    return 'Paid At date is required when status is paid.';
  }

  if (paidAt && paidAt < expenseDate) {
    return 'Paid At date cannot be before expense date.';
  }

  if (draft.status !== 'paid' && paidAt) {
    return 'Paid At should only be set when status is paid.';
  }

  return null;
};

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
      if (safeLeft !== safeRight) return safeRight - safeLeft;
    }

    return right.id - left.id;
  })
);

const formatPriceWithCurrencyDecimals = (amount: number, currency: string, fractionDigits: number): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const normalized = (currency || 'USD').toUpperCase();
  const symbol = normalized === 'USD' ? '$' : normalized;
  const money = safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  if (normalized === 'USD') return `${symbol}${money}`;
  return `${money} ${symbol}`;
};

const AnimatedCurrencyValue: React.FC<{ value: number; currency: string; className?: string }> = ({ value, currency, className }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-12% 0px -12% 0px' });
  const [progress, setProgress] = useState(0);

  const targetText = useMemo(
    () => formatPriceWithCurrencyDecimals(Number.isFinite(value) ? value : 0, currency, 2),
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

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
  tone: 'neutral' | 'green' | 'blue' | 'amber' | 'red';
  icon: React.ReactNode;
}> = ({ label, value, helper, tone, icon }) => {
  const toneClasses = {
    neutral: {
      card: 'border-stroke bg-bg1/85',
      iconWrap: 'bg-text text-bg1 ring-text/25',
    },
    green: {
      card: 'border-stroke bg-bg1/85',
      iconWrap: 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/35 dark:text-emerald-300',
    },
    blue: {
      card: 'border-stroke bg-bg1/85',
      iconWrap: 'bg-sky-500/12 text-sky-600 ring-sky-500/35 dark:text-sky-300',
    },
    amber: {
      card: 'border-stroke bg-bg1/85',
      iconWrap: 'bg-amber-500/12 text-amber-700 ring-amber-500/35 dark:text-amber-300',
    },
    red: {
      card: 'border-stroke bg-bg1/85',
      iconWrap: 'bg-rose-500/12 text-rose-600 ring-rose-500/35 dark:text-rose-300',
    },
  }[tone];

  return (
    <div className={`rounded-[26px] border p-4 shadow-[0_14px_40px_rgba(71,59,45,0.08)] backdrop-blur ${toneClasses.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
          <p className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-tight text-text">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClasses.iconWrap}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted">{helper}</p>
    </div>
  );
};

const Drawer: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, subtitle, onClose, children }) => {
  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[1200]">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-stroke bg-bg1 p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-text">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-bg1/80 text-muted transition hover:text-text"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
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
  const [expenseSearch, setExpenseSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [unlinkedSearch, setUnlinkedSearch] = useState('');

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
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);

  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => blankDraft(currency));
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ExpenseTab>('expenses');
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);

  const [loading, setLoading] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [loadingUnlinkedRestocks, setLoadingUnlinkedRestocks] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, dismiss } = useGlassToast(4800);

  const showFormError = useCallback((message: string) => {
    setError(message);
    showToast(message, 'secondary', 5200);
  }, [showToast]);

  const showFormSuccess = useCallback((message: string) => {
    showToast(message, 'primary', 3600);
  }, [showToast]);

  const activeCategories = useMemo(() => categories.filter((category) => category.is_active), [categories]);
  const activeVendors = useMemo(() => vendors.filter((vendor) => vendor.is_active), [vendors]);
  const allowedCurrencies = useMemo(
    () => CURRENCY_OPTIONS.map((option) => option.value),
    []
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

  const filteredExpenses = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((expense) => {
      const vendor = expense.vendor?.name?.toLowerCase() ?? '';
      const category = expense.category?.name?.toLowerCase() ?? '';
      const amount = formatPriceWithCurrency(expense.total_cents / 100, expense.currency || currency).toLowerCase();
      return vendor.includes(q) || category.includes(q) || amount.includes(q);
    });
  }, [currency, expenseSearch, expenses]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((vendor) =>
      [vendor.name, vendor.contact_name, vendor.phone, vendor.email, vendor.tax_number]
        .some((field) => (field ?? '').toLowerCase().includes(q))
    );
  }, [vendorSearch, vendors]);

  const filteredUnlinkedRestocks = useMemo(() => {
    const q = unlinkedSearch.trim().toLowerCase();
    if (!q) return unlinkedRestocks;
    return unlinkedRestocks.filter((restock) =>
      [restock.ingredient_name, restock.reference, restock.notes]
        .some((field) => (field ?? '').toLowerCase().includes(q))
    );
  }, [unlinkedRestocks, unlinkedSearch]);

  const loadReferenceData = useCallback(async () => {
    const [categoriesResponse, vendorsResponse] = await Promise.all([fetchExpenseCategories(), fetchVendors()]);
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
      showFormError(getErrorMessage(loadError, 'Failed to load expense management data.'));
    } finally {
      setLoading(false);
    }
  }, [loadReferenceData, loadUnlinkedRestocks, showFormError]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadReferenceData(), loadExpenses(), loadUnlinkedRestocks()]);
    } catch (loadError: unknown) {
      showFormError(getErrorMessage(loadError, 'Failed to load expense management data.'));
    } finally {
      setLoading(false);
    }
  }, [loadExpenses, loadReferenceData, loadUnlinkedRestocks, showFormError]);

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

  const resetVendorForm = () => {
    setEditingVendorId(null);
    setVendorName('');
    setVendorContactName('');
    setVendorPhone('');
    setVendorEmail('');
    setVendorTaxNumber('');
    setVendorNotes('');
    setVendorActive(true);
  };

  const openExpenseDrawer = () => {
    resetExpenseForm();
    setDrawerMode('expense');
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
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
      showFormSuccess('Expense category created.');
      setDrawerMode(null);
    } catch (createError: unknown) {
      showFormError(getErrorMessage(createError, 'Failed to create expense category.'));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveVendor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSavingVendor(true);

    try {
      if (editingVendorId === null) {
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
        showFormSuccess('Vendor created.');
      } else {
        const updated = await updateVendor(editingVendorId, {
          name: vendorName.trim(),
          contact_name: vendorContactName.trim() || null,
          phone: vendorPhone.trim() || null,
          email: vendorEmail.trim() || null,
          tax_number: vendorTaxNumber.trim() || null,
          notes: vendorNotes.trim() || null,
          is_active: vendorActive,
        });
        setVendors((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        showFormSuccess('Vendor updated.');
      }
      resetVendorForm();
      setDrawerMode(null);
    } catch (createError: unknown) {
      showFormError(getErrorMessage(createError, 'Failed to create vendor.'));
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

    if (!expenseDraft.expense_category_id) {
      showFormError('Please select an expense category.');
      return;
    }
    if (!expenseDraft.expense_date) {
      showFormError('Please select the expense date.');
      return;
    }
    if (!allowedCurrencies.includes(normalizeCurrency(expenseDraft.currency) as CurrencyCode)) {
      showFormError('Please select a valid currency.');
      return;
    }
    if (!expenseDraft.amount || centsFromInput(expenseDraft.amount) <= 0) {
      showFormError('Expense amount must be greater than 0.');
      return;
    }
    const dateValidationError = validateExpenseDates(expenseDraft);
    if (dateValidationError) {
      showFormError(dateValidationError);
      return;
    }

    setSavingExpense(true);

    try {
      if (editingExpenseId === null) {
        await createExpense(expensePayloadFromDraft(expenseDraft));
        setExpensePage(1);
        await loadExpenses();
        showFormSuccess('Expense created.');
        resetExpenseForm();
      } else {
        const updatePayload: UpdateExpensePayload = expensePayloadFromDraft(expenseDraft);
        await updateExpense(editingExpenseId, updatePayload);
        await loadExpenses();
        showFormSuccess('Expense updated.');
      }
      setDrawerMode(null);
      void loadUnlinkedRestocks();
    } catch (saveError: unknown) {
      showFormError(getErrorMessage(saveError, 'Failed to save expense.'));
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
    setDrawerMode('expense');
  };

  const startEditVendor = (vendor: FinanceVendor) => {
    setEditingVendorId(vendor.id);
    setVendorName(vendor.name || '');
    setVendorContactName(vendor.contact_name || '');
    setVendorPhone(vendor.phone || '');
    setVendorEmail(vendor.email || '');
    setVendorTaxNumber(vendor.tax_number || '');
    setVendorNotes(vendor.notes || '');
    setVendorActive(vendor.is_active);
    setDrawerMode('vendor');
  };

  const handleExpenseStatusUpdate = async (expense: FinanceExpense, nextStatus: FinanceExpenseStatus) => {
    setUpdatingStatusId(expense.id);
    setError(null);

    try {
      const updated = await updateExpense(expense.id, { status: nextStatus });
      setExpenses((current) => expenseSortNewestFirst(current.map((item) => (item.id === updated.id ? updated : item))));
      showFormSuccess(`Expense ${updated.id} moved to ${nextStatus}.`);
      void loadUnlinkedRestocks();
    } catch (updateError: unknown) {
      showFormError(getErrorMessage(updateError, 'Failed to update expense status.'));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const toggleCategoryActive = async (category: FinanceExpenseCategory) => {
    setError(null);
    try {
      const updated = await updateExpenseCategory(category.id, { is_active: !category.is_active });
      setCategories((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (updateError: unknown) {
      showFormError(getErrorMessage(updateError, 'Failed to update category status.'));
    }
  };

  const toggleVendorActive = async (vendor: FinanceVendor) => {
    setError(null);
    try {
      const updated = await updateVendor(vendor.id, { is_active: !vendor.is_active });
      setVendors((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (updateError: unknown) {
      showFormError(getErrorMessage(updateError, 'Failed to update vendor status.'));
    }
  };

  return (
    <DashboardLayout title="Expense Management">
      <div className="space-y-5">
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold2/85">Finance Operations</p>
              <h2 className="mt-1 text-3xl font-semibold text-text">Expense Management</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Track expenses, vendors, categories, payment status, and stock-linked expenses.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LiquidButton type="button" onClick={openExpenseDrawer}>+ New Expense</LiquidButton>
              <LiquidButton type="button" tone="tertiary" onClick={() => setDrawerMode('vendor')}>New Vendor</LiquidButton>
              <LiquidButton type="button" tone="tertiary" onClick={() => setDrawerMode('category')}>New Category</LiquidButton>
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadAll()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Export'}
              </LiquidButton>
            </div>
          </div>
        </GlassCard>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label={"Expense\u00A0Total"}
            value={<AnimatedCurrencyValue value={expenseTotals.totalAmount} currency={currency} />}
            helper="Across selected range"
            tone="neutral"
            icon={(
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
                <rect x="3" y="7" width="18" height="10" rx="2" />
                <circle cx="12" cy="12" r="2.2" />
                <path d="M7 10.5h.01M17 13.5h.01" strokeLinecap="round" />
              </svg>
            )}
          />
          <StatCard
            label="Paid"
            value={<AnimatedCurrencyValue value={expenseTotals.paidAmount} currency={currency} />}
            helper={`${expenseTotals.paidCount} on this page`}
            tone="green"
            icon={(
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.2} aria-hidden="true">
                <path d="M5 12.5l4.2 4.2L19 7.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          />
          <StatCard
            label="Approved"
            value={<AnimatedCurrencyValue value={expenseTotals.approvedAmount} currency={currency} />}
            helper={`${expenseTotals.approvedCount} on this page`}
            tone="blue"
            icon={(
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.2} aria-hidden="true">
                <path d="M5 12.5l4.2 4.2L19 7.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          />
          <StatCard
            label="Draft"
            value={<AnimatedCurrencyValue value={expenseTotals.draftAmount} currency={currency} />}
            helper={`${expenseTotals.draftCount} on this page`}
            tone="amber"
            icon={(
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.9} aria-hidden="true">
                <circle cx="12" cy="12" r="7.5" />
                <path d="M12 8.5v4.3l2.7 1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          />
          <StatCard
            label="Void"
            value={<AnimatedCurrencyValue value={expenseTotals.voidAmount} currency={currency} />}
            helper={`${expenseTotals.voidCount} on this page`}
            tone="red"
            icon={(
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.9} aria-hidden="true">
                <path d="M12 4.5L20 18a1.3 1.3 0 0 1-1.1 2H5.1A1.3 1.3 0 0 1 4 18L12 4.5z" />
                <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
              </svg>
            )}
          />
        </section>

        <GlassCard className="p-2">
          <div className="flex gap-2 overflow-x-auto">
            {([
              ['expenses', 'Expenses'],
              ['vendors', 'Vendors'],
              ['categories', 'Categories'],
              ['unlinked', 'Unlinked Stocks'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === key ? 'bg-text text-bg1' : 'text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </GlassCard>

        {activeTab === 'expenses' ? (
          <GlassCard>
            <div className="mb-4 grid gap-3 md:grid-cols-12 md:items-end">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Date From</span>
                <input type="date" value={dateFrom} onChange={(event) => { setExpensePage(1); setDateFrom(event.target.value); }} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Date To</span>
                <input type="date" value={dateTo} onChange={(event) => { setExpensePage(1); setDateTo(event.target.value); }} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Status</span>
                <select value={statusFilter} onChange={(event) => { setExpensePage(1); setStatusFilter(event.target.value as FinanceExpenseStatus | ''); }} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm">
                  <option value="">All statuses</option>
                  {EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Category</span>
                <select value={categoryFilter} onChange={(event) => { setExpensePage(1); setCategoryFilter(event.target.value); }} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm">
                  <option value="">All categories</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Vendor</span>
                <select value={vendorFilter} onChange={(event) => { setExpensePage(1); setVendorFilter(event.target.value); }} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm">
                  <option value="">All vendors</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Rows</span>
                <select value={String(expensePerPage)} onChange={(event) => { const parsed = Number(event.target.value); setExpensePage(1); setExpensePerPage(Number.isFinite(parsed) && parsed > 0 ? parsed : 25); }} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm">
                  {[25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                </select>
              </label>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} placeholder="Search by category, vendor, or amount" className="min-w-[280px] flex-1 rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" />
              <LiquidButton type="button" tone="tertiary" onClick={() => { setExpensePage(1); setDateFrom(''); setDateTo(''); setStatusFilter(''); setCategoryFilter(''); setVendorFilter(''); setExpenseSearch(''); }}>
                Clear Filters
              </LiquidButton>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stroke">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-bg1/90 text-xs uppercase tracking-[0.14em] text-muted">
                  <tr>
                    <th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Inventory Link</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingExpenses ? (
                    <tr><td className="px-4 py-10 text-center text-muted" colSpan={7}>Loading expenses...</td></tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr><td className="px-4 py-10 text-center text-muted" colSpan={7}>No expenses found for current filters.</td></tr>
                  ) : filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="border-t border-stroke/70 bg-bg1/45">
                      <td className="px-4 py-3 text-muted">{expense.expense_date}</td>
                      <td className="px-4 py-3 text-text">{expense.category?.name || `Category #${expense.expense_category_id}`}</td>
                      <td className="px-4 py-3 text-muted">{expense.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{expense.linked_stock_movement ? <div><p className="text-text">Stock Move #{expense.linked_stock_movement.id}</p><p>{expense.linked_stock_movement.ingredient_name || '-'}</p></div> : 'Not linked'}</td>
                      <td className="px-4 py-3 font-semibold text-text">{formatPriceWithCurrency(expense.total_cents / 100, expense.currency || currency)}</td>
                      <td className="px-4 py-3">
                        <select value={expense.status} onChange={(event) => void handleExpenseStatusUpdate(expense, event.target.value as FinanceExpenseStatus)} disabled={updatingStatusId === expense.id} className="themed-native-select rounded-full border border-stroke bg-bg1/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                          {EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => startEditExpense(expense)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-muted shadow-lux2 transition hover:text-text">✎</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">Page {expensePage} of {expenseLastPage} • {totalExpensesCount} total</p>
              <div className="flex gap-2">
                <LiquidButton type="button" tone="tertiary" disabled={loadingExpenses || expensePage <= 1} onClick={() => setExpensePage((current) => Math.max(1, current - 1))}>Previous</LiquidButton>
                <LiquidButton type="button" tone="tertiary" disabled={loadingExpenses || expensePage >= expenseLastPage} onClick={() => setExpensePage((current) => Math.min(expenseLastPage, current + 1))}>Next</LiquidButton>
              </div>
            </div>
          </GlassCard>
        ) : null}

        {activeTab === 'vendors' ? (
          <GlassCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-text">Vendors</h3>
                <p className="text-sm text-muted">Manage supplier and service provider records.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Search vendors" className="min-w-[220px] rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" />
                <LiquidButton type="button" onClick={() => { resetVendorForm(); setDrawerMode('vendor'); }}>+ New Vendor</LiquidButton>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredVendors.map((vendor) => (
                <div key={vendor.id} className="rounded-2xl border border-stroke bg-bg1/55 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-lg font-semibold text-text">{vendor.name}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${vendor.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>{vendor.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{vendor.contact_name || '-'}</p>
                  <p className="mt-3 text-sm text-muted">{vendor.phone || '-'}</p>
                  <p className="text-sm text-muted">{vendor.email || '-'}</p>
                  <p className="text-sm text-muted">{vendor.tax_number || '-'}</p>
                  <div className="mt-3 flex gap-2">
                    <LiquidButton type="button" tone="tertiary" onClick={() => startEditVendor(vendor)}>Edit</LiquidButton>
                    <LiquidButton type="button" tone="tertiary" onClick={() => void toggleVendorActive(vendor)}>{vendor.is_active ? 'Deactivate' : 'Activate'}</LiquidButton>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        ) : null}

        {activeTab === 'categories' ? (
          <GlassCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-text">Expense Categories</h3>
                <p className="text-sm text-muted">Keep codes and display names clean for reporting.</p>
              </div>
              <LiquidButton type="button" onClick={() => setDrawerMode('category')}>+ New Category</LiquidButton>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stroke">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-bg1/90 text-xs uppercase tracking-[0.14em] text-muted">
                  <tr><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-t border-stroke/70 bg-bg1/45">
                      <td className="px-4 py-3 font-medium text-text">{category.name}</td>
                      <td className="px-4 py-3 text-muted">{category.code}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${category.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>{category.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3 text-right"><LiquidButton type="button" tone="tertiary" onClick={() => void toggleCategoryActive(category)}>{category.is_active ? 'Deactivate' : 'Activate'}</LiquidButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        ) : null}

        {activeTab === 'unlinked' ? (
          <GlassCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-text">Unlinked Stocks</h3>
                <p className="text-sm text-muted">{unlinkedRestocksCount} stock movements without a linked expense.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input value={unlinkedSearch} onChange={(event) => setUnlinkedSearch(event.target.value)} placeholder="Search stock item" className="min-w-[220px] rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" />
                <LiquidButton type="button" tone="tertiary" onClick={() => void loadUnlinkedRestocks()} disabled={loadingUnlinkedRestocks}>{loadingUnlinkedRestocks ? 'Refreshing...' : 'Refresh Unlinked'}</LiquidButton>
              </div>
            </div>

            <div className="space-y-2">
              {filteredUnlinkedRestocks.map((restock) => (
                <div key={restock.id} className={`rounded-xl border px-3 py-2 ${restock.is_flagged ? 'border-rose-300/50 bg-rose-500/10 dark:border-rose-500/40' : 'border-stroke bg-bg1/55'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{restock.ingredient_name} • {restock.quantity_delta} {restock.unit}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${restock.is_flagged ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>{restock.age_days} stage diff</span>
                      <LiquidButton type="button" tone="tertiary">Link Expense</LiquidButton>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">Ref: {restock.reference || '-'}</p>
                </div>
              ))}
              {!loadingUnlinkedRestocks && filteredUnlinkedRestocks.length === 0 ? (
                <div className="rounded-xl border border-stroke bg-bg1/55 px-4 py-6 text-center text-sm text-muted">No unlinked restocks found.</div>
              ) : null}
            </div>
          </GlassCard>
        ) : null}

        {error ? <div className="rounded-xl2 border border-spicy/50 bg-spicy/12 px-4 py-3 text-sm text-spicy">{error}</div> : null}
      </div>

      <Drawer
        open={drawerMode === 'expense'}
        title={editingExpenseId ? `Edit Expense #${editingExpenseId}` : 'Create Expense'}
        subtitle="Capture category, vendor, amount, payment details, and timeline."
        onClose={() => setDrawerMode(null)}
      >
        <form className="space-y-3" onSubmit={handleSaveExpense}>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Category</span><select value={expenseDraft.expense_category_id} onChange={(event) => setExpenseDraft((current) => ({ ...current, expense_category_id: event.target.value }))} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" required><option value="">Select Category</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.code})</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Vendor</span><select value={expenseDraft.vendor_id} onChange={(event) => setExpenseDraft((current) => ({ ...current, vendor_id: event.target.value }))} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm"><option value="">No Vendor</option>{activeVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Expense Date</span><input type="date" value={expenseDraft.expense_date} onChange={(event) => setExpenseDraft((current) => ({ ...current, expense_date: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" required /></label>
          <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Amount</span><input type="number" min="0" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" required /></label><label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Tax Amount</span><input type="number" min="0" step="0.01" value={expenseDraft.tax_amount} onChange={(event) => setExpenseDraft((current) => ({ ...current, tax_amount: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label></div>
          <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Currency</span><select value={normalizeCurrency(expenseDraft.currency)} onChange={(event) => setExpenseDraft((current) => ({ ...current, currency: normalizeCurrency(event.target.value) }))} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm uppercase" required>{CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Status</span><select value={expenseDraft.status} onChange={(event) => setExpenseDraft((current) => ({ ...current, status: event.target.value as FinanceExpenseStatus, paid_at: event.target.value === 'paid' ? current.paid_at : '' }))} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm">{EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Payment Method</span><select value={expenseDraft.payment_method} onChange={(event) => setExpenseDraft((current) => ({ ...current, payment_method: event.target.value }))} className="themed-native-select w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm"><option value="">No Payment Method</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Reference Number</span><input type="text" value={expenseDraft.reference_no} onChange={(event) => setExpenseDraft((current) => ({ ...current, reference_no: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Description</span><input type="text" value={expenseDraft.description} onChange={(event) => setExpenseDraft((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Notes</span><textarea value={expenseDraft.notes} onChange={(event) => setExpenseDraft((current) => ({ ...current, notes: event.target.value }))} rows={2} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Due Date</span><input type="date" min={expenseDraft.expense_date || undefined} value={expenseDraft.due_date} onChange={(event) => setExpenseDraft((current) => ({ ...current, due_date: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label><label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Paid At</span><input type="date" min={expenseDraft.expense_date || undefined} value={expenseDraft.paid_at} onChange={(event) => setExpenseDraft((current) => ({ ...current, paid_at: event.target.value }))} disabled={expenseDraft.status !== 'paid'} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-55" /></label></div>
          <p className="rounded-xl border border-stroke bg-bg1/45 px-3 py-2 text-xs text-muted">Date rules: Expense Date is required. Due Date is optional but cannot be before Expense Date. Paid At is required only when Status is paid, and cannot be before Expense Date.</p>

          <div className="mt-5 flex justify-end gap-2 border-t border-stroke pt-4">
            <LiquidButton type="button" tone="tertiary" onClick={() => setDrawerMode(null)}>Cancel</LiquidButton>
            <LiquidButton type="submit" disabled={savingExpense}>{savingExpense ? 'Saving...' : editingExpenseId ? 'Update Expense' : 'Create Expense'}</LiquidButton>
          </div>
        </form>
      </Drawer>

      <Drawer open={drawerMode === 'vendor'} title={editingVendorId ? `Edit Vendor #${editingVendorId}` : 'Create Vendor'} subtitle={editingVendorId ? 'Update supplier or service provider details.' : 'Add a new supplier or service provider.'} onClose={() => setDrawerMode(null)}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSaveVendor}>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Vendor Name</span><input type="text" value={vendorName} onChange={(event) => setVendorName(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" required /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Contact Name</span><input type="text" value={vendorContactName} onChange={(event) => setVendorContactName(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Phone</span><input type="text" value={vendorPhone} onChange={(event) => setVendorPhone(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Email</span><input type="email" value={vendorEmail} onChange={(event) => setVendorEmail(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Tax Number</span><input type="text" value={vendorTaxNumber} onChange={(event) => setVendorTaxNumber(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <label className="inline-flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={vendorActive} onChange={(event) => setVendorActive(event.target.checked)} /> Active</label>
          <label className="block md:col-span-2"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Notes</span><textarea value={vendorNotes} onChange={(event) => setVendorNotes(event.target.value)} rows={2} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" /></label>
          <div className="md:col-span-2 mt-2 flex justify-end gap-2 border-t border-stroke pt-4">
            <LiquidButton type="button" tone="tertiary" onClick={() => setDrawerMode(null)}>Cancel</LiquidButton>
            <LiquidButton type="submit" disabled={savingVendor}>{savingVendor ? 'Saving...' : editingVendorId ? 'Update Vendor' : 'Create Vendor'}</LiquidButton>
          </div>
        </form>
      </Drawer>

      <Drawer open={drawerMode === 'category'} title="Create Category" subtitle="Add a code and display name for expense grouping." onClose={() => setDrawerMode(null)}>
        <form className="space-y-3" onSubmit={handleCreateCategory}>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Code</span><input type="text" value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" required /></label>
          <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Display Name</span><input type="text" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="w-full rounded-xl border border-stroke bg-bg1/75 px-3 py-2 text-sm" required /></label>
          <label className="inline-flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={categoryActive} onChange={(event) => setCategoryActive(event.target.checked)} /> Active</label>
          <div className="mt-2 flex justify-end gap-2 border-t border-stroke pt-4">
            <LiquidButton type="button" tone="tertiary" onClick={() => setDrawerMode(null)}>Cancel</LiquidButton>
            <LiquidButton type="submit" disabled={savingCategory}>{savingCategory ? 'Saving...' : 'Create Category'}</LiquidButton>
          </div>
        </form>
      </Drawer>
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminFinanceExpensesPage;
