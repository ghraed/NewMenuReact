import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { fetchStaffMembers } from '../services/staffService';
import {
  createStaffShift,
  fetchStaffSchedules,
  updateStaffShift,
  type CreateStaffShiftPayload,
} from '../services/staffScheduleService';
import type { StaffMember, StaffShift, StaffShiftStatus } from '../types';

const today = new Date().toISOString().slice(0, 10);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;

    if (response?.data?.errors) {
      const firstFieldError = Object.values(response.data.errors)[0]?.[0];
      if (firstFieldError) return firstFieldError;
    }

    if (response?.data?.message) return response.data.message;
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallback;
};

const STATUS_OPTIONS: StaffShiftStatus[] = ['scheduled', 'completed', 'cancelled'];

const AdminStaffSchedulingPage: React.FC = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [dateFrom, setDateFrom] = useState(today.slice(0, 8) + '01');
  const [dateTo, setDateTo] = useState(today);
  const [staffFilterId, setStaffFilterId] = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [shiftDate, setShiftDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const scheduleEligibleStaff = useMemo(
    () => staffMembers.filter((member) => member.role === 'staff' || member.role === 'chef'),
    [staffMembers]
  );

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [staffResponse, shiftsResponse] = await Promise.all([
        fetchStaffMembers(),
        fetchStaffSchedules({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          user_id: typeof staffFilterId === 'number' ? staffFilterId : undefined,
        }),
      ]);

      setStaffMembers(staffResponse);
      setShifts(shiftsResponse);

      if (employeeId === '' && staffResponse.length > 0) {
        setEmployeeId(staffResponse[0].id);
      }
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load staff schedules.'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, employeeId, staffFilterId]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const employeeNameById = useMemo(
    () => new Map(staffMembers.map((member) => [member.id, member.name])),
    [staffMembers]
  );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (employeeId === '') {
      setError('Please select an employee.');
      return;
    }

    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    const payload: CreateStaffShiftPayload = {
      user_id: employeeId,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      position: position.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    setCreating(true);

    try {
      await createStaffShift(payload);
      setSuccess('Shift created successfully.');
      setPosition('');
      setNotes('');
      await loadPageData();
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, 'Failed to create shift.'));
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (shiftId: number, status: StaffShiftStatus) => {
    setSavingStatusId(shiftId);
    setError(null);
    setSuccess(null);

    try {
      const updatedShift = await updateStaffShift(shiftId, { status });
      setShifts((current) => current.map((shift) => (shift.id === shiftId ? updatedShift : shift)));
      setSuccess('Shift status updated.');
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update shift status.'));
    } finally {
      setSavingStatusId(null);
    }
  };

  return (
    <DashboardLayout title="Staff Scheduling">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
        <GlassCard>
          <h2 className="text-lg font-semibold text-text">Create Shift</h2>
          <p className="mt-1 text-sm text-muted">Assign schedule blocks for staff and kitchen team.</p>

          <form className="mt-5 space-y-4" onSubmit={handleCreate}>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Employee</span>
              <select
                value={employeeId}
                onChange={(event) => {
                  const next = event.target.value;
                  setEmployeeId(next === '' ? '' : Number(next));
                }}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                required
              >
                <option value="">Select employee</option>
                {scheduleEligibleStaff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Shift Date</span>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(event) => setShiftDate(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Position</span>
                <input
                  type="text"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  placeholder="Floor, Kitchen, Cashier"
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Start Time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">End Time</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                placeholder="Optional shift instructions"
              />
            </label>

            <LiquidButton type="submit" disabled={creating || loading}>
              {creating ? 'Creating...' : 'Create Shift'}
            </LiquidButton>
          </form>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text">Scheduled Shifts</h3>
              <p className="mt-1 text-sm text-muted">Track and update shift status for the selected date range.</p>
            </div>
            <LiquidButton type="button" tone="tertiary" onClick={() => void loadPageData()} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </LiquidButton>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Date To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              />
            </label>
          </div>

          <div className="mb-4">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Employee Filter</span>
              <select
                value={staffFilterId}
                onChange={(event) => {
                  const next = event.target.value;
                  setStaffFilterId(next === '' ? '' : Number(next));
                }}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              >
                <option value="">All employees</option>
                {scheduleEligibleStaff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-5 text-sm text-muted">Loading shifts...</div>
          ) : shifts.length === 0 ? (
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-5 text-sm text-muted">No shifts in this range.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stroke">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-bg1/85 text-xs uppercase tracking-[0.14em] text-gold2/85">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Time</th>
                    <th className="px-3 py-3">Position</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="border-t border-stroke/70 bg-bg1/45">
                      <td className="px-3 py-3 text-text">{shift.shift_date}</td>
                      <td className="px-3 py-3 text-text">
                        {shift.employee?.name || employeeNameById.get(shift.user_id) || `#${shift.user_id}`}
                      </td>
                      <td className="px-3 py-3 text-muted">{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</td>
                      <td className="px-3 py-3 text-muted">{shift.position || '-'}</td>
                      <td className="px-3 py-3">
                        <select
                          value={shift.status}
                          onChange={(event) => void handleStatusChange(shift.id, event.target.value as StaffShiftStatus)}
                          disabled={savingStatusId === shift.id}
                          className="themed-native-select rounded-full border border-gold/35 bg-bg1/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 outline-none"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {error ? <div className="mt-5 rounded-xl border border-spicy/45 bg-spicy/10 px-4 py-3 text-sm text-spicy">{error}</div> : null}
      {success ? <div className="mt-5 rounded-xl border border-sage/45 bg-sage/10 px-4 py-3 text-sm text-sage">{success}</div> : null}
    </DashboardLayout>
  );
};

export default AdminStaffSchedulingPage;
