import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchInvoices } from '../services/invoiceService';
import { fetchAccountingOrders, fetchPendingOrders } from '../services/orderService';
import api from '../services/api';
import type { FinanceInvoiceStatus, OrderRecord } from '../types';

interface TodayOrdersResponse {
  orders?: OrderRecord[];
}

type TodayOrderStatus = 'pending' | 'ordered' | 'paid' | 'cancelled';

interface TodayOrderRow {
  order: OrderRecord;
  timelineStatus: TodayOrderStatus;
}

const todayIsoDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateMillis = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString();
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallback;
};

const isSameLocalDay = (value: string | null | undefined, targetIso: string): boolean => {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;

  const date = new Date(parsed);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}` === targetIso;
};

const TodayOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [paidInvoiceStatuses, setPaidInvoiceStatuses] = useState<Record<string, FinanceInvoiceStatus>>({});
  const hasBeenHiddenRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const loadOrders = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    try {
      const today = todayIsoDate();
      let todayOrders: OrderRecord[] = [];

      try {
        const response = await api.get<TodayOrdersResponse>('/orders/today', {
          params: { date: today },
        });
        todayOrders = Array.isArray(response.data?.orders) ? response.data.orders : [];
      } catch {
        const [pendingOrders, accountingOrders] = await Promise.all([
          fetchPendingOrders(),
          fetchAccountingOrders(),
        ]);

        const deduped = new Map<number, OrderRecord>();
        [...pendingOrders, ...accountingOrders].forEach((order) => {
          deduped.set(order.id, order);
        });

        todayOrders = Array.from(deduped.values()).filter((order) => (
          isSameLocalDay(order.created_at, today)
          || isSameLocalDay(order.confirmed_at, today)
          || isSameLocalDay(order.accounted_at, today)
        ));
      }

      setOrders(todayOrders);

      if (user?.role === 'admin') {
        try {
          const invoicesResponse = await fetchInvoices({
            date_from: today,
            date_to: today,
            per_page: 300,
            page: 1,
          });

          const invoiceStatusMap: Record<string, FinanceInvoiceStatus> = {};
          invoicesResponse.invoices.forEach((invoice) => {
            if (invoice.invoice_number) {
              invoiceStatusMap[invoice.invoice_number] = invoice.status;
            }
          });

          setPaidInvoiceStatuses(invoiceStatusMap);
        } catch {
          setPaidInvoiceStatuses({});
        }
      }

      setLastUpdatedAt(new Date().toISOString());
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load today orders.'));
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hasBeenHiddenRef.current = true;
        return;
      }

      if (document.visibilityState === 'visible' && hasBeenHiddenRef.current) {
        void loadOrders({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadOrders]);

  const rows = useMemo<TodayOrderRow[]>(() => {
    const isInvoicePaid = (order: OrderRecord): boolean => {
      const invoiceNumber = order.invoice_number || null;
      if (!invoiceNumber) return false;

      const invoiceStatus = paidInvoiceStatuses[invoiceNumber];
      return invoiceStatus === 'paid';
    };

    const resolveStatus = (order: OrderRecord): TodayOrderStatus => {
      if (order.status === 'staff_cancelled') {
        return 'cancelled';
      }

      if (isInvoicePaid(order)) {
        return 'paid';
      }

      if (order.status === 'staff_confirmed' || order.status === 'accounted') {
        return 'ordered';
      }

      return 'pending';
    };

    return [...orders]
      .sort((left, right) => {
        const rightTime = Math.max(
          parseDateMillis(right.created_at),
          parseDateMillis(right.confirmed_at),
          parseDateMillis(right.accounted_at)
        );
        const leftTime = Math.max(
          parseDateMillis(left.created_at),
          parseDateMillis(left.confirmed_at),
          parseDateMillis(left.accounted_at)
        );
        return rightTime - leftTime;
      })
      .map((order) => ({
        order,
        timelineStatus: resolveStatus(order),
      }));
  }, [orders, paidInvoiceStatuses]);

  const counts = useMemo(() => {
    const summary = {
      total: rows.length,
      pending: 0,
      ordered: 0,
      paid: 0,
      cancelled: 0,
    };

    rows.forEach((row) => {
      summary[row.timelineStatus] += 1;
    });

    return summary;
  }, [rows]);

  return (
    <DashboardLayout title="Today Orders">
      <div className="space-y-5">
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text">Today Orders</h2>
              <p className="text-sm text-muted">Tracks pending, ordered, paid, and cancelled orders for today.</p>
              <p className="mt-1 text-xs text-muted2">Last updated: {formatDateTime(lastUpdatedAt)}</p>
            </div>

            <LiquidButton
              type="button"
              tone="secondary"
              onClick={() => void loadOrders({ silent: true })}
              disabled={refreshing || loading}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </LiquidButton>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-stroke/60 bg-bg1/45 p-3 text-sm text-text">Total: {counts.total}</div>
            <div className="rounded-xl border border-stroke/60 bg-bg1/45 p-3 text-sm text-text">Pending: {counts.pending}</div>
            <div className="rounded-xl border border-stroke/60 bg-bg1/45 p-3 text-sm text-text">Ordered: {counts.ordered}</div>
            <div className="rounded-xl border border-stroke/60 bg-bg1/45 p-3 text-sm text-text">Paid: {counts.paid}</div>
            <div className="rounded-xl border border-stroke/60 bg-bg1/45 p-3 text-sm text-text">Cancelled: {counts.cancelled}</div>
          </div>
        </GlassCard>

        {loading ? (
          <div className="py-10 text-center text-muted">Loading today orders...</div>
        ) : error ? (
          <GlassCard className="border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</GlassCard>
        ) : rows.length === 0 ? (
          <GlassCard className="p-5 text-sm text-muted">No orders found for today.</GlassCard>
        ) : (
          <div className="space-y-3">
            {rows.map(({ order, timelineStatus }) => {
              const badgeClass = timelineStatus === 'paid'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-300/45'
                : timelineStatus === 'ordered'
                  ? 'bg-blue-500/20 text-blue-200 border-blue-300/45'
                  : timelineStatus === 'cancelled'
                    ? 'bg-red-500/20 text-red-200 border-red-300/45'
                    : 'bg-amber-500/20 text-amber-200 border-amber-300/45';

              const orderLabel = order.order_number || `Order #${order.id}`;

              return (
                <GlassCard key={order.id} className="p-4">
                  <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{orderLabel}</p>
                      <p className="truncate text-xs text-muted">Table: {order.table_reference}</p>
                    </div>

                    <div className="text-xs text-muted">
                      <p className="text-muted2">Created</p>
                      <p className="text-text">{formatDateTime(order.created_at)}</p>
                    </div>

                    <div className="text-xs text-muted">
                      <p className="text-muted2">Confirmed</p>
                      <p className="text-text">{formatDateTime(order.confirmed_at)}</p>
                    </div>

                    <div className="text-xs text-muted">
                      <p className="text-muted2">Invoice</p>
                      <p className="text-text">{order.invoice_number || 'N/A'}</p>
                    </div>

                    <div className="flex items-center lg:justify-end">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${badgeClass}`}>
                        {timelineStatus}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TodayOrdersPage;
