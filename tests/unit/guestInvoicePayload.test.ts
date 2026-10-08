import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildGuestInvoicePayload } from '../../src/utils/guestInvoicePayload';
import InvoiceTemplate from '../../src/components/Invoice/InvoiceTemplate';
import type { OrderRecord } from '../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));

const buildOrder = (): OrderRecord => ({
  id: 1,
  uuid: 'order-1',
  order_number: 'ORD-1',
  invoice_number: 'INV-30',
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
    expect(payload.invoiceNumber).toBe('INV-30');
    expect(payload.split?.breakdown).toHaveLength(2);
  });

  it.each([
    ['USD', '$43.13'],
    ['LBP', '43 LBP'],
    ['SYP', '43 SYP'],
    ['SAR', '43.13 ﷼'],
    ['AED', '43.13 د.إ'],
    ['EUR', '43.13 €'],
    ['QAR', '43.13 ﷼'],
  ] as const)('uses %s currency metadata and formatting in guest and print payloads', (currency, expectedTotal) => {
    const order = buildOrder();
    order.restaurant.currency = currency;
    order.invoice = {
      ...order.invoice,
      subtotal: '40.00',
      discount_type: 'fixed',
      discount_value: '2.50',
      discount_amount: '2.50',
      taxable_subtotal: '37.50',
      service_charge_rate: '10.00',
      service_charge_amount: '3.75',
      vat_rate: '5.00',
      vat_amount: '1.88',
      total: '43.13',
    };

    const payload = buildGuestInvoicePayload({
      restaurantName: 'Test',
      tableName: 'T1',
      generatedAt: '2026-08-03T12:00:00.000Z',
      notes: [],
      orders: [order],
      t: (key, options) => `${key}:${String(options?.value ?? '')}`,
    });

    expect(payload.currency).toBe(currency);
    if (currency === 'USD') {
      expect(payload.summary.subtotal).toMatch(/^\$/u);
    } else {
      expect(payload.summary.subtotal).not.toMatch(/^\$/u);
    }
    expect(payload.summary.serviceChargeLabel).toBe('accountingPage.serviceChargeWithValue:10.00');
    expect(payload.summary.serviceChargeAmount).toBeTruthy();
    expect(payload.summary.total).toBe(expectedTotal);

    render(React.createElement(InvoiceTemplate, { invoice: payload, variant: 'print' }));
    expect(screen.getAllByText(expectedTotal).length).toBeGreaterThan(0);
  });

  it('renders every visible total component including the service charge so rows reconcile exactly', () => {
    const order = buildOrder();
    order.invoice = {
      ...order.invoice,
      subtotal: '40.00',
      discount_type: 'fixed',
      discount_value: '2.50',
      discount_amount: '2.50',
      taxable_subtotal: '37.50',
      service_charge_rate: '10.00',
      service_charge_amount: '3.75',
      vat_rate: '5.00',
      vat_amount: '1.88',
      total: '43.13',
    };
    const payload = buildGuestInvoicePayload({
      restaurantName: 'Test', tableName: 'T1', generatedAt: '2026-08-03', notes: [], orders: [order],
      t: (key, options) => `${key}:${String(options?.value ?? '')}`,
    });

    render(React.createElement(InvoiceTemplate, { invoice: payload, variant: 'print' }));

    expect(screen.getByText('accountingPage.serviceChargeWithValue:10.00')).toBeInTheDocument();
    expect(screen.getByText('+ $3.75')).toBeInTheDocument();
    expect(screen.getAllByText('$43.13').length).toBeGreaterThan(0);
    expect(40 - 2.5 + 3.75 + 1.88).toBe(43.13);
  });
  it('prints the settled currency snapshot after restaurant settings change', () => {
    const order = buildOrder();
    order.invoice.currency = 'EUR';
    order.restaurant.currency = 'USD';
    const payload = buildGuestInvoicePayload({ sourceTableId: 1, restaurantName: 'QA_RUN_currency', tableName: 'T1', generatedAt: '2026-10-08', notes: [], orders: [order], t: (key) => key });
    expect(payload.currency).toBe('EUR');
    expect(payload.summary.total).toBe('30.00 €');
  });

});
