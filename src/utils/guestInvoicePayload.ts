import { COMPLAINT_REASON_LABELS, ISSUE_STATUS_LABELS, getOrderItemFinancials } from './orderItemCompensation';
import type { InvoiceSplitSummary, OrderLineItem, OrderRecord } from '../types';
import type { PrintableInvoicePayload } from './printableInvoice';

const asNumber = (value: string | number | null | undefined): number => {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const money = (value: number): string => `$${value.toFixed(2)}`;

const buildGroupingKey = (item: OrderLineItem): string => [
  item.dish_id ?? item.dish_name,
  item.status || 'normal',
  item.compensation_type || 'none',
  item.compensation_reason || 'none',
  item.compensation_note || 'none',
  item.accounting_bucket || 'none',
  item.original_unit_price || item.unit_price || '0',
  item.final_unit_price || item.unit_price || '0',
].join('|');

export const buildGuestInvoicePayload = (input: {
  sourceTableId?: number | string;
  restaurantName: string;
  tableName: string;
  generatedAt: string;
  notes: string[];
  orders: OrderRecord[];
  split?: InvoiceSplitSummary | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}): PrintableInvoicePayload => {
  const grouped = new Map<string, PrintableInvoicePayload['items'][number]>();

  input.orders.forEach((order) => {
    order.items.forEach((item) => {
      const financials = getOrderItemFinancials(item);
      const key = buildGroupingKey(item);
      const existing = grouped.get(key);
      const quantity = (existing?.quantity || 0) + item.quantity;
      const originalLineSubtotal = (asNumber(existing?.originalLineSubtotal) + financials.originalLineTotal);
      const finalLineSubtotal = (asNumber(existing?.lineSubtotal) + financials.finalLineTotal);

      grouped.set(key, {
        key,
        dishName: item.dish_name,
        quantity,
        unitPrice: money(financials.originalUnitPrice),
        lineSubtotal: money(finalLineSubtotal),
        originalLineSubtotal: originalLineSubtotal > finalLineSubtotal
          ? money(originalLineSubtotal)
          : undefined,
        status: item.status,
        compensationType: item.compensation_type,
        reasonLabel: item.compensation_reason
          ? COMPLAINT_REASON_LABELS[item.compensation_reason] || item.compensation_reason
          : undefined,
        note: item.compensation_note || undefined,
        badgeLabel: item.status && item.status !== 'normal'
          ? ISSUE_STATUS_LABELS[item.status]
          : undefined,
        approvedBy: item.approved_by?.name || undefined,
        approvedAt: item.approved_at || undefined,
        isComplimentary: item.is_complimentary,
      });
    });
  });

  const items = Array.from(grouped.values()).sort((left, right) => left.dishName.localeCompare(right.dishName));

  const subtotal = items.reduce((sum, item) => sum + asNumber(item.lineSubtotal), 0);
  const discountAmount = input.orders.reduce((sum, order) => sum + asNumber(order.invoice.discount_amount), 0);
  const vatRate = input.orders.reduce((max, order) => Math.max(max, asNumber(order.invoice.vat_rate)), 0);
  const taxableSubtotal = Math.max(subtotal - discountAmount, 0);
  const vatAmount = taxableSubtotal * (vatRate / 100);
  const total = taxableSubtotal + vatAmount;
  const percentageDiscountOrder = input.orders.find((order) => order.invoice.discount_type === 'percentage');

  return {
    sourceTableId: input.sourceTableId,
    restaurantName: input.restaurantName,
    tableName: input.tableName,
    generatedAt: input.generatedAt,
    notes: input.notes,
    items,
    includedOrders: input.orders.map((order) => order.order_number || input.t('accountingPage.orderNumberLabel', { id: order.id })),
    summary: {
      subtotal: money(subtotal),
      discountLabel: percentageDiscountOrder
        ? input.t('accountingPage.discountWithValue', { value: asNumber(percentageDiscountOrder.invoice.discount_value).toFixed(2) })
        : input.t('accountingPage.discount'),
      discountAmount: money(discountAmount),
      taxableSubtotal: money(taxableSubtotal),
      vatLabel: input.t('accountingPage.vatWithValue', { value: vatRate.toFixed(2) }),
      vatAmount: money(vatAmount),
      total: money(total),
    },
    split: input.split?.enabled ? {
      enabled: input.split.enabled,
      mode: input.split.mode,
      splitCount: input.split.split_count,
      breakdown: input.split.breakdown.map((item) => ({
        key: item.key,
        label: item.label,
        amount: money(asNumber(item.amount)),
      })),
    } : undefined,
  };
};
