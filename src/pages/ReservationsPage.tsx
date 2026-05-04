import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import {
  createPublicReservation,
  fetchPublicRoomPlan,
  fetchPublicRoomPlans,
  fetchTableAvailability,
} from '../services/roomPlanService';
import type { RoomPlan, RoomPlanAvailabilityRow } from '../types';
import { roomPlanStatusColor, toTimeSlots } from '../utils/roomPlan';
import NotFoundView from '../components/Common/NotFoundView';

const today = new Date().toISOString().slice(0, 10);
const timeSlots = toTimeSlots(15);

const ReservationsPage: React.FC = () => {
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<RoomPlan | null>(null);
  const [availability, setAvailability] = useState<RoomPlanAvailabilityRow[]>([]);
  const [selectedTableItemId, setSelectedTableItemId] = useState<number | null>(null);

  const [reservationDate, setReservationDate] = useState<string>(today);
  const [startTime, setStartTime] = useState<string>('19:00');
  const [endTime, setEndTime] = useState<string>('20:00');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);

  const isFeatureDisabledNotFound = (unknownError: unknown): boolean => {
    const status = (unknownError as AxiosError<{ message?: string }>)?.response?.status;
    const message = (unknownError as AxiosError<{ message?: string }>)?.response?.data?.message ?? '';
    return status === 404 && /feature/i.test(message);
  };

  const availabilityByItemId = useMemo(
    () => new Map(availability.map((row) => [row.room_plan_item_id, row])),
    [availability]
  );

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFeatureUnavailable(false);

    try {
      const response = await fetchPublicRoomPlans();
      setRoomPlans(response.room_plans ?? []);
      if ((response.room_plans ?? []).length > 0) {
        setSelectedPlanId((previous) => previous ?? response.room_plans[0].id);
      }
    } catch (loadError: unknown) {
      if (isFeatureDisabledNotFound(loadError)) {
        setFeatureUnavailable(true);
        return;
      }
      setError('Failed to load available room plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const loadPlan = async () => {
      if (!selectedPlanId) {
        setSelectedPlan(null);
        return;
      }

      setError(null);
      try {
        const plan = await fetchPublicRoomPlan(selectedPlanId);
        setSelectedPlan(plan);
        setSelectedTableItemId(null);
      } catch (loadError: unknown) {
        if (isFeatureDisabledNotFound(loadError)) {
          setFeatureUnavailable(true);
          return;
        }
        setError('Failed to load selected room plan.');
      }
    };

    void loadPlan();
  }, [selectedPlanId]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!selectedPlanId || !reservationDate || !startTime || !endTime) {
        setAvailability([]);
        return;
      }

      setAvailabilityLoading(true);
      setError(null);

      try {
        const rows = await fetchTableAvailability({
          room_plan_id: selectedPlanId,
          reservation_date: reservationDate,
          start_time: startTime,
          end_time: endTime,
        });
        setAvailability(rows);
      } catch (loadError: unknown) {
        if (isFeatureDisabledNotFound(loadError)) {
          setFeatureUnavailable(true);
          return;
        }
        setError('Failed to load table availability for selected time range.');
      } finally {
        setAvailabilityLoading(false);
      }
    };

    void loadAvailability();
  }, [selectedPlanId, reservationDate, startTime, endTime]);

  const tableItems = useMemo(
    () => (selectedPlan?.items ?? []).filter((item) => (item.type === 'table' || item.type === 'table_circle') && item.is_active),
    [selectedPlan]
  );

  const selectedTableItem = useMemo(
    () => tableItems.find((item) => item.id === selectedTableItemId) ?? null,
    [selectedTableItemId, tableItems]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPlanId || !selectedTableItemId || !selectedTableItem) {
      setError('Please select an available table before booking.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Customer name and phone are required.');
      return;
    }

    if ((selectedTableItem.type !== 'table' && selectedTableItem.type !== 'table_circle') || !selectedTableItem.is_active) {
      setError('Only active tables can be reserved.');
      return;
    }

    const tableAvailability = availabilityByItemId.get(selectedTableItem.id);
    if (tableAvailability && !tableAvailability.is_selectable) {
      setError('Selected table is unavailable for the chosen time range.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createPublicReservation({
        room_plan_id: selectedPlanId,
        room_plan_item_id: selectedTableItem.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        reservation_date: reservationDate,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || undefined,
      });

      setSuccess('Reservation confirmed successfully.');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setNotes('');
      setSelectedTableItemId(null);

      const rows = await fetchTableAvailability({
        room_plan_id: selectedPlanId,
        reservation_date: reservationDate,
        start_time: startTime,
        end_time: endTime,
      });
      setAvailability(rows);
    } catch (submitError: unknown) {
      if (isFeatureDisabledNotFound(submitError)) {
        setFeatureUnavailable(true);
        return;
      }
      setError('Reservation failed. Please review your selected table/time and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (featureUnavailable) {
    return <NotFoundView title="404" message="The requested page could not be found." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg0 via-bg1 to-bg0 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="rounded-2xl border border-stroke bg-bg1/60 p-5">
          <h1 className="text-2xl font-semibold text-text">Book A Table</h1>
          <p className="mt-1 text-sm text-muted">Choose room plan, date, and time to view live table availability.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select
                  value={selectedPlanId ?? ''}
                  onChange={(event) => setSelectedPlanId(Number(event.target.value))}
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                >
                  {roomPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={reservationDate}
                  onChange={(event) => setReservationDate(event.target.value)}
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                />
                <select
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                >
                  {timeSlots.map((slot) => <option key={`start-${slot}`} value={slot}>{slot}</option>)}
                </select>
                <select
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                >
                  {timeSlots.map((slot) => <option key={`end-${slot}`} value={slot}>{slot}</option>)}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#22c55e' }} /> Free</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} /> Reserved</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#ef4444' }} /> Busy</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#94a3b8' }} /> No Show</span>
              </div>
            </div>

            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              {loading ? (
                <p className="text-sm text-muted">Loading room plans...</p>
              ) : selectedPlan ? (
                <div className="overflow-auto rounded-xl border border-stroke bg-bg1/40 p-3">
                  <div
                    className="relative overflow-hidden rounded-lg border border-stroke"
                    style={{
                      width: selectedPlan.width,
                      height: selectedPlan.height,
                      backgroundColor: 'rgba(8, 10, 20, 0.35)',
                    }}
                  >
                    {selectedPlan.background_image_url ? (
                      <img
                        src={selectedPlan.background_image_url}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        style={{ objectFit: 'fill' }}
                        draggable={false}
                      />
                    ) : null}
                    {(selectedPlan.items ?? []).filter((item) => item.is_active).sort((a, b) => a.z_index - b.z_index).map((item) => {
                      const row = availabilityByItemId.get(item.id);
                      const isTable = item.type === 'table';
                      const status = row?.status ?? 'free';
                      const selectable = row?.is_selectable ?? true;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!isTable || !selectable}
                          onClick={() => {
                            if (!isTable || !selectable) return;
                            setSelectedTableItemId(item.id);
                            setSuccess(null);
                            setError(null);
                          }}
                          className={`absolute border text-left transition ${
                            selectedTableItemId === item.id
                              ? 'border-gold2 ring-2 ring-gold2/45'
                              : 'border-stroke'
                          } ${!isTable || !selectable ? 'cursor-not-allowed opacity-90' : 'hover:border-gold/55'}`}
                          style={{
                            left: item.x,
                            top: item.y,
                            width: item.width,
                            height: item.height,
                            transform: `rotate(${item.rotation}deg)`,
                            zIndex: item.z_index,
                            backgroundColor: isTable ? roomPlanStatusColor(status) : 'rgba(30, 41, 59, 0.75)',
                            color: '#fff',
                            padding: 6,
                          }}
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.08em]">{item.label}</div>
                          {isTable ? (
                            <div className="text-[10px] opacity-90">{status.replace('_', ' ')}</div>
                          ) : (
                            <div className="text-[10px] opacity-80">{item.type}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No room plans available.</p>
              )}
              {availabilityLoading ? <p className="mt-2 text-xs text-muted">Refreshing availability...</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-lg font-semibold text-text">Reservation Details</h2>
            <p className="mt-1 text-xs text-muted">
              Selected table: {selectedTableItem?.label ?? 'None'}
            </p>

            <form className="mt-4 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                required
              />
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Customer phone"
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                required
              />
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                placeholder="Customer email (optional)"
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes (optional)"
                rows={4}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
              <button
                type="submit"
                disabled={submitting || !selectedTableItemId}
                className="w-full rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Reserving...' : 'Reserve Selected Table'}
              </button>
            </form>

            {error ? <div className="mt-3 rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">{error}</div> : null}
            {success ? <div className="mt-3 rounded-xl border border-sage/45 bg-sage/10 px-3 py-2 text-sm text-sage">{success}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationsPage;
