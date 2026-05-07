import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import {
  fetchPayrollPeriods,
  fetchPayrollSummary,
  queryPayrollPeriods,
  updatePayrollPeriod,
  upsertPayrollEntries,
  type UpsertPayrollEntryPayload,
} from '../services/payrollService';
import { fetchStaffMembers } from '../services/staffService';
import type { PayrollPeriod, PayrollPeriodStatus, PayrollSplitMode, StaffMember } from '../types';
import { formatPriceWithCurrency } from '../utils/currency';

const today = new Date().toISOString().slice(0, 10);
const previousMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
const defaultPayrollYear = previousMonthDate.getFullYear();
const defaultPayrollMonth = previousMonthDate.getMonth() + 1;
const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type PayrollEntryDraft = {
  base: string;
  overtime: string;
  bonus: string;
  allowance: string;
  reimbursement: string;
  deduction: string;
  tax: string;
  notes: string;
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

const centsToMoneyString = (value: number): string => (value / 100).toFixed(2);

const moneyStringToCents = (value: string): number => {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
};

const PayrollStatusChip: React.FC<{ status: PayrollPeriodStatus }> = ({ status }) => {
  const tone = status === 'paid'
    ? 'border-sage/45 bg-sage/10 text-sage'
    : status === 'approved'
      ? 'border-gold/45 bg-gold/10 text-gold2'
      : 'border-stroke bg-bg1/50 text-muted';

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone}`}>
      {status}
    </span>
  );
};

const AdminPayrollManagementPage: React.FC = () => {
  const { user } = useAuth();
  const currency = user?.restaurant?.currency ?? 'USD';

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | ''>('');
  const [entryDrafts, setEntryDrafts] = useState<Record<number, PayrollEntryDraft>>({});
  const [isMonthlyMode, setIsMonthlyMode] = useState(true);
  const [queryYear, setQueryYear] = useState(defaultPayrollYear);
  const [queryMonth, setQueryMonth] = useState(defaultPayrollMonth);
  const [queryDateFrom, setQueryDateFrom] = useState(today);
  const [queryDateTo, setQueryDateTo] = useState(today);
  const [splitMode, setSplitMode] = useState<PayrollSplitMode>('full');
  const [customSplitDays, setCustomSplitDays] = useState('7');
  const [periodNotes, setPeriodNotes] = useState('');
  const [summaryDateFrom, setSummaryDateFrom] = useState(today.slice(0, 8) + '01');
  const [summaryDateTo, setSummaryDateTo] = useState(today);
  const [summaryNet, setSummaryNet] = useState(0);
  const [summaryEmployees, setSummaryEmployees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingEntries, setSavingEntries] = useState(false);
  const [generatingPeriods, setGeneratingPeriods] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const eligibleStaff = useMemo(
    () => staffMembers.filter((member) => member.role === 'staff' || member.role === 'chef'),
    [staffMembers]
  );

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId]
  );

  const resetEntryDrafts = useCallback((period: PayrollPeriod | null, employees: StaffMember[]) => {
    if (!period) {
      setEntryDrafts({});
      return;
    }

    const existingByUser = new Map(period.entries.map((entry) => [entry.user_id, entry]));
    const nextDrafts: Record<number, PayrollEntryDraft> = {};

    employees.forEach((employee) => {
      const existing = existingByUser.get(employee.id);
      nextDrafts[employee.id] = {
        base: centsToMoneyString(existing?.base_amount_cents ?? 0),
        overtime: centsToMoneyString(existing?.overtime_amount_cents ?? 0),
        bonus: centsToMoneyString(existing?.bonus_amount_cents ?? 0),
        allowance: centsToMoneyString(existing?.allowance_amount_cents ?? 0),
        reimbursement: centsToMoneyString(existing?.reimbursement_amount_cents ?? 0),
        deduction: centsToMoneyString(existing?.deduction_amount_cents ?? 0),
        tax: centsToMoneyString(existing?.tax_amount_cents ?? 0),
        notes: existing?.notes ?? '',
      };
    });

    setEntryDrafts(nextDrafts);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [periodsResponse, staffResponse, summaryResponse] = await Promise.all([
        fetchPayrollPeriods(),
        fetchStaffMembers(),
        fetchPayrollSummary({
          date_from: summaryDateFrom || undefined,
          date_to: summaryDateTo || undefined,
          period_status: 'approved_paid',
        }),
      ]);

      setPeriods(periodsResponse);
      setStaffMembers(staffResponse);
      setSummaryNet(summaryResponse.totals.net_pay);
      setSummaryEmployees(summaryResponse.totals.employee_count);

      const defaultPeriod = periodsResponse[0] ?? null;
      const keepSelected = defaultPeriod && selectedPeriodId !== ''
        ? periodsResponse.find((period) => period.id === selectedPeriodId) ?? null
        : null;
      const nextSelected = keepSelected ?? defaultPeriod;

      setSelectedPeriodId(nextSelected ? nextSelected.id : '');
      resetEntryDrafts(nextSelected, staffResponse);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Failed to load payroll data.'));
    } finally {
      setLoading(false);
    }
  }, [resetEntryDrafts, selectedPeriodId, summaryDateFrom, summaryDateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectPeriod = (periodId: number | '') => {
    setSelectedPeriodId(periodId);
    const period = periods.find((candidate) => candidate.id === periodId) ?? null;
    resetEntryDrafts(period, eligibleStaff);
  };

  const handleGeneratePeriods = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isMonthlyMode && queryDateFrom > queryDateTo) {
      setError('End date must be on or after start date.');
      return;
    }

    setGeneratingPeriods(true);

    try {
      const result = await queryPayrollPeriods({
        mode: isMonthlyMode ? 'monthly' : 'range',
        split_mode: splitMode,
        split_days: splitMode === 'custom_days' ? Math.max(1, Number(customSplitDays) || 1) : undefined,
        year: isMonthlyMode ? queryYear : undefined,
        month: isMonthlyMode ? queryMonth : undefined,
        date_from: !isMonthlyMode ? queryDateFrom : undefined,
        date_to: !isMonthlyMode ? queryDateTo : undefined,
        notes: periodNotes.trim() || undefined,
      });

      setPeriods((current) => {
        const next = new Map<number, PayrollPeriod>();
        current.forEach((period) => next.set(period.id, period));
        result.periods.forEach((period) => next.set(period.id, period));
        return Array.from(next.values()).sort((a, b) => {
          if (a.period_start === b.period_start) return b.id - a.id;
          return a.period_start < b.period_start ? 1 : -1;
        });
      });

      const firstPeriod = result.periods[0] ?? null;
      if (firstPeriod) {
        setSelectedPeriodId(firstPeriod.id);
        resetEntryDrafts(firstPeriod, eligibleStaff);
      }
      setSuccess(`Generated payroll lines for ${result.window.date_from} to ${result.window.date_to}.`);
    } catch (queryError: unknown) {
      setError(getErrorMessage(queryError, 'Failed to generate payroll lines.'));
    } finally {
      setGeneratingPeriods(false);
    }
  };

  const handleUpdatePeriodStatus = async (periodId: number, status: PayrollPeriodStatus) => {
    setUpdatingStatusId(periodId);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updatePayrollPeriod(periodId, { status });
      setPeriods((current) => current.map((period) => (period.id === periodId ? updated : period)));
      if (selectedPeriodId === periodId) {
        resetEntryDrafts(updated, eligibleStaff);
      }
      setSuccess(`Payroll period moved to ${status}.`);
    } catch (updateError: unknown) {
      setError(getErrorMessage(updateError, 'Failed to update payroll status.'));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const setEntryValue = (userId: number, field: keyof PayrollEntryDraft, value: string) => {
    setEntryDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? {
          base: '0.00',
          overtime: '0.00',
          bonus: '0.00',
          allowance: '0.00',
          reimbursement: '0.00',
          deduction: '0.00',
          tax: '0.00',
          notes: '',
        }),
        [field]: value,
      },
    }));
  };

  const currentEntriesPayload = useMemo<UpsertPayrollEntryPayload[]>(() => {
    return eligibleStaff.map((staff) => {
      const draft = entryDrafts[staff.id] ?? {
        base: '0.00',
        overtime: '0.00',
        bonus: '0.00',
        allowance: '0.00',
        reimbursement: '0.00',
        deduction: '0.00',
        tax: '0.00',
        notes: '',
      };

      return {
        user_id: staff.id,
        base_amount_cents: moneyStringToCents(draft.base),
        overtime_amount_cents: moneyStringToCents(draft.overtime),
        bonus_amount_cents: moneyStringToCents(draft.bonus),
        allowance_amount_cents: moneyStringToCents(draft.allowance),
        reimbursement_amount_cents: moneyStringToCents(draft.reimbursement),
        deduction_amount_cents: moneyStringToCents(draft.deduction),
        tax_amount_cents: moneyStringToCents(draft.tax),
        notes: draft.notes.trim() || undefined,
        currency: 'USD',
      };
    });
  }, [eligibleStaff, entryDrafts]);

  const draftNetTotal = useMemo(() => {
    return currentEntriesPayload.reduce((sum, entry) => (
      sum + entry.base_amount_cents + (entry.overtime_amount_cents ?? 0) + (entry.bonus_amount_cents ?? 0)
      + (entry.allowance_amount_cents ?? 0) + (entry.reimbursement_amount_cents ?? 0)
      - (entry.deduction_amount_cents ?? 0) - (entry.tax_amount_cents ?? 0)
    ), 0);
  }, [currentEntriesPayload]);

  const handleSaveEntries = async () => {
    if (!selectedPeriod) {
      setError('Select a payroll period first.');
      return;
    }

    if (summaryDateFrom > summaryDateTo) {
      setError('Summary end date must be on or after start date.');
      return;
    }

    const invalidNetEntry = currentEntriesPayload.find((entry) => (
      (entry.base_amount_cents + (entry.overtime_amount_cents ?? 0) + (entry.bonus_amount_cents ?? 0)
      + (entry.allowance_amount_cents ?? 0) + (entry.reimbursement_amount_cents ?? 0)
      - (entry.deduction_amount_cents ?? 0) - (entry.tax_amount_cents ?? 0)) < 0
    ));

    if (invalidNetEntry) {
      const name = eligibleStaff.find((staff) => staff.id === invalidNetEntry.user_id)?.name ?? `#${invalidNetEntry.user_id}`;
      setError(`Net pay cannot be negative for ${name}. Reduce deductions/tax or increase base pay.`);
      return;
    }

    setSavingEntries(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedPeriod = await upsertPayrollEntries(selectedPeriod.id, currentEntriesPayload);
      setPeriods((current) => current.map((period) => (period.id === selectedPeriod.id ? updatedPeriod : period)));
      resetEntryDrafts(updatedPeriod, eligibleStaff);
      setSuccess('Payroll entries saved successfully.');
      const summaryResponse = await fetchPayrollSummary({
        date_from: summaryDateFrom || undefined,
        date_to: summaryDateTo || undefined,
        period_status: 'approved_paid',
      });
      setSummaryNet(summaryResponse.totals.net_pay);
      setSummaryEmployees(summaryResponse.totals.employee_count);
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Failed to save payroll entries.'));
    } finally {
      setSavingEntries(false);
    }
  };

  return (
    <DashboardLayout title="Payroll Management">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
          <GlassCard>
            <h2 className="text-lg font-semibold text-text">Payroll Query Builder</h2>
            <p className="mt-1 text-sm text-muted">Choose monthly or date range, then generate payroll period containers and employee rows.</p>

            <form className="mt-5 space-y-4" onSubmit={handleGeneratePeriods}>
              <label className="flex items-center gap-2 rounded-xl border border-stroke bg-bg1/55 px-3 py-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={isMonthlyMode}
                  onChange={(event) => setIsMonthlyMode(event.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                Monthly
              </label>

              {isMonthlyMode ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Year</span>
                    <select
                      value={queryYear}
                      onChange={(event) => setQueryYear(Number(event.target.value))}
                      className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    >
                      {Array.from({ length: 8 }, (_, index) => defaultPayrollYear - 3 + index).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Month</span>
                    <select
                      value={queryMonth}
                      onChange={(event) => setQueryMonth(Number(event.target.value))}
                      className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    >
                      {monthLabels.map((label, index) => (
                        <option key={label} value={index + 1}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Start Date</span>
                    <input
                      type="date"
                      value={queryDateFrom}
                      onChange={(event) => setQueryDateFrom(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">End Date</span>
                    <input
                      type="date"
                      value={queryDateTo}
                      onChange={(event) => setQueryDateTo(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Period Split</span>
                  <select
                    value={splitMode}
                    onChange={(event) => setSplitMode(event.target.value as PayrollSplitMode)}
                    className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  >
                    <option value="full">Single Period</option>
                    <option value="weekly">Weekly Periods</option>
                    <option value="custom_days">Custom Day Blocks</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Custom Days</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={customSplitDays}
                    onChange={(event) => setCustomSplitDays(event.target.value)}
                    disabled={splitMode !== 'custom_days'}
                    className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60 disabled:opacity-50"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Notes</span>
                <textarea
                  value={periodNotes}
                  onChange={(event) => setPeriodNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                  placeholder="Optional payroll notes"
                />
              </label>

              <LiquidButton type="submit" disabled={generatingPeriods || loading}>
                {generatingPeriods ? 'Generating...' : 'Generate Payroll Lines'}
              </LiquidButton>
            </form>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text">Payroll Snapshot</h3>
                <p className="mt-1 text-sm text-muted">Approved and paid payroll totals for selected range.</p>
              </div>
              <LiquidButton type="button" tone="tertiary" onClick={() => void loadData()} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </LiquidButton>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Summary Date From</span>
                <input
                  type="date"
                  value={summaryDateFrom}
                  onChange={(event) => setSummaryDateFrom(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Summary Date To</span>
                <input
                  type="date"
                  value={summaryDateTo}
                  onChange={(event) => setSummaryDateTo(event.target.value)}
                  className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-stroke bg-bg1/55 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Net Payroll</p>
                <p className="mt-1 text-xl font-semibold text-text">{formatPriceWithCurrency(summaryNet, currency)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/55 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Employees Paid</p>
                <p className="mt-1 text-xl font-semibold text-text">{summaryEmployees}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text">Periods & Entries</h3>
              <p className="mt-1 text-sm text-muted">Select period, adjust statuses, and save per-employee payroll lines.</p>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block sm:col-span-2 lg:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Payroll Period</span>
              <select
                value={selectedPeriodId}
                onChange={(event) => {
                  const next = event.target.value;
                  handleSelectPeriod(next === '' ? '' : Number(next));
                }}
                className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60"
              >
                <option value="">Select payroll period</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.period_start} to {period.period_end} ({period.status})
                  </option>
                ))}
              </select>
            </label>

            {selectedPeriod ? (
              <div className="flex items-end">
                <PayrollStatusChip status={selectedPeriod.status} />
              </div>
            ) : null}
          </div>

          {selectedPeriod ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <LiquidButton
                  type="button"
                  tone="tertiary"
                  disabled={updatingStatusId === selectedPeriod.id}
                  onClick={() => void handleUpdatePeriodStatus(selectedPeriod.id, 'draft')}
                >
                  Mark Draft
                </LiquidButton>
                <LiquidButton
                  type="button"
                  tone="tertiary"
                  disabled={updatingStatusId === selectedPeriod.id}
                  onClick={() => void handleUpdatePeriodStatus(selectedPeriod.id, 'approved')}
                >
                  Mark Approved
                </LiquidButton>
                <LiquidButton
                  type="button"
                  tone="tertiary"
                  disabled={updatingStatusId === selectedPeriod.id}
                  onClick={() => void handleUpdatePeriodStatus(selectedPeriod.id, 'paid')}
                >
                  Mark Paid
                </LiquidButton>
              </div>

              <div className="mb-4 rounded-2xl border border-stroke bg-bg1/50 p-4 text-sm text-muted">
                Period total net pay: <span className="font-semibold text-text">{formatPriceWithCurrency(selectedPeriod.totals.net_pay, currency)}</span>
                {' '}• Draft net (editable form): <span className="font-semibold text-text">{formatPriceWithCurrency(draftNetTotal / 100, currency)}</span>
                {selectedPeriod.mirrored_expense_id ? (
                  <>
                    {' '}• Mirrored to Finance Expense: <span className="font-semibold text-text">#{selectedPeriod.mirrored_expense_id}</span>
                  </>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stroke">
                <table className="min-w-[1200px] text-left text-sm">
                  <thead className="bg-bg1/85 text-xs uppercase tracking-[0.14em] text-gold2/85">
                    <tr>
                      <th className="px-3 py-3">Employee</th>
                      <th className="px-3 py-3">Base</th>
                      <th className="px-3 py-3">Overtime</th>
                      <th className="px-3 py-3">Bonus</th>
                      <th className="px-3 py-3">Allowance</th>
                      <th className="px-3 py-3">Reimbursement</th>
                      <th className="px-3 py-3">Deduction</th>
                      <th className="px-3 py-3">Tax</th>
                      <th className="px-3 py-3">Net</th>
                      <th className="px-3 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleStaff.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-muted">No staff members found.</td>
                      </tr>
                    ) : eligibleStaff.map((staff) => {
                      const draft = entryDrafts[staff.id] ?? {
                        base: '0.00',
                        overtime: '0.00',
                        bonus: '0.00',
                        allowance: '0.00',
                        reimbursement: '0.00',
                        deduction: '0.00',
                        tax: '0.00',
                        notes: '',
                      };

                      return (
                        <tr key={staff.id} className="border-t border-stroke/70 bg-bg1/40">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-text">{staff.name}</p>
                            <p className="text-xs text-muted">{staff.role}</p>
                          </td>
                          <td className="px-3 py-3"><input value={draft.base} onChange={(event) => setEntryValue(staff.id, 'base', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3"><input value={draft.overtime} onChange={(event) => setEntryValue(staff.id, 'overtime', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3"><input value={draft.bonus} onChange={(event) => setEntryValue(staff.id, 'bonus', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3"><input value={draft.allowance} onChange={(event) => setEntryValue(staff.id, 'allowance', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3"><input value={draft.reimbursement} onChange={(event) => setEntryValue(staff.id, 'reimbursement', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3"><input value={draft.deduction} onChange={(event) => setEntryValue(staff.id, 'deduction', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3"><input value={draft.tax} onChange={(event) => setEntryValue(staff.id, 'tax', event.target.value)} type="number" min="0" step="0.01" className="w-24 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                          <td className="px-3 py-3 text-sm font-semibold text-text">
                            {formatPriceWithCurrency(
                              (moneyStringToCents(draft.base) + moneyStringToCents(draft.overtime) + moneyStringToCents(draft.bonus)
                                + moneyStringToCents(draft.allowance) + moneyStringToCents(draft.reimbursement)
                                - moneyStringToCents(draft.deduction) - moneyStringToCents(draft.tax)) / 100,
                              currency
                            )}
                          </td>
                          <td className="px-3 py-3"><input value={draft.notes} onChange={(event) => setEntryValue(staff.id, 'notes', event.target.value)} type="text" placeholder="Optional" className="w-56 rounded-lg border border-stroke bg-bg1/65 px-2 py-1.5 text-sm text-text" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <LiquidButton type="button" onClick={() => void handleSaveEntries()} disabled={savingEntries || selectedPeriod.status === 'paid'}>
                  {savingEntries ? 'Saving...' : selectedPeriod.status === 'paid' ? 'Paid Period Locked' : 'Save Entries'}
                </LiquidButton>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-5 text-sm text-muted">
              Select a period to edit payroll entries.
            </div>
          )}
        </GlassCard>

        {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-4 py-3 text-sm text-spicy">{error}</div> : null}
        {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-4 py-3 text-sm text-sage">{success}</div> : null}
      </div>
    </DashboardLayout>
  );
};

export default AdminPayrollManagementPage;
