import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import GuestTableAccessPanel from '../components/Guest/GuestTableAccessPanel';
import SectionHeading from '../components/Guest/SectionHeading';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import { useOrderCart } from '../contexts/useOrderCart';
import {
  fetchGuestTableSessionInvoiceSplit,
  fetchGuestTableSessionOrders,
  updateGuestTableSessionInvoiceSplit,
} from '../services/orderService';
import type { InvoiceSplitMode, InvoiceSplitSummary, OrderRecord } from '../types';
import { buildGuestMenuPath, buildGuestOrderReviewPath } from '../utils/guestTableRoutes';
import { useGuestMenuResource } from '../contexts/GuestMenuResourceContext';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const GuestOrdersPage: React.FC = () => {
  const { table_id } = useParams<{ table_id?: string }>();
  const { t } = useTranslation();
  const { restaurant, draft, clearGuestAccess, setGuestContext, updateDraft } = useOrderCart();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [invoiceSplit, setInvoiceSplit] = useState<InvoiceSplitSummary | null>(null);
  const [splitMode, setSplitMode] = useState<InvoiceSplitMode>('by_each_order');
  const [splitCountInput, setSplitCountInput] = useState('2');
  const [splitSaving, setSplitSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTableId = draft.tableId ?? (table_id ? Number(table_id) : null);
  const guestMenuResource = useGuestMenuResource({
    tableId: activeTableId,
    guestAccessToken: draft.guestAccessToken,
  }, {
    enabled: Boolean(activeTableId),
    ttlMs: 10_000,
  });
  const restaurantName = restaurant?.name || t('guestOrders.title');
  const canLoadOrders = Boolean(draft.tableSessionId && draft.guestAccessToken);

  useEffect(() => {
    if (!activeTableId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const entry = await guestMenuResource.ensure();
        const sessionResponse = entry.data;
        if (!sessionResponse?.table) {
          setOrders([]);
          setInvoiceSplit(null);
          return;
        }
        if (!sessionResponse.table_session) {
          updateDraft({
            tableId: sessionResponse.table.number,
            tableReference: sessionResponse.table.name,
            tableSessionId: null,
          });
          clearGuestAccess();
          setOrders([]);
          setInvoiceSplit(null);
          return;
        }

        setGuestContext({
          restaurant: sessionResponse.restaurant,
          tableId: sessionResponse.table.number,
          tableReference: sessionResponse.table.name,
          tableSessionId: sessionResponse.table_session.id,
          guestAccess: sessionResponse.guest_access ?? undefined,
        });

        if (!draft.guestAccessToken) {
          setOrders([]);
          setInvoiceSplit(null);
          return;
        }

        const nextOrders = await fetchGuestTableSessionOrders(
          sessionResponse.table_session.id,
          draft.guestAccessToken
        );
        setOrders(nextOrders);

        const splitFeatureEnabled = sessionResponse.restaurant.feature_flags?.invoice_splitting === true;
        if (splitFeatureEnabled) {
          const split = await fetchGuestTableSessionInvoiceSplit(
            sessionResponse.table_session.id,
            draft.guestAccessToken
          );
          setInvoiceSplit(split);
          if (split.mode === 'equal') {
            setSplitMode('equal');
            setSplitCountInput(String(split.split_count ?? 2));
          } else {
            setSplitMode('by_each_order');
          }
        } else {
          setInvoiceSplit(null);
        }
      } catch (err: unknown) {
        const status = typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;

        if (status && [401, 403, 404, 409, 423].includes(status)) {
          clearGuestAccess();
        }

        setError(getErrorMessage(err, t('guestOrders.failedLoad')));
        setInvoiceSplit(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeTableId, clearGuestAccess, draft.guestAccessToken, setGuestContext, updateDraft, t]);

  const splitFeatureEnabled = guestMenuResource.data?.restaurant?.feature_flags?.invoice_splitting === true;

  const saveSplit = async () => {
    if (!draft.tableSessionId || !draft.guestAccessToken || !splitFeatureEnabled) {
      return;
    }

    if (splitMode === 'equal') {
      const numericSplitCount = Number(splitCountInput);
      if (!Number.isFinite(numericSplitCount) || !Number.isInteger(numericSplitCount) || numericSplitCount < 2) {
        setError(t('guestOrders.invalidSplitCount', { defaultValue: 'Split count must be at least 2.' }));
        return;
      }
    }

    setSplitSaving(true);
    setError(null);
    try {
      const nextSplit = await updateGuestTableSessionInvoiceSplit(
        draft.tableSessionId,
        {
          mode: splitMode,
          split_count: splitMode === 'equal' ? Number(splitCountInput) : undefined,
        },
        draft.guestAccessToken
      );
      setInvoiceSplit(nextSplit);
    } catch (splitError: unknown) {
      setError(getErrorMessage(splitError, t('guestOrders.failedUpdateSplit', { defaultValue: 'Failed to update split settings.' })));
    } finally {
      setSplitSaving(false);
    }
  };

  const totalItems = useMemo(() => (
    orders.reduce((sum, order) => (
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    ), 0)
  ), [orders]);

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        {activeTableId ? (
          <div className="mb-6">
            <GuestTableAccessPanel
              tableId={activeTableId}
              tableLabel={draft.tableReference || undefined}
              compact
            />
          </div>
        ) : null}

        <SectionHeading
          title={t('guestOrders.title')}
          eyebrow={restaurantName}
          titleId="guest-orders-heading"
          aside={(
            <div className="flex flex-wrap gap-3">
              {activeTableId ? (
                <Link
                  to={buildGuestMenuPath(activeTableId)}
                  className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--guest-panel)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                >
                  {t('common.backToMenu')}
                </Link>
              ) : null}
              {activeTableId ? (
                <Link
                  to={buildGuestOrderReviewPath(activeTableId)}
                  className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--guest-panel)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                >
                  {t('guestOrders.reviewCart')}
                </Link>
              ) : null}
            </div>
          )}
        />

        {!canLoadOrders ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
              color: 'var(--guest-muted)',
            }}
          >
            {t('guestOrders.unlockRequired')}
          </div>
        ) : null}

        {canLoadOrders && loading ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
              color: 'var(--guest-muted)',
            }}
          >
            {t('guestOrders.loading')}
          </div>
        ) : null}

        {canLoadOrders && !loading && error ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
              color: 'rgb(var(--color-spicy))',
            }}
          >
            {error}
          </div>
        ) : null}

        {canLoadOrders && !loading && !error ? (
          <>
            <div
              className="rounded-[32px] border p-5 sm:p-6"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                boxShadow: 'var(--guest-shadow)',
              }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
                {t('guestOrders.summaryEyebrow')}
              </p>
              <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)]">
                {t('guestOrders.summaryTitle', { count: orders.length })}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--guest-muted)]">
                {t('guestOrders.summaryDescription', {
                  count: totalItems,
                  table: draft.tableReference || activeTableId || '',
                })}
              </p>
            </div>

            {splitFeatureEnabled ? (
              <div
                className="mt-6 rounded-[32px] border p-5 sm:p-6"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  boxShadow: 'var(--guest-shadow)',
                }}
              >
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
                  {t('guestOrders.splitSectionTitle', { defaultValue: 'Invoice Split' })}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-1 block text-sm text-[var(--guest-muted)]">
                      {t('guestOrders.splitModeLabel', { defaultValue: 'Split mode' })}
                    </span>
                    <select
                      value={splitMode}
                      onChange={(event) => setSplitMode(event.target.value as InvoiceSplitMode)}
                      className="w-full rounded-full border px-4 py-2.5 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                        color: 'var(--guest-text)',
                      }}
                    >
                      <option value="by_each_order">
                        {t('guestOrders.splitModeByOrder', { defaultValue: 'By each person order' })}
                      </option>
                      <option value="equal">
                        {t('guestOrders.splitModeEqual', { defaultValue: 'Split equally' })}
                      </option>
                    </select>
                  </label>

                  <button
                    type="button"
                    disabled={splitSaving}
                    onClick={() => void saveSplit()}
                    className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                  >
                    {splitSaving
                      ? t('guestOrders.savingSplit', { defaultValue: 'Saving...' })
                      : t('guestOrders.saveSplit', { defaultValue: 'Save Split' })}
                  </button>
                </div>

                {splitMode === 'equal' ? (
                  <div className="mt-3">
                    <label className="block">
                      <span className="mb-1 block text-sm text-[var(--guest-muted)]">
                        {t('guestOrders.splitCountLabel', { defaultValue: 'Number of splits' })}
                      </span>
                      <input
                        value={splitCountInput}
                        onChange={(event) => setSplitCountInput(event.target.value)}
                        type="number"
                        min="2"
                        className="w-full rounded-full border px-4 py-2.5 text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                          color: 'var(--guest-text)',
                        }}
                      />
                    </label>
                  </div>
                ) : null}

                {invoiceSplit?.enabled && invoiceSplit.breakdown.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {invoiceSplit.breakdown.map((share) => (
                      <div
                        key={share.key}
                        className="flex items-center justify-between rounded-[22px] border px-4 py-3"
                        style={{
                          backgroundColor: 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                        }}
                      >
                        <p className="text-sm text-[var(--guest-text)]">{share.label}</p>
                        <p className="text-sm font-semibold text-[var(--guest-text)]">${share.amount}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {orders.length === 0 ? (
              <div
                className="mt-6 rounded-[32px] border p-6 text-center"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  boxShadow: 'var(--guest-shadow)',
                  color: 'var(--guest-muted)',
                }}
              >
                {t('guestOrders.empty')}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-[32px] border p-5 sm:p-6"
                    style={{
                      backgroundColor: 'var(--guest-panel)',
                      borderColor: 'var(--guest-border)',
                      boxShadow: 'var(--guest-shadow)',
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">
                          {order.order_number || t('guestOrders.pendingNumber')}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold capitalize text-[var(--guest-text)]">
                          {order.status.replace(/_/g, ' ')}
                        </h3>
                        <p className="mt-2 text-sm text-[var(--guest-muted)]">
                          {order.created_at ? new Date(order.created_at).toLocaleString() : t('guestOrders.justNow')}
                        </p>
                      </div>

                      <div
                        className="rounded-[24px] border px-4 py-3 text-right"
                        style={{
                          backgroundColor: 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                        }}
                      >
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">
                          {t('common.currentSubtotal')}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-[var(--guest-text)]">${order.invoice.total}</p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3"
                          style={{
                            backgroundColor: 'var(--guest-panel-strong)',
                            borderColor: 'var(--guest-border)',
                          }}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--guest-text)]">{item.dish_name}</p>
                            <p className="mt-1 text-sm text-[var(--guest-muted)]">
                              {item.quantity} × ${item.unit_price}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-[var(--guest-text)]">${item.line_subtotal}</p>
                        </div>
                      ))}
                    </div>

                    {order.notes ? (
                      <div
                        className="mt-4 rounded-[22px] border p-4 text-sm"
                        style={{
                          backgroundColor: 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                          color: 'var(--guest-muted)',
                        }}
                      >
                        {order.notes}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}

        <div className="mt-8">
          <GuestInfoSection restaurantName={restaurantName} />
        </div>
      </main>
    </GuestPageShell>
  );
};

export default GuestOrdersPage;
