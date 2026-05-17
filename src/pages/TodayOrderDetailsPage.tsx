import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchAccountingOrders, fetchPendingOrders } from '../services/orderService';
import api from '../services/api';
import type { OrderRecord } from '../types';

const parseMoney = (value?: string | null): number => {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
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

const TodayOrderDetailsPage: React.FC = () => {
  const { user } = useAuth();
  const { order_id } = useParams<{ order_id: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!order_id) {
        setError('Missing order id.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const targetOrderId = Number.parseInt(order_id, 10);
        if (!Number.isFinite(targetOrderId) || targetOrderId <= 0) {
          throw new Error('Invalid order id.');
        }

        let nextOrder: OrderRecord | null = null;

        try {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayIso = `${year}-${month}-${day}`;

          const response = await api.get<{ orders?: OrderRecord[] }>('/orders/today', {
            params: { date: todayIso },
          });

          const todayOrders = Array.isArray(response.data?.orders) ? response.data.orders : [];
          nextOrder = todayOrders.find((entry) => entry.id === targetOrderId) || null;
        } catch {
          nextOrder = null;
        }

        if (!nextOrder) {
          const pendingOrders = await fetchPendingOrders();
          nextOrder = pendingOrders.find((entry) => entry.id === targetOrderId) || null;
        }

        if (!nextOrder && user?.role === 'admin') {
          const accountingOrders = await fetchAccountingOrders();
          nextOrder = accountingOrders.find((entry) => entry.id === targetOrderId) || null;
        }

        if (!nextOrder) {
          throw new Error('Order not found or not accessible.');
        }

        if (!cancelled) {
          setOrder(nextOrder);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Failed to load order details.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [order_id, user?.role]);

  const subtotal = useMemo(() => parseMoney(order?.invoice.subtotal), [order?.invoice.subtotal]);
  const total = useMemo(() => parseMoney(order?.invoice.total), [order?.invoice.total]);

  return (
    <DashboardLayout title="Order Details">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text">Order Details</h2>
          <Link to="/staff/today-orders" className="inline-flex">
            <LiquidButton type="button" tone="tertiary">Back to Today Orders</LiquidButton>
          </Link>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted">Loading order details...</div>
        ) : error ? (
          <GlassCard className="border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</GlassCard>
        ) : !order ? (
          <GlassCard className="p-4 text-sm text-muted">Order not found.</GlassCard>
        ) : (
          <>
            <GlassCard className="p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Order</p>
                  <p className="text-sm font-semibold text-text">{order.order_number || `Order #${order.id}`}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Table</p>
                  <p className="text-sm font-semibold text-text">{order.table_reference}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Status</p>
                  <p className="text-sm font-semibold text-text">{order.status.replaceAll('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Invoice #</p>
                  <p className="text-sm font-semibold text-text">{order.invoice_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Created</p>
                  <p className="text-sm text-text">{formatDateTime(order.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Confirmed</p>
                  <p className="text-sm text-text">{formatDateTime(order.confirmed_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Accounted</p>
                  <p className="text-sm text-text">{formatDateTime(order.accounted_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">Notes</p>
                  <p className="text-sm text-text">{order.notes || 'N/A'}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <p className="mb-3 text-sm font-semibold text-text">Items</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-xl border border-stroke/55 bg-bg1/50 p-3 sm:grid-cols-[1.5fr_auto_auto_auto] sm:items-center">
                    <p className="text-sm text-text">{item.dish_name}</p>
                    <p className="text-sm text-muted">Qty: {item.quantity}</p>
                    <p className="text-sm text-muted">Unit: ${parseMoney(item.unit_price).toFixed(2)}</p>
                    <p className="text-sm font-semibold text-text">${parseMoney(item.line_subtotal).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <p className="mb-3 text-sm font-semibold text-text">Invoice Summary</p>
              <div className="grid gap-2 text-sm text-text sm:max-w-sm">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span>Discount</span><span>${parseMoney(order.invoice.discount_amount).toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span>VAT</span><span>${parseMoney(order.invoice.vat_amount).toFixed(2)}</span></div>
                <div className="flex items-center justify-between border-t border-stroke/55 pt-2 font-semibold"><span>Total</span><span>${total.toFixed(2)}</span></div>
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TodayOrderDetailsPage;
