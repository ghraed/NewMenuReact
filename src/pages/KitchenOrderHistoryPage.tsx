import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassChip, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { fetchKitchenOrderHistory, undoMarkOrderServed } from '../services/orderService';
import type { KitchenOrderRecord, KitchenOrderStatus } from '../types';

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

const formatDateTime = (value?: string | null): string => {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (from?: string | null, to?: string | null): string => {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start) return '—';
  if (!end) return '—';
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return '—';
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return '< 1 min';
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h ${mins}m`;
};

const STATUS_LABELS: Record<KitchenOrderStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  ready: 'Ready',
  served: 'Served',
};

const STATUS_COLORS: Record<KitchenOrderStatus, string> = {
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

const getTableColorClass = (order: KitchenOrderRecord): string => {
  const tableKey = String(order.table?.id ?? order.table?.name ?? order.table_reference ?? order.table_session_id ?? order.id);
  let hash = 0;
  for (let index = 0; index < tableKey.length; index += 1) {
    hash = ((hash << 5) - hash) + tableKey.charCodeAt(index);
    hash |= 0;
  }
  return TABLE_CARD_PALETTE[Math.abs(hash) % TABLE_CARD_PALETTE.length];
};

type HistoryFilter = 'all' | KitchenOrderStatus;

const KitchenOrderHistoryPage: React.FC = () => {
  const { toast, dismiss } = useGlassToast(3600);
  const [orders, setOrders] = useState<KitchenOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const historyOrders = await fetchKitchenOrderHistory();
      setOrders(historyOrders);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load order history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUndoServed = async (orderId: number) => {
    if (processingOrderId === orderId) return;
    setProcessingOrderId(orderId);

    try {
      await undoMarkOrderServed(orderId);
      await loadHistory();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to undo served.'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((order) => order.kitchen_status === statusFilter);
  }, [orders, statusFilter]);

  const statusCounts = useMemo(() => ({
    all: orders.length,
    new: orders.filter((o) => o.kitchen_status === 'new').length,
    in_progress: orders.filter((o) => o.kitchen_status === 'in_progress').length,
    ready: orders.filter((o) => o.kitchen_status === 'ready').length,
    served: orders.filter((o) => o.kitchen_status === 'served').length,
  }), [orders]);

  return (
    <DashboardLayout title="Kitchen Order History">
      <div className="flex flex-col gap-6">
        <div className="grid shrink-0 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <GlassCard className="bg-gradient-to-br from-amber-300/12 via-amber-200/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">New</p>
            <p className="mt-3 text-3xl font-semibold text-text">{statusCounts.new}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-sky-300/12 via-sky-200/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">In Progress</p>
            <p className="mt-3 text-3xl font-semibold text-text">{statusCounts.in_progress}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-emerald-300/12 via-emerald-200/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">Ready</p>
            <p className="mt-3 text-3xl font-semibold text-text">{statusCounts.ready}</p>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-gold/16 via-gold/8 to-transparent">
            <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">Served</p>
            <p className="mt-3 text-3xl font-semibold text-text">{statusCounts.served}</p>
          </GlassCard>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'new', 'in_progress', 'ready', 'served'] as const).map((status) => (
              <GlassChip
                key={status}
                type="button"
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className="px-4 py-2 text-sm"
              >
                {status === 'all' ? 'All' : STATUS_LABELS[status]}
              </GlassChip>
            ))}
          </div>
          <LiquidButton tone="tertiary" onClick={() => void loadHistory()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </LiquidButton>
        </div>

        {error ? (
          <div className="shrink-0 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-6 text-sm text-muted">
            Loading order history...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-6 text-sm text-muted">
            No orders found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <GlassCard key={order.id} className={`rounded-[22px] p-4 ${getTableColorClass(order)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-gold2/80">
                      Table {order.table?.name || order.table_reference}
                    </p>
                    <h4 className="truncate text-lg font-semibold text-text">
                      Order #{order.order_number || order.id}
                    </h4>
                    <p className="mt-1 text-xs text-muted">
                      Waiter: <span className="font-medium text-text">{order.waiter_name || order.confirmed_by?.name || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${STATUS_COLORS[order.kitchen_status]}`}>
                      {STATUS_LABELS[order.kitchen_status]}
                    </span>
                    {order.kitchen_status === 'served' ? (
                      <button
                        type="button"
                        onClick={() => void handleUndoServed(order.id)}
                        disabled={processingOrderId === order.id}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-text transition hover:bg-white/20 disabled:opacity-50"
                      >
                        {processingOrderId === order.id ? 'Undoing...' : 'Undo Served'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-muted">
                  {order.items.map((item) => (
                    <p key={item.id}>
                      <span className="font-semibold text-text">{item.quantity}×</span>
                      {' '}
                      {item.dish_name}
                    </p>
                  ))}
                </div>

                {(order.special_requests || order.notes) ? (
                  <div className="mt-3 rounded-xl2 p-3 text-xs text-amber-50" style={{ backgroundColor: "#888", border: "1px solid #fff" }}>
                    <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-amber-200">Special Request</p>
                    <p className="leading-relaxed">{order.special_requests || order.notes}</p>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">Ordered</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDateTime(order.time_ordered || order.confirmed_at || order.created_at)}
                    </p>
                  </div>
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">Started</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDateTime(order.kitchen_started_at)}
                    </p>
                  </div>
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">Ready</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDateTime(order.kitchen_ready_at)}
                    </p>
                  </div>
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">Served</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDateTime(order.kitchen_completed_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">New → In Progress</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDuration(order.time_ordered || order.confirmed_at, order.kitchen_started_at)}
                    </p>
                  </div>
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">In Progress → Ready</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDuration(order.kitchen_started_at, order.kitchen_ready_at)}
                    </p>
                  </div>
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-gold2/70">Ready → Served</p>
                    <p className="mt-1 text-xs font-medium text-text">
                      {formatDuration(order.kitchen_ready_at, order.kitchen_completed_at)}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default KitchenOrderHistoryPage;
