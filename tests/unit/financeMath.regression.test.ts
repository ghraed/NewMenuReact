import { describe, expect, it } from 'vitest';
import { calculateCashSettlement, calculateInvoicePreview } from '../../src/utils/financeMath';
import { financeRegressionFixtures } from './fixtures/financeRegressionFixtures';

describe('financeMath regression fixtures', () => {
  it('matches locked calculation snapshots for known scenarios', () => {
    const results = financeRegressionFixtures.map((fixture) => {
      const invoice = calculateInvoicePreview({
        subtotal: fixture.input.subtotal,
        discountType: fixture.input.discountType,
        discountValue: fixture.input.discountValue,
        vatRate: fixture.input.vatRate,
      });
      const settlement = calculateCashSettlement(
        invoice.total,
        fixture.input.amountReceived,
        fixture.input.paymentMethod
      );

      return {
        id: fixture.id,
        invoice: {
          subtotalCents: invoice.subtotalCents,
          discountAmountCents: invoice.discountAmountCents,
          taxableSubtotalCents: invoice.taxableSubtotalCents,
          vatAmountCents: invoice.vatAmountCents,
          totalCents: invoice.totalCents,
          vatRate: invoice.vatRate,
          discountType: invoice.discountType,
          discountValue: invoice.discountValue,
        },
        settlement: {
          receivedAmount: settlement.receivedAmount,
          changeDue: settlement.changeDue,
          remainingDue: settlement.remainingDue,
        },
      };
    });

    expect(results).toMatchSnapshot();
  });
});
