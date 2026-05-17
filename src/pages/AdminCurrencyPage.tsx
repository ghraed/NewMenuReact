import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import api from '../services/api';
import type { CurrencyCode } from '../types';
import { GlassInput, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
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
        const nextCurrency = normalizeCurrency(payload.currency || payload.restaurant?.currency);
        const nextOtherCurrency = normalizeCurrency(
          payload.other_currency || payload.restaurant?.other_currency || (nextCurrency === 'USD' ? 'EUR' : 'USD')
        );
        const nextRate = parseDollarRate(payload.dollar_rate ?? payload.restaurant?.dollar_rate);

        setOriginalCurrency(nextCurrency);
        setOtherCurrency(nextOtherCurrency === nextCurrency ? (nextCurrency === 'USD' ? 'EUR' : 'USD') : nextOtherCurrency);
        setDollarRate(nextRate);
        persistGuestCurrencySettings(nextCurrency, Number(nextRate), nextOtherCurrency);
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
        <div className="max-w-2xl space-y-6">
          <div className="rounded-[24px] border border-stroke bg-bg1/60 p-5">
            <h2 className="text-lg font-semibold text-text">Default App Currency</h2>
            <p className="mt-2 text-sm text-muted">
              Choose the default currency used across finance, expenses, and the guest menu view.
            </p>
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
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
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
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
              >
                {CURRENCY_OPTIONS
                  .filter((option) => option.value !== originalCurrency)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
              <p className="mt-2 text-xs text-muted">
                Secondary currency used in the system for alternate currency views.
              </p>
            </div>

            <div>
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
              <p className="mt-2 text-xs text-muted">
                {`Example: 1 USD = ${dollarRate || '...'} ${originalCurrency}`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-xl2 border border-sage/40 bg-sage/12 p-3 text-sm text-sage">{success}</div>
          ) : null}

          <div className="flex justify-end">
            <LiquidButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Currency Settings'}
            </LiquidButton>
          </div>
        </div>
      )}
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminCurrencyPage;
