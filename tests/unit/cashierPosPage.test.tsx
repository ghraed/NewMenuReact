import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashierPosPage from '../../src/pages/CashierPosPage';

const mockedOrderService = vi.hoisted(() => ({
  fetchGuestTables: vi.fn(),
  fetchPublishedDishes: vi.fn(),
  fetchPosCapabilities: vi.fn(),
  quickPosCheckout: vi.fn(),
}));

const mockedToast = vi.hoisted(() => ({
  showToast: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('../../src/components/Admin/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/ui/liquid-glass', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  GlassToast: () => null,
  LiquidButton: ({ children, onClick, disabled, className }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
  useGlassToast: () => ({ toast: null, showToast: mockedToast.showToast, dismiss: mockedToast.dismiss }),
}));

vi.mock('../../src/contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: 'Admin User',
      role: 'admin',
      restaurant: {
        slug: 'alpha',
        currency: 'USD',
      },
    },
  }),
}));

vi.mock('../../src/services/orderService', () => ({
  fetchGuestTables: mockedOrderService.fetchGuestTables,
  fetchPublishedDishes: mockedOrderService.fetchPublishedDishes,
  fetchPosCapabilities: mockedOrderService.fetchPosCapabilities,
  quickPosCheckout: mockedOrderService.quickPosCheckout,
}));

vi.mock('../../src/services/complaintCompensationService', () => ({
  appendCompensationAuditLogs: vi.fn(),
  appendCompensationLedgerEntries: vi.fn(),
  buildCompensationDashboardReport: vi.fn(() => ({
    total_compensation_cost: 0,
    complaint_loss_total: 0,
    complimentary_value_total: 0,
    most_cancelled_dishes: [],
    most_common_reasons: [],
    staff_approvals: [],
    recent_events: [],
  })),
  readCompensationLedger: vi.fn(() => []),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue && typeof options.defaultValue === 'string') {
        return options.defaultValue.replace('{{dish}}', String(options.dish ?? ''));
      }
      return key;
    },
  }),
}));

