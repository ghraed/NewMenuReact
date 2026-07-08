import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassChip, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { ensureEchoConnection, getEcho } from '../services/realtime';
import {
  fetchKitchenOrders,
  markKitchenOrderReady,
  startKitchenOrder,
} from '../services/orderService';
import type { KitchenOrderRecord, KitchenOrderStatus } from '../types';
import { useAuth } from '../contexts/useAuth';

const POLL_INTERVAL_MS = 8000;
type ActiveKitchenStatus = Extract<KitchenOrderStatus, 'new' | 'in_progress' | 'ready'>;

const KITCHEN_COLUMNS: Array<{ key: ActiveKitchenStatus; label: string; empty: string }> = [
  { key: 'new', label: 'New', empty: 'No new orders right now.' },
  { key: 'in_progress', label: 'In Progress', empty: 'No orders are being prepared.' },
  { key: 'ready', label: 'Ready', empty: 'No ready tickets yet.' },
];

const statusBadgeClass: Record<KitchenOrderStatus, string> = {
  new: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  in_progress: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  ready: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  served: 'border-white/30 bg-white/15 text-white',
};

const TABLE_CARD_PALETTE = [
  'border-rose-200/70 bg-rose-100/55',
  'border-sky-200/70 bg-sky-100/55',
  'border-emerald-200/70 bg-emerald-100/55',
  'border-amber-200/70 bg-amber-100/55',
  'border-indigo-200/70 bg-indigo-100/55',
  'border-teal-200/70 bg-teal-100/55',
];

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatElapsed = (from?: string | null): string => {
  const start = parseDate(from);
  if (!start) return 'N/A';

  const diffMinutes = Math.max(Math.floor((Date.now() - start.getTime()) / 60000), 0);
  if (diffMinutes < 1) return '< 1 min';
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}h ${mins}m`;
};

const getTableColorClass = (order: KitchenOrderRecord): string => {
  const tableKey = String(order.table?.id ?? order.table?.name ?? order.table_reference ?? order.table_session_id ?? order.id);
  let hash = 0;
  for (let index = 0; index < tableKey.length; index += 1) {
    hash = ((hash << 5) - hash) + tableKey.charCodeAt(index);
    hash |= 0;
  }
  return TABLE_CARD_PALETTE[Math.abs(hash) % TABLE_CARD_PALETTE.length];
};

const ChefDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [orders, setOrders] = useState<KitchenOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<KitchenOrderStatus | 'all'>('all');
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const refreshInFlightRef = useRef(false);

  const replaceOrder = useCallback((nextOrder: KitchenOrderRecord) => {
    setOrders((current) => {
      const exists = current.some((order) => order.id === nextOrder.id);
      if (!exists) {
        return [nextOrder, ...current];
      }
      return current.map((order) => (order.id === nextOrder.id ? nextOrder : order));
    });
  }, []);

  const loadKitchenOrders = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const nextOrders = await fetchKitchenOrders(statusFilter);
      setOrders(nextOrders);
    } catch (err: unknown) {
      if (!silent) {
        setError(getErrorMessage(err, 'Failed to load kitchen orders.'));
      }
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadKitchenOrders();
  }, [loadKitchenOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadKitchenOrders({ silent: true });
    }, POLL_INTERVAL_MS);

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        ensureEchoConnection();
        void loadKitchenOrders({ silent: true });
      }
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [loadKitchenOrders]);

  useEffect(() => {
    if (!user?.restaurant?.id) {
      return undefined;
    }

    const echo = getEcho();
    if (!echo) {
      return undefined;
    }

    const channelName = `restaurant.${user.restaurant.id}.kitchen`;
    const channel = echo.private(channelName);

    channel.listen('.kitchen-order.created', (event: { order?: KitchenOrderRecord }) => {
      if (!event.order) return;
      replaceOrder(event.order);
      showToast(`New order #${event.order.order_number || event.order.id} added to kitchen queue.`, 'secondary', 4200);
    });

    channel.listen('.kitchen-order.updated', (event: { order?: KitchenOrderRecord }) => {
      if (!event.order) return;
      replaceOrder(event.order);
    });

    channel.listen('.kitchen-order.ready', (event: { order?: KitchenOrderRecord }) => {
      if (!event.order) return;
      replaceOrder(event.order);
      showToast(`Order #${event.order.order_number || event.order.id} is ready for runner pickup.`, 'primary', 4200);
    });

    return () => {
      echo.leave(channelName);
    };
  }, [replaceOrder, showToast, user?.restaurant?.id]);

  const groupedOrders = useMemo<Record<ActiveKitchenStatus, KitchenOrderRecord[]>>(() => ({
    new: orders.filter((order) => order.kitchen_status === 'new'),
    in_progress: orders.filter((order) => order.kitchen_status === 'in_progress'),
    ready: orders.filter((order) => order.kitchen_status === 'ready'),
  }), [orders]);

  const avgPreparationTime = useMemo(() => {
    const durations = orders
      .map((order) => {
        const startedAt = parseDate(order.kitchen_started_at);
        const readyAt = parseDate(order.kitchen_ready_at);
        if (!startedAt || !readyAt) return null;
        return Math.max(0, Math.round((readyAt.getTime() - startedAt.getTime()) / 60000));
      })
      .filter((value): value is number => value !== null);

    if (durations.length === 0) {
      return 'N/A';
    }

    const average = Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
    return `${average} min`;
  }, [orders]);

  const handleStartPreparing = async (order: KitchenOrderRecord) => {
    if (processingOrderId === order.id || order.kitchen_status !== 'new') return;
    setProcessingOrderId(order.id);
    setError(null);

    try {
      const response = await startKitchenOrder(order.id);
      replaceOrder(response.order);
      showToast(`Order #${response.order.order_number || response.order.id} moved to In Progress.`, 'secondary', 3600);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update order status.'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleMarkReady = async (order: KitchenOrderRecord) => {
    if (processingOrderId === order.id || order.kitchen_status !== 'in_progress') return;
    setProcessingOrderId(order.id);
    setError(null);

    try {
      const response = await markKitchenOrderReady(order.id);
      replaceOrder(response.order);
      showToast(`Order #${response.order.order_number || response.order.id} marked as Ready.`, 'primary', 3600);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to mark order as ready.'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <DashboardLayout title="Kitchen Dashboard">
      <div className="flex flex-col gap-6 lg:h-[calc(100vh-160px)]">
        <div className="grid shrink-0 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <GlassCard className="bg-gradient-to-br from-amber-300/12 via-amber-200/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">New Orders</p>
            <p className="mt-3 text-3xl font-semibold text-text">{groupedOrders.new.length}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-sky-300/12 via-sky-200/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">In Progress</p>
            <p className="mt-3 text-3xl font-semibold text-text">{groupedOrders.in_progress.length}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-emerald-300/12 via-emerald-200/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">Ready</p>
            <p className="mt-3 text-3xl font-semibold text-text">{groupedOrders.ready.length}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-gold/16 via-gold/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">Avg Prep Time</p>
            <p className="mt-3 text-3xl font-semibold text-text">{avgPreparationTime}</p>
          </GlassCard>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'new', 'in_progress', 'ready'] as const).map((status) => (
              <GlassChip
                key={status}
                type="button"
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className="px-4 py-2 text-sm"
              >
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </GlassChip>
            ))}
          </div>
          <LiquidButton tone="tertiary" onClick={() => void loadKitchenOrders()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </LiquidButton>
        </div>

        {error ? (
          <div className="shrink-0 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3 lg:flex-1 lg:min-h-0">
          {KITCHEN_COLUMNS.map((column) => {
            const columnOrders = groupedOrders[column.key];

            return (
              <div key={column.key} className="flex flex-col rounded-[28px] border border-stroke/80 bg-panel2/30 p-4 shadow-lux1 lg:min-h-0">
                <div className="mb-3 flex shrink-0 items-center justify-between">
                  <h3 className="text-lg font-semibold text-text">{column.label}</h3>
                  <span className="rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold2">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="lg:flex-1 lg:overflow-y-auto lg:min-h-0 lg:overscroll-contain lg:pr-1">
                {columnOrders.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted">
                    {column.empty}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {columnOrders.map((order: KitchenOrderRecord) => (
                      <GlassCard key={order.id} className={`rounded-[22px] p-4 ${getTableColorClass(order)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.16em] text-gold2/80">
                              Table {order.table?.name || order.table_reference}
                            </p>
                            <h4 className="truncate text-lg font-semibold text-text">
                              Order #{order.order_number || order.id}
                            </h4>
                            <p className="mt-1 text-xs text-muted">
                              Ordered {formatElapsed(order.time_ordered || order.confirmed_at || order.created_at)} ago
                            </p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${statusBadgeClass[order.kitchen_status]}`}>
                            {order.kitchen_status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-sm text-muted">
                          {order.items.map((item: KitchenOrderRecord['items'][number]) => (
                            <p key={item.id}>
                              <span className="font-semibold text-text">{item.quantity}×</span>
                              {' '}
                              {item.dish_name}
                            </p>
                          ))}
                        </div>

                        {(order.special_requests || order.notes) ? (
                          <div className="mt-3 rounded-xl2 border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
                            <p className="mb-1 font-semibold uppercase tracking-[0.12em]">Special Request</p>
                            <p>{order.special_requests || order.notes}</p>
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-2 text-xs text-muted">
                          <p>Waiter: <span className="font-medium text-text">{order.waiter_name || order.confirmed_by?.name || 'N/A'}</span></p>
                          <p>Guest/Session: <span className="font-medium text-text">{order.guest_identifier || (order.table_session_id ? `session-${order.table_session_id}` : 'N/A')}</span></p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {order.kitchen_status === 'new' ? (
                            <LiquidButton
                              tone="primary"
                              onClick={() => void handleStartPreparing(order)}
                              disabled={processingOrderId === order.id}
                              className="px-4 py-2 text-sm"
                            >
                              {processingOrderId === order.id ? 'Updating...' : 'Start Preparing'}
                            </LiquidButton>
                          ) : null}

                          {order.kitchen_status === 'in_progress' ? (
                            <LiquidButton
                              tone="primary"
                              onClick={() => void handleMarkReady(order)}
                              disabled={processingOrderId === order.id}
                              className="px-4 py-2 text-sm"
                            >
                              {processingOrderId === order.id ? 'Updating...' : 'Mark as Ready'}
                            </LiquidButton>
                          ) : null}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default ChefDashboardPage;
