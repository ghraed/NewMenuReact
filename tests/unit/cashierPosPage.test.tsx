import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashierPosPage from '../../src/pages/CashierPosPage';
import { setVerifiedBrowserIdentity } from '../../src/services/protectedBrowserStorage';

const mockedOrderService = vi.hoisted(() => ({
  fetchGuestTables: vi.fn(),
  fetchPublishedDishes: vi.fn(),
  fetchPosCapabilities: vi.fn(),
  quickPosCheckout: vi.fn(),
}));

const mockedReport = vi.hoisted(() => ({ fetch: vi.fn() }));

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
        id: 1,
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

vi.mock('../../src/services/complaintCompensationService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/services/complaintCompensationService')>(),
  appendCompensationAuditLogs: vi.fn(),
  fetchCompensationReport: mockedReport.fetch,
  readCompensationAuditLogs: vi.fn(() => []),
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
    localStorage.setItem('admin_auth_token', 'QA_RUN_unit_report');
    setVerifiedBrowserIdentity({ id: 1, name: 'Admin User', email: null, role: 'admin', restaurant: { id: 1, name: 'Alpha', slug: 'alpha' } }, 'QA_RUN_unit_report');
    mockedReport.fetch.mockResolvedValue({ entries: [], totals_by_currency: {}, timezone: 'UTC' });
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

  it('uses server financial facts and never promotes local draft edits into report totals', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([dish]);
    mockedReport.fetch.mockResolvedValue({ entries: [], totals_by_currency: { USD: { waived_revenue: '10.00', refunded_revenue: '8.00', gift_catalog_value: '12.00' } }, timezone: 'UTC' });
    localStorage.setItem('pos_compensation_ledger_v1', JSON.stringify([{ loss_amount: 999 }]));
    render(<CashierPosPage />);
    await waitFor(() => expect(screen.getByText('Waived Revenue').parentElement).toHaveTextContent('$10.00'));
    expect(screen.getByText('Refunded Revenue').parentElement).toHaveTextContent('$8.00');
    expect(screen.getByText('Gift Catalog Value').parentElement).toHaveTextContent('$12.00');
    await saveComplimentary();
    fireEvent.click(screen.getByRole('button', { name: 'cashierPosPage.editIssueCompensation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Compensation' }));
    expect(mockedReport.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Waived Revenue').parentElement).toHaveTextContent('$10.00');
  });

  it('shows unavailable values on report failure and retries without falling back to browser events', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([]);
    mockedReport.fetch.mockRejectedValueOnce(new Error('QA_RUN_unavailable'));
    render(<CashierPosPage />);
    expect(await screen.findByText(/Report unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Waived Revenue').parentElement).toHaveTextContent('—');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
    await waitFor(() => expect(screen.getByText('Waived Revenue').parentElement).toHaveTextContent('$0.00'));
    expect(mockedReport.fetch).toHaveBeenCalledTimes(2);
  });

  it('discards a report response if another tab replaces the authenticated session token', async () => {
    mockedOrderService.fetchPublishedDishes.mockResolvedValue([]);
    let release!: (value: unknown) => void;
    mockedReport.fetch.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(<CashierPosPage />);
    await waitFor(() => expect(mockedReport.fetch).toHaveBeenCalledTimes(1));
    localStorage.setItem('admin_auth_token', 'QA_RUN_different_session');
    release({ entries: [], totals_by_currency: { USD: { waived_revenue: '999.00' } }, timezone: 'UTC' });
    await waitFor(() => expect(screen.getByText('Waived Revenue').parentElement).toHaveTextContent('—'));
    expect(screen.queryByText('$999.00')).not.toBeInTheDocument();
  });

});
