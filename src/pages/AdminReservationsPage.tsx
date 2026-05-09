import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  createAdminReservation,
  fetchAdminReservations,
  fetchRoomPlan,
  fetchRoomPlans,
  fetchTableAvailability,
  setAdminReservationStatus,
} from '../services/roomPlanService';
import type { ReservationRecord, RoomPlan, RoomPlanAvailabilityRow } from '../types';
import { toTimeSlots } from '../utils/roomPlan';

const today = new Date().toISOString().slice(0, 10);
const timeSlots = toTimeSlots(15);

const AdminReservationsPage: React.FC = () => {
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [roomPlanId, setRoomPlanId] = useState<number | ''>('');
  const [reservationDate, setReservationDate] = useState<string>(today);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createRoomPlanId, setCreateRoomPlanId] = useState<number | ''>('');
  const [createReservationDate, setCreateReservationDate] = useState<string>(today);
  const [createStartTime, setCreateStartTime] = useState<string>('19:00');
  const [createEndTime, setCreateEndTime] = useState<string>('20:00');
  const [createCustomerName, setCreateCustomerName] = useState('');
  const [createCustomerPhone, setCreateCustomerPhone] = useState('');
  const [createCustomerEmail, setCreateCustomerEmail] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createTableItemId, setCreateTableItemId] = useState<number | ''>('');
  const [createPlan, setCreatePlan] = useState<RoomPlan | null>(null);
  const [createAvailability, setCreateAvailability] = useState<RoomPlanAvailabilityRow[]>([]);
  const [createAvailabilityLoading, setCreateAvailabilityLoading] = useState(false);

  const refreshCreateAvailability = useCallback(async () => {
    if (
      typeof createRoomPlanId !== 'number'
      || !createReservationDate
      || !createStartTime
      || !createEndTime
    ) {
      setCreateAvailability([]);
      return;
    }

    setCreateAvailabilityLoading(true);
    try {
      const rows = await fetchTableAvailability({
        room_plan_id: createRoomPlanId,
        reservation_date: createReservationDate,
        start_time: createStartTime,
        end_time: createEndTime,
      });
      setCreateAvailability(rows);
    } catch {
      setError('Failed to load table availability for manual reservation.');
    } finally {
      setCreateAvailabilityLoading(false);
    }
  }, [createRoomPlanId, createReservationDate, createStartTime, createEndTime]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [plans, reservationRows] = await Promise.all([
        fetchRoomPlans(),
        fetchAdminReservations({
          reservation_date: reservationDate || undefined,
          room_plan_id: typeof roomPlanId === 'number' ? roomPlanId : undefined,
        }),
      ]);

      setRoomPlans(plans);
      setCreateRoomPlanId((previous) => (previous === '' && plans.length > 0 ? plans[0].id : previous));
      setReservations(reservationRows);
    } catch {
      setError('Failed to load reservations.');
    } finally {
      setLoading(false);
    }
  }, [reservationDate, roomPlanId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const loadCreatePlan = async () => {
      if (typeof createRoomPlanId !== 'number') {
        setCreatePlan(null);
        setCreateTableItemId('');
        return;
      }

      try {
        const plan = await fetchRoomPlan(createRoomPlanId);
        setCreatePlan(plan);
        setCreateTableItemId('');
      } catch {
        setError('Failed to load selected room plan for manual reservation.');
      }
    };

    void loadCreatePlan();
  }, [createRoomPlanId]);

  useEffect(() => {
    void refreshCreateAvailability();
  }, [refreshCreateAvailability]);

  const createTableOptions = useMemo(() => {
    const availableLookup = new Map(createAvailability.map((row) => [row.room_plan_item_id, row]));
    return (createPlan?.items ?? [])
      .filter((item) => (item.type === 'table' || item.type === 'table_circle') && item.is_active)
      .map((item) => ({
        item,
        availability: availableLookup.get(item.id),
      }));
  }, [createPlan, createAvailability]);

  const filteredReservations = useMemo(() => reservations, [reservations]);

  const handleStatus = async (reservationId: number, action: 'busy' | 'complete' | 'cancel' | 'no-show') => {
    setStatusBusyId(reservationId);
    setError(null);
    setSuccess(null);

    try {
      await setAdminReservationStatus(reservationId, action);
      setSuccess('Reservation status updated.');
      await loadData();
    } catch {
      setError('Failed to update reservation status.');
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleCreateReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (typeof createRoomPlanId !== 'number') {
      setError('Please choose a room plan.');
      return;
    }

    if (typeof createTableItemId !== 'number') {
      setError('Please choose an available table.');
      return;
    }

    if (!createCustomerName.trim() || !createCustomerPhone.trim()) {
      setError('Guest name and phone are required.');
      return;
    }

    const selectedTable = createTableOptions.find((entry) => entry.item.id === createTableItemId);
    if (!selectedTable || selectedTable.availability?.is_selectable === false) {
      setError('Selected table is unavailable for the chosen time range.');
      return;
    }

    setCreateSubmitting(true);

    try {
      await createAdminReservation({
        room_plan_id: createRoomPlanId,
        room_plan_item_id: createTableItemId,
        customer_name: createCustomerName.trim(),
        customer_phone: createCustomerPhone.trim(),
        customer_email: createCustomerEmail.trim() || undefined,
        reservation_date: createReservationDate,
        start_time: createStartTime,
        end_time: createEndTime,
        notes: createNotes.trim() || undefined,
      });

      setCreateCustomerName('');
      setCreateCustomerPhone('');
      setCreateCustomerEmail('');
      setCreateNotes('');
      setCreateTableItemId('');
      setSuccess('Manual reservation created successfully.');
      await Promise.all([loadData(), refreshCreateAvailability()]);
    } catch {
      setError('Failed to create manual reservation.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Reservations Manager">
      <div className="space-y-4">
        <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
          <h2 className="text-lg font-semibold text-text">Add Manual Reservation</h2>
          <p className="mt-1 text-xs text-muted">Create reservations for walk-in guests or phone bookings.</p>

          <form className="mt-4 space-y-3" onSubmit={(event) => void handleCreateReservation(event)}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Room Plan</span>
                <select
                  value={createRoomPlanId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setCreateRoomPlanId(next === '' ? '' : Number(next));
                  }}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                >
                  <option value="" disabled>Select room plan</option>
                  {roomPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Reservation Date</span>
                <input
                  type="date"
                  value={createReservationDate}
                  onChange={(event) => setCreateReservationDate(event.target.value)}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                />
              </label>

              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Start Time</span>
                <select
                  value={createStartTime}
                  onChange={(event) => setCreateStartTime(event.target.value)}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                >
                  {timeSlots.map((slot) => <option key={`manual-start-${slot}`} value={slot}>{slot}</option>)}
                </select>
              </label>

              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">End Time</span>
                <select
                  value={createEndTime}
                  onChange={(event) => setCreateEndTime(event.target.value)}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                >
                  {timeSlots.map((slot) => <option key={`manual-end-${slot}`} value={slot}>{slot}</option>)}
                </select>
              </label>
            </div>

            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Table</span>
              <select
                value={createTableItemId}
                onChange={(event) => {
                  const next = event.target.value;
                  setCreateTableItemId(next === '' ? '' : Number(next));
                }}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                required
              >
                <option value="">Select available table</option>
                {createTableOptions.map(({ item, availability }) => {
                  const status = availability?.status ?? 'free';
                  const selectable = availability?.is_selectable ?? true;
                  return (
                    <option key={item.id} value={item.id} disabled={!selectable}>
                      {item.label} ({status.replace('_', ' ')})
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Guest Name</span>
                <input
                  value={createCustomerName}
                  onChange={(event) => setCreateCustomerName(event.target.value)}
                  placeholder="Guest name"
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                />
              </label>
              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Guest Phone</span>
                <input
                  value={createCustomerPhone}
                  onChange={(event) => setCreateCustomerPhone(event.target.value)}
                  placeholder="Guest phone"
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                />
              </label>
            </div>

            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Guest Email (Optional)</span>
              <input
                type="email"
                value={createCustomerEmail}
                onChange={(event) => setCreateCustomerEmail(event.target.value)}
                placeholder="Guest email (optional)"
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>

            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Notes (Optional)</span>
              <textarea
                value={createNotes}
                onChange={(event) => setCreateNotes(event.target.value)}
                placeholder="Notes (optional)"
                rows={3}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>

            <button
              type="submit"
              disabled={createSubmitting}
              className="w-full rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65 disabled:opacity-60"
            >
              {createSubmitting ? 'Creating reservation...' : 'Create Reservation'}
            </button>

            {createAvailabilityLoading ? (
              <p className="text-xs text-muted">Refreshing availability for selected time...</p>
            ) : null}
          </form>
        </div>

        <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Filter Date</span>
              <input
                type="date"
                value={reservationDate}
                onChange={(event) => setReservationDate(event.target.value)}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>
            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">Room Plan</span>
              <select
                value={roomPlanId}
                onChange={(event) => {
                  const next = event.target.value;
                  setRoomPlanId(next === '' ? '' : Number(next));
                }}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              >
                <option value="">All room plans</option>
                {roomPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setRoomPlanId('');
                setReservationDate(today);
                void loadData();
              }}
              className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text transition hover:border-gold/35"
            >
              Reset
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-5 text-sm text-muted">Loading reservations...</div>
        ) : filteredReservations.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-5 text-sm text-muted">No reservations found for current filters.</div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map((reservation) => (
              <div key={reservation.id} className="rounded-2xl border border-stroke bg-bg1/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text">{reservation.customer_name}</h3>
                    <p className="text-xs text-muted">{reservation.customer_phone} {reservation.customer_email ? `• ${reservation.customer_email}` : ''}</p>
                    <p className="mt-1 text-sm text-muted">
                      {reservation.reservation_date} • {reservation.start_time} - {reservation.end_time}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Plan: {reservation.room_plan?.name ?? reservation.room_plan_id} • Table: {reservation.room_plan_item?.label ?? reservation.room_plan_item_id}
                    </p>
                    {reservation.notes ? <p className="mt-1 text-xs text-muted">Notes: {reservation.notes}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-gold/45 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-gold2">
                      {reservation.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleStatus(reservation.id, 'busy')}
                      disabled={statusBusyId === reservation.id}
                      className="rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 disabled:opacity-50"
                    >
                      Busy
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatus(reservation.id, 'complete')}
                      disabled={statusBusyId === reservation.id}
                      className="rounded-lg border border-sage/45 bg-sage/10 px-3 py-1.5 text-xs text-sage disabled:opacity-50"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatus(reservation.id, 'cancel')}
                      disabled={statusBusyId === reservation.id}
                      className="rounded-lg border border-spicy/45 bg-spicy/10 px-3 py-1.5 text-xs text-spicy disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatus(reservation.id, 'no-show')}
                      disabled={statusBusyId === reservation.id}
                      className="rounded-lg border border-slate-400/45 bg-slate-400/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
                    >
                      No Show
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">{error}</div> : null}
        {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-3 py-2 text-sm text-sage">{success}</div> : null}
      </div>
    </DashboardLayout>
  );
};

export default AdminReservationsPage;
