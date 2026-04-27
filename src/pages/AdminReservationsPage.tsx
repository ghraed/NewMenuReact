import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  fetchAdminReservations,
  fetchRoomPlans,
  setAdminReservationStatus,
} from '../services/roomPlanService';
import type { ReservationRecord, RoomPlan } from '../types';

const today = new Date().toISOString().slice(0, 10);

const AdminReservationsPage: React.FC = () => {
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [roomPlanId, setRoomPlanId] = useState<number | ''>('');
  const [reservationDate, setReservationDate] = useState<string>(today);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  const loadData = async () => {
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
      setReservations(reservationRows);
    } catch {
      setError('Failed to load reservations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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

  return (
    <DashboardLayout title="Reservations Manager">
      <div className="space-y-4">
        <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              type="date"
              value={reservationDate}
              onChange={(event) => setReservationDate(event.target.value)}
              className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
            />
            <select
              value={roomPlanId}
              onChange={(event) => {
                const next = event.target.value;
                setRoomPlanId(next === '' ? '' : Number(next));
              }}
              className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
            >
              <option value="">All room plans</option>
              {roomPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
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
