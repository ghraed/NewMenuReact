import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import GlassToast from '../components/ui/liquid-glass/GlassToast';
import { useGlassToast } from '../components/ui/liquid-glass/useGlassToast';
import { useAppTheme } from '../hooks/useGuestTheme';
import { fetchStaffMembers } from '../services/staffService';
import {
  createStaffShift,
  deleteStaffShift,
  fetchStaffSchedules,
  updateStaffShift,
  type CreateStaffShiftPayload,
} from '../services/staffScheduleService';
import type { StaffMember, StaffShift, StaffShiftStatus } from '../types';

const MINUTES_PER_DAY = 24 * 60;

type ScheduleViewMode = 'week' | 'day' | 'custom';
type ShiftEntryMode = 'single' | 'recurring';
type RecurrenceFrequency = 'weekly' | 'monthly';

type PositionCode = 'waiter' | 'cashier' | 'kitchen' | 'floor' | 'delivery' | 'manager';

const POSITION_OPTIONS: Array<{ value: PositionCode; label: string }> = [
  { value: 'waiter', label: 'Waiter' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'floor', label: 'Floor' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'manager', label: 'Manager' },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const STATUS_OPTIONS: StaffShiftStatus[] = ['scheduled', 'completed', 'cancelled', 'absent', 'replaced'];
const STATUS_FILTER_OPTIONS: StaffShiftStatus[] = ['scheduled', 'completed', 'cancelled', 'absent', 'replaced', 'deleted'];

const REQUIRED_DAILY_COVERAGE: PositionCode[] = ['waiter', 'kitchen', 'cashier'];

const STATUS_BADGE_CLASS: Record<StaffShiftStatus, string> = {
  scheduled: 'border-gold/40 bg-gold/15 text-gold2',
  completed: 'border-sage/40 bg-sage/15 text-sage',
  cancelled: 'border-spicy/40 bg-spicy/15 text-spicy',
  absent: 'border-red-400/45 bg-red-400/15 text-red-200',
  replaced: 'border-sky-300/45 bg-sky-300/15 text-sky-200',
  deleted: 'border-zinc-400/45 bg-zinc-400/15 text-zinc-200',
};

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

const toMinutes = (time: string): number => {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
};

const toEpochDay = (dateValue: string): number => {
  const parsed = new Date(`${dateValue}T00:00:00`);
  return Math.floor(parsed.getTime() / (1000 * 60 * 60 * 24));
};

const formatTime = (time: string): string => time.slice(0, 5);

const titleize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const dayName = (day: number): string => WEEKDAY_OPTIONS.find((item) => item.value === day)?.label ?? `#${day}`;

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = toDateKey(new Date());

const startOfWeek = (dateValue: string): string => {
  const date = new Date(`${dateValue}T00:00:00`);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  return toDateKey(start);
};

const addDays = (dateValue: string, days: number): string => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const detectOvernight = (startTime: string, endTime: string, explicitOvernight: boolean): boolean => {
  if (explicitOvernight) return true;
  return toMinutes(endTime) <= toMinutes(startTime);
};

const computeDurationMinutes = (
  startTime: string,
  endTime: string,
  explicitOvernight: boolean,
  breakMinutes: number
): number => {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);
  if (detectOvernight(startTime, endTime, explicitOvernight)) {
    end += MINUTES_PER_DAY;
  }
  return Math.max(0, end - start - Math.max(0, breakMinutes));
};

const getShiftRangeMinutes = (
  shiftDate: string,
  startTime: string,
  endTime: string,
  explicitOvernight: boolean
): { startAbs: number; endAbs: number } => {
  const day = toEpochDay(shiftDate);
  const start = day * MINUTES_PER_DAY + toMinutes(startTime);
  let end = day * MINUTES_PER_DAY + toMinutes(endTime);
  if (detectOvernight(startTime, endTime, explicitOvernight)) {
    end += MINUTES_PER_DAY;
  }
  return { startAbs: start, endAbs: end };
};

