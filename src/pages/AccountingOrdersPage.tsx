import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassChip,
  GlassInput,
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

type InvoicePreview = {
  subtotal: number;
  discountType: '' | DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableSubtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
};

const parseDraftNumber = (value: string): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const toCents = (value: number | string): number => Math.round(Number(value || 0) * 100);

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;

const calculateInvoicePreview = (
  order: OrderRecord,
  draft: DraftState[number]
): InvoicePreview => {
  const subtotalCents = toCents(order.invoice.subtotal);
  const vatRate = Math.max(parseDraftNumber(draft.vatRate), 0);
  const rawDiscountValue = Math.max(parseDraftNumber(draft.discountValue), 0);
  const discountValue = draft.discountType === 'percentage'
    ? Math.min(rawDiscountValue, 100)
    : rawDiscountValue;

  let discountAmountCents = 0;

  if (draft.discountType === 'percentage' && discountValue > 0) {
    discountAmountCents = Math.round(subtotalCents * discountValue / 100);
  }

  if (draft.discountType === 'fixed' && discountValue > 0) {
    discountAmountCents = toCents(discountValue);
  }

  discountAmountCents = Math.min(discountAmountCents, subtotalCents);

  const taxableSubtotalCents = Math.max(subtotalCents - discountAmountCents, 0);
  const vatAmountCents = Math.round(taxableSubtotalCents * vatRate / 100);
  const totalCents = taxableSubtotalCents + vatAmountCents;

  return {
    subtotal: subtotalCents / 100,
    discountType: draft.discountType,
    discountValue,
    discountAmount: discountAmountCents / 100,
    taxableSubtotal: taxableSubtotalCents / 100,
    vatRate,
    vatAmount: vatAmountCents / 100,
    total: totalCents / 100,
  };
};

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
          vatRate: order.invoice.vat_rate || '0',
          discountType: order.invoice.discount_type || '',
          discountValue: order.invoice.discount_value || '0',
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
    const preview = calculateInvoicePreview(order, draft);
    const payload: AccountOrderRequest = {};

    payload.vat_rate = preview.vatRate;

    if (preview.discountType) {
      payload.discount_type = preview.discountType;
      payload.discount_value = preview.discountValue;
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
            const preview = calculateInvoicePreview(order, draft);

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
                          rightSlot="%"
                          onChange={(event) => updateDraft(order.id, { vatRate: event.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">Discount Type</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {discountOptions.map((option) => (
                            <GlassChip
                              key={option.value || 'none'}
                              type="button"
                              active={draft.discountType === option.value}
                              onClick={() => updateDraft(order.id, {
                                discountType: option.value,
                                discountValue: option.value ? draft.discountValue : '0',
                              })}
                              className="px-4 py-2 text-sm"
                            >
                              {option.label}
                            </GlassChip>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">
                          {draft.discountType === 'percentage' ? 'Discount %' : 'Discount Value'}
                        </label>
                        <GlassInput
                          type="number"
                          min="0"
                          max={draft.discountType === 'percentage' ? '100' : undefined}
                          step="0.01"
                          value={draft.discountValue}
                          disabled={!draft.discountType}
                          rightSlot={draft.discountType === 'percentage' ? '%' : '$'}
                          onChange={(event) => updateDraft(order.id, { discountValue: event.target.value })}
                        />
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted2">Live Invoice Preview</p>
                        <div className="mt-3 space-y-2 text-sm text-muted">
                          <div className="flex items-center justify-between gap-3">
                            <span>Subtotal</span>
                            <span className="font-medium text-text">{formatMoney(preview.subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>
                              Discount
                              {preview.discountType === 'percentage' ? ` (${preview.discountValue.toFixed(2)}%)` : ''}
                            </span>
                            <span className="font-medium text-text">- {formatMoney(preview.discountAmount)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Taxable subtotal</span>
                            <span className="font-medium text-text">{formatMoney(preview.taxableSubtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>VAT ({preview.vatRate.toFixed(2)}%)</span>
                            <span className="font-medium text-text">+ {formatMoney(preview.vatAmount)}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-base">
                            <span className="font-semibold text-text">Final total</span>
                            <span className="text-lg font-semibold text-gold2">{formatMoney(preview.total)}</span>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted2">
                          This preview matches the accounting calculation that will be saved when you finalize.
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
