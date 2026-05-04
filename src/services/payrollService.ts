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
