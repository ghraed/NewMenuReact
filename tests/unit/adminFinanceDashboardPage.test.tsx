import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminFinanceDashboardPage from '../../src/pages/AdminFinanceDashboardPage';

const mockedApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mockedInvoiceService = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  fetchInvoices: vi.fn(),
  updateInvoice: vi.fn(),
}));

const mockedExpenseService = vi.hoisted(() => ({
  fetchExpenses: vi.fn(),
}));

const mockedPayrollService = vi.hoisted(() => ({
  fetchPayrollPeriods: vi.fn(),
  fetchPayrollSummary: vi.fn(),
}));

const mockedScheduleService = vi.hoisted(() => ({
  fetchStaffSchedules: vi.fn(),
}));

const mockedReportingService = vi.hoisted(() => ({
  fetchTaxSummary: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/ui/liquid-glass', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  LiquidButton: ({
    children,
    onClick,
    disabled,
    type,
    className,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, className }: { children: React.ReactNode; className?: string }) => <section className={className}>{children}</section>,
    span: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
  },
  useInView: () => true,
}));

vi.mock('react-chartjs-2', () => ({
  Chart: () => <div data-testid="finance-chart" />,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      restaurant: {
        currency: 'USD',
        other_currency: 'EUR',
        dollar_rate: 1,
      },
    },
  }),
}));

vi.mock('../../src/services/api', () => ({
  default: mockedApi,
}));

vi.mock('../../src/services/invoiceService', () => ({
  createInvoice: mockedInvoiceService.createInvoice,
  fetchInvoices: mockedInvoiceService.fetchInvoices,
  updateInvoice: mockedInvoiceService.updateInvoice,
}));

vi.mock('../../src/services/financeExpenseService', () => ({
  fetchExpenses: mockedExpenseService.fetchExpenses,
}));

vi.mock('../../src/services/payrollService', () => ({
  fetchPayrollPeriods: mockedPayrollService.fetchPayrollPeriods,
  fetchPayrollSummary: mockedPayrollService.fetchPayrollSummary,
}));

vi.mock('../../src/services/staffScheduleService', () => ({
  fetchStaffSchedules: mockedScheduleService.fetchStaffSchedules,
}));

vi.mock('../../src/services/financeReportingService', () => ({
  fetchTaxSummary: mockedReportingService.fetchTaxSummary,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'adminFinancePage.pagination') {
        return `Page ${options?.page} of ${options?.lastPage} • ${options?.total} total`;
      }
      return key;
    },
  }),
}));

const invoicePages = {
  1: {
    invoices: [
      { id: 3, invoice_date: '2026-05-04', created_at: '2026-05-04T10:00:00Z', status: 'paid', total: 80 },
      { id: 2, invoice_date: '2026-05-03', created_at: '2026-05-03T10:00:00Z', status: 'cancelled', total: 50 },
    ],
    meta: { current_page: 1, last_page: 2, per_page: 200, total: 3 },
  },
  2: {
    invoices: [
      { id: 1, invoice_date: '2026-05-02', created_at: '2026-05-02T10:00:00Z', status: 'issued', total: 120 },
    ],
    meta: { current_page: 2, last_page: 2, per_page: 200, total: 3 },
  },
} as const;

const expensePages = {
  1: {
    expenses: [
      {
        id: 11,
        expense_date: '2026-05-04',
        total_cents: 2200,
        currency: 'USD',
        status: 'paid',
        category: { id: 90, code: 'ops', name: 'Operations', is_active: true },
        linked_stock_movement: null,
      },
      {
        id: 12,
        expense_date: '2026-05-03',
        total_cents: 3300,
        currency: 'USD',
        status: 'approved',
        category: { id: 91, code: 'utilities', name: 'Utilities', is_active: true },
        linked_stock_movement: null,
      },
    ],
    meta: { current_page: 1, last_page: 2, per_page: 200, total: 4 },
  },
  2: {
    expenses: [
      {
        id: 13,
        expense_date: '2026-05-02',
        total_cents: 1550,
        currency: 'USD',
        status: 'paid',
        category: { id: 92, code: 'inventory', name: 'Inventory', is_active: true },
        linked_stock_movement: { id: 400, ingredient_name: 'Rice' },
      },
      {
        id: 14,
        expense_date: '2026-05-02',
        total_cents: 999,
        currency: 'USD',
        status: 'draft',
        category: { id: 90, code: 'ops', name: 'Operations', is_active: true },
        linked_stock_movement: null,
      },
    ],
    meta: { current_page: 2, last_page: 2, per_page: 200, total: 4 },
  },
} as const;

