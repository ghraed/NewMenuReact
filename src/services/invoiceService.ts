import api from './api';
import type { FinanceInvoice, FinanceInvoiceDetails, FinanceInvoiceStatus, FinanceRevenuePoint } from '../types';

export interface InvoiceListFilters {
  date_from?: string;
  date_to?: string;
  status?: FinanceInvoiceStatus | '';
  per_page?: number;
  page?: number;
}

export interface InvoiceRevenueTrendFilters {
  range: 'daily' | 'monthly' | 'yearly';
  date_from?: string;
  date_to?: string;
}

export interface CreateInvoiceItemInput {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoicePayload {
  invoice_date: string;
  status: FinanceInvoiceStatus;
  notes?: string;
  items: CreateInvoiceItemInput[];
}

export interface UpdateInvoicePayload {
  invoice_date?: string;
  status?: FinanceInvoiceStatus;
  notes?: string | null;
  items?: CreateInvoiceItemInput[];
}

interface InvoiceListResponse {
  invoices: FinanceInvoice[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface InvoiceMutationResponse {
  message: string;
  invoice: FinanceInvoice;
}

interface InvoiceRevenueTrendResponse {
  range: 'daily' | 'monthly' | 'yearly';
  date_from: string;
  date_to: string;
  points: FinanceRevenuePoint[];
  totals: {
    revenue: number;
    invoice_count: number;
  };
}

export const fetchInvoices = async (filters: InvoiceListFilters): Promise<InvoiceListResponse> => {
  const response = await api.get<InvoiceListResponse>('/admin/finance/invoices', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      status: filters.status || undefined,
      per_page: filters.per_page || undefined,
      page: filters.page || undefined,
    },
  });

  return response.data;
};

export const createInvoice = async (payload: CreateInvoicePayload): Promise<FinanceInvoice> => {
  const response = await api.post<InvoiceMutationResponse>('/admin/finance/invoices', payload);
  return response.data.invoice;
};

export const updateInvoice = async (invoiceId: number, payload: UpdateInvoicePayload): Promise<FinanceInvoice> => {
  const response = await api.patch<InvoiceMutationResponse>(`/admin/finance/invoices/${invoiceId}`, payload);
  return response.data.invoice;
};

export const fetchInvoiceById = async (invoiceId: number | string): Promise<FinanceInvoiceDetails> => {
  const response = await api.get<{ invoice: FinanceInvoiceDetails }>(`/admin/finance/invoices/${invoiceId}`);
  return response.data.invoice;
};

export const fetchInvoiceRevenueTrends = async (
  filters: InvoiceRevenueTrendFilters
): Promise<InvoiceRevenueTrendResponse> => {
  const response = await api.get<InvoiceRevenueTrendResponse>('/admin/finance/invoices/revenue-trends', {
    params: {
      range: filters.range,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    },
  });

  return response.data;
};
