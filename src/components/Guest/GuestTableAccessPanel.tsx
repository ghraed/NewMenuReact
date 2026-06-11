import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { verifyGuestTablePin } from '../../services/orderService';
import { useOrderCart } from '../../contexts/useOrderCart';
import { buildGuestInvoicePath, buildGuestMenuPath, buildGuestOrdersPath } from '../../utils/guestTableRoutes';
import { loadPrintableInvoice } from '../../utils/printableInvoice';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

interface GuestTableAccessPanelProps {
  tableId: number | null;
  tableLabel?: string | null;
  compact?: boolean;
}

const GuestTableAccessPanel: React.FC<GuestTableAccessPanelProps> = ({
  tableId,
  tableLabel,
  compact = false,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { draft, setGuestAccess, setGuestContext, clearGuestAccess } = useOrderCart();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const label = tableLabel || (tableId ? t('guestAccess.tableLabel', { table: tableId }) : null);
  const isUnlocked = draft.guestAccessVerified && Boolean(draft.guestAccessToken);
  const hasInvoicePreview = tableId
    ? loadPrintableInvoice()?.sourceTableId === tableId
    : false;

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tableId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await verifyGuestTablePin(tableId, pin);
      if (response.table_session) {
        setGuestContext({
          restaurant: response.restaurant,
          tableId: response.table.id,
          tableReference: response.table.name,
          tableSessionId: response.table_session.id,
          guestAccess: response.guest_access,
        });
      } else {
        setGuestAccess({
          token: response.guest_access.token,
          expiresAt: response.guest_access.expires_at,
        });
      }

      const targetPath = buildGuestMenuPath(response.table.id);
      const isAlreadyOnMenuPage = location.pathname === targetPath;

      setPin('');

      if (isAlreadyOnMenuPage) {
        setSuccess(response.message || t('guestAccess.unlocked'));
      } else {
        navigate(targetPath, { replace: true });
      }
    } catch (err: unknown) {
      clearGuestAccess();
      setError(getErrorMessage(err, t('guestAccess.failed')));
    } finally {
      setSubmitting(false);
    }
  };

  if (!tableId) {
    return null;
  }

  return (
    <section
      className={`rounded-[32px] border ${compact ? 'p-5' : 'p-6 sm:p-7'}`}
      style={{
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
            {isUnlocked ? t('guestAccess.unlockedEyebrow') : t('guestAccess.lockedEyebrow')}
          </p>
          <h2 className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl'} font-serif text-[var(--guest-text)]`}>
            {isUnlocked ? t('guestAccess.unlockedTitle') : t('guestAccess.lockedTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--guest-muted)]">
            {isUnlocked
              ? t('guestAccess.unlockedDescription', { table: label || '' })
              : t('guestAccess.lockedDescription', { table: label || '' })}
          </p>
        </div>

        {label ? (
          <span
            className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: 'var(--guest-panel-strong)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
            }}
          >
            {label}
          </span>
        ) : null}
      </div>

      {isUnlocked ? (
        <div className="mt-5 rounded-[24px] border p-4 text-sm" style={{
          backgroundColor: 'var(--guest-accent-soft)',
          borderColor: 'var(--guest-border)',
          color: 'var(--guest-accent)',
        }}>
          <p className="font-semibold">{success || t('guestAccess.unlocked')}</p>
          <p className="mt-2 text-[var(--guest-text)]">
            {t('guestAccess.actionsReady')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={buildGuestOrdersPath(tableId)}
              className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--guest-text)',
                borderColor: 'var(--guest-text)',
                color: 'var(--guest-bg)',
              }}
            >
              {t('guestAccess.viewOrders')}
            </Link>
            {hasInvoicePreview ? (
              <Link
                to={buildGuestInvoicePath(tableId)}
                className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-text)',
                  color: 'var(--guest-text)',
                }}
              >
                {t('guestAccess.viewInvoice')}
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleUnlock}>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--guest-accent)]">
              {t('guestAccess.pinLabel')}
            </span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D+/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('guestAccess.pinPlaceholder')}
              className="mt-3 w-full rounded-[22px] border px-4 py-3 text-lg tracking-[0.32em] outline-none transition"
              style={{
                backgroundColor: 'var(--guest-panel-strong)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-text)',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting || pin.length !== 4}
            className="inline-flex items-center justify-center self-end rounded-full border px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--guest-accent)',
              borderColor: 'var(--guest-accent)',
              color: 'var(--guest-accent-button-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            {submitting ? t('guestAccess.unlocking') : t('guestAccess.unlockButton')}
          </button>
        </form>
      )}

      {error ? (
        <div
          className="mt-4 rounded-[22px] border p-4 text-sm"
          style={{
            backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
            borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 42%, var(--guest-border))',
            color: 'rgb(var(--color-spicy))',
          }}
        >
          {error}
        </div>
      ) : null}
    </section>
  );
};

export default GuestTableAccessPanel;
