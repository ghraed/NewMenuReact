import { describe, expect, it } from 'vitest';
import type { OrderRecord } from '../../src/types';
import type { BillItemAdjustment } from '../../src/utils/billAdjustments';
import { applyBillAdjustmentsToOrders } from '../../src/utils/guestOrderCompensation';

describe('guest order compensation', () => {
  it('recalculates item and invoice totals from saved 100% partial discounts', () => {
    const orders: OrderRecord[] = [
      {
        id: 1,
        uuid: 'order-1',
        order_number: 'ORD-1',
        invoice_number: null,
        status: 'accounted',
        kitchen_status: 'served',
        table_session_id: 2,
        table_reference: 'Table 2',
        table: { id: 2, number: 2, name: 'Table 2' },
        notes: null,
        created_at: null,
        confirmed_at: null,
        cancelled_at: null,
        accounted_at: null,
        restaurant: {
          id: 1,
          name: 'Rozer',
          slug: 'rozer',
        },
        items: [
          {
            id: 11,
            dish_id: 99,
            dish_name: 'Burger',
            unit_price: '7.50',
            quantity: 3,
            line_subtotal: '22.50',
          },
        ],
        invoice: {
          subtotal: '22.50',
          discount_type: null,
          discount_value: '0.00',
          discount_amount: '0.00',
          taxable_subtotal: '22.50',
          vat_rate: '0.00',
          vat_amount: '0.00',
          total: '22.50',
        },
        confirmed_by: null,
        cancelled_by: null,
        accounted_by: null,
      },
    ];

    const adjustments: BillItemAdjustment[] = [
      {
        key: '1:11',
        order_item_id: 11,
        dish_name: 'Burger',
        quantity: 3,
        status: 'problematic',
        compensation_type: 'partial_discount',
        original_unit_price: '7.50',
        final_unit_price: '0.00',
        partial_discount_type: 'percentage',
        partial_discount_value: '100.00',
      },
    ];

    const adjusted = applyBillAdjustmentsToOrders(orders, adjustments);

    expect(adjusted[0].items[0].line_subtotal).toBe('0.00');
    expect(adjusted[0].items[0].final_unit_price).toBe('0.00');
    expect(adjusted[0].invoice.subtotal).toBe('0.00');
    expect(adjusted[0].invoice.total).toBe('0.00');
  });
});
