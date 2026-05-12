import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import GuestTableAccessPanel from '../components/Guest/GuestTableAccessPanel';
import SectionHeading from '../components/Guest/SectionHeading';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import RestaurantBrandMark from '../components/Common/RestaurantBrandMark';
import { useOrderCart } from '../contexts/useOrderCart';
import { createGuestTableSessionOrder } from '../services/orderService';
import type { OrderRecord } from '../types';
import { formatRestaurantLabel } from '../utils/guestRestaurant';
import { buildGuestMenuPath, buildGuestOrdersPath } from '../utils/guestTableRoutes';
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

const OrderReviewPage: React.FC = () => {
  const { table_id } = useParams<{ table_id?: string }>();
  const { t } = useTranslation();
  const {
    restaurant,
    items,
    draft,
    subtotal,
    clearGuestAccess,
    setGuestContext,
    updateDraft,
    updateQuantity,
    removeDish,
    clearCart,
  } = useOrderCart();

  const [submitting, setSubmitting] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<OrderRecord | null>(null);

  const activeTableId = draft.tableId ?? (table_id ? Number(table_id) : null);
  const guestMenuResource = useGuestMenuResource({
    tableId: activeTableId,
    guestAccessToken: draft.guestAccessToken,
    includeDishes: 'none',
  }, {
    enabled: Boolean(activeTableId) && !submittedOrder,
    ttlMs: 10_000,
  });
  const guestMenuResourceKey = guestMenuResource.key;
  const restaurantSlug = submittedOrder?.restaurant.slug || restaurant?.slug;
  const restaurantName = submittedOrder?.restaurant.name || restaurant?.name || formatRestaurantLabel(restaurantSlug);
  const restaurantLogoUrl = guestMenuResource.data?.restaurant?.logo_url ?? restaurant?.logo_url ?? null;
  const restaurantShortDescription = (guestMenuResource.data?.restaurant?.profile?.short_description || '').trim();
  const tableOrderingEnabled = restaurant?.feature_flags?.table_ordering !== false;
  const canSubmit = items.length > 0
    && draft.tableSessionId !== null
    && draft.guestAccessVerified
    && tableOrderingEnabled
    && !submitting
    && !sessionLoading;
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  useEffect(() => {
    if (!activeTableId || submittedOrder) {
      return;
    }

    setSessionLoading(true);
    setError(null);

    void guestMenuResource.ensure()
      .then((entry) => {
        const response = entry.data;
        const hasActiveUnlockedSession = (
          response?.table_session?.status === 'active'
          && response?.protected_actions?.ordering_unlocked === true
        );

        if (!response?.table || !hasActiveUnlockedSession) {
          if (response?.table) {
            updateDraft({
              tableId: response.table.id,
              tableReference: response.table.name,
              tableSessionId: null,
            });
          }
          clearGuestAccess();
          setError(t('orderReview.validationMissingSession'));
          return;
        }

        if (response.guest_access) {
          setGuestContext({
            restaurant: response.restaurant,
            tableId: response.table.id,
            tableReference: response.table.name,
            tableSessionId: response.table_session!.id,
            guestAccess: response.guest_access,
          });
        }
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err, t('orderReview.validationMissingSession')));
      })
      .finally(() => {
        setSessionLoading(false);
      });
  }, [activeTableId, submittedOrder, guestMenuResourceKey, setGuestContext, updateDraft, clearGuestAccess, t]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0) {
      setError(t('orderReview.validationEmptyCart'));
      return;
    }

    if (!draft.tableSessionId || !draft.guestAccessToken) {
      setError(t('orderReview.validationMissingSession'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await createGuestTableSessionOrder(draft.tableSessionId, {
        notes: draft.notes.trim() || undefined,
        items: items.map((item) => ({
          dish_id: item.dishId,
          quantity: item.quantity,
        })),
      }, draft.guestAccessToken);

      setSubmittedOrder(response.order);
      clearCart();
    } catch (err: unknown) {
      const status = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;

      if (status && [401, 403, 404, 409, 423].includes(status)) {
        clearGuestAccess();
      }

      setError(getErrorMessage(err, t('orderReview.failedToSend')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        <section
          className="mb-6 flex flex-wrap items-center gap-4 rounded-[28px] border px-4 py-4 sm:px-5"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow-soft)',
          }}
        >
          <RestaurantBrandMark
            name={restaurantName}
            logoUrl={restaurantLogoUrl}
            className="h-14 w-14 sm:h-16 sm:w-16"
            fallbackClassName="text-lg sm:text-xl"
          />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-[var(--guest-text)] sm:text-2xl">{restaurantName}</h2>
            {restaurantShortDescription ? (
              <p className="truncate text-xs text-[var(--guest-muted)] sm:text-sm">{restaurantShortDescription}</p>
            ) : null}
          </div>
        </section>

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
          title={t('orderReview.title')}
          eyebrow={restaurantName}
          titleId="order-review-heading"
          aside={(
            <Link
              to={activeTableId ? buildGuestMenuPath(activeTableId) : restaurantSlug ? `/menu/${restaurantSlug}` : '/menu'}
              className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-text)',
              }}
            >
              {t('common.backToMenu')}
            </Link>
          )}
        />

        {submittedOrder ? (
          <section
            className="rounded-[32px] border p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('orderReview.requestReceived')}</p>
            <h2 className="mt-3 font-serif text-3xl text-[var(--guest-text)]">{t('orderReview.requestSentTitle')}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--guest-muted)]">
              {t('orderReview.requestSentDescription', { table: submittedOrder.table_reference })}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div
                className="rounded-[24px] border p-5"
                style={{
                  backgroundColor: 'var(--guest-panel-strong)',
                  borderColor: 'var(--guest-border)',
                }}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">{t('common.orderNumber')}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--guest-text)]">
                  {submittedOrder.order_number || t('common.pendingAssignment')}
                </p>
              </div>

              <div
                className="rounded-[24px] border p-5"
                style={{
                  backgroundColor: 'var(--guest-panel-strong)',
                  borderColor: 'var(--guest-border)',
                }}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">{t('common.table')}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--guest-text)]">
                  {submittedOrder.table_reference}
                </p>
              </div>

              <div
                className="rounded-[24px] border p-5"
                style={{
                  backgroundColor: 'var(--guest-panel-strong)',
                  borderColor: 'var(--guest-border)',
                }}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">{t('common.status')}</p>
                <p className="mt-2 text-lg font-semibold capitalize text-[var(--guest-text)]">
                  {submittedOrder.status.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div
              className="mt-6 rounded-[24px] border p-5"
              style={{
                backgroundColor: 'var(--guest-panel-strong)',
                borderColor: 'var(--guest-border)',
              }}
            >
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">{t('common.currentSubtotal')}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--guest-text)]">${submittedOrder.invoice.subtotal}</p>
              <p className="mt-2 text-sm text-[var(--guest-muted)]">
                {t('orderReview.subtotalNote')}
              </p>
            </div>

            {activeTableId ? (
              <div className="mt-6">
                <Link
                  to={buildGuestOrdersPath(activeTableId)}
                  className="inline-flex rounded-full border px-5 py-3 text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--guest-text)',
                    borderColor: 'var(--guest-text)',
                    color: 'var(--guest-bg)',
                  }}
                >
                  {t('orderReview.viewOrders')}
                </Link>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section
              className="rounded-[32px] border p-5 sm:p-6"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                boxShadow: 'var(--guest-shadow)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('orderReview.cartEyebrow')}</p>
                  <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)]">{t('orderReview.itemCount', { count: itemCount })}</h2>
                </div>
                <span
                  className="rounded-full border px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--guest-accent-soft)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-accent)',
                  }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {items.length === 0 ? (
                <div
                  className="mt-6 rounded-[24px] border p-6 text-center"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-muted)',
                  }}
                >
                  {t('orderReview.emptyCart')}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                    <article
                      key={item.dishId}
                      className="rounded-[24px] border p-4"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-[var(--guest-text)]">{item.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-[var(--guest-muted)]">{item.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDish(item.dishId)}
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                          style={{
                            backgroundColor: 'transparent',
                            borderColor: 'var(--guest-border)',
                            color: 'var(--guest-muted)',
                          }}
                        >
                          {t('common.remove')}
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border px-2 py-2" style={{ borderColor: 'var(--guest-border)' }}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.dishId, item.quantity - 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition"
                            style={{
                              backgroundColor: 'var(--guest-panel)',
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-text)',
                            }}
                          >
                            -
                          </button>
                          <span className="min-w-[2rem] text-center text-sm font-semibold text-[var(--guest-text)]">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.dishId, item.quantity + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition"
                            style={{
                              backgroundColor: 'var(--guest-panel)',
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-text)',
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">{t('common.eachPrice', { price: item.price.toFixed(2) })}</p>
                          <p className="mt-1 text-lg font-semibold text-[var(--guest-text)]">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              className="rounded-[32px] border p-5 sm:p-6"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                boxShadow: 'var(--guest-shadow)',
              }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('orderReview.tableRequestEyebrow')}</p>
              <h2 className="mt-2 font-serif text-3xl text-[var(--guest-text)]">{t('orderReview.tableRequestTitle')}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--guest-muted)]">
                {t('orderReview.tableRequestDescription')}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div
                  className="rounded-[22px] border px-4 py-3"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                  }}
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--guest-accent)]">{t('common.tableReference')}</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--guest-text)]">
                    {draft.tableReference || (activeTableId ? `Table ${activeTableId}` : t('orderReview.tablePending'))}
                  </p>
                </div>

                {sessionLoading ? (
                  <div
                    className="rounded-[22px] border p-4 text-sm"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-muted)',
                    }}
                  >
                    {t('orderReview.loadingSession')}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--guest-text)]">{t('common.notesForTeam')}</span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) => updateDraft({ notes: event.target.value })}
                    className="min-h-[120px] w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                    placeholder={t('common.optionalServiceNote')}
                  />
                </label>

                {error ? (
                  <div
                    className="rounded-[22px] border p-4 text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
                      borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 38%, var(--guest-border))',
                      color: 'rgb(var(--color-spicy))',
                    }}
                  >
                    {error}
                  </div>
                ) : null}

                {!tableOrderingEnabled ? (
                  <div
                    className="rounded-[22px] border p-4 text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 12%, var(--guest-panel))',
                      borderColor: 'color-mix(in srgb, rgb(var(--color-spicy)) 38%, var(--guest-border))',
                      color: 'rgb(var(--color-spicy))',
                    }}
                  >
                    {t('orderReview.orderingDisabled', { defaultValue: 'Table ordering is currently disabled for this restaurant.' })}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center rounded-full border px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--guest-accent)',
                    borderColor: 'var(--guest-accent)',
                    color: 'var(--guest-accent-button-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                  }}
                >
                  {submitting ? t('orderReview.sendingRequest') : t('orderReview.sendRequest')}
                </button>
              </form>
            </section>
          </div>
        )}

        <GuestInfoSection restaurantName={restaurantName} />
      </main>
    </GuestPageShell>
  );
};

export default OrderReviewPage;
