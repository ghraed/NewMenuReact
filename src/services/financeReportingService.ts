import api from './api';
import type { FinancePnlGroupBy, FinanceProfitAndLossSummary, FinanceTaxSummary } from '../types';
import { parseMoneyField } from '../utils/financeReporting';

interface ProfitAndLossFilters {
  date_from?: string;
  date_to?: string;
  group_by?: FinancePnlGroupBy;
}

interface TaxSummaryFilters {
  date_from?: string;
  date_to?: string;
}

const normalizePnlResponse = (
  payload: Record<string, unknown>,
  filters: ProfitAndLossFilters
): FinanceProfitAndLossSummary => ({
  date_from: typeof payload.date_from === 'string' ? payload.date_from : (filters.date_from ?? ''),
  date_to: typeof payload.date_to === 'string' ? payload.date_to : (filters.date_to ?? ''),
  group_by: payload.group_by === 'daily' || payload.group_by === 'monthly' || payload.group_by === 'yearly'
    ? payload.group_by
    : (filters.group_by ?? 'monthly'),
  revenue: parseMoneyField(payload, 'revenue', 'revenue_cents'),
  cogs: parseMoneyField(payload, 'cogs', 'cogs_cents'),
  gross_profit: parseMoneyField(payload, 'gross_profit', 'gross_profit_cents'),
  operating_expenses: parseMoneyField(payload, 'operating_expenses', 'operating_expenses_cents'),
  net_profit: parseMoneyField(payload, 'net_profit', 'net_profit_cents'),
});

const normalizeTaxResponse = (
  payload: Record<string, unknown>,
  filters: TaxSummaryFilters
): FinanceTaxSummary => ({
  date_from: typeof payload.date_from === 'string' ? payload.date_from : (filters.date_from ?? ''),
  date_to: typeof payload.date_to === 'string' ? payload.date_to : (filters.date_to ?? ''),
  taxable_sales: parseMoneyField(payload, 'taxable_sales', 'taxable_sales_cents'),
  output_vat: parseMoneyField(payload, 'output_vat', 'output_vat_cents'),
  input_vat: parseMoneyField(payload, 'input_vat', 'input_vat_cents'),
  net_vat_payable: parseMoneyField(payload, 'net_vat_payable', 'net_vat_payable_cents'),
});

export const fetchProfitAndLossSummary = async (
  filters: ProfitAndLossFilters
): Promise<FinanceProfitAndLossSummary> => {
  const response = await api.get<Record<string, unknown>>('/admin/finance/pnl', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      group_by: filters.group_by || undefined,
    },
  });

  return normalizePnlResponse(response.data ?? {}, filters);
};

export const fetchTaxSummary = async (filters: TaxSummaryFilters): Promise<FinanceTaxSummary> => {
  const response = await api.get<Record<string, unknown>>('/admin/finance/tax/summary', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    },
  });

  return normalizeTaxResponse(response.data ?? {}, filters);
};
