import api from './api';
import type {
  FinanceExpense,
  FinanceExpenseCategory,
  FinanceExpensePaymentMethod,
  FinanceExpenseStatus,
  FinanceUnlinkedRestockRecord,
  FinanceVendor,
} from '../types';

export interface FinanceExpensesFilters {
  date_from?: string;
  date_to?: string;
  status?: FinanceExpenseStatus | '';
  category_id?: number;
  vendor_id?: number;
  per_page?: number;
  page?: number;
}

export interface CreateExpenseCategoryPayload {
  code: string;
  name: string;
  is_active?: boolean;
}

export interface UpdateExpenseCategoryPayload {
  code?: string;
  name?: string;
  is_active?: boolean;
}

export interface CreateVendorPayload {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  notes?: string;
  is_active?: boolean;
}

export interface UpdateVendorPayload {
  name?: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_number?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface CreateExpensePayload {
  expense_category_id: number;
  vendor_id?: number | null;
  linked_stock_movement_id?: number | null;
  expense_date: string;
  amount_cents: number;
  tax_amount_cents?: number;
  currency: string;
  status?: FinanceExpenseStatus;
  payment_method?: FinanceExpensePaymentMethod | null;
  reference_no?: string | null;
  description?: string | null;
  notes?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
}

export interface UpdateExpensePayload {
  expense_category_id?: number;
  vendor_id?: number | null;
  linked_stock_movement_id?: number | null;
  expense_date?: string;
  amount_cents?: number;
  tax_amount_cents?: number;
  currency?: string;
  status?: FinanceExpenseStatus;
  payment_method?: FinanceExpensePaymentMethod | null;
  reference_no?: string | null;
  description?: string | null;
  notes?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
}

interface CategoriesResponse {
  categories: FinanceExpenseCategory[];
}

interface VendorsResponse {
  vendors: FinanceVendor[];
}

interface CategoryMutationResponse {
  message: string;
  category: FinanceExpenseCategory;
}

interface VendorMutationResponse {
  message: string;
  vendor: FinanceVendor;
}

interface ExpensesListResponse {
  expenses: FinanceExpense[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface ExpenseMutationResponse {
  message: string;
  expense: FinanceExpense;
}

interface UnlinkedRestocksResponse {
  restocks: FinanceUnlinkedRestockRecord[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export const fetchExpenseCategories = async (): Promise<FinanceExpenseCategory[]> => {
  const response = await api.get<CategoriesResponse>('/admin/finance/expense-categories');
  return response.data.categories;
};

export const createExpenseCategory = async (payload: CreateExpenseCategoryPayload): Promise<FinanceExpenseCategory> => {
  const response = await api.post<CategoryMutationResponse>('/admin/finance/expense-categories', payload);
  return response.data.category;
};

export const updateExpenseCategory = async (
  categoryId: number,
  payload: UpdateExpenseCategoryPayload
): Promise<FinanceExpenseCategory> => {
  const response = await api.patch<CategoryMutationResponse>(`/admin/finance/expense-categories/${categoryId}`, payload);
  return response.data.category;
};

export const fetchVendors = async (): Promise<FinanceVendor[]> => {
  const response = await api.get<VendorsResponse>('/admin/finance/vendors');
  return response.data.vendors;
};

export const createVendor = async (payload: CreateVendorPayload): Promise<FinanceVendor> => {
  const response = await api.post<VendorMutationResponse>('/admin/finance/vendors', payload);
  return response.data.vendor;
};

export const updateVendor = async (vendorId: number, payload: UpdateVendorPayload): Promise<FinanceVendor> => {
  const response = await api.patch<VendorMutationResponse>(`/admin/finance/vendors/${vendorId}`, payload);
  return response.data.vendor;
};

export const fetchExpenses = async (filters: FinanceExpensesFilters): Promise<ExpensesListResponse> => {
  const response = await api.get<ExpensesListResponse>('/admin/finance/expenses', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      status: filters.status || undefined,
      category_id: filters.category_id || undefined,
      vendor_id: filters.vendor_id || undefined,
      per_page: filters.per_page || undefined,
      page: filters.page || undefined,
    },
  });

  return response.data;
};

export const createExpense = async (payload: CreateExpensePayload): Promise<FinanceExpense> => {
  const response = await api.post<ExpenseMutationResponse>('/admin/finance/expenses', payload);
  return response.data.expense;
};

export const updateExpense = async (expenseId: number, payload: UpdateExpensePayload): Promise<FinanceExpense> => {
  const response = await api.patch<ExpenseMutationResponse>(`/admin/finance/expenses/${expenseId}`, payload);
  return response.data.expense;
};

export const fetchUnlinkedRestocks = async (filters: {
  date_from?: string;
  date_to?: string;
  ingredient_id?: number;
  per_page?: number;
}): Promise<UnlinkedRestocksResponse> => {
  const response = await api.get<UnlinkedRestocksResponse>('/admin/finance/expenses/unlinked-restocks', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      ingredient_id: filters.ingredient_id || undefined,
      per_page: filters.per_page || undefined,
    },
  });

  return response.data;
};
