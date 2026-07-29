import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminFinanceExpensesPage from '../../src/pages/AdminFinanceExpensesPage';

const mockedExpenseService = vi.hoisted(() => ({
  createExpense: vi.fn(),
  createExpenseCategory: vi.fn(),
  createVendor: vi.fn(),
  fetchExpenseCategories: vi.fn(),
  fetchExpenses: vi.fn(),
  fetchUnlinkedRestocks: vi.fn(),
  fetchVendors: vi.fn(),
  updateExpense: vi.fn(),
  updateExpenseCategory: vi.fn(),
  updateVendor: vi.fn(),
}));

const mockedToast = vi.hoisted(() => ({
  dismiss: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/ui/liquid-glass', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  GlassToast: () => null,
  LiquidButton: ({
    children,
    onClick,
    disabled,
    type,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  useGlassToast: () => ({ toast: null, showToast: mockedToast.showToast, dismiss: mockedToast.dismiss }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
  },
  useInView: () => true,
}));

vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      restaurant: {
        currency: 'USD',
        dollar_rate: 1,
      },
    },
  }),
}));

vi.mock('../../src/services/financeExpenseService', () => ({
  createExpense: mockedExpenseService.createExpense,
  createExpenseCategory: mockedExpenseService.createExpenseCategory,
  createVendor: mockedExpenseService.createVendor,
  fetchExpenseCategories: mockedExpenseService.fetchExpenseCategories,
  fetchExpenses: mockedExpenseService.fetchExpenses,
  fetchUnlinkedRestocks: mockedExpenseService.fetchUnlinkedRestocks,
  fetchVendors: mockedExpenseService.fetchVendors,
  updateExpense: mockedExpenseService.updateExpense,
  updateExpenseCategory: mockedExpenseService.updateExpenseCategory,
  updateVendor: mockedExpenseService.updateVendor,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'adminFinanceExpensesPage.pagination') {
        return `Page ${options?.page} of ${options?.lastPage} • ${options?.total} total`;
      }
      return key;
    },
  }),
}));

const categories = [
  { id: 10, name: 'Utilities', code: 'utilities', is_active: true },
  { id: 11, name: 'Marketing', code: 'marketing', is_active: true },
];

const vendors = [
  { id: 20, name: 'City Electric', contact_name: 'Nora', phone: null, email: null, tax_number: null, notes: null, is_active: true },
];

const expenses = [
  {
    id: 100,
    expense_category_id: 10,
    vendor_id: 20,
    expense_date: '2026-05-04',
    amount_cents: 10025,
    tax_amount_cents: 0,
    total_cents: 10025,
    currency: 'USD',
    status: 'paid',
    category: categories[0],
    vendor: vendors[0],
    linked_stock_movement: null,
    payment_method: 'cash',
    reference_no: 'UTIL-1',
    description: 'Power bill',
    notes: null,
    due_date: null,
    paid_at: '2026-05-05T10:00:00Z',
  },
  {
    id: 101,
    expense_category_id: 11,
    vendor_id: null,
    expense_date: '2026-05-03',
    amount_cents: 5000,
    tax_amount_cents: 0,
    total_cents: 5000,
    currency: 'USD',
    status: 'approved',
    category: categories[1],
    vendor: null,
    linked_stock_movement: null,
    payment_method: null,
    reference_no: null,
    description: 'Flyers',
    notes: null,
    due_date: null,
    paid_at: null,
  },
  {
    id: 102,
    expense_category_id: 10,
    vendor_id: null,
    expense_date: '2026-05-02',
    amount_cents: 2500,
    tax_amount_cents: 0,
    total_cents: 2500,
    currency: 'USD',
    status: 'draft',
    category: categories[0],
    vendor: null,
    linked_stock_movement: null,
    payment_method: null,
    reference_no: null,
    description: 'Pending meter check',
    notes: null,
    due_date: null,
    paid_at: null,
  },
] as const;

