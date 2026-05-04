import type { DiscountType, PosPaymentMethod } from '../../../src/types';

export interface FinanceRegressionFixture {
  id: string;
  input: {
    subtotal: number | string;
    discountType: '' | DiscountType;
    discountValue: number | string;
    vatRate: number | string;
    paymentMethod: PosPaymentMethod;
    amountReceived: number | string;
  };
}

export const financeRegressionFixtures: FinanceRegressionFixture[] = [
  {
    id: 'walkin-cash-no-discount-11-vat',
    input: {
      subtotal: 100,
      discountType: '',
      discountValue: 0,
      vatRate: 11,
      paymentMethod: 'cash',
      amountReceived: 120,
    },
  },
  {
    id: 'fixed-discount-cash-complete',
    input: {
      subtotal: 89.99,
      discountType: 'fixed',
      discountValue: 10,
      vatRate: 11,
      paymentMethod: 'cash',
      amountReceived: 100,
    },
  },
  {
    id: 'fixed-discount-over-subtotal',
    input: {
      subtotal: 13.5,
      discountType: 'fixed',
      discountValue: 20,
      vatRate: 11,
      paymentMethod: 'cash',
      amountReceived: 0,
    },
  },
  {
    id: 'percentage-discount-with-rounding',
    input: {
      subtotal: 42.38,
      discountType: 'percentage',
      discountValue: 12.5,
      vatRate: 11,
      paymentMethod: 'cash',
      amountReceived: 45,
    },
  },
  {
    id: 'percentage-discount-clamped',
    input: {
      subtotal: 42.38,
      discountType: 'percentage',
      discountValue: 150,
      vatRate: 11,
      paymentMethod: 'cash',
      amountReceived: 10,
    },
  },
  {
    id: 'zero-vat-card-payment',
    input: {
      subtotal: 200,
      discountType: 'fixed',
      discountValue: 50,
      vatRate: 0,
      paymentMethod: 'card',
      amountReceived: 999,
    },
  },
  {
    id: 'invalid-numeric-strings',
    input: {
      subtotal: 'bad-subtotal',
      discountType: 'fixed',
      discountValue: 'bad-discount',
      vatRate: 'bad-vat',
      paymentMethod: 'cash',
      amountReceived: 'bad-received',
    },
  },
  {
    id: 'high-vat-small-ticket',
    input: {
      subtotal: 1.99,
      discountType: '',
      discountValue: 0,
      vatRate: 23,
      paymentMethod: 'wallet',
      amountReceived: 0,
    },
  },
  {
    id: 'three-decimal-subtotal-input',
    input: {
      subtotal: '10.005',
      discountType: '',
      discountValue: 0,
      vatRate: 11,
      paymentMethod: 'cash',
      amountReceived: 11.12,
    },
  },
  {
    id: 'negative-values-clamped',
    input: {
      subtotal: -999,
      discountType: 'percentage',
      discountValue: -50,
      vatRate: -11,
      paymentMethod: 'cash',
      amountReceived: -5,
    },
  },
];
