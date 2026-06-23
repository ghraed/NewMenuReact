import type { OrderLineItem, OrderRecord } from '../types';
import { calculateInvoicePreview } from './financeMath';
import type { BillItemAdjustment } from './billAdjustments';

const parseAmount = (value: string | number | null | undefined): number => {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatAmount = (value: number): string => value.toFixed(2);

const normalizeText = (value: string | null | undefined): string => (value || '').trim().toLowerCase();

const signatureForItem = (dishName: string, quantity: number, originalUnitPrice: number): string => [
  normalizeText(dishName),
  String(quantity),
  originalUnitPrice.toFixed(2),
].join('|');

const normalizeOrderReference = (value: string | null | undefined): string => normalizeText(value);

const buildAdjustedItem = (item: OrderLineItem, adjustment?: BillItemAdjustment): OrderLineItem => {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const originalUnitPrice = parseAmount(adjustment?.original_unit_price ?? item.original_unit_price ?? item.unit_price);
  const finalUnitPrice = parseAmount(adjustment?.final_unit_price ?? item.final_unit_price ?? item.unit_price);

  return {
    ...item,
    status: adjustment?.status ?? item.status,
    compensation_type: adjustment?.compensation_type ?? item.compensation_type,
    compensation_reason: adjustment?.compensation_reason ?? item.compensation_reason,
    complaint_category: adjustment?.complaint_category ?? item.complaint_category,
    operational_loss_category: adjustment?.operational_loss_category ?? item.operational_loss_category,
    adjustment_action_type: adjustment?.adjustment_action_type ?? item.adjustment_action_type,
    compensation_note: adjustment?.compensation_note ?? item.compensation_note,
    approved_at: adjustment?.approved_at ?? item.approved_at,
    original_unit_price: formatAmount(originalUnitPrice),
    final_unit_price: formatAmount(finalUnitPrice),
    partial_discount_type: adjustment?.partial_discount_type ?? item.partial_discount_type,
    partial_discount_value: adjustment?.partial_discount_value ?? item.partial_discount_value,
    is_complimentary: adjustment?.is_complimentary ?? item.is_complimentary,
    accounting_bucket: adjustment?.accounting_bucket ?? item.accounting_bucket,
    line_subtotal: formatAmount(finalUnitPrice * quantity),
  };
};

const buildLocalGiftItem = (gift: BillItemAdjustment, syntheticId: number): OrderLineItem => {
  const quantity = Math.max(1, Number(gift.quantity || 1));
  const originalUnitPrice = parseAmount(gift.original_unit_price ?? gift.final_unit_price);
  const finalUnitPrice = parseAmount(gift.final_unit_price);

  return {
    id: syntheticId,
    dish_id: null,
    dish_name: gift.dish_name,
    unit_price: formatAmount(originalUnitPrice),
    quantity,
    line_subtotal: formatAmount(finalUnitPrice * quantity),
    status: gift.status,
    compensation_type: gift.compensation_type,
    compensation_reason: gift.compensation_reason ?? null,
    complaint_category: gift.complaint_category ?? null,
    operational_loss_category: gift.operational_loss_category ?? null,
    adjustment_action_type: gift.adjustment_action_type ?? null,
    compensation_note: gift.compensation_note ?? null,
    approved_at: gift.approved_at ?? null,
    original_unit_price: formatAmount(originalUnitPrice),
    final_unit_price: formatAmount(finalUnitPrice),
    partial_discount_type: gift.partial_discount_type ?? null,
    partial_discount_value: gift.partial_discount_value ?? null,
    is_complimentary: gift.is_complimentary === true,
    accounting_bucket: gift.accounting_bucket ?? null,
  };
};

export const applyBillAdjustmentsToOrders = (
  orders: OrderRecord[],
  adjustments: BillItemAdjustment[]
): OrderRecord[] => {
  if (orders.length === 0 || adjustments.length === 0) {
    return orders;
  }

  const byOrderItemId = new Map<number, BillItemAdjustment>();
  const fallbackBuckets = new Map<string, BillItemAdjustment[]>();
  const localOnlyGifts = adjustments.filter((adjustment) => adjustment.local_only === true);

  adjustments.forEach((adjustment) => {
    if (adjustment.local_only === true) {
      return;
    }

    if (typeof adjustment.order_item_id === 'number') {
      byOrderItemId.set(adjustment.order_item_id, adjustment);
      return;
    }

    const originalUnitPrice = parseAmount(adjustment.original_unit_price ?? adjustment.final_unit_price);
    const signature = signatureForItem(
      adjustment.dish_name,
      Math.max(1, Number(adjustment.quantity || 1)),
      originalUnitPrice
    );
    const bucket = fallbackBuckets.get(signature) || [];
    bucket.push(adjustment);
    fallbackBuckets.set(signature, bucket);
  });

  let nextSyntheticId = -1;

  return orders.map((order, orderIndex) => {
    const nextItems = order.items.map((item) => {
      const directMatch = byOrderItemId.get(item.id);
      const fallbackSignature = signatureForItem(
        item.dish_name,
        Math.max(0, Number(item.quantity || 0)),
        parseAmount(item.original_unit_price ?? item.unit_price)
      );
      const fallbackBucket = directMatch ? undefined : fallbackBuckets.get(fallbackSignature);
      const fallbackMatch = fallbackBucket && fallbackBucket.length > 0 ? fallbackBucket.shift() : undefined;

      return buildAdjustedItem(item, directMatch ?? fallbackMatch);
    });

    const matchingGiftItems = localOnlyGifts
      .filter((gift) => {
        const sourceOrderReference = normalizeOrderReference(gift.source_order_reference);
        if (!sourceOrderReference) {
          return orderIndex === 0;
        }

        return sourceOrderReference === normalizeOrderReference(order.order_number || String(order.id));
      })
      .map((gift) => buildLocalGiftItem(gift, nextSyntheticId--));

    const allItems = [...nextItems, ...matchingGiftItems];
    const subtotal = allItems.reduce((sum, item) => sum + parseAmount(item.line_subtotal), 0);
    const preview = calculateInvoicePreview({
      subtotal,
      discountType: order.invoice.discount_type ?? '',
      discountValue: order.invoice.discount_value,
      vatRate: order.invoice.vat_rate,
    });

    return {
      ...order,
      items: allItems,
      invoice: {
        subtotal: formatAmount(preview.subtotal),
        discount_type: preview.discountType || null,
        discount_value: formatAmount(preview.discountValue),
        discount_amount: formatAmount(preview.discountAmount),
        taxable_subtotal: formatAmount(preview.taxableSubtotal),
        vat_rate: formatAmount(preview.vatRate),
        vat_amount: formatAmount(preview.vatAmount),
        total: formatAmount(preview.total),
      },
    };
  });
};