describe('AdminFinanceExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(1000);
      return 1;
    }) as typeof requestAnimationFrame);

    mockedExpenseService.fetchExpenseCategories.mockResolvedValue(categories);
    mockedExpenseService.fetchVendors.mockResolvedValue(vendors);
    mockedExpenseService.fetchExpenses.mockResolvedValue({
      expenses,
      meta: {
        current_page: 1,
        last_page: 2,
        per_page: 25,
        total: 3,
      },
    });
    mockedExpenseService.fetchUnlinkedRestocks.mockResolvedValue({
      restocks: [],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 200,
        total: 0,
      },
    });
    mockedExpenseService.createExpenseCategory.mockResolvedValue({
      id: 12,
      name: 'Office Rent',
      code: 'office_rent',
      is_active: true,
    });
    mockedExpenseService.createVendor.mockResolvedValue({
      id: 21,
      name: 'Fresh Farm',
      contact_name: 'Maya',
      phone: null,
      email: null,
      tax_number: null,
      notes: null,
      is_active: true,
    });
    mockedExpenseService.createExpense.mockResolvedValue(expenses[0]);
    mockedExpenseService.updateExpense.mockResolvedValue({
      ...expenses[0],
      amount_cents: 12075,
      total_cents: 12075,
      description: 'Updated power bill',
    });
  });

  it('renders independently derived totals and pagination from the loaded expense records', async () => {
    render(<AdminFinanceExpensesPage />);

    await waitFor(() => {
      expect(mockedExpenseService.fetchExpenses).toHaveBeenCalledTimes(1);
    });

    const expectedTotal = expenses.reduce((sum, expense) => sum + expense.total_cents / 100, 0);
    const expectedPaid = expenses
      .filter((expense) => expense.status === 'paid')
      .reduce((sum, expense) => sum + expense.total_cents / 100, 0);
    const expectedApproved = expenses
      .filter((expense) => expense.status === 'approved')
      .reduce((sum, expense) => sum + expense.total_cents / 100, 0);
    const expectedDraft = expenses
      .filter((expense) => expense.status === 'draft')
      .reduce((sum, expense) => sum + expense.total_cents / 100, 0);

    expect(screen.getAllByText(`$${expectedTotal.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`$${expectedPaid.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`$${expectedApproved.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`$${expectedDraft.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getByText('Page 1 of 2 • 3 total')).toBeInTheDocument();
  });

  it('validates paid date rules and submits a decimal create payload in cents', async () => {
    render(<AdminFinanceExpensesPage />);

    await screen.findByText('adminFinanceExpensesPage.heading');

    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.newExpense' }));
    fireEvent.change(screen.getAllByLabelText('adminFinanceExpensesPage.category').at(-1) as Element, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.amount'), { target: { value: '123.45' } });
    fireEvent.change(screen.getAllByLabelText('adminFinanceExpensesPage.status').at(-1) as Element, { target: { value: 'paid' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.createExpense' }));

    await waitFor(() => {
      expect(mockedExpenseService.createExpense).not.toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'adminFinanceExpensesPage.cancel' }).at(-1) as Element);
    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.newExpense' }));
    fireEvent.change(screen.getAllByLabelText('adminFinanceExpensesPage.category').at(-1) as Element, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.amount'), { target: { value: '123.45' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.referenceNumber'), { target: { value: ' REF-42 ' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.descriptionLabel'), { target: { value: '  Water bill  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.createExpense' }));

    await waitFor(() => {
      expect(mockedExpenseService.createExpense).toHaveBeenCalledTimes(1);
    });

    expect(mockedExpenseService.createExpense).toHaveBeenCalledWith(expect.objectContaining({
      expense_category_id: 10,
      amount_cents: 12345,
      tax_amount_cents: 0,
      currency: 'USD',
      status: 'draft',
      paid_at: null,
      reference_no: 'REF-42',
      description: 'Water bill',
    }));
  });

  it('updates an existing expense in cents and can create categories and vendors', async () => {
    render(<AdminFinanceExpensesPage />);

    await screen.findByText('adminFinanceExpensesPage.heading');

    const utilitiesRow = screen.getByText('Power bill').closest('tr');
    expect(utilitiesRow).not.toBeNull();
    const actionButtons = within(utilitiesRow as HTMLElement).getAllByRole('button');
    fireEvent.click(actionButtons[0]);

    const amountInput = screen.getByLabelText('adminFinanceExpensesPage.amount') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '120.75' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.descriptionLabel'), { target: { value: ' Updated power bill ' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.updateExpense' }));

    await waitFor(() => {
      expect(mockedExpenseService.updateExpense).toHaveBeenCalledTimes(1);
    });

    expect(mockedExpenseService.updateExpense).toHaveBeenCalledWith(100, expect.objectContaining({
      amount_cents: 12075,
      description: 'Updated power bill',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.newCategory' }));
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.code'), { target: { value: ' office_rent ' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.displayName'), { target: { value: 'Office Rent' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.createCategory' }));

    await waitFor(() => {
      expect(mockedExpenseService.createExpenseCategory).toHaveBeenCalledWith({
        code: 'office_rent',
        name: 'Office Rent',
        is_active: true,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.newVendor' }));
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.vendorName'), { target: { value: ' Fresh Farm ' } });
    fireEvent.change(screen.getByLabelText('adminFinanceExpensesPage.contactName'), { target: { value: ' Maya ' } });
    fireEvent.click(screen.getByRole('button', { name: 'adminFinanceExpensesPage.createVendor' }));

    await waitFor(() => {
      expect(mockedExpenseService.createVendor).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Fresh Farm',
        contact_name: 'Maya',
      }));
    });
  });
});
