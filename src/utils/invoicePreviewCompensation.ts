import type {
  ComplaintAccountingBucket,
  ComplaintReasonCode,
  ComplaintCategory,
  DiscountType,
  InvoiceSplitSummary,
  OperationalLossCategory,
} from '../types';
import type { BillItemAdjustment } from './billAdjustments';
import type { PrintableInvoiceItem, PrintableInvoiceSplit, PrintableInvoiceSummary } from './printableInvoice';

interface InvoicePreviewItem {
  key: string;
  order_item_id?: number;
  dish_name: string;
  dish_name_ar?: string | null;
  quantity: number;
  unit_price: string;
  line_subtotal: string;
  status?: 'normal' | 'problematic' | 'cancelled' | 'compensated';
  compensation_type?: 'none' | 'full_waiver' | 'partial_discount' | 'complimentary';
  compensation_reason?: ComplaintReasonCode | null;
  complaint_category?: ComplaintCategory | null;
  operational_loss_category?: OperationalLossCategory | null;
  compensation_note?: string | null;
  approved_by_staff_name?: string | null;
  approved_at?: string | null;
  original_unit_price?: string | null;
  final_unit_price?: string | null;
  partial_discount_percentage?: string | null;
  partial_discount_type?: DiscountType | null;
  partial_discount_value?: string | null;
  is_complimentary?: boolean;
  accounting_bucket?: ComplaintAccountingBucket | null;
}

interface InvoicePreviewSummary {
  discount_amount: string;
  vat_rate: string;
}

const parseMoneyValue = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== 'string') {
    return 0;
  }
  const normalized = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(normalized) ? normalized : 0;
};

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;

const normalizeText = (value: string | null | undefined): string => (value || '').trim().toLowerCase();

const toSignature = (input: {
  dishName: string;
  quantity: number;
  originalUnitPrice: number;
}): string => [
  normalizeText(input.dishName),
  String(input.quantity),
  input.originalUnitPrice.toFixed(2),
].join('|');

const toReadableStatus = (value: string | null | undefined): string | undefined => (
  value ? value.replace(/_/g, ' ') : undefined
);

const consumeFallbackAdjustment = (
  item: InvoicePreviewItem,
  fallbackBuckets: Map<string, BillItemAdjustment[]>
): BillItemAdjustment | undefined => {
  const originalUnitPrice = parseMoneyValue(item.original_unit_price ?? item.unit_price);
  const exactSignature = toSignature({
    dishName: item.dish_name,
    quantity: item.quantity,
    originalUnitPrice,
  });
  const exactMatches = fallbackBuckets.get(exactSignature);
  if (exactMatches && exactMatches.length > 0) {
    return exactMatches.shift();
  }

  for (const [signature, bucket] of fallbackBuckets.entries()) {
    if (!signature.startsWith(`${normalizeText(item.dish_name)}|${item.quantity}|`)) {
      continue;
    }
    if (bucket.length === 0) {
      continue;
    }
    return bucket.shift();
  }

  return undefined;
};

