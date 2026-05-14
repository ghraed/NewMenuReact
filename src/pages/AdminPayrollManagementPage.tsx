import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import {
  createPayrollPeriod,
  deletePayrollPeriod,
  fetchPayrollPeriods,
  fetchPayrollSummary,
  updatePayrollPeriod,
  upsertPayrollEntries,
} from '../services/payrollService';
import { fetchStaffMembers } from '../services/staffService';
import type { PayrollPeriod, PayrollPeriodStatus, StaffMember } from '../types';
import { formatPriceWithCurrency, normalizeCurrency, readGuestCurrencySettings } from '../utils/currency';

const today = new Date().toISOString().slice(0, 10);
const monthStart = today.slice(0, 8) + '01';

type SalaryDraft = {
  employeeId: string;
  monthly: boolean;
  year: string;
  month: string;
  startDate: string;
  endDate: string;
  base: string;
  overtime: string;
  bonus: string;
  allowance: string;
  reimbursement: string;
  deduction: string;
  tax: string;
  notes: string;
};

type AdjustmentDraft = {
  date: string;
  amount: string;
  note: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
    const firstFieldError = response?.data?.errors ? Object.values(response.data.errors)[0]?.[0] : null;
    if (firstFieldError) return firstFieldError;
    if (response?.data?.message) return response.data.message;
  }
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
};

const cents = (value: string): number => {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
};

const defaultDraft = (): SalaryDraft => {
  const d = new Date();
  return {
    employeeId: '',
    monthly: true,
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    startDate: monthStart,
    endDate: today,
    base: '0.00',
    overtime: '0.00',
    bonus: '0.00',
    allowance: '0.00',
    reimbursement: '0.00',
    deduction: '0.00',
    tax: '0.00',
    notes: '',
  };
};

const statusChip = (status: PayrollPeriodStatus): string => (
  status === 'paid' ? 'border-sage/45 bg-sage/10 text-sage'
    : status === 'approved' ? 'border-gold/45 bg-gold/10 text-gold2'
      : 'border-stroke bg-bg1/50 text-muted'
);

const ActionIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="mr-2 inline-flex h-4 w-4 items-center justify-center text-gold2/95">{children}</span>
);

