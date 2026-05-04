import { describe, expect, it } from 'vitest';
import { buildFinanceReportCsv, parseMoneyField, validateFinanceDateRange } from '../../src/utils/financeReporting';

describe('financeReporting utilities', () => {
  it('prefers major unit field when both major and cents exist', () => {
    const value = parseMoneyField(
      {
        revenue: 42.75,
        revenue_cents: 9900,
      },
      'revenue',
      'revenue_cents'
    );

    expect(value).toBe(42.75);
  });

  it('falls back to cents and converts to major units', () => {
    const value = parseMoneyField(
      {
        gross_profit_cents: 12345,
      },
      'gross_profit',
      'gross_profit_cents'
    );

    expect(value).toBe(123.45);
  });

  it('accepts numeric strings and returns zero for invalid inputs', () => {
    expect(parseMoneyField({ output_vat: '15.5' }, 'output_vat', 'output_vat_cents')).toBe(15.5);
    expect(parseMoneyField({ output_vat: 'abc' }, 'output_vat', 'output_vat_cents')).toBe(0);
  });

  it('validates date range boundaries', () => {
    expect(validateFinanceDateRange('', '')).toBeNull();
    expect(validateFinanceDateRange('2026-01-01', '2026-01-31')).toBeNull();
    expect(validateFinanceDateRange('2026-02-01', '2026-01-31')).toBe('Date From cannot be after Date To.');
  });

  it('builds a stable csv report payload', () => {
    const csv = buildFinanceReportCsv({
      currency: 'USD',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      pnl: {
        date_from: '2026-01-01',
        date_to: '2026-01-31',
        group_by: 'monthly',
        revenue: 1000,
        cogs: 300,
        gross_profit: 700,
        operating_expenses: 250,
        net_profit: 450,
      },
      tax: {
        date_from: '2026-01-01',
        date_to: '2026-01-31',
        taxable_sales: 900,
        output_vat: 90,
        input_vat: 20,
        net_vat_payable: 70,
      },
      payroll: {
        gross_pay: 400,
        deductions: 30,
        tax: 15,
        net_pay: 355,
        employee_count: 6,
      },
    });

    expect(csv).toContain('metric,value');
    expect(csv).toContain('Date Range,2026-01-01 to 2026-01-31');
    expect(csv).toContain('P&L Net Profit,450');
    expect(csv).toContain('Net VAT Payable,70');
    expect(csv).toContain('Employees Paid,6');
  });
});
