import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import GuestTableAccessPanel from '../components/Guest/GuestTableAccessPanel';
import SectionHeading from '../components/Guest/SectionHeading';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import { useOrderCart } from '../contexts/useOrderCart';
import { fetchGuestTableSessionOrders } from '../services/orderService';
import type { OrderRecord } from '../types';
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
          return;
        }

        const nextOrders = await fetchGuestTableSessionOrders(
          sessionResponse.table_session.id,
          draft.guestAccessToken
        );
        setOrders(nextOrders);
      } catch (err: unknown) {
        const status = typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;

        if (status && [401, 403, 404, 409, 423].includes(status)) {
          clearGuestAccess();
        }

        setError(getErrorMessage(err, t('guestOrders.failedLoad')));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeTableId, clearGuestAccess, draft.guestAccessToken, setGuestContext, updateDraft, t]);

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
