import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchAccountingOrders, fetchPendingOrders } from '../services/orderService';
import api from '../services/api';
import type { OrderRecord } from '../types';
import { translateStatusLabel } from '../i18n/dynamic';

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { order_id } = useParams<{ order_id: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!order_id) {
        setError(t('todayOrderDetailsPage.missingOrderId'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const targetOrderId = Number.parseInt(order_id, 10);
        if (!Number.isFinite(targetOrderId) || targetOrderId <= 0) {
          throw new Error(t('todayOrderDetailsPage.invalidOrderId'));
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
          throw new Error(t('todayOrderDetailsPage.orderNotFoundOrNotAccessible'));
        }

        if (!cancelled) {
          setOrder(nextOrder);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, t('todayOrderDetailsPage.failedLoad')));
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
  }, [order_id, t, user?.role]);

  const subtotal = useMemo(() => parseMoney(order?.invoice.subtotal), [order?.invoice.subtotal]);
  const total = useMemo(() => parseMoney(order?.invoice.total), [order?.invoice.total]);

  return (
    <DashboardLayout title={t('todayOrderDetailsPage.pageTitle')}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text">{t('todayOrderDetailsPage.heading')}</h2>
          <Link to="/staff/today-orders" className="inline-flex">
            <LiquidButton type="button" tone="tertiary">{t('todayOrderDetailsPage.backToTodayOrders')}</LiquidButton>
          </Link>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted">{t('todayOrderDetailsPage.loading')}</div>
        ) : error ? (
          <GlassCard className="border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</GlassCard>
        ) : !order ? (
          <GlassCard className="p-4 text-sm text-muted">{t('todayOrderDetailsPage.orderNotFound')}</GlassCard>
        ) : (
          <>
            <GlassCard className="p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.order')}</p>
                  <p className="text-sm font-semibold text-text">{order.order_number || `Order #${order.id}`}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.table')}</p>
                  <p className="text-sm font-semibold text-text">{order.table_reference}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.status')}</p>
                  <p className="text-sm font-semibold text-text">{translateStatusLabel(order.status.replaceAll('_', ' '))}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.invoiceNumber')}</p>
                  <p className="text-sm font-semibold text-text">{order.invoice_number || t('todayOrderDetailsPage.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.created')}</p>
                  <p className="text-sm text-text">{formatDateTime(order.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.confirmed')}</p>
                  <p className="text-sm text-text">{formatDateTime(order.confirmed_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.accounted')}</p>
                  <p className="text-sm text-text">{formatDateTime(order.accounted_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted2">{t('todayOrderDetailsPage.notes')}</p>
                  <p className="text-sm text-text">{order.notes || t('todayOrderDetailsPage.notAvailable')}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <p className="mb-3 text-sm font-semibold text-text">{t('todayOrderDetailsPage.items')}</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-xl border border-stroke/55 bg-bg1/50 p-3 sm:grid-cols-[1.5fr_auto_auto_auto] sm:items-center">
                    <p className="text-sm text-text">{item.dish_name}</p>
                    <p className="text-sm text-muted">{t('todayOrderDetailsPage.quantity', { count: item.quantity })}</p>
                    <p className="text-sm text-muted">{t('todayOrderDetailsPage.unitPrice', { value: parseMoney(item.unit_price).toFixed(2) })}</p>
                    <p className="text-sm font-semibold text-text">${parseMoney(item.line_subtotal).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <p className="mb-3 text-sm font-semibold text-text">{t('todayOrderDetailsPage.invoiceSummary')}</p>
              <div className="grid gap-2 text-sm text-text sm:max-w-sm">
                <div className="flex items-center justify-between"><span>{t('todayOrderDetailsPage.subtotal')}</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span>{t('todayOrderDetailsPage.discount')}</span><span>${parseMoney(order.invoice.discount_amount).toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span>{t('todayOrderDetailsPage.vat')}</span><span>${parseMoney(order.invoice.vat_amount).toFixed(2)}</span></div>
                <div className="flex items-center justify-between border-t border-stroke/55 pt-2 font-semibold"><span>{t('todayOrderDetailsPage.total')}</span><span>${total.toFixed(2)}</span></div>
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TodayOrderDetailsPage;
