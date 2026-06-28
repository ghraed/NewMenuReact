import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassToast, useGlassToast } from '../components/ui/liquid-glass';
import PageSkeleton from '../components/Common/PageSkeleton';
import { useAuth } from '../contexts/useAuth';
import {
  createAdminReservation,
  fetchAdminReservations,
  fetchAdminTableAvailability,
  fetchRoomPlan,
  fetchRoomPlans,
  setAdminReservationStatus,
} from '../services/roomPlanService';
import type { ReservationRecord, RoomPlan, RoomPlanAvailabilityRow } from '../types';
import { toTimeSlots } from '../utils/roomPlan';
import { translateStatusLabel } from '../i18n/dynamic';

const today = new Date().toISOString().slice(0, 10);
const timeSlots = toTimeSlots(15);

const AdminReservationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const { user } = useAuth();
  const isStaffView = user?.role === 'staff';
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
      const rows = await fetchAdminTableAvailability({
        room_plan_id: createRoomPlanId,
        reservation_date: createReservationDate,
        start_time: createStartTime,
        end_time: createEndTime,
      });
      setCreateAvailability(rows);
    } catch {
      setError(t('adminReservationsPage.failedLoadAvailability'));
    } finally {
      setCreateAvailabilityLoading(false);
    }
  }, [createRoomPlanId, createReservationDate, createStartTime, createEndTime, t]);

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
      setError(t('adminReservationsPage.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [reservationDate, roomPlanId, t]);

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
        setError(t('adminReservationsPage.failedLoadSelectedPlan'));
      }
    };

    void loadCreatePlan();
  }, [createRoomPlanId]);

  useEffect(() => {
    void refreshCreateAvailability();
  }, [refreshCreateAvailability]);

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
    if (isStaffView) {
      setError(t('adminReservationsPage.staffViewOnlyError'));
      return;
    }

    setStatusBusyId(reservationId);
    setError(null);
    setSuccess(null);

    try {
      await setAdminReservationStatus(reservationId, action);
      setSuccess(t('adminReservationsPage.statusUpdated'));
      await loadData();
    } catch {
      setError(t('adminReservationsPage.failedStatusUpdate'));
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleCreateReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isStaffView) {
      setError(t('adminReservationsPage.staffViewOnlyError'));
      return;
    }
    setError(null);
    setSuccess(null);

    if (typeof createRoomPlanId !== 'number') {
      setError(t('adminReservationsPage.chooseRoomPlan'));
      return;
    }

    if (typeof createTableItemId !== 'number') {
      setError(t('adminReservationsPage.chooseAvailableTable'));
      return;
    }

    if (!createCustomerName.trim() || !createCustomerPhone.trim()) {
      setError(t('adminReservationsPage.guestNamePhoneRequired'));
      return;
    }

    const selectedTable = createTableOptions.find((entry) => entry.item.id === createTableItemId);
    if (!selectedTable || selectedTable.availability?.is_selectable === false) {
      setError(t('adminReservationsPage.selectedTableUnavailable'));
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
      setSuccess(t('adminReservationsPage.created'));
      await Promise.all([loadData(), refreshCreateAvailability()]);
    } catch {
      setError(t('adminReservationsPage.failedCreate'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <DashboardLayout title={t('adminReservationsPage.pageTitle')}>
      <div className="space-y-4">
        {!isStaffView ? (
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-lg font-semibold text-text">{t('adminReservationsPage.addManualReservation')}</h2>
            <p className="mt-1 text-xs text-muted">{t('adminReservationsPage.addManualReservationHint')}</p>

          <form className="mt-4 space-y-3" onSubmit={(event) => void handleCreateReservation(event)}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.roomPlan')}</span>
                <select
                  value={createRoomPlanId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setCreateRoomPlanId(next === '' ? '' : Number(next));
                  }}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                >
                  <option value="" disabled>{t('adminReservationsPage.selectRoomPlan')}</option>
                  {roomPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.reservationDate')}</span>
                <input
                  type="date"
                  value={createReservationDate}
                  onChange={(event) => setCreateReservationDate(event.target.value)}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                />
              </label>

              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.startTime')}</span>
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
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.endTime')}</span>
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
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('common.table')}</span>
              <select
                value={createTableItemId}
                onChange={(event) => {
                  const next = event.target.value;
                  setCreateTableItemId(next === '' ? '' : Number(next));
                }}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                required
              >
                <option value="">{t('adminReservationsPage.selectAvailableTable')}</option>
                {createTableOptions.map(({ item, availability }) => {
                  const status = availability?.status ?? 'free';
                  const selectable = availability?.is_selectable ?? true;
                  return (
                    <option key={item.id} value={item.id} disabled={!selectable}>
                      {item.label} ({translateStatusLabel(status.replace('_', ' '))})
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.guestName')}</span>
                <input
                  value={createCustomerName}
                  onChange={(event) => setCreateCustomerName(event.target.value)}
                  placeholder={t('adminReservationsPage.guestNamePlaceholder')}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                />
              </label>
              <label className="block text-sm text-text">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.guestPhone')}</span>
                <input
                  value={createCustomerPhone}
                  onChange={(event) => setCreateCustomerPhone(event.target.value)}
                  placeholder={t('adminReservationsPage.guestPhonePlaceholder')}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  required
                />
              </label>
            </div>

            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.guestEmailOptional')}</span>
              <input
                type="email"
                value={createCustomerEmail}
                onChange={(event) => setCreateCustomerEmail(event.target.value)}
                placeholder={t('adminReservationsPage.guestEmailPlaceholder')}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>

            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.notesOptional')}</span>
              <textarea
                value={createNotes}
                onChange={(event) => setCreateNotes(event.target.value)}
                placeholder={t('adminReservationsPage.notesPlaceholder')}
                rows={3}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>

            <button
              type="submit"
              disabled={createSubmitting}
              className="w-full rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65 disabled:opacity-60"
            >
              {createSubmitting ? t('adminReservationsPage.creatingReservation') : t('adminReservationsPage.createReservation')}
            </button>

            {createAvailabilityLoading ? (
              <p className="text-xs text-muted">{t('adminReservationsPage.refreshingAvailability')}</p>
            ) : null}
          </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4 text-sm text-muted">
            {t('adminReservationsPage.staffViewOnly')}
          </div>
        )}

        <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.filterDate')}</span>
              <input
                type="date"
                value={reservationDate}
                onChange={(event) => setReservationDate(event.target.value)}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
            </label>
            <label className="block text-sm text-text">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted2">{t('adminReservationsPage.roomPlan')}</span>
              <select
                value={roomPlanId}
                onChange={(event) => {
                  const next = event.target.value;
                  setRoomPlanId(next === '' ? '' : Number(next));
                }}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              >
                <option value="">{t('adminReservationsPage.allRoomPlans')}</option>
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
              {t('adminReservationsPage.applyFilters')}
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
              {t('adminReservationsPage.reset')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-5">
            <PageSkeleton rows={4} columns={1} loadingText={t('adminReservationsPage.loading')} />
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-5 text-sm text-muted">
            <p className="font-semibold text-text">{t('adminReservationsPage.noReservations')}</p>
            <p className="mt-1">
              {t('adminReservationsPage.noReservationsHint')}
            </p>
          </div>
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
                      {t('adminReservationsPage.planTableLine', {
                        plan: reservation.room_plan?.name ?? reservation.room_plan_id,
                        table: reservation.room_plan_item?.label ?? reservation.room_plan_item_id,
                      })}
                    </p>
                    {reservation.notes ? <p className="mt-1 text-xs text-muted">{t('adminReservationsPage.notesLine', { notes: reservation.notes })}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-gold/45 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-gold2">
                      {translateStatusLabel(reservation.status)}
                    </span>
                    {!isStaffView ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleStatus(reservation.id, 'busy')}
                          disabled={statusBusyId === reservation.id}
                          className="rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 disabled:opacity-50"
                        >
                          {t('adminReservationsPage.actions.busy')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatus(reservation.id, 'complete')}
                          disabled={statusBusyId === reservation.id}
                          className="rounded-lg border border-sage/45 bg-sage/10 px-3 py-1.5 text-xs text-sage disabled:opacity-50"
                        >
                          {t('adminReservationsPage.actions.complete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatus(reservation.id, 'cancel')}
                          disabled={statusBusyId === reservation.id}
                          className="rounded-lg border border-spicy/45 bg-spicy/10 px-3 py-1.5 text-xs text-spicy disabled:opacity-50"
                        >
                          {t('adminReservationsPage.actions.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatus(reservation.id, 'no-show')}
                          disabled={statusBusyId === reservation.id}
                          className="rounded-lg border border-slate-400/45 bg-slate-400/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
                        >
                          {t('adminReservationsPage.actions.noShow')}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">{error}</div> : null}
        {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-3 py-2 text-sm text-sage">{success}</div> : null}
      </div>
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminReservationsPage;
