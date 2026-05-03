import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import GuestTableAccessPanel from '../components/Guest/GuestTableAccessPanel';
import SectionHeading from '../components/Guest/SectionHeading';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import RestaurantBrandMark from '../components/Common/RestaurantBrandMark';
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

type PeopleDraftState = Record<number, Record<number, number>>;

const emptyPeopleDraft = (splitCount: number): PeopleDraftState => {
  const draft: PeopleDraftState = {};
  for (let personIndex = 1; personIndex <= splitCount; personIndex++) {
    draft[personIndex] = {};
  }
  return draft;
};

const peopleDraftFromSplit = (split: InvoiceSplitSummary | null, splitCount: number): PeopleDraftState => {
  const draft = emptyPeopleDraft(splitCount);
  if (!split?.people) {
    return draft;
  }

  split.people.forEach((person) => {
    const personDraft: Record<number, number> = {};
    person.items.forEach((item) => {
      if (item.quantity > 0) {
        personDraft[item.order_item_id] = item.quantity;
      }
    });
    draft[person.person_index] = personDraft;
  });

  return draft;
};

const GuestOrdersPage: React.FC = () => {
  const { table_id } = useParams<{ table_id?: string }>();
  const { t } = useTranslation();
  const { restaurant, draft, clearGuestAccess, setGuestContext, updateDraft } = useOrderCart();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [invoiceSplit, setInvoiceSplit] = useState<InvoiceSplitSummary | null>(null);
  const [splitMode, setSplitMode] = useState<InvoiceSplitMode>('none');
  const [splitCountInput, setSplitCountInput] = useState('2');
  const [activePersonIndex, setActivePersonIndex] = useState(1);
  const [peopleDraft, setPeopleDraft] = useState<PeopleDraftState>({});
  const [savedPeopleDraft, setSavedPeopleDraft] = useState<PeopleDraftState>({});
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
  const restaurantLogoUrl = guestMenuResource.data?.restaurant?.logo_url ?? restaurant?.logo_url ?? null;
  const restaurantShortDescription = (guestMenuResource.data?.restaurant?.profile?.short_description || '').trim();
  const canLoadOrders = Boolean(draft.tableSessionId && draft.guestAccessToken);

  const splitFeatureEnabled = guestMenuResource.data?.restaurant?.feature_flags?.invoice_splitting === true;

  const splitCount = useMemo(() => {
    const parsed = Number(splitCountInput);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }, [splitCountInput]);

  const applySplitToLocalState = (split: InvoiceSplitSummary | null) => {
    setInvoiceSplit(split);

    if (!split) {
      setSplitMode('none');
      setSplitCountInput('2');
      setActivePersonIndex(1);
      setPeopleDraft({});
      setSavedPeopleDraft({});
      return;
    }

    const nextMode: InvoiceSplitMode = split.mode ?? 'none';
    setSplitMode(nextMode);

    const nextSplitCount = split.split_count && split.split_count > 0
      ? split.split_count
      : 2;

    setSplitCountInput(String(nextSplitCount));
    setActivePersonIndex((previous) => Math.min(Math.max(previous, 1), nextSplitCount));

    const nextDraft = peopleDraftFromSplit(split, nextSplitCount);
    setPeopleDraft(nextDraft);
    setSavedPeopleDraft(nextDraft);
  };

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
          applySplitToLocalState(null);
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
          applySplitToLocalState(null);
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
          applySplitToLocalState(null);
          return;
        }

        const nextOrders = await fetchGuestTableSessionOrders(
          sessionResponse.table_session.id,
          draft.guestAccessToken
        );
        setOrders(nextOrders);

        const splitEnabled = sessionResponse.restaurant.feature_flags?.invoice_splitting === true;
        if (splitEnabled) {
          const split = await fetchGuestTableSessionInvoiceSplit(
            sessionResponse.table_session.id,
            draft.guestAccessToken
          );
          applySplitToLocalState(split);
        } else {
          applySplitToLocalState(null);
        }
      } catch (err: unknown) {
        const status = typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;

        if (status && [401, 403, 404, 409, 423].includes(status)) {
          clearGuestAccess();
        }

        setError(getErrorMessage(err, t('guestOrders.failedLoad')));
        applySplitToLocalState(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeTableId, clearGuestAccess, draft.guestAccessToken, setGuestContext, t, updateDraft]);

  const editableItems = invoiceSplit?.editable_items ?? [];

  const getAssignedByOtherPeople = (
    draftState: PeopleDraftState,
    orderItemId: number,
    currentPerson: number
  ): number => {
    let assigned = 0;
    Object.entries(draftState).forEach(([personIndexRaw, personItems]) => {
      const personIndex = Number(personIndexRaw);
      if (personIndex === currentPerson) {
        return;
      }
      assigned += personItems[orderItemId] ?? 0;
    });
    return assigned;
  };

  const setPersonItemQuantity = (personIndex: number, orderItemId: number, nextQuantityRaw: number) => {
    setPeopleDraft((current) => {
      const next = { ...current };
      const personItems = { ...(next[personIndex] ?? {}) };
      const editableItem = editableItems.find((item) => item.order_item_id === orderItemId);
      const available = editableItem?.quantity ?? 0;
      const assignedByOthers = getAssignedByOtherPeople(current, orderItemId, personIndex);
      const maxQuantity = Math.max(available - assignedByOthers, 0);
      const nextQuantity = Math.min(Math.max(Math.floor(nextQuantityRaw), 0), maxQuantity);

      if (nextQuantity === 0) {
        delete personItems[orderItemId];
      } else {
        personItems[orderItemId] = nextQuantity;
      }

      next[personIndex] = personItems;
      return next;
    });
  };

  const buildPeoplePayload = (splitCountValue: number) => {
    const payload: Array<{ person_index: number; items: Array<{ order_item_id: number; quantity: number }> }> = [];

    for (let personIndex = 1; personIndex <= splitCountValue; personIndex++) {
      const personItems = peopleDraft[personIndex] ?? {};
      payload.push({
        person_index: personIndex,
        items: Object.entries(personItems)
          .map(([orderItemId, quantity]) => ({
            order_item_id: Number(orderItemId),
            quantity: Number(quantity),
          }))
          .filter((item) => item.quantity > 0),
      });
    }

    return payload;
  };

  const saveSplit = async (saveMode?: InvoiceSplitMode) => {
    if (!draft.tableSessionId || !draft.guestAccessToken || !splitFeatureEnabled) {
      return;
    }

    const effectiveMode = saveMode ?? splitMode;

    if (effectiveMode === 'equal') {
      if (splitCount < 2) {
        setError(t('guestOrders.invalidSplitCount', { defaultValue: 'Split count must be at least 2.' }));
        return;
      }
    }

    if (effectiveMode === 'by_person_order') {
      if (splitCount < 1) {
        setError(t('guestOrders.invalidSplitCount', { defaultValue: 'Split count must be at least 1.' }));
        return;
      }
    }

    setSplitSaving(true);
    setError(null);

    try {
      const nextSplit = await updateGuestTableSessionInvoiceSplit(
        draft.tableSessionId,
        {
          mode: effectiveMode,
          split_count: effectiveMode === 'none' ? undefined : splitCount,
          people: effectiveMode === 'by_person_order' ? buildPeoplePayload(splitCount) : undefined,
        },
        draft.guestAccessToken
      );

      applySplitToLocalState(nextSplit);
      setSplitMode(effectiveMode);
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

  const unassignedItemsPreview = useMemo(() => {
    if (!invoiceSplit?.remaining_items) {
      return [];
    }

    return invoiceSplit.remaining_items;
  }, [invoiceSplit?.remaining_items]);

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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
                    {t('guestOrders.splitSectionTitle', { defaultValue: 'Invoice Split' })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={splitSaving}
                      onClick={() => {
                        setPeopleDraft(savedPeopleDraft);
                        setError(null);
                      }}
                      className="inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                        color: 'var(--guest-text)',
                      }}
                    >
                      {t('guestOrders.undoSplit', { defaultValue: 'Undo' })}
                    </button>
                    <button
                      type="button"
                      disabled={splitSaving}
                      onClick={() => {
                        void saveSplit('none');
                      }}
                      className="inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--guest-panel-strong)',
                        borderColor: 'var(--guest-border)',
                        color: 'var(--guest-text)',
                      }}
                    >
                      {t('guestOrders.clearSplit', { defaultValue: 'Clear Split' })}
                    </button>
                  </div>
                </div>
                <p className="mb-3 text-xs text-[var(--guest-muted)]">
                  {t('guestOrders.splitScopeHint', {
                    defaultValue: 'Split applies to the full table invoice across all orders in this session.',
                  })}
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
                      <option value="none">{t('guestOrders.splitModeNone', { defaultValue: 'No splitting' })}</option>
                      <option value="equal">{t('guestOrders.splitModeEqual', { defaultValue: 'Split equally' })}</option>
                      <option value="by_person_order">{t('guestOrders.splitModeByOrder', { defaultValue: 'By each person order' })}</option>
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

                {splitMode === 'equal' || splitMode === 'by_person_order' ? (
                  <div className="mt-3">
                    <label className="block">
                      <span className="mb-1 block text-sm text-[var(--guest-muted)]">
                        {splitMode === 'equal'
                          ? t('guestOrders.splitCountLabel', { defaultValue: 'Number of splits' })
                          : t('guestOrders.guestCountLabel', { defaultValue: 'Number of guests' })}
                      </span>
                      <input
                        value={splitCountInput}
                        onChange={(event) => setSplitCountInput(event.target.value)}
                        type="number"
                        min={splitMode === 'equal' ? '2' : '1'}
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

                {splitMode === 'by_person_order' && editableItems.length > 0 ? (
                  <div className="mt-4 rounded-[22px] border border-[var(--guest-border)] bg-[var(--guest-panel-strong)] p-4">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {Array.from({ length: splitCount }).map((_, index) => {
                        const personIndex = index + 1;
                        const isActive = personIndex === activePersonIndex;
                        return (
                          <button
                            key={`person-${personIndex}`}
                            type="button"
                            onClick={() => setActivePersonIndex(personIndex)}
                            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                            style={{
                              backgroundColor: isActive ? 'var(--guest-accent-soft)' : 'transparent',
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-text)',
                            }}
                          >
                            {t('guestOrders.personLabel', { index: personIndex, defaultValue: `Person ${personIndex}` })}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      {editableItems.map((item) => {
                        const currentQuantity = peopleDraft[activePersonIndex]?.[item.order_item_id] ?? 0;
                        const assignedByOthers = getAssignedByOtherPeople(peopleDraft, item.order_item_id, activePersonIndex);
                        const maxQuantity = Math.max(item.quantity - assignedByOthers, 0);
                        const remainingQuantity = Math.max(item.quantity - assignedByOthers - currentQuantity, 0);

                        return (
                          <div
                            key={`split-item-${item.order_item_id}`}
                            className="rounded-[18px] border px-3 py-2.5"
                            style={{
                              borderColor: 'var(--guest-border)',
                              backgroundColor: 'var(--guest-panel)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--guest-text)]">{item.dish_name}</p>
                                <p className="text-xs text-[var(--guest-muted)]">
                                  {t('guestOrders.itemQtyPrice', {
                                    defaultValue: 'Qty {{qty}} • ${{price}} each',
                                    qty: item.quantity,
                                    price: item.unit_price,
                                  })}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPersonItemQuantity(activePersonIndex, item.order_item_id, currentQuantity - 1)}
                                  className="h-8 w-8 rounded-full border"
                                  style={{ borderColor: 'var(--guest-border)', color: 'var(--guest-text)' }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={String(maxQuantity)}
                                  value={String(currentQuantity)}
                                  onChange={(event) => setPersonItemQuantity(activePersonIndex, item.order_item_id, Number(event.target.value))}
                                  className="w-16 rounded-full border px-2 py-1 text-center text-sm"
                                  style={{
                                    borderColor: 'var(--guest-border)',
                                    backgroundColor: 'var(--guest-panel-strong)',
                                    color: 'var(--guest-text)',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setPersonItemQuantity(activePersonIndex, item.order_item_id, currentQuantity + 1)}
                                  className="h-8 w-8 rounded-full border"
                                  style={{ borderColor: 'var(--guest-border)', color: 'var(--guest-text)' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <p className="mt-2 text-xs text-[var(--guest-muted)]">
                              {t('guestOrders.remainingForItem', {
                                defaultValue: 'Remaining unassigned: {{count}}',
                                count: remainingQuantity,
                              })}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={splitSaving}
                        onClick={() => void saveSplit('by_person_order')}
                        className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
                        style={{
                          backgroundColor: 'var(--guest-text)',
                          borderColor: 'var(--guest-text)',
                          color: 'var(--guest-bg)',
                        }}
                      >
                        {t('guestOrders.savePersonSplit', { defaultValue: 'Save Person' })}
                      </button>
                    </div>
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

                {splitMode === 'by_person_order' && unassignedItemsPreview.length > 0 ? (
                  <div className="mt-4 rounded-[22px] border border-[var(--guest-border)] bg-[var(--guest-panel-strong)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--guest-accent)]">
                      {t('guestOrders.unassignedItems', { defaultValue: 'Remaining Unassigned Items' })}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-[var(--guest-muted)]">
                      {unassignedItemsPreview.map((item) => (
                        <p key={`unassigned-${item.order_item_id}`}>
                          {item.dish_name}: {item.remaining_quantity}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {splitMode === 'by_person_order' ? (
                  <p className="mt-3 text-xs text-[var(--guest-muted)]">
                    {invoiceSplit?.is_complete
                      ? t('guestOrders.splitComplete', { defaultValue: 'Split is fully assigned and saved.' })
                      : t('guestOrders.splitIncomplete', { defaultValue: 'Assign all remaining quantities and save to complete split.' })}
                  </p>
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
