import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassInput,
  GlassSelect,
  LiquidButton,
} from '../components/ui/liquid-glass';
import { accountConfirmedOrder, fetchAccountingOrders } from '../services/orderService';
import type { AccountOrderRequest, DiscountType, OrderRecord } from '../types';

type DraftState = Record<number, {
  vatRate: string;
  discountType: '' | DiscountType;
  discountValue: string;
}>;

const discountOptions = [
  { value: '', label: 'No discount' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percentage', label: 'Percentage' },
] satisfies Array<{ value: '' | DiscountType; label: string }>;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const AccountingOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  const syncDrafts = useCallback((nextOrders: OrderRecord[]) => {
    setDrafts((current) => {
      const nextDrafts: DraftState = {};

      nextOrders.forEach((order) => {
        nextDrafts[order.id] = current[order.id] || {
          vatRate: '0',
          discountType: '',
          discountValue: '0',
        };
      });

      return nextDrafts;
    });
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextOrders = await fetchAccountingOrders();
      setOrders(nextOrders);
      syncDrafts(nextOrders);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load accounting orders.'));
    } finally {
      setLoading(false);
    }
  }, [syncDrafts]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const orderCountLabel = useMemo(() => (
    `${orders.length} staff-confirmed order${orders.length === 1 ? '' : 's'} waiting for accounting`
  ), [orders.length]);

  const updateDraft = (orderId: number, nextValue: Partial<DraftState[number]>) => {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        vatRate: current[orderId]?.vatRate ?? '0',
        discountType: current[orderId]?.discountType ?? '',
        discountValue: current[orderId]?.discountValue ?? '0',
        ...nextValue,
      },
    }));
  };

  const handleFinalize = async (order: OrderRecord) => {
    const draft = drafts[order.id] || { vatRate: '0', discountType: '', discountValue: '0' };
    const payload: AccountOrderRequest = {};
    const parsedVatRate = Number(draft.vatRate);
    const parsedDiscountValue = Number(draft.discountValue);

    if (!Number.isNaN(parsedVatRate)) {
      payload.vat_rate = parsedVatRate;
    }

    if (draft.discountType) {
      payload.discount_type = draft.discountType;
      if (!Number.isNaN(parsedDiscountValue)) {
        payload.discount_value = parsedDiscountValue;
      }
    }

    setProcessingOrderId(order.id);
    setNotice(null);
    setError(null);

    try {
      const response = await accountConfirmedOrder(order.id, payload);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice(`Finalized ${response.order.invoice_number || response.order.order_number || `order #${response.order.id}`}.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to finalize accounting.'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <DashboardLayout title="Accounting">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Confirmed orders waiting for accounting</h2>
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
        <div className="py-12 text-center text-muted">Loading accounting queue...</div>
      ) : null}

      {!loading && orders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">💳</div>
          <h3 className="mb-2 text-xl font-medium text-text">No orders waiting for accounting</h3>
          <p className="text-muted">Staff-confirmed orders will appear here for VAT, discounts, and invoice finalization.</p>
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const draft = drafts[order.id] || { vatRate: '0', discountType: '', discountValue: '0' };

            return (
              <GlassCard key={order.id} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Awaiting Accounting</p>
                    <h3 className="mt-2 text-2xl font-semibold text-text">
                      {order.order_number || `Order #${order.id}`}
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      Table {order.table_reference}
                      {order.confirmed_by ? ` • Confirmed by ${order.confirmed_by.name}` : ''}
                    </p>
                    {order.notes ? (
                      <p className="mt-3 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
                        {order.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Subtotal</p>
                    <p className="mt-2 text-2xl font-semibold text-text">${order.invoice.subtotal}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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

                  <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-text">Invoice Settings</p>
                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">VAT %</label>
                        <GlassInput
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.vatRate}
                          onChange={(event) => updateDraft(order.id, { vatRate: event.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">Discount Type</label>
                        <GlassSelect
                          value={draft.discountType}
                          onChange={(event) => updateDraft(order.id, {
                            discountType: event.target.value as '' | DiscountType,
                            discountValue: event.target.value ? draft.discountValue : '0',
                          })}
                          options={discountOptions}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">Discount Value</label>
                        <GlassInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.discountValue}
                          disabled={!draft.discountType}
                          onChange={(event) => updateDraft(order.id, { discountValue: event.target.value })}
                        />
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                        <div className="flex items-center justify-between gap-3 text-sm text-muted">
                          <span>Pre-accounting total</span>
                          <span className="font-medium text-text">${order.invoice.total}</span>
                        </div>
                        <p className="mt-3 text-xs text-muted2">
                          VAT and discounts are applied here, after staff approves the table order.
                        </p>
                      </div>

                      <LiquidButton
                        tone="primary"
                        onClick={() => handleFinalize(order)}
                        disabled={processingOrderId === order.id}
                      >
                        {processingOrderId === order.id ? 'Finalizing...' : 'Finalize Invoice'}
                      </LiquidButton>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : null}
    </DashboardLayout>
  );
};

export default AccountingOrdersPage;
