import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassToast, useGlassToast } from '../components/ui/liquid-glass';
import { getEcho } from '../services/realtime';
import { useAuth } from '../contexts/useAuth';
import {
  createAdminEvent,
  fetchAdminEventForecast,
  fetchAdminEvents,
  generateAdminEventOrderDraft,
  replaceAdminEventMenuItems,
  setAdminEventStatus,
  updateAdminEvent,
  type EventReservationPayload,
} from '../services/eventReservationService';
import { fetchRoomPlans } from '../services/roomPlanService';
import { fetchPublishedDishes } from '../services/orderService';
import type {
  EventForecast,
  EventReservationMenuItem,
  EventReservationRecord,
  EventReservationStatus,
  PublishedDishSummary,
  RoomPlan,
} from '../types';

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
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const { user } = useAuth();
  const [events, setEvents] = useState<EventReservationRecord[]>([]);
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [publishedDishes, setPublishedDishes] = useState<PublishedDishSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventDraft>(defaultDraft);
  const [menuDraft, setMenuDraft] = useState<Record<number, { planned_quantity: number; prep_notes: string }>>({});
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
          fetchPublishedDishes(),
        ]);
        setRoomPlans(plans);
        setPublishedDishes(dishes);
        await reloadEvents();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load event planner data.'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [reloadEvents]);

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
      setSuccess(draft.id ? 'Event updated successfully.' : 'Event created successfully.');
    } catch (err) {
      const axiosError = err as AxiosError<{ errors?: { conflicts?: { blocking_reservations?: unknown[]; blocking_events?: unknown[] } }; message?: string }>;
      setConflicts(axiosError.response?.data?.errors?.conflicts ?? null);
      setError(getErrorMessage(err, 'Failed to save event.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMenu = async () => {
    if (!draft.id) {
      setError('Create the event first, then save planned menu quantities.');
      return;
    }

    const items: EventReservationMenuItem[] = Object.entries(menuDraft)
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
      setSuccess('Planned menu saved.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save planned menu.'));
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
      setSuccess(`Event marked as ${status}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update event status.'));
    } finally {
      setStatusBusy(null);
    }
  };

  const handleGenerateDraftOrder = async () => {
    if (!draft.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await generateAdminEventOrderDraft(draft.id);
      setSuccess(`${response.message} Order #${response.order.order_number || response.order.id}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate event order draft.'));
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
      setError(getErrorMessage(err, 'Failed to load event forecast.'));
    }
  };

  const groupedDishes = useMemo(() => {
    const groups = new Map<string, PublishedDishSummary[]>();
    publishedDishes.forEach((dish) => {
      const key = dish.category || 'Uncategorized';
      const bucket = groups.get(key) ?? [];
      bucket.push(dish);
      groups.set(key, bucket);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [publishedDishes]);

  return (
    <DashboardLayout title="Event Planner">
      <div className="space-y-4">
        <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm text-text">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as EventReservationStatus | 'all' }))}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="text-sm text-text">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Date From</span>
              <input
                type="date"
                value={filters.date_from}
                onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>
            <label className="text-sm text-text">
              <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Date To</span>
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
                Refresh
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                className="rounded-xl border border-stroke bg-bg1 px-4 py-2 text-sm text-text"
              >
                New Event
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-lg font-semibold text-text">Events</h2>
            {loading ? (
              <p className="mt-3 text-sm text-muted">Loading events...</p>
            ) : events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No events found for selected filters.</p>
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
                    <p className="text-xs uppercase tracking-[0.08em] text-gold2">{event.status}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <h2 className="text-lg font-semibold text-text">Event Details</h2>
              {draft.status === 'confirmed' && selectedEvent?.lead_time_warning ? (
                <div className="mt-2 rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">
                  {selectedEvent.lead_time_warning}
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Event title</span>
                  <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Event title" className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Customer name</span>
                  <input value={draft.customer_name} onChange={(event) => setDraft((current) => ({ ...current, customer_name: event.target.value }))} placeholder="Customer name" className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Customer phone</span>
                  <input value={draft.customer_phone} onChange={(event) => setDraft((current) => ({ ...current, customer_phone: event.target.value }))} placeholder="Customer phone" className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Customer email (optional)</span>
                  <input type="email" value={draft.customer_email} onChange={(event) => setDraft((current) => ({ ...current, customer_email: event.target.value }))} placeholder="Customer email (optional)" className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Event date</span>
                  <input type="date" value={draft.event_date} onChange={(event) => setDraft((current) => ({ ...current, event_date: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
                <div>
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Event time</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm text-text">
                      <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted2">Start time</span>
                      <input type="time" value={draft.start_time} onChange={(event) => setDraft((current) => ({ ...current, start_time: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                    </label>
                    <label className="text-sm text-text">
                      <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted2">End time</span>
                      <input type="time" value={draft.end_time} onChange={(event) => setDraft((current) => ({ ...current, end_time: event.target.value }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                    </label>
                  </div>
                </div>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Room plan</span>
                  <select value={draft.room_plan_id} onChange={(event) => setDraft((current) => ({ ...current, room_plan_id: event.target.value === '' ? '' : Number(event.target.value) }))} className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text">
                    <option value="">All Room Plans</option>
                    {roomPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-text">
                  <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Invoice ID (optional)</span>
                  <input type="number" min={1} value={draft.invoice_id === '' ? '' : draft.invoice_id} onChange={(event) => setDraft((current) => ({ ...current, invoice_id: event.target.value === '' ? '' : Number(event.target.value) }))} placeholder="Invoice ID (optional)" className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
                </label>
              </div>
              <label className="mt-3 block text-sm text-text">
                <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted2">Operational notes</span>
                <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Operational notes" className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text" />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleSaveEvent()} disabled={saving} className="rounded-xl border border-gold/45 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold2 disabled:opacity-60">
                  {saving ? 'Saving...' : draft.id ? 'Save Event' : 'Create Event'}
                </button>
                <button type="button" onClick={() => void handleStatusAction('confirm', 'confirmed')} disabled={!draft.id || statusBusy !== null} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">Confirm</button>
                <button type="button" onClick={() => void handleStatusAction('cancel', 'cancelled')} disabled={!draft.id || statusBusy !== null} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">Cancel</button>
                <button type="button" onClick={() => void handleStatusAction('complete', 'completed')} disabled={!draft.id || statusBusy !== null} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">Complete</button>
                <button type="button" onClick={() => void handleGenerateDraftOrder()} disabled={!draft.id || saving} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">Generate Order Draft</button>
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text">Planned Menu Quantities</h3>
                <button type="button" onClick={() => void handleSaveMenu()} disabled={!draft.id || menuSaving} className="rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 disabled:opacity-60">
                  {menuSaving ? 'Saving...' : 'Save Planned Menu'}
                </button>
              </div>
              <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
                {groupedDishes.map(([category, dishes]) => (
                  <div key={category} className="rounded-xl border border-stroke bg-bg1/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gold2">{category}</p>
                    <div className="space-y-2">
                      {dishes.map((dish) => {
                        const entry = menuDraft[dish.id] ?? { planned_quantity: 0, prep_notes: '' };
                        return (
                          <div key={dish.id} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px]">
                            <div>
                              <p className="text-sm font-medium text-text">{dish.name}</p>
                              <input
                                value={entry.prep_notes}
                                onChange={(event) => setMenuDraft((current) => ({
                                  ...current,
                                  [dish.id]: {
                                    ...entry,
                                    prep_notes: event.target.value,
                                  },
                                }))}
                                placeholder="Prep note (optional)"
                                className="mt-1 w-full rounded-lg border border-stroke bg-bg1 px-2 py-1.5 text-xs text-text"
                              />
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleForecast()} disabled={!draft.id} className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text disabled:opacity-60">
                  Load Forecast
                </button>
              </div>

              {forecast ? (
                <div className="mt-3 rounded-xl border border-stroke bg-bg1/40 p-3">
                  <p className="text-sm font-semibold text-text">Forecast Summary</p>
                  <p className="text-xs text-muted">
                    Dishes: {forecast.summary.dish_count} | Ingredients: {forecast.summary.ingredient_count} | Shortages: {forecast.summary.shortage_count}
                  </p>
                  <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-stroke bg-bg1/45 p-2">
                    {forecast.ingredient_totals.map((ingredient) => (
                      <div key={ingredient.ingredient_id} className="flex items-center justify-between gap-2 py-1 text-xs">
                        <span className={ingredient.is_shortage ? 'text-spicy' : 'text-text'}>
                          {ingredient.ingredient_name} ({ingredient.unit})
                        </span>
                        <span className={ingredient.is_shortage ? 'text-spicy' : 'text-muted'}>
                          Need {ingredient.required_quantity} / Available {ingredient.available_quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {conflicts ? (
              <div className="rounded-2xl border border-spicy/45 bg-spicy/10 p-4 text-sm text-spicy">
                <p className="font-semibold">Conflicts detected</p>
                <p className="mt-1">Resolve overlapping table reservations/events before saving this full-venue event.</p>
                <p className="mt-1 text-xs">
                  Reservations: {conflicts.blocking_reservations?.length ?? 0} | Events: {conflicts.blocking_events?.length ?? 0}
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