export const buildPrintableInvoiceItemsFromPreview = (
  items: InvoicePreviewItem[],
  adjustments: BillItemAdjustment[]
): PrintableInvoiceItem[] => {
  const byOrderItemId = new Map<number, BillItemAdjustment>();
  const fallbackBuckets = new Map<string, BillItemAdjustment[]>();
  const localOnlyGifts: BillItemAdjustment[] = [];

  adjustments.forEach((adjustment) => {
    if (adjustment.local_only === true) {
      localOnlyGifts.push(adjustment);
      return;
    }

    if (typeof adjustment.order_item_id === 'number') {
      byOrderItemId.set(adjustment.order_item_id, adjustment);
      return;
    }

    const adjustmentOriginalUnit = parseMoneyValue(adjustment.original_unit_price ?? adjustment.final_unit_price);
    const signature = toSignature({
      dishName: adjustment.dish_name,
      quantity: adjustment.quantity || 1,
      originalUnitPrice: adjustmentOriginalUnit,
    });
    const bucket = fallbackBuckets.get(signature) || [];
    bucket.push(adjustment);
    fallbackBuckets.set(signature, bucket);
  });

  const printableItems = items.map((item) => {
    const matchedAdjustment = typeof item.order_item_id === 'number'
      ? byOrderItemId.get(item.order_item_id)
      : undefined;
    const adjustment = matchedAdjustment || consumeFallbackAdjustment(item, fallbackBuckets);
    const quantity = item.quantity;
    const originalUnitPrice = parseMoneyValue(adjustment?.original_unit_price ?? item.original_unit_price ?? item.unit_price);
    const finalUnitPrice = parseMoneyValue(adjustment?.final_unit_price ?? item.final_unit_price ?? item.unit_price);
    const lineSubtotal = finalUnitPrice * quantity;
    const originalLineSubtotal = originalUnitPrice * quantity;

    return {
      key: item.key,
      dishName: item.dish_name,
      dishNameArabic: item.dish_name_ar || undefined,
      quantity,
      unitPrice: formatMoney(originalUnitPrice),
      lineSubtotal: formatMoney(lineSubtotal),
      originalLineSubtotal: originalLineSubtotal > lineSubtotal
        ? formatMoney(originalLineSubtotal)
        : undefined,
      status: adjustment?.status || item.status || 'normal',
      compensationType: adjustment?.compensation_type || item.compensation_type || 'none',
      reasonLabel: adjustment?.compensation_reason || item.compensation_reason || undefined,
      note: adjustment?.compensation_note || item.compensation_note || undefined,
      badgeLabel: toReadableStatus(adjustment?.status || item.status),
      approvedBy: adjustment?.approved_by_staff_name || item.approved_by_staff_name || undefined,
      approvedAt: adjustment?.approved_at || item.approved_at || undefined,
      accountingBucketLabel: adjustment?.accounting_bucket || item.accounting_bucket || undefined,
      isComplimentary: adjustment?.is_complimentary === true || item.is_complimentary === true,
    } satisfies PrintableInvoiceItem;
  });

  localOnlyGifts.forEach((gift, index) => {
    const quantity = gift.quantity || 1;
    const originalUnitPrice = parseMoneyValue(gift.original_unit_price ?? gift.final_unit_price);
    printableItems.push({
      key: `gift-local-${index + 1}-${gift.key}`,
      dishName: gift.dish_name,
      dishNameArabic: undefined,
      quantity,
      unitPrice: formatMoney(originalUnitPrice),
      lineSubtotal: formatMoney(0),
      originalLineSubtotal: formatMoney(originalUnitPrice * quantity),
      status: gift.status,
      compensationType: gift.compensation_type,
      reasonLabel: gift.compensation_reason || undefined,
      note: gift.compensation_note || undefined,
      badgeLabel: toReadableStatus(gift.status),
      approvedBy: gift.approved_by_staff_name || undefined,
      approvedAt: gift.approved_at || undefined,
      accountingBucketLabel: gift.accounting_bucket || undefined,
      isComplimentary: true,
    });
  });

  return printableItems;
};

export const buildPrintableInvoiceSummaryFromPreview = (
  items: PrintableInvoiceItem[],
  summary: InvoicePreviewSummary,
  t: (key: string, options?: Record<string, unknown>) => string
): PrintableInvoiceSummary => {
  const subtotal = items.reduce((sum, item) => sum + parseMoneyValue(item.lineSubtotal), 0);
  const discountAmount = parseMoneyValue(summary.discount_amount);
  const vatRate = parseMoneyValue(summary.vat_rate);
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const vatAmount = taxableSubtotal * (vatRate / 100);
  const total = taxableSubtotal + vatAmount;

  return {
    subtotal: formatMoney(subtotal),
    discountLabel: t('accountingPage.discount'),
    discountAmount: formatMoney(discountAmount),
    taxableSubtotal: formatMoney(taxableSubtotal),
    vatLabel: t('accountingPage.vatWithValue', { value: vatRate.toFixed(2) }),
    vatAmount: formatMoney(vatAmount),
    total: formatMoney(total),
  };
};

export const buildPrintableInvoiceSplitFromPreview = (
  split: InvoiceSplitSummary | undefined
): PrintableInvoiceSplit | undefined => {
  if (!split) {
    return undefined;
  }

  return {
    enabled: split.enabled,
    mode: split.mode,
    splitCount: split.split_count,
    breakdown: split.breakdown.map((item) => ({
      key: item.key,
      label: item.label,
      amount: formatMoney(parseMoneyValue(item.amount)),
    })),
  };
};
