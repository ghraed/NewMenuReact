import { describe, expect, it } from 'vitest';
import { buildGuestInvoicePayload } from '../../src/utils/guestInvoicePayload';
import type { OrderRecord } from '../../src/types';

const buildOrder = (): OrderRecord => ({
  id: 1,
  uuid: 'order-1',
  order_number: 'ORD-1',
  invoice_number: null,
  status: 'pending_staff_confirmation',
  table_session_id: 10,
  table_reference: 'T1',
  table: { id: 1, name: 'T1' },
  notes: null,
  created_at: null,
  confirmed_at: null,
  cancelled_at: null,
  accounted_at: null,
  restaurant: {
    id: 1,
    name: 'Test',
    slug: 'test',
    logo_url: null,
    currency: 'USD',
    other_currency: null,
    dollar_rate: null,
    profile: null,
    feature_flags: {},
  },
  items: [
    {
      id: 11,
      dish_id: 101,
      dish_name: 'Shared Plate',
      unit_price: '15.00',
      quantity: 2,
      line_subtotal: '0.00',
      status: 'normal',
    },
  ],
  invoice: {
    subtotal: '30.00',
    discount_type: null,
    discount_value: '0.00',
    discount_amount: '0.00',
    taxable_subtotal: '30.00',
    vat_rate: '0.00',
    vat_amount: '0.00',
    total: '30.00',
  },
  confirmed_by: null,
  cancelled_by: null,
  accounted_by: null,
});

describe('guest invoice payload', () => {
  it('keeps the table invoice total even when split item lines are zeroed out', () => {
    const payload = buildGuestInvoicePayload({
      sourceTableId: 1,
      restaurantName: 'Test',
      tableName: 'T1',
      generatedAt: '2026-08-03T12:00:00.000Z',
      generatedAtIso: '2026-08-03T12:00:00.000Z',
      notes: [],
      orders: [buildOrder()],
      split: {
        enabled: true,
        mode: 'by_person_order',
        split_count: 2,
        breakdown: [
          { key: 'person-1', label: 'Person 1', amount: '15.00' },
          { key: 'person-2', label: 'Person 2', amount: '15.00' },
        ],
        people: [],
        editable_items: [],
        remaining_items: [],
        remaining_summary: {
          subtotal: '0.00',
          discount_amount: '0.00',
          taxable_subtotal: '0.00',
          service_charge_amount: '0.00',
          vat_amount: '0.00',
          total: '0.00',
        },
        is_complete: true,
      },
      t: (key) => key,
    });

    expect(payload.summary.subtotal).toBe('$30.00');
    expect(payload.summary.taxableSubtotal).toBe('$30.00');
    expect(payload.summary.total).toBe('$30.00');
    expect(payload.split?.breakdown).toHaveLength(2);
  });
});
