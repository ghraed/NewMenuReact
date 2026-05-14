import { beforeEach, describe, expect, it } from 'vitest';
import { readBillAdjustmentsForTable, upsertBillAdjustmentsForTable } from '../../src/utils/billAdjustments';

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
});
