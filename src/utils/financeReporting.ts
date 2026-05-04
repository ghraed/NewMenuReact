import type { FinanceProfitAndLossSummary, FinanceTaxSummary, PayrollSummaryTotals } from '../types';

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const parseMoneyField = (
  source: Record<string, unknown> | null | undefined,
  majorKey: string,
  centsKey: string
): number => {
  if (!source) {
    return 0;
  }

  const major = toFiniteNumber(source[majorKey]);
  if (major !== null) {
    return major;
  }

  const cents = toFiniteNumber(source[centsKey]);
  if (cents !== null) {
    return cents / 100;
  }

  return 0;
};

export const validateFinanceDateRange = (dateFrom: string, dateTo: string): string | null => {
  if (!dateFrom || !dateTo) {
    return null;
  }

  if (dateFrom > dateTo) {
    return 'Date From cannot be after Date To.';
  }

  return null;
};

const escapeCsv = (value: string | number): string => {
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
};

export interface FinanceReportCsvInput {
  currency: string;
  dateFrom: string;
  dateTo: string;
  pnl: FinanceProfitAndLossSummary;
  tax: FinanceTaxSummary;
  payroll: PayrollSummaryTotals;
}

export const buildFinanceReportCsv = (input: FinanceReportCsvInput): string => {
  const rangeLabel = input.dateFrom && input.dateTo
    ? `${input.dateFrom} to ${input.dateTo}`
    : 'All time';

  const rows: Array<[string, string | number]> = [
    ['Currency', input.currency],
    ['Date Range', rangeLabel],
    ['P&L Revenue', input.pnl.revenue],
    ['P&L COGS', input.pnl.cogs],
    ['P&L Gross Profit', input.pnl.gross_profit],
    ['P&L Operating Expenses', input.pnl.operating_expenses],
    ['P&L Net Profit', input.pnl.net_profit],
    ['Taxable Sales', input.tax.taxable_sales],
    ['Output VAT', input.tax.output_vat],
    ['Input VAT', input.tax.input_vat],
    ['Net VAT Payable', input.tax.net_vat_payable],
    ['Payroll Gross', input.payroll.gross_pay],
    ['Payroll Deductions', input.payroll.deductions],
    ['Payroll Tax', input.payroll.tax],
    ['Payroll Net', input.payroll.net_pay],
    ['Employees Paid', input.payroll.employee_count],
  ];

  return [
    'metric,value',
    ...rows.map(([metric, value]) => `${escapeCsv(metric)},${escapeCsv(value)}`),
  ].join('\n');
};
