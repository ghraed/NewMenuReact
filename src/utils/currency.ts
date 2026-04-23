import type { CurrencyCode } from '../types';

export const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string; symbol: string }> = [
  { value: 'USD', label: 'Dollar (USD)', symbol: '$' },
  { value: 'LBP', label: 'Lebanese Pound (LBP)', symbol: 'LBP' },
  { value: 'SYP', label: 'Syrian Lira (SYP)', symbol: 'SYP' },
];

export const normalizeCurrency = (value?: string | null): CurrencyCode => {
  const normalized = (value || '').trim().toUpperCase();

  if (normalized === 'LBP' || normalized === 'SYP' || normalized === 'USD') {
    return normalized;
  }

  return 'USD';
};

export const getCurrencySymbol = (currency?: string | null): string => {
  const normalized = normalizeCurrency(currency);
  const option = CURRENCY_OPTIONS.find((candidate) => candidate.value === normalized);
  return option?.symbol || '$';
};

export const formatMoney = (amount: number): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount.toFixed(2);
};

export const formatPriceWithCurrency = (amount: number, currency?: string | null): string => {
  const normalized = normalizeCurrency(currency);
  const symbol = getCurrencySymbol(normalized);
  const money = formatMoney(amount);

  if (normalized === 'USD') {
    return `${symbol}${money}`;
  }

  return `${money} ${symbol}`;
};

export const formatDollarRate = (currency?: string | null, dollarRate?: number | null): string => {
  const normalized = normalizeCurrency(currency);

  if (normalized === 'USD') {
    return '1 USD = 1.00 USD';
  }

  const safeRate = typeof dollarRate === 'number' && Number.isFinite(dollarRate) && dollarRate > 0 ? dollarRate : 0;

  if (safeRate <= 0) {
    return `USD rate unavailable for ${normalized}`;
  }

  return `1 USD = ${safeRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${normalized}`;
};
