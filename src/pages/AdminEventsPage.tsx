import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassSearchSelect, GlassToast, useGlassToast } from '../components/ui/liquid-glass';
import PageSkeleton from '../components/Common/PageSkeleton';
import { getEcho } from '../services/realtime';
import { useAuth } from '../contexts/useAuth';
import { translateStatusLabel } from '../i18n/dynamic';
import {
  createAdminEvent,
  fetchAdminEventDishOptions,
  fetchAdminEventForecast,
  fetchAdminEvents,
  replaceAdminEventMenuItems,
  setAdminEventStatus,
  updateAdminEvent,
  type EventReservationPayload,
} from '../services/eventReservationService';
import { fetchRoomPlans } from '../services/roomPlanService';
import type {
  EventForecast,
  EventReservationMenuItem,
  EventReservationRecord,
  EventReservationStatus,
  PublishedDishSummary,
  RoomPlan,
} from '../types';
import { downloadEventPlanPdf } from '../utils/eventPlanPdf';

const today = new Date().toISOString().slice(0, 10);

type EventDraft = {
  id: number | null;
  title: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  room_plan_id: number | '';
  invoice_id: number | '';
  event_date: string;
  start_time: string;
  end_time: string;
  notes: string;
  status: EventReservationStatus;
};

const defaultDraft: EventDraft = {
  id: null,
  title: '',
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  room_plan_id: '',
  invoice_id: '',
  event_date: today,
  start_time: '19:00',
  end_time: '22:00',
  notes: '',
  status: 'draft',
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<{ message?: string; errors?: Record<string, unknown> }>;
  const conflicts = axiosError.response?.data?.errors?.conflicts;
  if (Array.isArray(conflicts)) {
    return fallback;
  }

  return axiosError.response?.data?.message ?? fallback;
};

const toPayload = (draft: EventDraft): EventReservationPayload => ({
  title: draft.title.trim(),
  customer_name: draft.customer_name.trim(),
  customer_phone: draft.customer_phone.trim(),
  customer_email: draft.customer_email.trim() || null,
  room_plan_id: draft.room_plan_id === '' ? null : draft.room_plan_id,
  invoice_id: draft.invoice_id === '' ? null : draft.invoice_id,
  event_date: draft.event_date,
  start_time: draft.start_time,
  end_time: draft.end_time,
  notes: draft.notes.trim() || null,
  status: draft.status,
});

const toDraft = (event: EventReservationRecord): EventDraft => ({
  id: event.id,
  title: event.title,
  customer_name: event.customer_name,
  customer_phone: event.customer_phone,
  customer_email: event.customer_email ?? '',
  room_plan_id: event.room_plan_id ?? '',
  invoice_id: event.invoice_id ?? '',
  event_date: event.event_date,
  start_time: event.start_time,
  end_time: event.end_time,
  notes: event.notes ?? '',
  status: event.status,
});

const AdminEventsPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const { user } = useAuth();
  const [events, setEvents] = useState<EventReservationRecord[]>([]);
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [publishedDishes, setPublishedDishes] = useState<PublishedDishSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventDraft>(defaultDraft);
  const [menuDraft, setMenuDraft] = useState<Record<number, { planned_quantity: number; prep_notes: string }>>({});
  const [menuPickerValue, setMenuPickerValue] = useState('');
  const [forecast, setForecast] = useState<EventForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState<EventReservationStatus | null>(null);
  const [filters, setFilters] = useState<{ status: EventReservationStatus | 'all'; date_from: string; date_to: string }>({
    status: 'all',
    date_from: '',
    date_to: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ blocking_reservations?: unknown[]; blocking_events?: unknown[] } | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const reloadEvents = useCallback(async () => {
    const rows = await fetchAdminEvents({
      status: filters.status,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    });
    setEvents(rows);
    setSelectedEventId((previous) => {
      if (!rows.length) return null;
      if (previous && rows.some((row) => row.id === previous)) return previous;
      return rows[0].id;
    });
  }, [filters.date_from, filters.date_to, filters.status]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [plans, dishes] = await Promise.all([
          fetchRoomPlans(),
          fetchAdminEventDishOptions(),
      ]);
        setRoomPlans(plans);
        setPublishedDishes(dishes);
        await reloadEvents();
      } catch (err) {
        setError(getErrorMessage(err, t('adminEventsPage.failedLoad')));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [reloadEvents, t]);

  useEffect(() => {
    if (!user?.restaurant?.id) {
      return undefined;
    }

    const echo = getEcho();
    if (!echo) {
      return undefined;
    }

    const channelName = `restaurant.${user.restaurant.id}.events`;
    const channel = echo.private(channelName);

    channel.listen('.event-planning.updated', () => {
      void reloadEvents();
    });

    return () => {
      echo.leave(channelName);
    };
  }, [reloadEvents, user?.restaurant?.id]);

  useEffect(() => {
    if (!selectedEvent) {
      setDraft(defaultDraft);
      setMenuDraft({});
      setMenuPickerValue('');
      setForecast(null);
      return;
    }

    setDraft(toDraft(selectedEvent));
    const nextMenuDraft: Record<number, { planned_quantity: number; prep_notes: string }> = {};
    selectedEvent.menu_items.forEach((item) => {
      nextMenuDraft[item.dish_id] = {
        planned_quantity: item.planned_quantity,
        prep_notes: item.prep_notes ?? '',
      };
    });
    setMenuDraft(nextMenuDraft);
    setMenuPickerValue('');
    setForecast(null);
  }, [selectedEvent]);

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

  const handleCreateNew = () => {
    setSelectedEventId(null);
    setDraft(defaultDraft);
    setMenuDraft({});
    setMenuPickerValue('');
    setForecast(null);
    setError(null);
    setSuccess(null);
    setConflicts(null);
  };

  const handleSaveEvent = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setConflicts(null);

    try {
      const payload = toPayload(draft);
      const saved = draft.id
        ? await updateAdminEvent(draft.id, payload)
        : await createAdminEvent(payload);

      await reloadEvents();
      setSelectedEventId(saved.id);
      setSuccess(draft.id ? t('adminEventsPage.updated') : t('adminEventsPage.created'));
    } catch (err) {
      const axiosError = err as AxiosError<{ errors?: { conflicts?: { blocking_reservations?: unknown[]; blocking_events?: unknown[] } }; message?: string }>;
      setConflicts(axiosError.response?.data?.errors?.conflicts ?? null);
      setError(getErrorMessage(err, t('adminEventsPage.failedSave')));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMenu = async () => {
    if (!draft.id) {
      setError(t('adminEventsPage.createEventFirst'));
      return;
    }

    const allowedDishIds = new Set(publishedDishes.map((dish) => dish.id));
    const items: EventReservationMenuItem[] = Object.entries(menuDraft)
      .filter(([dishId]) => allowedDishIds.has(Number(dishId)))
      .map(([dishId, row]) => ({
        dish_id: Number(dishId),
        planned_quantity: row.planned_quantity,
        prep_notes: row.prep_notes.trim() || null,
      }))
      .filter((row) => row.planned_quantity > 0);

    setMenuSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await replaceAdminEventMenuItems(draft.id, items);
      await reloadEvents();
      setSelectedEventId(updated.id);
      setSuccess(t('adminEventsPage.plannedMenuSaved'));
    } catch (err) {
      setError(getErrorMessage(err, t('adminEventsPage.failedSaveMenu')));
    } finally {
      setMenuSaving(false);
    }
  };

  const handleStatusAction = async (action: 'confirm' | 'cancel' | 'complete', status: EventReservationStatus) => {
    if (!draft.id) return;
    setStatusBusy(status);
    setError(null);
    setSuccess(null);
    try {
      const updated = await setAdminEventStatus(draft.id, action);
      await reloadEvents();
      setSelectedEventId(updated.id);
      setSuccess(t('adminEventsPage.markedAs', { status: translateStatusLabel(status) }));
    } catch (err) {
      setError(getErrorMessage(err, t('adminEventsPage.failedStatusUpdate')));
    } finally {
      setStatusBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const nextForecast = draft.id
        ? await fetchAdminEventForecast(draft.id)
        : null;

      if (nextForecast) {
        setForecast(nextForecast);
      }

      downloadEventPlanPdf({
        restaurantName: user?.restaurant?.name || t('adminEventsPage.restaurantFallback'),
        event: {
          id: draft.id ?? 0,
          title: draft.title,
          customer_name: draft.customer_name,
          customer_phone: draft.customer_phone,
          customer_email: draft.customer_email || null,
          status: draft.status,
          notes: draft.notes || null,
          event_date: draft.event_date,
          start_time: draft.start_time,
          end_time: draft.end_time,
          room_plan: roomPlans.find((plan) => plan.id === draft.room_plan_id)
            ? {
                id: Number(draft.room_plan_id),
                name: roomPlans.find((plan) => plan.id === draft.room_plan_id)?.name || '',
              }
            : null,
        },
        plannedMenu: groupedDishes.map(([category, dishes]) => ({
          category,
          items: dishes.map((dish) => ({
            dishName: dish.name,
            plannedQuantity: menuDraft[dish.id]?.planned_quantity ?? 0,
            prepNotes: menuDraft[dish.id]?.prep_notes ?? '',
          })),
        })),
        forecast: nextForecast ?? forecast,
      });

      setSuccess(t('adminEventsPage.pdfDownloaded'));
    } catch (err) {
      setError(getErrorMessage(err, t('adminEventsPage.failedDownloadPdf')));
    } finally {
      setSaving(false);
    }
  };

  const handleForecast = async () => {
    if (!draft.id) return;
    setError(null);
    try {
      const nextForecast = await fetchAdminEventForecast(draft.id);
      setForecast(nextForecast);
    } catch (err) {
      setError(getErrorMessage(err, t('adminEventsPage.failedLoadForecast')));
    }
  };

  const groupedDishes = useMemo(() => {
    const selectedDishIds = new Set(Object.keys(menuDraft).map((dishId) => Number(dishId)));
    const groups = new Map<string, PublishedDishSummary[]>();
    publishedDishes
      .filter((dish) => selectedDishIds.has(dish.id))
      .forEach((dish) => {
      const key = dish.category || t('adminEventsPage.uncategorized');
      const bucket = groups.get(key) ?? [];
      bucket.push(dish);
      groups.set(key, bucket);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, dishes]) => [
        category,
        [...dishes].sort((a, b) => a.name.localeCompare(b.name)),
      ] as const);
  }, [menuDraft, publishedDishes, t]);

  const addableDishOptions = useMemo(() => {
    const selectedDishIds = new Set(Object.keys(menuDraft).map((dishId) => Number(dishId)));
    return publishedDishes
      .filter((dish) => !selectedDishIds.has(dish.id))
      .sort((a, b) => {
        const categoryCompare = (a.category || t('adminEventsPage.uncategorized')).localeCompare(b.category || t('adminEventsPage.uncategorized'));
        return categoryCompare !== 0 ? categoryCompare : a.name.localeCompare(b.name);
      })
      .map((dish) => ({
        value: String(dish.id),
        label: `${dish.name} · ${dish.category || t('adminEventsPage.uncategorized')}`,
      }));
  }, [menuDraft, publishedDishes, t]);

  const handleAddMenuDish = (dishId: number) => {
    setMenuDraft((current) => {
      if (current[dishId]) {
        return current;
      }

      return {
        ...current,
        [dishId]: {
          planned_quantity: 1,
          prep_notes: '',
        },
      };
    });
    setMenuPickerValue('');
  };

  const handleRemoveMenuDish = (dishId: number) => {
    setMenuDraft((current) => {
      if (!(dishId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[dishId];
      return next;
    });
  };

  return (
    <DashboardLayout title={t('adminEventsPage.pageTitle')}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm text-text">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.status')}</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as EventReservationStatus | 'all' }))}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              >
                <option value="all">{t('adminEventsPage.all')}</option>
                <option value="draft">{t('dynamic.status.draft')}</option>
                <option value="confirmed">{t('dynamic.status.confirmed')}</option>
                <option value="cancelled">{t('dynamic.status.cancelled')}</option>
                <option value="completed">{t('dynamic.status.completed')}</option>
              </select>
            </label>
            <label className="text-sm text-text">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.dateFrom')}</span>
              <input
                type="date"
                value={filters.date_from}
                onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>
            <label className="text-sm text-text">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.dateTo')}</span>
              <input
                type="date"
                value={filters.date_to}
                onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void reloadEvents()}
                className="rounded-xl border border-gold/45 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold2"
              >
                {t('adminEventsPage.refresh')}
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                className="rounded-xl border border-stroke bg-bg1 px-4 py-2 text-sm text-text"
              >
                {t('adminEventsPage.newEvent')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-lg font-semibold text-text">{t('adminEventsPage.events')}</h2>
            {loading ? (
              <div className="mt-3">
                <PageSkeleton rows={4} columns={1} loadingText={t('adminEventsPage.loadingEvents')} />
              </div>
            ) : events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('adminEventsPage.noEvents')}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      selectedEventId === event.id ? 'border-gold/50 bg-gold/10' : 'border-stroke bg-bg1/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-text">{event.title}</p>
                    <p className="text-xs text-muted">{event.event_date} {event.start_time} - {event.end_time}</p>
                    <p className="text-xs uppercase tracking-[0.08em] text-gold2">{translateStatusLabel(event.status)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <h2 className="text-lg font-semibold text-text">{t('adminEventsPage.eventDetails')}</h2>
              {draft.status === 'confirmed' && selectedEvent?.lead_time_warning ? (
                <div className="mt-2 rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">
                  {selectedEvent.lead_time_warning}
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.eventTitle')}</span>
                  <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={t('adminEventsPage.eventTitle')} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.customerName')}</span>
                  <input value={draft.customer_name} onChange={(event) => setDraft((current) => ({ ...current, customer_name: event.target.value }))} placeholder={t('adminEventsPage.customerName')} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.customerPhone')}</span>
                  <input value={draft.customer_phone} onChange={(event) => setDraft((current) => ({ ...current, customer_phone: event.target.value }))} placeholder={t('adminEventsPage.customerPhone')} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.customerEmailOptional')}</span>
                  <input type="email" value={draft.customer_email} onChange={(event) => setDraft((current) => ({ ...current, customer_email: event.target.value }))} placeholder={t('adminEventsPage.customerEmailOptional')} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.eventDate')}</span>
                  <input type="date" value={draft.event_date} onChange={(event) => setDraft((current) => ({ ...current, event_date: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <div>
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.eventTime')}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm text-text">
                      <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.startTime')}</span>
                      <input type="time" value={draft.start_time} onChange={(event) => setDraft((current) => ({ ...current, start_time: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                    </label>
                    <label className="text-sm text-text">
                      <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.endTime')}</span>
                      <input type="time" value={draft.end_time} onChange={(event) => setDraft((current) => ({ ...current, end_time: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                    </label>
                  </div>
                </div>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.roomPlan')}</span>
                  <select value={draft.room_plan_id} onChange={(event) => setDraft((current) => ({ ...current, room_plan_id: event.target.value === '' ? '' : Number(event.target.value) }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text">
                    <option value="">{t('adminEventsPage.allRoomPlans')}</option>
                    {roomPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.invoiceIdOptional')}</span>
                  <input type="number" min={1} value={draft.invoice_id === '' ? '' : draft.invoice_id} onChange={(event) => setDraft((current) => ({ ...current, invoice_id: event.target.value === '' ? '' : Number(event.target.value) }))} placeholder={t('adminEventsPage.invoiceIdOptional')} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
              </div>
              <label className="mt-3 block text-sm text-text">
                <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">{t('adminEventsPage.operationalNotes')}</span>
                <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder={t('adminEventsPage.operationalNotes')} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleSaveEvent()} disabled={saving} className="rounded-xl border border-gold/45 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold2 disabled:opacity-60">
                  {saving ? t('adminEventsPage.saving') : draft.id ? t('adminEventsPage.saveEvent') : t('adminEventsPage.createEvent')}
                </button>
                <button type="button" onClick={() => void handleStatusAction('confirm', 'confirmed')} disabled={!draft.id || statusBusy !== null} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">{t('adminEventsPage.confirm')}</button>
                <button type="button" onClick={() => void handleStatusAction('cancel', 'cancelled')} disabled={!draft.id || statusBusy !== null} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">{t('adminEventsPage.cancel')}</button>
                <button type="button" onClick={() => void handleStatusAction('complete', 'completed')} disabled={!draft.id || statusBusy !== null} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">{t('adminEventsPage.complete')}</button>
                <button type="button" onClick={() => void handleDownloadPdf()} disabled={saving} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">{t('adminEventsPage.downloadPdf')}</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text">{t('adminEventsPage.plannedMenuQuantities')}</h3>
                <button type="button" onClick={() => void handleSaveMenu()} disabled={!draft.id || menuSaving} className="rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 disabled:opacity-60">
                  {menuSaving ? t('adminEventsPage.saving') : t('adminEventsPage.savePlannedMenu')}
                </button>
              </div>
              <div className="rounded-xl border border-stroke bg-bg1/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold2">{t('adminEventsPage.addMenuItem')}</p>
                <GlassSearchSelect
                  value={menuPickerValue}
                  options={addableDishOptions}
                  onChange={(nextValue) => {
                    setMenuPickerValue(nextValue);
                    const dishId = Number(nextValue);
                    if (Number.isFinite(dishId) && dishId > 0) {
                      handleAddMenuDish(dishId);
                    }
                  }}
                  placeholder={t('adminEventsPage.searchDishesToAdd')}
                  searchPlaceholder={t('adminEventsPage.searchByDishOrCategory')}
                  emptyText={t('adminEventsPage.allAvailableDishesAdded')}
                  disabled={!draft.id || menuSaving}
                />
              </div>
              <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
                {groupedDishes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stroke bg-bg1/30 px-4 py-6 text-center text-sm text-muted">
                    {t('adminEventsPage.addDishesHint')}
                  </div>
                ) : null}
                {groupedDishes.map(([category, dishes]) => (
                  <div key={category} className="rounded-xl border border-stroke bg-bg1/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold2">{category}</p>
                    <div className="space-y-2">
                      {dishes.map((dish) => {
                        const entry = menuDraft[dish.id] ?? { planned_quantity: 0, prep_notes: '' };
                        return (
                          <div key={dish.id} className="rounded-xl border border-stroke bg-bg1/55 p-3">
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-start">
                              <div>
                                <p className="text-sm font-medium text-text">{dish.name}</p>
                                <p className="mt-1 text-xs text-muted">{t('adminEventsPage.quantityAssignedHint')}</p>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={entry.planned_quantity}
                                onChange={(event) => {
                                  const plannedQuantity = Number(event.target.value) || 0;
                                  setMenuDraft((current) => ({
                                    ...current,
                                    [dish.id]: {
                                      ...entry,
                                      planned_quantity: Math.max(0, plannedQuantity),
                                    },
                                  }));
                                }}
                                className="rounded-lg border border-stroke bg-bg1 px-2 py-1.5 text-sm text-text"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMenuDish(dish.id)}
                                className="rounded-lg border border-stroke bg-bg1 px-3 py-1.5 text-xs text-text"
                              >
                                {t('adminEventsPage.remove')}
                              </button>
                            </div>
                            <input
                              value={entry.prep_notes}
                              onChange={(event) => setMenuDraft((current) => ({
                                ...current,
                                [dish.id]: {
                                  ...entry,
                                  prep_notes: event.target.value,
                                },
                              }))}
                              placeholder={t('adminEventsPage.prepNoteOptional')}
                              className="mt-3 w-full rounded-lg border border-stroke bg-bg1 px-2 py-1.5 text-xs text-text"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleForecast()} disabled={!draft.id} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">
                  {t('adminEventsPage.loadForecast')}
                </button>
              </div>

              {forecast ? (
                <div className="mt-3 rounded-xl border border-stroke bg-bg1/40 p-3">
                  <p className="text-sm font-semibold text-text">{t('adminEventsPage.forecastSummary')}</p>
                  <p className="text-xs text-muted">
                    {t('adminEventsPage.forecastCounts', {
                      dishes: forecast.summary.dish_count,
                      ingredients: forecast.summary.ingredient_count,
                      shortages: forecast.summary.shortage_count,
                    })}
                  </p>
                  <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-stroke bg-bg1/45 p-2">
                    {forecast.ingredient_totals.map((ingredient) => (
                      <div key={ingredient.ingredient_id} className="flex items-center justify-between gap-2 py-1 text-xs">
                        <span className={ingredient.is_shortage ? 'text-spicy' : 'text-text'}>
                          {ingredient.ingredient_name} ({ingredient.unit})
                        </span>
                        <span className={ingredient.is_shortage ? 'text-spicy' : 'text-muted'}>
                          {t('adminEventsPage.needAvailable', {
                            required: ingredient.required_quantity,
                            available: ingredient.available_quantity,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {conflicts ? (
              <div className="rounded-2xl border border-spicy/45 bg-spicy/10 p-4 text-sm text-spicy">
                <p className="font-semibold">{t('adminEventsPage.conflictsDetected')}</p>
                <p className="mt-1">{t('adminEventsPage.conflictsHint')}</p>
                <p className="mt-1 text-xs">
                  {t('adminEventsPage.conflictsCounts', {
                    reservations: conflicts.blocking_reservations?.length ?? 0,
                    events: conflicts.blocking_events?.length ?? 0,
                  })}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">{error}</div> : null}
        {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-3 py-2 text-sm text-sage">{success}</div> : null}
      </div>
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminEventsPage;