const parseBreakMinutesFromNotes = (notes: string | null | undefined): number => {
  if (!notes) return 0;
  const match = notes.match(/\[break:(\d+)m\]/i);
  if (!match) return 0;
  return Number(match[1]) || 0;
};

const isSoftDeletedShift = (shift: StaffShift): boolean => {
  return shift.status === 'deleted' || Boolean(shift.deleted_at) || /\[soft-deleted\s/i.test(shift.notes || '');
};

const withBreakTag = (notes: string, breakMinutes: number): string | undefined => {
  const cleaned = notes.replace(/\s*\[break:\d+m\]\s*/gi, ' ').trim();
  if (breakMinutes <= 0) return cleaned || undefined;
  const tagged = cleaned ? `${cleaned} [break:${breakMinutes}m]` : `[break:${breakMinutes}m]`;
  return tagged;
};

const withOvernightTag = (notes: string | undefined, overnight: boolean): string | undefined => {
  if (!overnight) return notes;
  if (!notes || notes.trim() === '') return '[overnight]';
  if (/\[overnight\]/i.test(notes)) return notes;
  return `${notes} [overnight]`;
};

const matchesMonthlyPattern = (candidateDate: string, anchorDate: string): boolean => {
  const candidate = new Date(`${candidateDate}T00:00:00`);
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const candidateOrdinal = Math.ceil(candidate.getDate() / 7);
  const anchorOrdinal = Math.ceil(anchor.getDate() / 7);
  return candidateOrdinal === anchorOrdinal;
};

const AdminStaffSchedulingPage: React.FC = () => {
  const { theme } = useAppTheme();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);

  const [viewMode, setViewMode] = useState<ScheduleViewMode>('week');
  const [weekAnchorDate, setWeekAnchorDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(startOfWeek(today));
  const [dateTo, setDateTo] = useState(addDays(startOfWeek(today), 6));

  const [staffFilterId, setStaffFilterId] = useState<number | ''>('');
  const [positionFilter, setPositionFilter] = useState<PositionCode | ''>('');
  const [statusFilter, setStatusFilter] = useState<StaffShiftStatus | ''>('');
  const [showDeleted, setShowDeleted] = useState(false);

  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [shiftEntryMode, setShiftEntryMode] = useState<ShiftEntryMode>('single');
  const [shiftDate, setShiftDate] = useState(today);
  const [recurrenceUntilDate, setRecurrenceUntilDate] = useState(addDays(today, 27));
  const [recurrenceStartWeekday, setRecurrenceStartWeekday] = useState<number>(new Date(`${today}T00:00:00`).getDay());
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([1, 3]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [allowOvernight, setAllowOvernight] = useState(false);
  const [position, setPosition] = useState<PositionCode | ''>('');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [deletingShiftId, setDeletingShiftId] = useState<number | null>(null);
  const [activeNote, setActiveNote] = useState<{ title: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { toast, showToast, dismiss } = useGlassToast(3800);

  useEffect(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(weekAnchorDate);
      setDateFrom(weekStart);
      setDateTo(addDays(weekStart, 6));
    }
  }, [viewMode, weekAnchorDate]);

  useEffect(() => {
    if (viewMode === 'day') {
      setDateFrom(weekAnchorDate);
      setDateTo(weekAnchorDate);
    }
  }, [viewMode, weekAnchorDate]);

  useEffect(() => {
    if (error) showToast(error, 'tertiary');
  }, [error, showToast]);

  useEffect(() => {
    if (success) showToast(success, 'primary');
  }, [showToast, success]);

  const scheduleEligibleStaff = useMemo(
    () => staffMembers.filter((member) => member.role === 'staff' || member.role === 'chef'),
    [staffMembers]
  );

  const employeeNameById = useMemo(
    () => new Map(staffMembers.map((member) => [member.id, member.name])),
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
          position: positionFilter || undefined,
          status: statusFilter || undefined,
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
  }, [dateFrom, dateTo, employeeId, positionFilter, staffFilterId, statusFilter]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      if (!showDeleted && isSoftDeletedShift(shift)) {
        return false;
      }
      if (positionFilter && (shift.position || '').toLowerCase() !== positionFilter) {
        return false;
      }
      if (statusFilter && shift.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [positionFilter, shifts, showDeleted, statusFilter]);

  const coverageWarnings = useMemo(() => {
    if (viewMode !== 'week') return [];

    const warnings: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(dateFrom, i);
      const dayShifts = filteredShifts.filter((shift) => shift.shift_date === day && shift.status !== 'cancelled');

      REQUIRED_DAILY_COVERAGE.forEach((requiredPosition) => {
        const hasCoverage = dayShifts.some((shift) => (shift.position || '').toLowerCase() === requiredPosition);
        if (!hasCoverage) {
          warnings.push(`${day}: Missing ${requiredPosition} coverage.`);
        }
      });
    }

    return warnings;
  }, [dateFrom, filteredShifts, viewMode]);

  const weeklyColumns = useMemo(() => {
    if (viewMode !== 'week') return [];

    return Array.from({ length: 7 }).map((_, index) => {
      const date = addDays(dateFrom, index);
      const dayShifts = filteredShifts.filter((shift) => shift.shift_date === date);
      return { date, shifts: dayShifts };
    });
  }, [dateFrom, filteredShifts, viewMode]);

  const workedHoursPreview = useMemo(() => {
    const minutes = computeDurationMinutes(startTime, endTime, allowOvernight, breakMinutes);
    return (minutes / 60).toFixed(2);
  }, [allowOvernight, breakMinutes, endTime, startTime]);

  const hasEmployeeConflict = useCallback(
    (candidate: { userId: number; shiftDate: string; startTime: string; endTime: string; overnight: boolean }): boolean => {
      const candidateRange = getShiftRangeMinutes(
        candidate.shiftDate,
        candidate.startTime,
        candidate.endTime,
        candidate.overnight
      );

      return shifts.some((shift) => {
        if (shift.user_id !== candidate.userId) return false;
        if (shift.status === 'cancelled') return false;

        const existingRange = getShiftRangeMinutes(
          shift.shift_date,
          shift.start_time,
          shift.end_time,
          detectOvernight(shift.start_time, shift.end_time, false)
        );

        return candidateRange.startAbs < existingRange.endAbs && existingRange.startAbs < candidateRange.endAbs;
      });
    },
    [shifts]
  );

  const hasDuplicateShift = useCallback(
    (candidate: { userId: number; shiftDate: string; startTime: string; endTime: string }): boolean => {
      return shifts.some(
        (shift) =>
          shift.user_id === candidate.userId &&
          shift.shift_date === candidate.shiftDate &&
          shift.start_time.slice(0, 5) === candidate.startTime &&
          shift.end_time.slice(0, 5) === candidate.endTime
      );
    },
    [shifts]
  );

  const toggleRecurrenceWeekday = useCallback((weekday: number) => {
    setRecurrenceWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((day) => day !== weekday);
      }
      return [...current, weekday].sort((a, b) => a - b);
    });
  }, []);

  const generateRecurringDates = useCallback((): string[] => {
    const selected = new Set(recurrenceWeekdays);
    const dates: string[] = [];
    const start = new Date(`${shiftDate}T00:00:00`);
    const end = new Date(`${recurrenceUntilDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return [];
    }

    let cursor = new Date(start);
    while (cursor <= end) {
      const cursorDay = cursor.getDay();
      const cursorDate = toDateKey(cursor);
      const isSelectedWeekday = selected.has(cursorDay);

      if (isSelectedWeekday) {
        if (recurrenceFrequency === 'weekly') {
          dates.push(cursorDate);
        } else if (matchesMonthlyPattern(cursorDate, shiftDate)) {
          dates.push(cursorDate);
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }, [recurrenceFrequency, recurrenceStartWeekday, recurrenceUntilDate, recurrenceWeekdays, shiftDate]);

  const handleCreate = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (employeeId === '') {
      setError('Please select an employee.');
      return;
    }

    const selectedEmployee = scheduleEligibleStaff.find((member) => member.id === employeeId);
    if (!selectedEmployee) {
      setError('Inactive employees cannot be scheduled.');
      return;
    }

    if (position === '') {
      setError('Please select a position for this shift.');
      return;
    }

    const isOvernight = detectOvernight(startTime, endTime, allowOvernight);
    if (!allowOvernight && toMinutes(endTime) <= toMinutes(startTime)) {
      setError('End time must be after start time, or mark this as an overnight shift.');
      return;
    }

    if (breakMinutes < 0 || breakMinutes >= 24 * 60) {
      setError('Break minutes must be between 0 and 1439.');
      return;
    }

    const workedMinutes = computeDurationMinutes(startTime, endTime, isOvernight, breakMinutes);
    if (workedMinutes <= 0) {
      setError('Worked hours must be greater than zero after break time.');
      return;
    }

    const candidateDates =
      shiftEntryMode === 'single'
        ? [shiftDate]
        : generateRecurringDates();

    if (candidateDates.length === 0) {
      setError(
        shiftEntryMode === 'recurring'
          ? 'No recurring dates matched this rule. Adjust start day, frequency, weekdays, or date range.'
          : 'No dates selected.'
      );
      return;
    }

    const normalizedNotes = withBreakTag(notes, breakMinutes);

    setCreating(true);

    try {
      let createdCount = 0;

      for (const candidateDate of candidateDates) {
        if (
          hasDuplicateShift({
            userId: employeeId,
            shiftDate: candidateDate,
            startTime,
            endTime,
          })
        ) {
          continue;
        }

        if (
          hasEmployeeConflict({
            userId: employeeId,
            shiftDate: candidateDate,
            startTime,
            endTime,
            overnight: isOvernight,
          })
        ) {
          continue;
        }

        if (isOvernight) {
          const nextDay = addDays(candidateDate, 1);
          const firstLegPayload: CreateStaffShiftPayload = {
            user_id: employeeId,
            shift_date: candidateDate,
            start_time: startTime,
            end_time: '23:59',
            position,
            status: 'scheduled',
            notes: withOvernightTag(normalizedNotes, true),
          };
          const secondLegPayload: CreateStaffShiftPayload = {
            user_id: employeeId,
            shift_date: nextDay,
            start_time: '00:00',
            end_time: endTime,
            position,
            status: 'scheduled',
            notes: withOvernightTag(normalizedNotes, true),
          };

          await createStaffShift(firstLegPayload);
          await createStaffShift(secondLegPayload);
          createdCount += 2;
        } else {
          const payload: CreateStaffShiftPayload = {
            user_id: employeeId,
            shift_date: candidateDate,
            start_time: startTime,
            end_time: endTime,
            position,
            status: 'scheduled',
            notes: normalizedNotes,
          };
          await createStaffShift(payload);
          createdCount += 1;
        }
      }

      if (createdCount === 0) {
        setError('All generated shifts were skipped due to duplicate or overlap conflicts.');
        return;
      }

      const recurringLabel =
        shiftEntryMode === 'recurring'
          ? ` from recurring rule (${recurrenceFrequency}, ${recurrenceWeekdays.map(dayName).join('/')})`
          : '';
      setSuccess(
        `Created ${createdCount} shift record(s)${recurringLabel}. Worked hours per shift: ${(workedMinutes / 60).toFixed(2)}h.`
      );

      setPosition('');
      setNotes('');
      setBreakMinutes(0);
      setAllowOvernight(false);
      await loadPageData();
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, 'Failed to create shift.'));
    } finally {
      setCreating(false);
    }
  }, [
    allowOvernight,
    breakMinutes,
    employeeId,
    endTime,
    generateRecurringDates,
    hasDuplicateShift,
    hasEmployeeConflict,
    loadPageData,
    notes,
    position,
    recurrenceFrequency,
    recurrenceWeekdays,
    scheduleEligibleStaff,
    shiftDate,
    shiftEntryMode,
    startTime,
  ]);

  const handleStatusChange = async (shift: StaffShift, status: StaffShiftStatus) => {
    setSavingStatusId(shift.id);
    setError(null);
    setSuccess(null);

    const isPastOrToday = shift.shift_date <= today;
    let nextNotes = shift.notes ?? undefined;

    if (shift.status === 'completed' && status !== 'completed' && isPastOrToday) {
      const correctionNote = window.prompt(
        'Completed shifts used in payroll cannot be edited without a correction note. Enter correction note:'
      );

      if (!correctionNote || correctionNote.trim() === '') {
        setSavingStatusId(null);
        setError('Completed shifts used in payroll cannot be edited without a correction note.');
        return;
      }

      nextNotes = `${shift.notes ? `${shift.notes} | ` : ''}Correction: ${correctionNote.trim()}`;
    }

    try {
      const updatedShift = await updateStaffShift(shift.id, { status, notes: nextNotes });
      setShifts((current) => current.map((row) => (row.id === shift.id ? updatedShift : row)));
      setSuccess('Shift status updated.');
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update shift status.'));
    } finally {
      setSavingStatusId(null);
    }
  };

  const handleDeleteShift = useCallback(async (shift: StaffShift) => {
    const employeeName = shift.employee?.name || employeeNameById.get(shift.user_id) || `#${shift.user_id}`;
    const confirmed = window.confirm(
      `Delete shift for ${employeeName} on ${shift.shift_date} (${formatTime(shift.start_time)}-${formatTime(shift.end_time)})?\n\nThis is a soft delete.`
    );
    if (!confirmed) return;

    setDeletingShiftId(shift.id);
    setError(null);
    setSuccess(null);

    try {
      const deletedAt = new Date().toISOString();
      const softDeleteNote = `${shift.notes ? `${shift.notes} | ` : ''}[soft-deleted ${deletedAt}]`;
      await deleteStaffShift(shift.id, softDeleteNote);
      setShifts((current) => current.filter((row) => row.id !== shift.id));
      setSuccess('Shift deleted successfully.');
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, 'Failed to delete shift.'));
    } finally {
      setDeletingShiftId(null);
    }
  }, [employeeNameById]);

  return (
    <DashboardLayout title="Staff Scheduling">
      <div className="grid gap-6">
        <GlassCard>
          <h2 className="text-lg font-semibold text-text">Create Shift</h2>
          <p className="mt-1 text-sm text-muted">Weekly-first planning with conflict-safe shift creation.</p>

          <form className="mt-5 space-y-4" onSubmit={handleCreate}>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Schedule Type</span>
              <select
                value={shiftEntryMode}
                onChange={(event) => setShiftEntryMode(event.target.value as ShiftEntryMode)}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              >
                <option value="single">Single shift</option>
                <option value="recurring">Recurring schedule</option>
              </select>
            </label>

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
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">
                  {shiftEntryMode === 'single' ? 'Shift Date' : 'Recurring Start Date'}
                </span>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(event) => setShiftDate(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  required
                />
              </label>
              {shiftEntryMode === 'recurring' ? (
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Recurring Until</span>
                  <input
                    type="date"
                    value={recurrenceUntilDate}
                    onChange={(event) => setRecurrenceUntilDate(event.target.value)}
                    className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    required
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Position</span>
                <select
                  value={position}
                  onChange={(event) => setPosition(event.target.value as PositionCode | '')}
                  className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  required
                >
                  <option value="">Select position</option>
                  {POSITION_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {shiftEntryMode === 'recurring' ? (
              <div className="space-y-3 rounded-2xl border border-stroke bg-bg1/40 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Start Day Of Week</span>
                    <select
                      value={recurrenceStartWeekday}
                      onChange={(event) => setRecurrenceStartWeekday(Number(event.target.value))}
                      className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    >
                      {WEEKDAY_OPTIONS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Frequency</span>
                    <select
                      value={recurrenceFrequency}
                      onChange={(event) => setRecurrenceFrequency(event.target.value as RecurrenceFrequency)}
                      className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                </div>
                <div>
                  <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Weekdays Included</span>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const active = recurrenceWeekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleRecurrenceWeekday(day.value)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                            active
                              ? 'border-gold/60 bg-gold/20 text-gold2'
                              : 'border-stroke bg-bg1/60 text-muted hover:text-text'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-stroke/70 bg-bg1/50 px-3 py-2 text-xs text-muted">
                  Rule preview: starts on {dayName(recurrenceStartWeekday)}, {recurrenceFrequency}, days{' '}
                  {recurrenceWeekdays.length > 0 ? recurrenceWeekdays.map(dayName).join(', ') : 'none selected'}, time{' '}
                  {startTime} - {endTime}.
                </div>
              </div>
            ) : null}

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

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl border border-stroke bg-bg1/45 px-3 py-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={allowOvernight}
                  onChange={(event) => setAllowOvernight(event.target.checked)}
                  className="h-4 w-4 accent-[rgb(var(--color-gold))]"
                />
                Overnight shift
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Break (minutes)</span>
                <input
                  type="number"
                  min={0}
                  max={1439}
                  step={5}
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(Number(event.target.value) || 0)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-stroke bg-bg1/40 px-4 py-2.5 text-sm text-muted">
              Worked hours preview: <span className="font-semibold text-text">{workedHoursPreview}h</span>
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
              {creating ? 'Creating...' : shiftEntryMode === 'single' ? 'Create Shift' : 'Generate Recurring Shifts'}
            </LiquidButton>
          </form>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text">Scheduled Shifts</h3>
              <p className="mt-1 text-sm text-muted">Plan weekly by default, then refine by day, employee, position, and status.</p>
            </div>
            <LiquidButton type="button" tone="tertiary" onClick={() => void loadPageData()} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </LiquidButton>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Workflow</span>
              <select
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as ScheduleViewMode)}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              >
                <option value="week">Weekly (recommended)</option>
                <option value="day">Daily</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">
                {viewMode === 'week' ? 'Week anchor date' : 'Date'}
              </span>
              <input
                type="date"
                value={weekAnchorDate}
                onChange={(event) => setWeekAnchorDate(event.target.value)}
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              />
            </label>
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

          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                disabled={viewMode !== 'custom'}
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition disabled:opacity-60 focus:border-gold/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Date To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                disabled={viewMode !== 'custom'}
                className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition disabled:opacity-60 focus:border-gold/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Position Filter</span>
              <select
                value={positionFilter}
                onChange={(event) => setPositionFilter(event.target.value as PositionCode | '')}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              >
                <option value="">All positions</option>
                {POSITION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Status Filter</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StaffShiftStatus | '')}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              >
                <option value="">All statuses</option>
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {titleize(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mb-4 flex items-center gap-2 rounded-2xl border border-stroke bg-bg1/45 px-3 py-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(event) => setShowDeleted(event.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--color-gold))]"
            />
            Show deleted shifts
          </label>

          {viewMode === 'week' ? (
            <div className="mb-4 rounded-2xl border border-stroke bg-bg1/35 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                {weeklyColumns.map((column) => (
                  <div key={column.date} className="rounded-xl border border-stroke/70 bg-bg1/45 p-2.5">
                    <div className="text-xs uppercase tracking-[0.12em] text-gold2/85">{column.date}</div>
                    <div className="mt-1 text-sm text-text">{column.shifts.length} shift(s)</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {coverageWarnings.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-300/35 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
              {coverageWarnings.slice(0, 4).map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
              {coverageWarnings.length > 4 ? <div>+{coverageWarnings.length - 4} more coverage warnings.</div> : null}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-5 text-sm text-muted">Loading shifts...</div>
          ) : filteredShifts.length === 0 ? (
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-5 text-sm text-muted">No shifts in this range.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stroke">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-bg1/85 text-xs uppercase tracking-[0.14em] text-gold2/85">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Time</th>
                    <th className="px-3 py-3">Worked Hours</th>
                    <th className="px-3 py-3">Position</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Note</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((shift) => {
                    const breakFromNotes = parseBreakMinutesFromNotes(shift.notes);
                    const overnight = detectOvernight(shift.start_time, shift.end_time, false);
                    const workedHours = (
                      computeDurationMinutes(shift.start_time, shift.end_time, overnight, breakFromNotes) / 60
                    ).toFixed(2);

                    return (
                      <tr key={shift.id} className="border-t border-stroke/70 bg-bg1/45">
                        <td className="px-3 py-3 text-text">{shift.shift_date}</td>
                        <td className="px-3 py-3 text-text">
                          {shift.employee?.name || employeeNameById.get(shift.user_id) || `#${shift.user_id}`}
                        </td>
                        <td className="px-3 py-3 text-muted">
                          {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          {overnight ? ' (+1 day)' : ''}
                        </td>
                        <td className="px-3 py-3 text-text">{workedHours}h</td>
                        <td className="px-3 py-3 text-muted">{shift.position ? titleize(shift.position) : '-'}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${STATUS_BADGE_CLASS[shift.status]}`}
                            >
                              {shift.status}
                            </span>
                            <select
                              value={shift.status}
                              onChange={(event) => void handleStatusChange(shift, event.target.value as StaffShiftStatus)}
                              disabled={savingStatusId === shift.id}
                              className="themed-native-select rounded-full border border-gold/35 bg-bg1/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold2 outline-none"
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {shift.notes && shift.notes.trim() !== '' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveNote({
                                  title: `${shift.employee?.name || employeeNameById.get(shift.user_id) || `#${shift.user_id}`} • ${shift.shift_date}`,
                                  content: shift.notes || '',
                                })
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold/45 bg-gold/15 text-gold2 transition hover:bg-gold/25"
                              aria-label="Show shift note"
                              title="Show note"
                            >
                              📝
                            </button>
                          ) : (
                            <span
                              className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border border-stroke/70 bg-bg1/40 text-gray-400/80"
                              aria-label="No note"
                              title="No note"
                            >
                              📝
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => void handleDeleteShift(shift)}
                            disabled={deletingShiftId === shift.id}
                            className="rounded-full border border-spicy/40 bg-spicy/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-spicy transition hover:bg-spicy/20 disabled:opacity-60"
                          >
                            {deletingShiftId === shift.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {activeNote ? (
        <div className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[3px]">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-modalStroke bg-modalSurface shadow-[0_30px_90px_rgba(0,0,0,0.35)] ring-1 ring-gold/25">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(243,215,154,0.16),transparent_60%)]" />
            <div className="relative z-10 border-b border-gold/25 px-5 py-4">
              <div className={`text-xs uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-text/92' : 'text-black/85'}`}>
                Shift Note
              </div>
              <div className={`mt-1 text-sm font-semibold ${theme === 'dark' ? 'text-text' : 'text-black'}`}>
                {activeNote.title}
              </div>
            </div>
            <div
              className={`relative z-10 max-h-[55vh] overflow-auto px-5 py-4 text-sm leading-6 ${
                theme === 'dark' ? 'text-text/92' : 'text-black/90'
              }`}
            >
              {activeNote.content}
            </div>
            <div className="relative z-10 flex justify-end border-t border-gold/20 px-5 py-4">
              <button
                type="button"
                onClick={() => setActiveNote(null)}
                className="rounded-full border border-gold/45 bg-gold/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-gold2 transition hover:bg-gold/25"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminStaffSchedulingPage;
