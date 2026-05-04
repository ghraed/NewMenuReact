import { describe, expect, it } from 'vitest';
import { calculateCashSettlement, calculateInvoicePreview, fromCents, parseFiniteNumber, toCents } from '../../src/utils/financeMath';

describe('financeMath', () => {
  describe('numeric normalization', () => {
    it('parses only finite numbers', () => {
      expect(parseFiniteNumber('12.4')).toBe(12.4);
      expect(parseFiniteNumber('not-a-number')).toBe(0);
      expect(parseFiniteNumber(Number.NaN)).toBe(0);
      expect(parseFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('converts money values to cents with proper rounding', () => {
      expect(toCents('10')).toBe(1000);
      expect(toCents('10.005')).toBe(1001);
      expect(toCents('0.004')).toBe(0);
      expect(toCents('0.005')).toBe(1);
      expect(fromCents(12345)).toBe(123.45);
    });
  });

  describe('invoice preview math', () => {
    it('calculates fixed discount then VAT', () => {
      const preview = calculateInvoicePreview({
        subtotal: 100,
        discountType: 'fixed',
        discountValue: 5,
        vatRate: 10,
      });

      expect(preview.subtotal).toBe(100);
      expect(preview.discountAmount).toBe(5);
      expect(preview.taxableSubtotal).toBe(95);
      expect(preview.vatAmount).toBe(9.5);
      expect(preview.total).toBe(104.5);
      expect(preview.totalCents).toBe(10450);
    });

    it('caps percentage discount at 100%', () => {
      const preview = calculateInvoicePreview({
        subtotal: 42.38,
        discountType: 'percentage',
        discountValue: 180,
        vatRate: 11,
      });

      expect(preview.discountValue).toBe(100);
      expect(preview.discountAmountCents).toBe(preview.subtotalCents);
      expect(preview.taxableSubtotalCents).toBe(0);
      expect(preview.vatAmountCents).toBe(0);
      expect(preview.totalCents).toBe(0);
    });

    it('caps fixed discount at subtotal', () => {
      const preview = calculateInvoicePreview({
        subtotal: 20,
        discountType: 'fixed',
        discountValue: 9999,
        vatRate: 10,
      });

      expect(preview.discountAmount).toBe(20);
      expect(preview.total).toBe(0);
    });

    it('clamps invalid and negative input values', () => {
      const preview = calculateInvoicePreview({
        subtotal: -100,
        discountType: 'percentage',
        discountValue: '-5',
        vatRate: '-12',
      });

      expect(preview.subtotalCents).toBe(0);
      expect(preview.discountAmountCents).toBe(0);
      expect(preview.vatAmountCents).toBe(0);
      expect(preview.totalCents).toBe(0);
    });

    it('keeps accounting invariants across combinations', () => {
      const subtotals = [0, 1, 12.34, 100, 999.99];
      const vatRates = [0, 5, 10, 11, 20];
      const discountValues = [0, 2.5, 10, 50, 100, 250];
      const discountTypes: Array<'' | 'fixed' | 'percentage'> = ['', 'fixed', 'percentage'];

      for (const subtotal of subtotals) {
        for (const vatRate of vatRates) {
          for (const discountType of discountTypes) {
            for (const discountValue of discountValues) {
              const preview = calculateInvoicePreview({
                subtotal,
                discountType,
                discountValue,
                vatRate,
              });

              expect(preview.discountAmountCents).toBeGreaterThanOrEqual(0);
              expect(preview.discountAmountCents).toBeLessThanOrEqual(preview.subtotalCents);
              expect(preview.taxableSubtotalCents).toBe(preview.subtotalCents - preview.discountAmountCents);
              expect(preview.totalCents).toBe(preview.taxableSubtotalCents + preview.vatAmountCents);
            }
          }
        }
      }
    });
  });

  describe('cash settlement', () => {
    it('computes change and remaining due only for cash payments', () => {
      const cash = calculateCashSettlement(100, 120, 'cash');
      expect(cash.changeDue).toBe(20);
      expect(cash.remainingDue).toBe(0);

      const shortCash = calculateCashSettlement(100, 70, 'cash');
      expect(shortCash.changeDue).toBe(0);
      expect(shortCash.remainingDue).toBe(30);

      const card = calculateCashSettlement(100, 1000, 'card');
      expect(card.changeDue).toBe(0);
      expect(card.remainingDue).toBe(0);
    });
  });
});
