import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import api from '../services/api';
import type { CurrencyCode } from '../types';
import { GlassCard, GlassInput, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { CURRENCY_OPTIONS, normalizeCurrency, persistGuestCurrencySettings, readGuestCurrencySettings } from '../utils/currency';

interface CurrencySettingsResponse {
  currency?: string;
  other_currency?: string | null;
  dollar_rate?: number | string | null;
  restaurant?: {
    currency?: string;
    other_currency?: string | null;
    dollar_rate?: number | string | null;
  };
}

const parseDollarRate = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return String(numeric);
    }
  }

  return '1';
};

const shouldPreserveStoredGuestRate = (
  stored: ReturnType<typeof readGuestCurrencySettings>,
  currency: CurrencyCode,
  otherCurrency: CurrencyCode,
  apiRate: number
): stored is NonNullable<ReturnType<typeof readGuestCurrencySettings>> => {
  if (!stored) {
    return false;
  }

  if (stored.currency !== currency) {
    return false;
  }

  if ((stored.other_currency || (currency === 'USD' ? 'EUR' : 'USD')) !== otherCurrency) {
    return false;
  }

  return apiRate === 1 && stored.dollar_rate > 1 && currency === 'USD' && otherCurrency !== 'USD';
};

const AdminCurrencyPage: React.FC = () => {
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const [originalCurrency, setOriginalCurrency] = useState<CurrencyCode>('USD');
  const [otherCurrency, setOtherCurrency] = useState<CurrencyCode>('EUR');
  const [dollarRate, setDollarRate] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<CurrencySettingsResponse>('/restaurant/currency-settings');
        const payload = response.data;
        const stored = readGuestCurrencySettings();
        const nextCurrency = normalizeCurrency(payload.currency || payload.restaurant?.currency);
        const nextOtherCurrency = normalizeCurrency(
          payload.other_currency || payload.restaurant?.other_currency || (nextCurrency === 'USD' ? 'EUR' : 'USD')
        );
        const parsedApiRate = Number(parseDollarRate(payload.dollar_rate ?? payload.restaurant?.dollar_rate));
        const effectiveRate = shouldPreserveStoredGuestRate(
          stored,
          nextCurrency,
          nextOtherCurrency,
          parsedApiRate
        )
          ? stored.dollar_rate
          : parsedApiRate;

        setOriginalCurrency(nextCurrency);
        setOtherCurrency(nextOtherCurrency === nextCurrency ? (nextCurrency === 'USD' ? 'EUR' : 'USD') : nextOtherCurrency);
        setDollarRate(String(effectiveRate));
        persistGuestCurrencySettings(nextCurrency, effectiveRate, nextOtherCurrency);
      } catch (err) {
        console.error(err);
        const stored = readGuestCurrencySettings();
        if (stored) {
          setOriginalCurrency(stored.currency);
          setOtherCurrency(
            stored.other_currency
              ? (stored.other_currency === stored.currency ? (stored.currency === 'USD' ? 'EUR' : 'USD') : stored.other_currency)
              : (stored.currency === 'USD' ? 'EUR' : 'USD')
          );
          setDollarRate(String(stored.dollar_rate));
        } else {
          setError('Failed to load currency settings.');
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  useEffect(() => {
    if (error) {
      showToast(error, 'tertiary', 4800);
    }
  }, [error, showToast]);

  useEffect(() => {
    if (success) {
      showToast(success, 'secondary', 3600);
    }
  }, [showToast, success]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const normalizedRate = dollarRate.trim();
      const parsedRate = Number(normalizedRate);
      const safeDollarRate = parsedRate;
      const safeOtherCurrency = otherCurrency === originalCurrency
        ? (originalCurrency === 'USD' ? 'EUR' : 'USD')
        : otherCurrency;

      if (!Number.isFinite(safeDollarRate) || safeDollarRate <= 0) {
        setError('Exchange rate must be a number greater than 0.');
        setSaving(false);
        return;
      }

      // Keep guest view consistent immediately on this device, even if API sync fails.
      persistGuestCurrencySettings(originalCurrency, safeDollarRate, safeOtherCurrency);

      await api.patch('/restaurant/currency-settings', {
        currency: originalCurrency,
        other_currency: safeOtherCurrency,
        dollar_rate: safeDollarRate,
      });

      setDollarRate(String(safeDollarRate));
      setOtherCurrency(safeOtherCurrency);

      setSuccess('Currency settings saved.');
    } catch (err: unknown) {
      console.error(err);
      setSuccess('Saved locally for guest view on this device.');
      setError('Backend sync failed. Please run API migration/deploy so currency saves for all devices.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Currency Settings">
      {loading ? (
        <div className="py-12 text-center text-muted">Loading currency settings...</div>
      ) : (
        <div className="space-y-6">
          <GlassCard className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-gold/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-gold2/10 blur-2xl" />
            <div className="relative">
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/80">Finance Control</p>
              <h2 className="mt-2 text-2xl font-semibold text-text sm:text-3xl">Currency Configuration</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Set the restaurant default currency, secondary currency, and exchange rate used across finance, expenses, and guest-facing values.
              </p>
            </div>
          </GlassCard>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <GlassCard className="relative space-y-5 overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-10 top-6 h-24 w-24 rounded-full bg-gold/10 blur-xl" />
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Settings</h3>
                <span className="rounded-full border border-gold/35 bg-gold/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold2">
                  Finance Sync
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="currency" className="mb-1 block text-sm font-medium text-text">
                    Default Currency
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={originalCurrency}
                    onChange={(event) => {
                      const nextCurrency = normalizeCurrency(event.target.value);
                      setOriginalCurrency(nextCurrency);
                      if (otherCurrency === nextCurrency) {
                        setOtherCurrency(nextCurrency === 'USD' ? 'EUR' : 'USD');
                      }
                    }}
                    className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm font-medium text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="other_currency" className="mb-1 block text-sm font-medium text-text">
                    Other Currency
                  </label>
                  <select
                    id="other_currency"
                    name="other_currency"
                    value={otherCurrency}
                    onChange={(event) => {
                      const nextCurrency = normalizeCurrency(event.target.value);
                      if (nextCurrency === originalCurrency) {
                        return;
                      }
                      setOtherCurrency(nextCurrency);
                    }}
                    className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm font-medium text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                  >
                    {CURRENCY_OPTIONS
                      .filter((option) => option.value !== originalCurrency)
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                  <p className="mt-2 text-xs text-muted">Used for alternate currency views and quick switching.</p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="dollar_rate" className="mb-1 block text-sm font-medium text-text">
                    Exchange Rate
                  </label>
                  <GlassInput
                    id="dollar_rate"
                    name="dollar_rate"
                    type="number"
                    min="0.000001"
                    step="0.01"
                    value={dollarRate}
                    onChange={(event) => setDollarRate(event.target.value)}
                    placeholder="e.g. 89500"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-medium text-gold2">
                      1 USD = {dollarRate || '...'} {otherCurrency}
                    </span>
                    <span className="rounded-full border border-stroke bg-bg2/65 px-3 py-1 text-muted">
                      Preview pair: {originalCurrency} ↔ {otherCurrency}
                    </span>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">{error}</div>
              ) : null}

              {success ? (
                <div className="rounded-xl2 border border-sage/40 bg-sage/12 p-3 text-sm text-sage my-[5px]">{success}</div>
              ) : null}

              <div className="flex justify-end">
                <LiquidButton onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Currency Settings'}
                </LiquidButton>
              </div>
            </GlassCard>

            <GlassCard className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Live Preview</h3>
                <span className="text-xs font-medium text-muted">Realtime</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-stroke bg-bg2/65 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Default</p>
                  <p className="mt-1 text-lg font-semibold text-text">{originalCurrency}</p>
                </div>
                <div className="rounded-2xl border border-stroke bg-bg2/65 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Secondary</p>
                  <p className="mt-1 text-lg font-semibold text-text">{otherCurrency}</p>
                </div>
                <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-gold2/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gold2/85">Sample Conversion</p>
                  <p className="mt-2 text-sm text-text">
                    1 USD ≈ {Number.isFinite(Number(dollarRate)) && Number(dollarRate) > 0
                      ? (1 * Number(dollarRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : '...'} "LBP"
                  </p>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted">
                Tip: keep exchange rates updated before downloading finance reports so charts, summaries, and exported workbooks stay consistent.
              </p>
            </GlassCard>
          </div>
        </div>
      )}
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminCurrencyPage;
