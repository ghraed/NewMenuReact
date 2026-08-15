import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashierPosPage from '../../src/pages/CashierPosPage';

const mockedOrderService = vi.hoisted(() => ({
  fetchGuestTables: vi.fn(),
  fetchPublishedDishes: vi.fn(),
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
});
