import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { cancelPendingOrder, confirmPendingOrder, fetchPendingOrders } from '../services/orderService';
import type { OrderRecord } from '../types';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const StaffOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextOrders = await fetchPendingOrders();
      setOrders(nextOrders);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load pending orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const orderCountLabel = useMemo(() => (
    `${orders.length} request${orders.length === 1 ? '' : 's'} waiting for staff action`
  ), [orders.length]);

  const handleConfirm = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    setNotice(null);
    setError(null);

    try {
      const response = await confirmPendingOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice(`Confirmed ${response.order.order_number || `order #${response.order.id}`} for ${response.order.table_reference}.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to confirm order.'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCancel = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    setNotice(null);
    setError(null);

    try {
      const response = await cancelPendingOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice(`Cancelled ${response.order.order_number || `order #${response.order.id}`} for ${response.order.table_reference}.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to cancel order.'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <DashboardLayout title="Staff Order Requests">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">
            {user?.role === 'staff' ? 'Orders waiting for your decision' : 'Staff order confirmations'}
          </h2>
          <p className="mt-1 text-sm text-muted">{orderCountLabel}</p>
        </div>

        <LiquidButton tone="tertiary" onClick={loadOrders} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </LiquidButton>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl2 border border-sage/40 bg-sage/10 p-3 text-sm text-sage">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-muted">Loading pending order requests...</div>
      ) : null}

      {!loading && orders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">🧾</div>
          <h3 className="mb-2 text-xl font-medium text-text">No pending requests</h3>
          <p className="text-muted">New table orders will appear here for staff review.</p>
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <GlassCard key={order.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Pending Staff Review</p>
                  <h3 className="mt-2 text-2xl font-semibold text-text">
                    {order.order_number || `Order #${order.id}`}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    Table {order.table_reference}
                    {order.created_at ? ` • ${new Date(order.created_at).toLocaleString()}` : ''}
                  </p>
                  {order.notes ? (
                    <p className="mt-3 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
                      {order.notes}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Current Subtotal</p>
                  <p className="mt-2 text-2xl font-semibold text-text">${order.invoice.subtotal}</p>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-text">Items</p>
                <div className="mt-3 space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-black/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{item.dish_name}</p>
                        <p className="text-sm text-muted">
                          {item.quantity} × ${item.unit_price}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-gold2">${item.line_subtotal}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <LiquidButton
                  tone="tertiary"
                  onClick={() => handleCancel(order)}
                  disabled={processingOrderId === order.id}
                >
                  {processingOrderId === order.id ? 'Processing...' : 'Cancel Request'}
                </LiquidButton>
                <LiquidButton
                  tone="primary"
                  onClick={() => handleConfirm(order)}
                  disabled={processingOrderId === order.id}
                >
                  {processingOrderId === order.id ? 'Processing...' : 'Confirm Request'}
                </LiquidButton>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : null}
    </DashboardLayout>
  );
};

export default StaffOrdersPage;
