import type { CurrencyCode } from '../types';

export const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string; symbol: string }> = [
  { value: 'USD', label: 'Dollar (USD)', symbol: '$' },
  { value: 'LBP', label: 'Lebanese Pound (LBP)', symbol: 'LBP' },
  { value: 'SYP', label: 'Syrian Lira (LS)', symbol: 'SYP' },
  { value: 'SAR', label: 'Saudi Riyal (SAR)', symbol: '﷼' },
  { value: 'AED', label: 'UAE Dirham (AED)', symbol: 'د.إ' },
  { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { value: 'QAR', label: 'Qatari Riyal (QAR)', symbol: '﷼' },
];

export const normalizeCurrency = (value?: string | null): CurrencyCode => {
  const normalized = (value || '').trim().toUpperCase();

  if (normalized === 'EUA' || normalized === 'UAE') {
    return 'AED';
  }

  if (normalized === 'EURO') {
    return 'EUR';
  }

  if (
    normalized === 'LBP'
    || normalized === 'SYP'
    || normalized === 'USD'
    || normalized === 'SAR'
    || normalized === 'AED'
    || normalized === 'EUR'
    || normalized === 'QAR'
  ) {
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
  return safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export const convertPriceFromUsdToCurrency = (
  amountInUsd: number,
  currency?: string | null,
  dollarRate?: number | null
): number => {
  const normalized = normalizeCurrency(currency);
  const safeAmount = Number.isFinite(amountInUsd) ? amountInUsd : 0;

  if (normalized === 'USD') {
    return safeAmount;
  }

  const safeRate = typeof dollarRate === 'number' && Number.isFinite(dollarRate) && dollarRate > 0 ? dollarRate : 0;
  if (safeRate <= 0) {
    return safeAmount;
  }

  return safeAmount * safeRate;
};

export const convertPriceToUsd = (
  amount: number,
  currency?: string | null,
  dollarRate?: number | null
): number => {
  const normalized = normalizeCurrency(currency);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (normalized === 'USD') {
    return safeAmount;
  }

  const safeRate = typeof dollarRate === 'number' && Number.isFinite(dollarRate) && dollarRate > 0 ? dollarRate : 0;
  if (safeRate <= 0) {
    return safeAmount;
  }

  return safeAmount / safeRate;
};

export const convertPriceBetweenCurrencies = (
  amount: number,
  fromCurrency?: string | null,
  toCurrency?: string | null,
  dollarRate?: number | null
): number => {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (from === to) {
    return safeAmount;
  }

  const usdAmount = convertPriceToUsd(safeAmount, from, dollarRate);
  return convertPriceFromUsdToCurrency(usdAmount, to, dollarRate);
};

export const formatUsdEquivalent = (
  amount: number,
  currency?: string | null,
  dollarRate?: number | null
): string => {
  const usdAmount = convertPriceToUsd(amount, currency, dollarRate);
  return `USD: $${formatMoney(usdAmount)}`;
};

const GUEST_CURRENCY_SETTINGS_KEY = 'guest_currency_settings_v2';

export const persistGuestCurrencySettings = (
  currency: CurrencyCode,
  dollarRate: number,
  otherCurrency?: CurrencyCode | null
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      GUEST_CURRENCY_SETTINGS_KEY,
      JSON.stringify({
        currency: normalizeCurrency(currency),
        dollar_rate: dollarRate > 0 ? dollarRate : 1,
        other_currency: otherCurrency ? normalizeCurrency(otherCurrency) : undefined,
      })
    );
  } catch {
    // ignore storage failures
  }
};

export const readGuestCurrencySettings = (): { currency: CurrencyCode; dollar_rate: number; other_currency?: CurrencyCode } | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(GUEST_CURRENCY_SETTINGS_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { currency?: string; dollar_rate?: unknown; other_currency?: string };
    const currency = normalizeCurrency(parsed.currency);
    const otherCurrency = parsed.other_currency ? normalizeCurrency(parsed.other_currency) : undefined;
    const dollarRate = typeof parsed.dollar_rate === 'number' && Number.isFinite(parsed.dollar_rate) && parsed.dollar_rate > 0
      ? parsed.dollar_rate
      : 1;

    return {
      currency,
      dollar_rate: dollarRate,
      other_currency: otherCurrency,
    };
  } catch {
    return null;
  }
};