const IconGlyph: React.FC<{ d: string }> = ({ d }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdminPayrollManagementPage: React.FC = () => {
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const { user } = useAuth();
  const storedGuestCurrency = readGuestCurrencySettings()?.currency;
  const currency = normalizeCurrency(storedGuestCurrency || user?.restaurant?.currency || 'USD');

  const [records, setRecords] = useState<PayrollPeriod[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summaryFrom, setSummaryFrom] = useState(monthStart);
  const [summaryTo, setSummaryTo] = useState(today);
  const [summaryNet, setSummaryNet] = useState(0);
  const [summaryEmployees, setSummaryEmployees] = useState(0);

  const [draft, setDraft] = useState<SalaryDraft>(defaultDraft);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<Record<number, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<number, SalaryDraft>>({});
  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<number, AdjustmentDraft>>({});

  const [loading, setLoading] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [savingAdjustment, setSavingAdjustment] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const eligibleStaff = useMemo(() => staff.filter((s) => s.role === 'staff' || s.role === 'chef'), [staff]);

  const regularRecords = useMemo(
    () => records.filter((record) => (record.period_type ?? 'regular') === 'regular').sort((a, b) => (a.period_start === b.period_start ? b.id - a.id : (a.period_start < b.period_start ? 1 : -1))),
    [records]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [periods, members, summary] = await Promise.all([
        fetchPayrollPeriods(),
        fetchStaffMembers(),
        fetchPayrollSummary({ date_from: summaryFrom || undefined, date_to: summaryTo || undefined, period_status: 'approved_paid' }),
      ]);
      setRecords(periods);
      setStaff(members);
      setSummaryNet(summary.totals.net_pay);
      setSummaryEmployees(summary.totals.employee_count);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load salary records.'));
    } finally {
      setLoading(false);
    }
  }, [summaryFrom, summaryTo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const resolveRange = (form: SalaryDraft): { start: string; end: string } => {
    if (!form.monthly) {
      return { start: form.startDate, end: form.endDate };
    }
    const year = Number(form.year);
    const monthIndex = Number(form.month) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  const createSalaryRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCreate(true);
    setError(null);
    setSuccess(null);

    try {
      if (!draft.employeeId) {
        setError('Select an employee.');
        return;
      }
      const range = resolveRange(draft);
      if (range.start > range.end) {
        setError('Salary range end date must be on or after start date.');
        return;
      }

      const created = await createPayrollPeriod({
        period_type: 'regular',
        employee_id: Number(draft.employeeId),
        period_start: range.start,
        period_end: range.end,
        base_amount_cents: cents(draft.base),
        overtime_amount_cents: cents(draft.overtime),
        bonus_amount_cents: cents(draft.bonus),
        allowance_amount_cents: cents(draft.allowance),
        reimbursement_amount_cents: cents(draft.reimbursement),
        deduction_amount_cents: cents(draft.deduction),
        tax_amount_cents: cents(draft.tax),
        notes: draft.notes.trim() || undefined,
      });

      setRecords((current) => [created, ...current.filter((p) => p.id !== created.id)]);
      setDraft(defaultDraft());
      setSuccess('Salary record created.');
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to create salary record.'));
    } finally {
      setSavingCreate(false);
    }
  };

  const updateStatus = async (record: PayrollPeriod, status: PayrollPeriodStatus) => {
    setStatusUpdating(record.id);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePayrollPeriod(record.id, { status });
      setRecords((current) => current.map((p) => (p.id === record.id ? updated : p)));
      setSuccess(`Record #${record.id} moved to ${status}.`);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to update status.'));
    } finally {
      setStatusUpdating(null);
    }
  };

  const beginEdit = (record: PayrollPeriod) => {
    const first = record.entries[0];
    setEditing((prev) => ({ ...prev, [record.id]: true }));
    setEditDrafts((prev) => ({
      ...prev,
      [record.id]: {
        ...defaultDraft(),
        employeeId: String(record.employee_id ?? first?.user_id ?? ''),
        monthly: false,
        year: record.period_start.slice(0, 4),
        month: record.period_start.slice(5, 7),
        startDate: record.period_start,
        endDate: record.period_end,
        base: ((first?.base_amount_cents ?? 0) / 100).toFixed(2),
        overtime: ((first?.overtime_amount_cents ?? 0) / 100).toFixed(2),
        bonus: ((first?.bonus_amount_cents ?? 0) / 100).toFixed(2),
        allowance: ((first?.allowance_amount_cents ?? 0) / 100).toFixed(2),
        reimbursement: ((first?.reimbursement_amount_cents ?? 0) / 100).toFixed(2),
        deduction: ((first?.deduction_amount_cents ?? 0) / 100).toFixed(2),
        tax: ((first?.tax_amount_cents ?? 0) / 100).toFixed(2),
        notes: first?.notes ?? '',
      },
    }));
  };

  const saveEdit = async (record: PayrollPeriod) => {
    const form = editDrafts[record.id];
    if (!form) return;
    setSavingRow(record.id);
    setError(null);
    setSuccess(null);

    try {
      const updated = await upsertPayrollEntries(record.id, [{
        user_id: Number(form.employeeId),
        base_amount_cents: cents(form.base),
        overtime_amount_cents: cents(form.overtime),
        bonus_amount_cents: cents(form.bonus),
        allowance_amount_cents: cents(form.allowance),
        reimbursement_amount_cents: cents(form.reimbursement),
        deduction_amount_cents: cents(form.deduction),
        tax_amount_cents: cents(form.tax),
        notes: form.notes.trim() || undefined,
        currency: currency,
      }]);
      setRecords((current) => current.map((p) => (p.id === record.id ? updated : p)));
      setEditing((prev) => ({ ...prev, [record.id]: false }));
      setSuccess(`Salary record #${record.id} updated.`);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to update salary record.'));
    } finally {
      setSavingRow(null);
    }
  };

  const addAdjustment = async (record: PayrollPeriod) => {
    const form = adjustmentDrafts[record.id] ?? { date: today, amount: '', note: '' };
    setSavingAdjustment(record.id);
    setError(null);
    setSuccess(null);

    try {
      const amountCents = cents(form.amount);
      if (!Number.isFinite(Number(form.amount)) || form.amount.trim() === '' || amountCents === 0) {
        setError('Adjustment amount must be non-zero.');
        return;
      }
      if (!form.note.trim()) {
        setError('Adjustment note is required.');
        return;
      }

      const adjustment = await createPayrollPeriod({
        period_type: 'adjustment',
        adjustment_of_period_id: record.id,
        period_start: form.date,
        period_end: form.date,
        notes: form.note.trim(),
      });

      const updatedAdjustment = await upsertPayrollEntries(adjustment.id, [{
        user_id: Number(record.employee_id ?? record.entries[0]?.user_id),
        base_amount_cents: amountCents,
        notes: form.note.trim(),
        currency,
      }]);

      setRecords((current) => [updatedAdjustment, ...current.filter((p) => p.id !== updatedAdjustment.id)]);
      setAdjustmentDrafts((prev) => ({ ...prev, [record.id]: { date: today, amount: '', note: '' } }));
      await refresh();
      setExpanded((prev) => ({ ...prev, [record.id]: true }));
      setSuccess(`Adjustment created for salary #${record.id}.`);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to create adjustment.'));
    } finally {
      setSavingAdjustment(null);
    }
  };

  const deleteDraftRecord = async (record: PayrollPeriod) => {
    if (record.status !== 'draft') {
      setError('Only draft records can be deleted.');
      return;
    }
    const confirmed = window.confirm(`Delete draft payroll record #${record.id}?`);
    if (!confirmed) return;

    setDeletingRow(record.id);
    setError(null);
    setSuccess(null);
    try {
      await deletePayrollPeriod(record.id);
      setRecords((current) => current.filter((p) => p.id !== record.id));
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[record.id];
        return next;
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[record.id];
        return next;
      });
      setSuccess(`Draft record #${record.id} deleted.`);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete draft payroll record.'));
    } finally {
      setDeletingRow(null);
    }
  };

  return (
    <DashboardLayout title="Payroll Management">
      <div className="space-y-6">
        <GlassCard>
          <h2 className="text-lg font-semibold text-text">Employee Salary Record</h2>
          <p className="mt-1 text-sm text-muted">Create independent salary records per employee. Each record can be approved/paid and adjusted later.</p>

          <form className="mt-5 grid gap-4" onSubmit={createSalaryRecord}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Employee</span>
                <select value={draft.employeeId} onChange={(e) => setDraft((d) => ({ ...d, employeeId: e.target.value }))} className="themed-native-select w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text outline-none transition focus:border-gold/60">
                  <option value="">Select employee</option>
                  {eligibleStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-stroke bg-bg1/55 px-3 py-2 text-sm text-text">
                <input type="checkbox" checked={draft.monthly} onChange={(e) => setDraft((d) => ({ ...d, monthly: e.target.checked }))} className="h-4 w-4 accent-gold" />
                Monthly Range
              </label>
              {draft.monthly ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Year</span>
                    <input type="number" value={draft.year} onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Month</span>
                    <input type="number" min={1} max={12} value={draft.month} onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" />
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Start Date</span>
                    <input type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">End Date</span>
                    <input type="date" value={draft.endDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" />
                  </label>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {(['base', 'overtime', 'bonus', 'allowance', 'reimbursement', 'deduction', 'tax'] as const).map((field) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">{field}</span>
                  <input type="number" step="0.01" min="0" value={draft[field]} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text" />
                </label>
              ))}
            </div>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Notes</span>
              <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" />
            </label>

            <div>
              <LiquidButton type="submit" disabled={savingCreate || loading}>
                <span className="inline-flex items-center">
                  <ActionIcon><IconGlyph d="M12 5v14M5 12h14" /></ActionIcon>
                  {savingCreate ? 'Saving...' : 'Create Salary Record'}
                </span>
              </LiquidButton>
            </div>
          </form>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text">Salary Summary</h3>
              <p className="mt-1 text-sm text-muted">Finance totals are based on saved salary records and adjustments.</p>
            </div>
            <LiquidButton type="button" tone="tertiary" onClick={() => void refresh()} disabled={loading}>
              <span className="inline-flex items-center">
                <ActionIcon><IconGlyph d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></ActionIcon>
                {loading ? 'Loading...' : 'Refresh'}
              </span>
            </LiquidButton>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">From</span><input type="date" value={summaryFrom} onChange={(e) => setSummaryFrom(e.target.value)} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" /></label>
            <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">To</span><input type="date" value={summaryTo} onChange={(e) => setSummaryTo(e.target.value)} className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-4"><p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Net Payroll</p><p className="mt-1 text-xl font-semibold text-text">{formatPriceWithCurrency(summaryNet, currency)}</p></div>
            <div className="rounded-2xl border border-stroke bg-bg1/55 p-4"><p className="text-xs uppercase tracking-[0.12em] text-gold2/85">Employees Paid</p><p className="mt-1 text-xl font-semibold text-text">{summaryEmployees}</p></div>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-semibold text-text">Employee Salary Records</h3>
          <p className="mt-1 text-sm text-muted">Main row = original salary. Expanded rows = correction history.</p>

          <div className="mt-4 space-y-3">
            {regularRecords.length === 0 ? <div className="rounded-2xl border border-stroke bg-bg1/55 p-4 text-sm text-muted">No salary records yet.</div> : regularRecords.map((record) => {
              const recordEdit = editDrafts[record.id];
              const adjDraft = adjustmentDrafts[record.id] ?? { date: today, amount: '', note: '' };
              const adjusted = (record.adjustment_count ?? 0) > 0;

              return (
                <div key={record.id} className="rounded-2xl border border-stroke bg-bg1/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">#{record.id} • {record.employee?.name ?? `Employee #${record.employee_id ?? '-'}`}</p>
                      <p className="text-xs text-muted">{record.period_start} to {record.period_end}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.12em] ${statusChip(record.status)}`}>{record.status}</span>
                        {adjusted ? <span className="rounded-full border border-gold/45 bg-gold/10 px-2.5 py-1 font-semibold uppercase tracking-[0.12em] text-gold2">Adjusted ({record.adjustment_count})</span> : null}
                      </div>
                    </div>
                    <div className="grid gap-1 text-right text-sm">
                      <p className="text-muted">Original: <span className="font-semibold text-text">{formatPriceWithCurrency(record.original_salary ?? record.totals.net_pay, currency)}</span></p>
                      <p className="text-muted">Adjustments: <span className="font-semibold text-text">{formatPriceWithCurrency(record.total_adjustments ?? 0, currency)}</span></p>
                      <p className="text-muted">Final: <span className="font-semibold text-text">{formatPriceWithCurrency(record.final_salary ?? record.totals.net_pay, currency)}</span></p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <LiquidButton type="button" tone="tertiary" onClick={() => setExpanded((p) => ({ ...p, [record.id]: !p[record.id] }))}>
                      <span className="inline-flex items-center">
                        <ActionIcon><IconGlyph d={expanded[record.id] ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} /></ActionIcon>
                        {expanded[record.id] ? 'Hide Details' : 'Show Details'}
                      </span>
                    </LiquidButton>
                    <LiquidButton type="button" tone="tertiary" disabled={statusUpdating === record.id} onClick={() => void updateStatus(record, 'draft')}>
                      <span className="inline-flex items-center"><ActionIcon><IconGlyph d="M4 20h16M14 4l6 6L8 22l-4 1 1-4 9-9z" /></ActionIcon>Draft</span>
                    </LiquidButton>
                    <LiquidButton type="button" tone="tertiary" disabled={statusUpdating === record.id} onClick={() => void updateStatus(record, 'approved')}>
                      <span className="inline-flex items-center"><ActionIcon><IconGlyph d="M20 6L9 17l-5-5" /></ActionIcon>Approve</span>
                    </LiquidButton>
                    <LiquidButton type="button" tone="tertiary" disabled={statusUpdating === record.id} onClick={() => void updateStatus(record, 'paid')}>
                      <span className="inline-flex items-center"><ActionIcon><IconGlyph d="M12 1v22M3 6h13a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h13" /></ActionIcon>Pay</span>
                    </LiquidButton>
                    <LiquidButton type="button" tone="tertiary" disabled={record.status === 'paid'} onClick={() => beginEdit(record)}>
                      <span className="inline-flex items-center"><ActionIcon><IconGlyph d="M14 4l6 6M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20z" /></ActionIcon>Edit Salary</span>
                    </LiquidButton>
                    <LiquidButton type="button" tone="tertiary" disabled={record.status !== 'draft' || deletingRow === record.id} onClick={() => void deleteDraftRecord(record)}>
                      <span className="inline-flex items-center">
                        <ActionIcon><IconGlyph d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></ActionIcon>
                        {deletingRow === record.id ? 'Deleting...' : 'Delete Draft'}
                      </span>
                    </LiquidButton>
                  </div>

                  {editing[record.id] && recordEdit ? (
                    <div className="mt-3 grid gap-3 rounded-xl border border-stroke bg-bg1/55 p-3 sm:grid-cols-4">
                      {(['base', 'overtime', 'bonus', 'allowance', 'reimbursement', 'deduction', 'tax'] as const).map((field) => (
                        <label key={field} className="block"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">{field}</span><input type="number" min="0" step="0.01" value={recordEdit[field]} onChange={(e) => setEditDrafts((prev) => ({ ...prev, [record.id]: { ...recordEdit, [field]: e.target.value } }))} className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text" /></label>
                      ))}
                      <label className="block sm:col-span-4"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-gold2/85">Notes</span><input value={recordEdit.notes} onChange={(e) => setEditDrafts((prev) => ({ ...prev, [record.id]: { ...recordEdit, notes: e.target.value } }))} className="w-full rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text" /></label>
                      <div className="sm:col-span-4">
                        <LiquidButton type="button" onClick={() => void saveEdit(record)} disabled={savingRow === record.id}>
                          <span className="inline-flex items-center">
                            <ActionIcon><IconGlyph d="M5 5h11l3 3v11H5zM8 5v6h8" /></ActionIcon>
                            {savingRow === record.id ? 'Saving...' : 'Save Salary Values'}
                          </span>
                        </LiquidButton>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-2 rounded-xl border border-stroke bg-bg1/55 p-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
                    <input type="date" value={adjDraft.date} onChange={(e) => setAdjustmentDrafts((prev) => ({ ...prev, [record.id]: { ...adjDraft, date: e.target.value } }))} className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text" />
                    <input type="number" step="0.01" placeholder="Adjustment +/-" value={adjDraft.amount} onChange={(e) => setAdjustmentDrafts((prev) => ({ ...prev, [record.id]: { ...adjDraft, amount: e.target.value } }))} className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text" />
                    <input type="text" placeholder="Adjustment note" value={adjDraft.note} onChange={(e) => setAdjustmentDrafts((prev) => ({ ...prev, [record.id]: { ...adjDraft, note: e.target.value } }))} className="rounded-xl border border-stroke bg-bg1/65 px-3 py-2 text-sm text-text" />
                    <LiquidButton type="button" tone="tertiary" onClick={() => void addAdjustment(record)} disabled={savingAdjustment === record.id}>
                      <span className="inline-flex items-center">
                        <ActionIcon><IconGlyph d="M12 5v14M5 12h14" /></ActionIcon>
                        {savingAdjustment === record.id ? 'Adding...' : 'Add Adjustment'}
                      </span>
                    </LiquidButton>
                  </div>

                  {expanded[record.id] ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-stroke bg-bg1/35 p-3">
                      {(record.adjustments ?? []).length === 0 ? (
                        <p className="text-sm text-muted">No adjustments.</p>
                      ) : (record.adjustments ?? []).map((adj) => (
                        <div key={adj.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stroke/70 bg-bg1/55 px-3 py-2 text-sm">
                          <div>
                            <p className="font-semibold text-text">Adjustment #{adj.id} • {adj.date ?? '-'}</p>
                            <p className="text-xs text-muted">{adj.note || 'No note'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-text">{formatPriceWithCurrency(adj.amount, currency)}</p>
                            <p className="text-xs text-muted uppercase">{adj.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </GlassCard>

        {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-4 py-3 text-sm text-spicy">{error}</div> : null}
        {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-4 py-3 text-sm text-sage">{success}</div> : null}
      </div>
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminPayrollManagementPage;
