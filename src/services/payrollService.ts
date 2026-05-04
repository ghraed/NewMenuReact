import api from './api';
import type { PayrollPeriod, PayrollSummaryMode, PayrollSummaryResponse } from '../types';

export interface PayrollPeriodsResponse {
  periods: PayrollPeriod[];
}

export interface PayrollSummaryFilters {
  date_from?: string;
  date_to?: string;
  period_status?: PayrollSummaryMode;
}

export interface CreatePayrollPeriodPayload {
  period_start: string;
  period_end: string;
  notes?: string;
}

export interface UpdatePayrollPeriodPayload {
  status?: 'draft' | 'approved' | 'paid';
  notes?: string | null;
}

export interface UpsertPayrollEntryPayload {
  user_id: number;
  base_amount_cents: number;
  overtime_amount_cents?: number;
  bonus_amount_cents?: number;
  deduction_amount_cents?: number;
  tax_amount_cents?: number;
  currency?: string;
  notes?: string;
}

interface PayrollPeriodMutationResponse {
  message: string;
  period: PayrollPeriod;
}

export const fetchPayrollPeriods = async (): Promise<PayrollPeriod[]> => {
  const response = await api.get<PayrollPeriodsResponse>('/admin/finance/payroll/periods');
  return response.data.periods;
};

export const fetchPayrollSummary = async (filters: PayrollSummaryFilters): Promise<PayrollSummaryResponse> => {
  const response = await api.get<PayrollSummaryResponse>('/admin/finance/payroll/summary', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      period_status: filters.period_status || undefined,
    },
  });

  return response.data;
};

export const createPayrollPeriod = async (payload: CreatePayrollPeriodPayload): Promise<PayrollPeriod> => {
  const response = await api.post<PayrollPeriodMutationResponse>('/admin/finance/payroll/periods', payload);
  return response.data.period;
};

export const updatePayrollPeriod = async (
  payrollPeriodId: number,
  payload: UpdatePayrollPeriodPayload
): Promise<PayrollPeriod> => {
  const response = await api.patch<PayrollPeriodMutationResponse>(
    `/admin/finance/payroll/periods/${payrollPeriodId}`,
    payload
  );
  return response.data.period;
};

export const upsertPayrollEntries = async (
  payrollPeriodId: number,
  entries: UpsertPayrollEntryPayload[]
): Promise<PayrollPeriod> => {
  const response = await api.put<PayrollPeriodMutationResponse>(
    `/admin/finance/payroll/periods/${payrollPeriodId}/entries`,
    { entries }
  );
  return response.data.period;
};