describe('CashierPosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedOrderService.fetchPosCapabilities.mockResolvedValue({ compensation_version: 1, can_compensate: true });
    mockedOrderService.fetchGuestTables.mockResolvedValue({
      restaurant: { id: 1, name: 'Alpha', slug: 'alpha' },
      tables: [],
    });
  });

  it('does not show out-of-stock dishes in POS catalog', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([
      {
        id: 10,
        name: 'In Stock Dish',
        price: 10,
        category: 'Food',
        is_orderable: true,
        is_out_of_stock: false,
      },
      {
        id: 20,
        name: 'Out Dish',
        price: 12,
        category: 'Food',
        is_orderable: true,
        is_out_of_stock: true,
      },
    ]);

    render(<CashierPosPage />);

    await waitFor(() => {
      expect(mockedOrderService.fetchPublishedDishes).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('In Stock Dish')).toBeInTheDocument();
    expect(screen.queryByText('Out Dish')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.add' }));
    expect(mockedToast.showToast).not.toHaveBeenCalledWith(expect.stringContaining('Out Dish'), 'secondary');
  });

  it('disables Hold and Checkout when the order is empty', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([]);

    render(<CashierPosPage />);

    expect(await screen.findByRole('button', { name: 'Hold (F4)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Checkout (Ctrl+Enter)' })).toBeDisabled();
  });

  it('does not show payment method controls', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([]);

    render(<CashierPosPage />);

    await screen.findByRole('button', { name: 'Checkout (Ctrl+Enter)' });
    expect(screen.queryByRole('button', { name: 'cash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'card' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'wallet' })).not.toBeInTheDocument();
  });

  it('confirms before holding an in-progress order to resume a held order', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([
      { id: 10, name: 'Test Dish', price: 10, category: 'Food', is_orderable: true, is_out_of_stock: false },
    ]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CashierPosPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'cashierPosPage.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hold (F4)' }));
    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.resume' }));

    expect(confirm).toHaveBeenCalledWith(
      'Resuming this held order will move the current order to the hold list. Continue?',
    );
    expect(mockedToast.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Current order moved to hold. Resumed'),
      'secondary',
    );
  });
  const dish = { id: 10, name: 'QA_RUN_compensation', price: 10, category: 'Food', is_orderable: true, is_out_of_stock: false };

  async function saveComplimentary() {
    fireEvent.click(await screen.findByRole('button', { name: 'cashierPosPage.complimentary', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.editIssueCompensation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Compensation' }));
  }

  it('sends compensation intent and displays the server confirmed payable total', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([dish]);
    mockedOrderService.quickPosCheckout.mockResolvedValue({ compensation_version: 1, order: { invoice_number: 'QA_RUN_invoice', invoice: { total: '0.00', currency: 'USD' } }, payment: { total: '0.00' } });
    render(<CashierPosPage />);
    await saveComplimentary();
    fireEvent.click(screen.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }));
    await waitFor(() => expect(mockedOrderService.quickPosCheckout).toHaveBeenCalledTimes(1));
    const [payload, key] = mockedOrderService.quickPosCheckout.mock.calls[0];
    expect(payload.items[0]).toMatchObject({ status: 'compensated', compensation_type: 'complimentary' });
    expect(payload.items[0]).not.toHaveProperty('final_unit_price');
    expect(payload.items[0]).not.toHaveProperty('approved_by_staff_id');
    expect(key).toEqual(expect.any(String));
    expect(await screen.findByRole('status')).toHaveTextContent('QA_RUN_invoice · Paid $0.00');
    expect(mockedToast.showToast).toHaveBeenCalledWith('Checkout complete: QA_RUN_invoice. Paid $0.00.', 'secondary', 4500);
  });

  it('fails closed on an old server while ordinary checkout remains available', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([dish]);
    mockedOrderService.fetchPosCapabilities.mockRejectedValue({ response: { status: 404 } });
    render(<CashierPosPage />);
    const complimentary = await screen.findByRole('button', { name: 'cashierPosPage.complimentary', exact: true });
    expect(complimentary).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.add' }));
    expect(screen.getByRole('button', { name: 'Checkout (Ctrl+Enter)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'cashierPosPage.editIssueCompensation' })).toBeDisabled();
  });

  it('retains rejected compensation and reuses the attempt key on an unchanged retry', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([dish]);
    mockedOrderService.quickPosCheckout.mockRejectedValue({ response: { status: 422, data: { message: 'Invalid compensation intent.' } } });
    render(<CashierPosPage />);
    await saveComplimentary();
    fireEvent.click(screen.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }));
    await waitFor(() => expect(mockedToast.showToast).toHaveBeenCalledWith('Invalid compensation intent.', 'secondary', 4500));
    expect(screen.getByRole('button', { name: 'Checkout (Ctrl+Enter)' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }));
    await waitFor(() => expect(mockedOrderService.quickPosCheckout).toHaveBeenCalledTimes(2));
    expect(mockedOrderService.quickPosCheckout.mock.calls[0][1]).toEqual(expect.any(String));
    expect(mockedOrderService.quickPosCheckout.mock.calls[1][1]).toBe(mockedOrderService.quickPosCheckout.mock.calls[0][1]);
    expect(mockedToast.showToast.mock.calls.some(([message]) => message.startsWith('Checkout complete:'))).toBe(false);
  });

  it('rounds a half cent retained unit price before multiplying quantity', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([{ ...dish, price: 0.03 }]);
    render(<CashierPosPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'cashierPosPage.complimentary', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.editIssueCompensation' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'cashierPosPage.compensationType' }), { target: { value: 'partial_discount' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'cashierPosPage.partialDiscount' }), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Compensation' }));
    expect(screen.getByText('Total').parentElement).toHaveTextContent('$0.02');
  });

});
