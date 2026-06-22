import { beforeEach, describe, expect, it } from 'vitest';
import { readBillAdjustmentsForTable, readBillAdjustmentsForTableInvoice, upsertBillAdjustmentsForTable } from '../../src/utils/billAdjustments';

describe('bill adjustments', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists partial discount type and value fields', () => {
    upsertBillAdjustmentsForTable('T1', [{
      key: '1:1',
      dish_name: 'Soup',
      status: 'compensated',
      compensation_type: 'partial_discount',
      partial_discount_type: 'fixed',
      partial_discount_value: '2.50',
      final_unit_price: '7.50',
      original_unit_price: '10.00',
    }]);

    const saved = readBillAdjustmentsForTable('T1');
    expect(saved).toHaveLength(1);
    expect(saved[0].partial_discount_type).toBe('fixed');
    expect(saved[0].partial_discount_value).toBe('2.50');
  });

  it('falls back to table local-only gifts when included order references do not match', () => {
    upsertBillAdjustmentsForTable('T1', [{
      key: 'gift:T1:-1',
      source_order_reference: 'ORDER-1',
      dish_name: 'Cake',
      status: 'compensated',
      compensation_type: 'complimentary',
      local_only: true,
    }]);

    const saved = readBillAdjustmentsForTableInvoice('T1', ['INVOICE-ORDER']);
    expect(saved).toHaveLength(1);
    expect(saved[0].dish_name).toBe('Cake');
    expect(saved[0].local_only).toBe(true);
  });
});
