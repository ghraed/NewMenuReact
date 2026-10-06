import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TodayOrdersPage from '../../src/pages/TodayOrdersPage';
import TodayOrderDetailsPage from '../../src/pages/TodayOrderDetailsPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), detail: vi.fn(), pending: vi.fn(), accounting: vi.fn(), invoices: vi.fn(), role: 'admin' }));
vi.mock('../../src/services/api', () => ({ default: { get: mocks.get } }));
vi.mock('../../src/services/orderService', () => ({ fetchOrderById: mocks.detail, fetchPendingOrders: mocks.pending, fetchAccountingOrders: mocks.accounting }));
vi.mock('../../src/services/invoiceService', () => ({ fetchInvoices: mocks.invoices }));
vi.mock('../../src/contexts/useAuth', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../../src/components/Admin/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const settledOrder = () => ({
  id: 901, order_number: 'QA_RUN_20261006_SETTLED', invoice_number: 'QA_RUN_20261006_INVOICE', status: 'accounted',
  created_at: '2026-01-15T12:00:00Z', confirmed_at: '2026-01-15T12:00:00Z', accounted_at: '2026-01-15T12:05:00Z',
  cancelled_at: null, table_reference: 'QA_RUN_T01', notes: null,
  invoice: { subtotal: '9.25', total: '9.25', discount_amount: '0.00', vat_amount: '0.00', vat_rate: '0.00', currency: 'USD' },
  confirmed_by: null, accounted_by: null,
  items: [{ id: 1, dish_name: 'QA_RUN_20261006_Dish', quantity: 1, unit_price: '9.25', line_subtotal: '9.25' }],
});

describe('order history pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = 'admin';
    mocks.get.mockResolvedValue({ data: { orders: [settledOrder()] } });
    mocks.detail.mockResolvedValue(settledOrder());
    mocks.pending.mockResolvedValue([]);
    mocks.accounting.mockResolvedValue([]);
    mocks.invoices.mockRejectedValue({ response: { status: 403 } });
  });

  const list = () => render(<MemoryRouter><TodayOrdersPage /></MemoryRouter>);
  const details = (id = '901') => render(<MemoryRouter initialEntries={[`/staff/today-orders/${id}`]}><Routes><Route path="/staff/today-orders/:order_id" element={<TodayOrderDetailsPage />} /></Routes></MemoryRouter>);

  it('shows settled orders as paid without requiring finance reporting', async () => {
    list();
    await screen.findByText('QA_RUN_20261006_SETTLED');
    expect(screen.getByText('Paid: 1')).toBeVisible();
    expect(mocks.get).toHaveBeenCalledWith('/orders/history', expect.objectContaining({ params: expect.objectContaining({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }));
    expect(mocks.pending).not.toHaveBeenCalled();
    expect(mocks.accounting).not.toHaveBeenCalled();
  });

  it('surfaces history failures rather than showing incomplete queue fallbacks', async () => {
    mocks.get.mockRejectedValue({ response: { status: 503, data: { message: 'QA_RUN history unavailable' } } });
    list();
    expect(await screen.findByText('QA_RUN history unavailable')).toBeVisible();
    expect(mocks.pending).not.toHaveBeenCalled();
    expect(mocks.accounting).not.toHaveBeenCalled();
  });

  it('passes the selected date range to history reads', async () => {
    list();
    await screen.findByText('QA_RUN_20261006_SETTLED');
    fireEvent.change(screen.getByLabelText('Date From'), { target: { value: '2026-01-10' } });
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/orders/history', expect.objectContaining({ params: expect.objectContaining({ date_from: '2026-01-10' }) })));
  });

  it('staff reads today with a timezone and counts settled orders as paid', async () => {
    mocks.role = 'staff';
    list();
    await screen.findByText('QA_RUN_20261006_SETTLED');
    expect(screen.getByText('Paid: 1')).toBeVisible();
    expect(mocks.get).toHaveBeenCalledWith('/orders/today', expect.objectContaining({ params: expect.objectContaining({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }));
  });

  it('loads settled or historical details directly by ID', async () => {
    details();
    expect(await screen.findByText('QA_RUN_20261006_Dish')).toBeVisible();
    expect(mocks.detail).toHaveBeenCalledWith(901);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.pending).not.toHaveBeenCalled();
    expect(mocks.accounting).not.toHaveBeenCalled();
  });

  it('does not interpret partial numeric IDs as valid order IDs', async () => {
    details('901invalid');
    expect(await screen.findByText('Invalid order id.')).toBeVisible();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('shows a readable not-found message without exposing backend model names', async () => {
    mocks.detail.mockRejectedValueOnce({ response: { status: 404, data: { message: 'No query results for model [App\\Models\\Order]' } } });
    details();
    expect(await screen.findByText('Order not found or not accessible.')).toBeVisible();
    expect(screen.queryByText(/App\\Models\\Order/)).not.toBeInTheDocument();
  });
});
