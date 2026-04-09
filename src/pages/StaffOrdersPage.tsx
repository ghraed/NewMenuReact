import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { getEcho } from '../services/realtime';
import {
  cancelPendingOrder,
  confirmPendingOrder,
  fetchGuestTables,
  fetchPendingOrders,
  fetchPendingWaves,
  resolvePendingWave,
} from '../services/orderService';
import type { OrderRecord, TableWaveRecord } from '../types';

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
  const [waves, setWaves] = useState<TableWaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [processingWaveId, setProcessingWaveId] = useState<number | null>(null);
  const [adminRealtimeTableIds, setAdminRealtimeTableIds] = useState<number[]>([]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextOrders, nextWaves] = await Promise.all([
        fetchPendingOrders(),
        fetchPendingWaves(),
      ]);
      setOrders(nextOrders);
      setWaves(nextWaves);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load pending staff activity.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (user?.role !== 'admin' || !user.restaurant?.slug) {
      setAdminRealtimeTableIds([]);
      return;
    }

    let isActive = true;

    const loadRealtimeTables = async () => {
      try {
        const response = await fetchGuestTables(user.restaurant!.slug);

        if (!isActive) {
          return;
        }

        setAdminRealtimeTableIds(response.tables.map((table) => table.id));
      } catch {
        if (isActive) {
          setAdminRealtimeTableIds([]);
        }
      }
    };

    loadRealtimeTables();

    return () => {
      isActive = false;
    };
  }, [user?.role, user?.restaurant?.slug]);

  useEffect(() => {
    if (!user?.restaurant?.id) {
      return undefined;
    }

    const echo = getEcho();

    if (!echo) {
      return undefined;
    }

    const tableIds = user.role === 'admin'
      ? adminRealtimeTableIds
      : (user.assigned_tables ?? []).map((table) => table.id);

    if (tableIds.length === 0) {
      return undefined;
    }

    const uniqueTableIds = Array.from(new Set(tableIds));
    const channelNames = uniqueTableIds.map(
      (tableId) => `restaurant.${user.restaurant!.id}.table.${tableId}.waves`
    );

    channelNames.forEach((channelName) => {
      const channel = echo.private(channelName);

      channel.listen('.table-wave.created', (event: { wave?: TableWaveRecord }) => {
        const nextWave = event.wave;

        if (!nextWave) {
          return;
        }

        setWaves((current) => {
          const alreadyExists = current.some((wave) => wave.id === nextWave.id);

          if (alreadyExists) {
            return current.map((wave) => (wave.id === nextWave.id ? nextWave : wave));
          }

          return [nextWave, ...current];
        });

        setNotice(`New wave from ${nextWave.table_reference}.`);
      });

      channel.listen('.table-wave.resolved', (event: { wave?: TableWaveRecord }) => {
        const resolvedWave = event.wave;

        if (!resolvedWave) {
          return;
        }

        setWaves((current) => current.filter((wave) => wave.id !== resolvedWave.id));
      });
    });

    return () => {
      channelNames.forEach((channelName) => {
        echo.leave(channelName);
      });
    };
  }, [adminRealtimeTableIds, user?.assigned_tables, user?.restaurant?.id, user?.role]);

  const orderCountLabel = useMemo(() => (
    `${orders.length} request${orders.length === 1 ? '' : 's'} waiting for staff action`
  ), [orders.length]);

  const waveCountLabel = useMemo(() => (
    `${waves.length} wave${waves.length === 1 ? '' : 's'} waiting for service`
  ), [waves.length]);

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

  const handleResolveWave = async (wave: TableWaveRecord) => {
    setProcessingWaveId(wave.id);
    setNotice(null);
    setError(null);

    try {
      const response = await resolvePendingWave(wave.id);
      setWaves((current) => current.filter((item) => item.id !== wave.id));
      setNotice(`Marked the wave from ${response.wave.table_reference} as handled.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to resolve wave.'));
    } finally {
      setProcessingWaveId(null);
    }
  };

  return (
    <DashboardLayout title="Staff Service Requests">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">
            {user?.role === 'staff' ? 'Orders waiting for your decision' : 'Staff order confirmations'}
          </h2>
          <p className="mt-1 text-sm text-muted">{waveCountLabel} • {orderCountLabel}</p>
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
        <div className="py-12 text-center text-muted">Loading pending staff activity...</div>
      ) : null}

      {!loading && waves.length === 0 && orders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">👋</div>
          <h3 className="mb-2 text-xl font-medium text-text">No pending staff activity</h3>
          <p className="text-muted">New guest waves and table orders will appear here for staff review.</p>
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-4">
          {waves.map((wave) => (
            <GlassCard key={`wave-${wave.id}`} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Guest Wave</p>
                  <h3 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-text">
                    <span aria-hidden="true">👋</span>
                    <span>Table {wave.table_reference}</span>
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    Guest is calling for staff assistance.
                    {wave.created_at ? ` • ${new Date(wave.created_at).toLocaleString()}` : ''}
                  </p>
                </div>

                <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Service Call</p>
                  <p className="mt-2 text-lg font-semibold text-text">{wave.table_reference}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <LiquidButton
                  tone="primary"
                  onClick={() => handleResolveWave(wave)}
                  disabled={processingWaveId === wave.id}
                >
                  {processingWaveId === wave.id ? 'Processing...' : 'Mark Handled'}
                </LiquidButton>
              </div>
            </GlassCard>
          ))}

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
