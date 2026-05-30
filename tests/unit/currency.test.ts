import { describe, expect, it } from 'vitest';
import {
  convertPriceFromUsdToCurrency,
  convertPriceToUsd,
  formatPriceWithCurrency,
  normalizeCurrency,
} from '../../src/utils/currency';

describe('currency utils', () => {
  it('normalizes known aliases and defaults unknown values to USD', () => {
    expect(normalizeCurrency('eua')).toBe('AED');
    expect(normalizeCurrency('euro')).toBe('EUR');
    expect(normalizeCurrency(' xyz ')).toBe('USD');
  });

  it('formats USD with leading symbol and non-USD with trailing symbol', () => {
    expect(formatPriceWithCurrency(12.5, 'USD')).toBe('$12.50');
    expect(formatPriceWithCurrency(12.5, 'EUR')).toBe('12.50 €');
  });

  it('converts prices to and from USD using a valid rate', () => {
    expect(convertPriceFromUsdToCurrency(10, 'LBP', 90000)).toBe(900000);
    expect(convertPriceToUsd(900000, 'LBP', 90000)).toBe(10);
  });

  it('falls back safely when rate is invalid', () => {
    expect(convertPriceFromUsdToCurrency(10, 'LBP', 0)).toBe(10);
    expect(convertPriceToUsd(900000, 'LBP', null)).toBe(900000);
  });
});
