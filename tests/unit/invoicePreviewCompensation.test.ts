import { describe, expect, it } from 'vitest';
import { buildPrintableInvoiceItemsFromPreview, buildPrintableInvoiceSummaryFromPreview } from '../../src/utils/invoicePreviewCompensation';
import type { BillItemAdjustment } from '../../src/utils/billAdjustments';

describe('invoice preview compensation', () => {
  it('applies persisted issue adjustments even when preview items do not include order_item_id', () => {
    const items = buildPrintableInvoiceItemsFromPreview([
      {
        key: 'dish-1',
        dish_name: 'Burger',
        quantity: 1,
        unit_price: '20.00',
        line_subtotal: '20.00',
      },
    ], [
      {
        key: 'missing-order-item-id',
        dish_name: 'Burger',
        quantity: 1,
        status: 'cancelled',
        compensation_type: 'full_waiver',
        original_unit_price: '20.00',
        final_unit_price: '0.00',
      } satisfies BillItemAdjustment,
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('cancelled');
    expect(items[0].lineSubtotal).toBe('$0.00');
    expect(items[0].originalLineSubtotal).toBe('$20.00');
  });

  it('includes local-only gifts when present for the table invoice', () => {
    const items = buildPrintableInvoiceItemsFromPreview([], [
      {
        key: 'gift:T1:-1',
        dish_name: 'Cake',
        quantity: 1,
        status: 'compensated',
        compensation_type: 'complimentary',
        original_unit_price: '8.00',
        final_unit_price: '0.00',
        local_only: true,
      } satisfies BillItemAdjustment,
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].dishName).toBe('Cake');
    expect(items[0].lineSubtotal).toBe('$0.00');
    expect(items[0].originalLineSubtotal).toBe('$8.00');
    expect(items[0].isComplimentary).toBe(true);
  });

  it('recalculates the summary from adjusted line totals', () => {
    const summary = buildPrintableInvoiceSummaryFromPreview([
      {
        key: 'dish-1',
        dishName: 'Burger',
        quantity: 1,
        unitPrice: '$20.00',
        lineSubtotal: '$0.00',
        originalLineSubtotal: '$20.00',
      },
    ], {
      discount_amount: '0.00',
      vat_rate: '0.00',
    }, (key) => key);

    expect(summary.subtotal).toBe('$0.00');
    expect(summary.taxableSubtotal).toBe('$0.00');
    expect(summary.total).toBe('$0.00');
  });
});
