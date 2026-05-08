import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import api from '../services/api';
import type { CurrencyCode } from '../types';
import { GlassInput, GlassSelect, LiquidButton } from '../components/ui/liquid-glass';
import { CURRENCY_OPTIONS, normalizeCurrency, persistGuestCurrencySettings, readGuestCurrencySettings } from '../utils/currency';

interface CurrencySettingsResponse {
  currency?: string;
  dollar_rate?: number | string | null;
  restaurant?: {
    currency?: string;
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
  const [originalCurrency, setOriginalCurrency] = useState<CurrencyCode>('USD');
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
        const nextRate = parseDollarRate(payload.dollar_rate ?? payload.restaurant?.dollar_rate);

        setOriginalCurrency(nextCurrency);
        setDollarRate(nextRate);
        persistGuestCurrencySettings(nextCurrency, Number(nextRate));
      } catch (err) {
        console.error(err);
        const stored = readGuestCurrencySettings();
        if (stored) {
          setOriginalCurrency(stored.currency);
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const normalizedRate = dollarRate.trim();
      const parsedRate = Number(normalizedRate);
      const safeDollarRate = originalCurrency === 'USD' ? 1 : parsedRate;

      if (!Number.isFinite(safeDollarRate) || safeDollarRate <= 0) {
        setError('Exchange rate must be a number greater than 0.');
        setSaving(false);
        return;
      }

      // Keep guest view consistent immediately on this device, even if API sync fails.
      persistGuestCurrencySettings(originalCurrency, safeDollarRate);

      await api.patch('/restaurant/currency-settings', {
        currency: originalCurrency,
        dollar_rate: safeDollarRate,
      });

      if (originalCurrency === 'USD') {
        setDollarRate('1');
      } else {
        setDollarRate(String(safeDollarRate));
      }

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
            <h2 className="text-lg font-semibold text-text">Guest Menu Currency</h2>
            <p className="mt-2 text-sm text-muted">
              Pick the original currency and the exchange rate shown to guests when they tap a dish price.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="currency" className="mb-1 block text-sm font-medium text-text">
                Base Menu Currency
              </label>
              <GlassSelect
                id="currency"
                name="currency"
                value={originalCurrency}
                onChange={(event) => {
                  const nextCurrency = normalizeCurrency(event.target.value);
                  setOriginalCurrency(nextCurrency);
                  if (nextCurrency === 'USD') {
                    setDollarRate('1');
                  }
                }}
                options={CURRENCY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>

            <div>
              <label htmlFor="dollar_rate" className="mb-1 block text-sm font-medium text-text">
                USD Exchange Rate
              </label>
              <GlassInput
                id="dollar_rate"
                name="dollar_rate"
                type="number"
                min="0.000001"
                step="0.01"
                value={dollarRate}
                onChange={(event) => setDollarRate(event.target.value)}
                disabled={originalCurrency === 'USD'}
                placeholder={originalCurrency === 'USD' ? 'Not required' : 'e.g. 89500'}
              />
              <p className="mt-2 text-xs text-muted">
                {originalCurrency === 'USD'
                  ? 'This value is fixed at 1 when the base menu currency is USD.'
                  : `Example: 1 USD = ${dollarRate || '...'} ${originalCurrency}`}
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
    </DashboardLayout>
  );
};

export default AdminCurrencyPage;