describe('AdminFinanceDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(1000);
      return 1;
    }) as typeof requestAnimationFrame);

    mockedApi.get.mockRejectedValue(new Error('no remote settings'));
    mockedInvoiceService.fetchInvoices.mockImplementation(async ({ page = 1 }) => ({
      ...invoicePages[page as 1 | 2],
      invoices: invoicePages[page as 1 | 2].invoices.map((invoice) => ({
        invoice_number: `INV-${invoice.id}`,
        items: [{ id: invoice.id * 10, name: `Item ${invoice.id}` }],
        payment_method: null,
        notes: null,
        currency: 'USD',
        ...invoice,
      })),
    }));
    mockedExpenseService.fetchExpenses.mockImplementation(async ({ page = 1 }) => expensePages[page as 1 | 2]);
    mockedPayrollService.fetchPayrollSummary.mockResolvedValue({
      date_from: '2026-05-01',
      date_to: '2026-05-31',
      mode: { period_status: 'approved_paid' },
      totals: {
        gross_pay: 120,
        deductions: 10,
        tax: 10,
        net_pay: 100,
        employee_count: 2,
      },
    });
    mockedPayrollService.fetchPayrollPeriods.mockResolvedValue([
      { id: 1, status: 'approved', paid_at: '2026-05-04T09:00:00Z', period_end: '2026-05-04', final_salary: 70, totals: { net_pay: 70 } },
      { id: 2, status: 'paid', paid_at: '2026-05-02T09:00:00Z', period_end: '2026-05-02', final_salary: 30, totals: { net_pay: 30 } },
      { id: 3, status: 'draft', paid_at: '2026-05-05T09:00:00Z', period_end: '2026-05-05', final_salary: 99, totals: { net_pay: 99 } },
    ]);
    mockedScheduleService.fetchStaffSchedules.mockResolvedValue([
      { id: 10, status: 'scheduled' },
      { id: 11, status: 'completed' },
    ]);
    mockedReportingService.fetchTaxSummary.mockResolvedValue({
      date_from: '2026-05-01',
      date_to: '2026-05-31',
      taxable_sales: 180,
      output_vat: 18,
      input_vat: 4,
      net_vat_payable: 14,
    });
    mockedInvoiceService.createInvoice.mockResolvedValue({ id: 999 });
    mockedInvoiceService.updateInvoice.mockResolvedValue({ id: 999 });
  });

  it('builds dashboard totals from paginated fixtures using independent expected arithmetic', async () => {
    render(<AdminFinanceDashboardPage />);

    await waitFor(() => {
      expect(mockedInvoiceService.fetchInvoices).toHaveBeenCalled();
      expect(mockedExpenseService.fetchExpenses).toHaveBeenCalled();
    });

    const invoices = [...invoicePages[1].invoices, ...invoicePages[2].invoices];
    const expenses = [...expensePages[1].expenses, ...expensePages[2].expenses];
    const payrollPeriods = await mockedPayrollService.fetchPayrollPeriods.mock.results[0]?.value;

    const expectedRevenue = invoices
      .filter((invoice) => invoice.status === 'issued' || invoice.status === 'paid' || invoice.status === 'draft')
      .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
    const expectedCogs = expenses
      .filter((expense) => (expense.status === 'approved' || expense.status === 'paid') && expense.linked_stock_movement)
      .reduce((sum, expense) => sum + expense.total_cents / 100, 0);
    const expectedOperating = expenses
      .filter((expense) => (expense.status === 'approved' || expense.status === 'paid') && !expense.linked_stock_movement)
      .reduce((sum, expense) => sum + expense.total_cents / 100, 0);
    const expectedPayroll = payrollPeriods
      .filter((period: { status: string }) => period.status === 'approved' || period.status === 'paid')
      .reduce((sum: number, period: { final_salary?: number; totals?: { net_pay?: number } }) => sum + Number(period.final_salary ?? period.totals?.net_pay ?? 0), 0);
    const expectedNetProfit = expectedRevenue - expectedCogs - expectedOperating - expectedPayroll;
    const expectedOperatingWithPayroll = expectedOperating + expectedPayroll;

    expect(screen.getAllByText(`$${expectedRevenue.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getByText(`$${expectedOperatingWithPayroll.toFixed(2)}`)).toBeInTheDocument();
    expect(screen.getAllByText(`$${expectedPayroll.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getByText(`$${expectedNetProfit.toFixed(2)}`)).toBeInTheDocument();
    expect(screen.getByText('$14.00')).toBeInTheDocument();
    expect(screen.getAllByText('$120.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Page 1 of 1 • 3 total')).toBeInTheDocument();
  });

  it('passes active filters through to invoice and expense fetches without hidden defaults', async () => {
    render(<AdminFinanceDashboardPage />);

    await waitFor(() => {
      expect(mockedInvoiceService.fetchInvoices).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('adminFinancePage.dateFrom'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('adminFinancePage.dateTo'), { target: { value: '2026-05-31' } });
    fireEvent.change(screen.getAllByLabelText('adminFinancePage.status')[0], { target: { value: 'paid' } });

    await waitFor(() => {
      expect(mockedInvoiceService.fetchInvoices).toHaveBeenCalledWith(expect.objectContaining({
        date_from: '2026-05-01',
        date_to: '2026-05-31',
        status: 'paid',
        page: 1,
      }));
      expect(mockedExpenseService.fetchExpenses).toHaveBeenCalledWith(expect.objectContaining({
        date_from: '2026-05-01',
        date_to: '2026-05-31',
        page: 1,
      }));
    });
  });
});
