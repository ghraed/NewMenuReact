import { COMPLAINT_REASON_LABELS, ISSUE_STATUS_LABELS } from './orderItemCompensation';
import type { InvoiceSplitSummary, OrderRecord } from '../types';
import type { PrintableInvoicePayload } from './printableInvoice';

const asNumber = (value: string | number | null | undefined): number => {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const money = (value: number): string => `$${value.toFixed(2)}`;

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
  const items = input.orders.flatMap((order) => (
    order.items.map((item) => {
      const originalUnitPrice = asNumber(item.original_unit_price ?? item.unit_price);
      const originalLineSubtotal = originalUnitPrice * item.quantity;
      const finalLineSubtotal = asNumber(item.line_subtotal);

      return {
        key: `order-${order.id}-item-${item.id}`,
        dishName: item.dish_name,
        quantity: item.quantity,
        unitPrice: money(originalUnitPrice),
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
      };
    })
  ));

  const subtotal = input.orders.reduce((sum, order) => sum + asNumber(order.invoice.subtotal), 0);
  const discountAmount = input.orders.reduce((sum, order) => sum + asNumber(order.invoice.discount_amount), 0);
  const taxableSubtotal = input.orders.reduce((sum, order) => sum + asNumber(order.invoice.taxable_subtotal), 0);
  const vatAmount = input.orders.reduce((sum, order) => sum + asNumber(order.invoice.vat_amount), 0);
  const total = input.orders.reduce((sum, order) => sum + asNumber(order.invoice.total), 0);
  const vatRate = input.orders.reduce((max, order) => Math.max(max, asNumber(order.invoice.vat_rate)), 0);
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
