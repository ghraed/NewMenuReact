import type { DiscountType, PosPaymentMethod } from '../types';

export interface InvoiceDraftInput {
  subtotal: number | string;
  discountType: '' | DiscountType;
  discountValue: number | string;
  vatRate: number | string;
}

export interface InvoicePreview {
  subtotal: number;
  discountType: '' | DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableSubtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

export interface InvoicePreviewCents {
  subtotalCents: number;
  discountAmountCents: number;
  taxableSubtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
}

export interface CashSettlement {
  receivedAmount: number;
  changeDue: number;
  remainingDue: number;
}

export const parseFiniteNumber = (value: number | string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toCents = (value: number | string): number => {
  return Math.round(parseFiniteNumber(value) * 100);
};

export const fromCents = (value: number): number => value / 100;

const clampNonNegative = (value: number): number => Math.max(value, 0);

const normalizePercent = (value: number): number => Math.min(clampNonNegative(value), 100);

export const calculateInvoicePreview = (input: InvoiceDraftInput): InvoicePreview & InvoicePreviewCents => {
  const subtotalCents = clampNonNegative(toCents(input.subtotal));
  const rawDiscountValue = clampNonNegative(parseFiniteNumber(input.discountValue));
  const normalizedDiscountValue = input.discountType === 'percentage'
    ? normalizePercent(rawDiscountValue)
    : rawDiscountValue;

  let discountAmountCents = 0;
  if (input.discountType === 'percentage' && normalizedDiscountValue > 0) {
    discountAmountCents = Math.round(subtotalCents * normalizedDiscountValue / 100);
  } else if (input.discountType === 'fixed' && normalizedDiscountValue > 0) {
    discountAmountCents = clampNonNegative(toCents(normalizedDiscountValue));
  }

  discountAmountCents = Math.min(discountAmountCents, subtotalCents);

  const taxableSubtotalCents = Math.max(subtotalCents - discountAmountCents, 0);
  const vatRate = clampNonNegative(parseFiniteNumber(input.vatRate));
  const vatAmountCents = Math.round(taxableSubtotalCents * vatRate / 100);
  const totalCents = taxableSubtotalCents + vatAmountCents;

  return {
    subtotal: fromCents(subtotalCents),
    discountType: input.discountType,
    discountValue: normalizedDiscountValue,
    discountAmount: fromCents(discountAmountCents),
    taxableSubtotal: fromCents(taxableSubtotalCents),
    vatRate,
    vatAmount: fromCents(vatAmountCents),
    total: fromCents(totalCents),
    subtotalCents,
    discountAmountCents,
    taxableSubtotalCents,
    vatAmountCents,
    totalCents,
  };
};

export const calculateCashSettlement = (
  total: number | string,
  amountReceived: number | string,
  paymentMethod: PosPaymentMethod
): CashSettlement => {
  const totalAmount = clampNonNegative(parseFiniteNumber(total));
  const receivedAmount = clampNonNegative(parseFiniteNumber(amountReceived));

  if (paymentMethod !== 'cash') {
    return {
      receivedAmount,
      changeDue: 0,
      remainingDue: 0,
    };
  }

  return {
    receivedAmount,
    changeDue: Math.max(receivedAmount - totalAmount, 0),
    remainingDue: Math.max(totalAmount - receivedAmount, 0),
  };
};
