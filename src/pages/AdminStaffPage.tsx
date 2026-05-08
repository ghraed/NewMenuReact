import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { createStaffMember, fetchStaffMembers, updateStaffMemberTables } from '../services/staffService';
import { fetchTableManagement, updateManualTableCount } from '../services/tableManagementService';
import type { StaffMember, TableManagementSummary } from '../types';
import { GlassCard, GlassChip, GlassInput, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';

type AssignmentState = Record<number, number[]>;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;

    if (response?.data?.errors) {
      const firstFieldError = Object.values(response.data.errors)[0]?.[0];
      if (firstFieldError) return firstFieldError;
    }

    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const toggleTableId = (current: number[], tableId: number): number[] => (
  current.includes(tableId)
    ? current.filter((id) => id !== tableId)
    : [...current, tableId].sort((left, right) => left - right)
);

const mapAssignments = (staffMembers: StaffMember[]): AssignmentState => (
  Object.fromEntries(
    staffMembers.map((staff) => [
      staff.id,
      (staff.assigned_tables ?? []).map((table) => table.id).sort((left, right) => left - right),
    ])
  )
);

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizePhone = (value: string): string => value.replace(/[^\d+]/g, '');

const AdminStaffPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'staff' | 'chef'>('staff');
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<AssignmentState>({});
  const [management, setManagement] = useState<TableManagementSummary | null>(null);
  const [manualCountInput, setManualCountInput] = useState('');
  const [createdStaff, setCreatedStaff] = useState<StaffMember | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [managementLoading, setManagementLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingStaffId, setSavingStaffId] = useState<number | null>(null);
  const [savingManualCount, setSavingManualCount] = useState(false);

  const tables = useMemo(() => management?.active_tables ?? [], [management?.active_tables]);
  const manualModeRequiresCount = management?.mode === 'MANUAL' && !management?.manual_table_count;
  const tableNameById = useMemo(() => new Map(tables.map((table) => [table.id, table.name])), [tables]);

  const syncStaffMembers = useCallback((nextStaffMembers: StaffMember[]) => {
    setStaffMembers(nextStaffMembers);
    setStaffAssignments(mapAssignments(nextStaffMembers));
  }, []);

  const loadTableManagement = useCallback(async () => {
    setManagementLoading(true);

    try {
      const response = await fetchTableManagement();
      setManagement(response);
      setManualCountInput(response.manual_table_count ? String(response.manual_table_count) : '');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load table mode.'));
    } finally {
      setManagementLoading(false);
    }
  }, []);

  const loadStaffMembers = useCallback(async () => {
    setStaffLoading(true);

    try {
      const nextStaffMembers = await fetchStaffMembers();
      syncStaffMembers(nextStaffMembers);
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, t('adminStaff.failedLoadStaff')));
    } finally {
      setStaffLoading(false);
    }
  }, [syncStaffMembers, t]);

  useEffect(() => {
    setPageError(null);
    loadTableManagement();
    loadStaffMembers();
  }, [loadTableManagement, loadStaffMembers]);

  const handleSaveManualCount = async () => {
    const parsed = Number.parseInt(manualCountInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageError('Table count must be greater than 0.');
      return;
    }

    setSavingManualCount(true);
    setPageError(null);

    try {
      const response = await updateManualTableCount(parsed);
      setManagement({
        mode: response.mode,
        manual_table_count: response.manual_table_count,
        active_tables: response.active_tables,
      });
      setSelectedTableIds([]);
      await loadStaffMembers();
      showToast(response.message, 'primary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to update manual table count.'));
    } finally {
      setSavingManualCount(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName) {
      setPageError(t('adminStaff.nameRequired'));
      return;
    }

    if (!normalizedEmail && !normalizedPhone) {
      setPageError(t('adminStaff.contactRequired'));
      return;
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setPageError('Please enter a valid email address.');
      return;
    }

    if (normalizedPhone && normalizePhone(normalizedPhone).length < 7) {
      setPageError('Please enter a valid phone number.');
      return;
    }

    if (manualModeRequiresCount) {
      setPageError('Set manual table count before assigning tables.');
      return;
    }

    setCreating(true);

    try {
      const response = await createStaffMember({
        name: normalizedName,
        email: normalizedEmail || undefined,
        phone: normalizedPhone || undefined,
        role,
        table_ids: role === 'staff' ? selectedTableIds : [],
      });

      setCreatedStaff(response.staff);
      setTemporaryPassword(response.temporary_password);
      setName('');
      setEmail('');
      setPhone('');
      setRole('staff');
      setSelectedTableIds([]);
      await loadStaffMembers();
      showToast(response.message || t('adminStaff.created'), 'primary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, t('adminStaff.failedCreate')));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveAssignments = async (staff: StaffMember) => {
    const nextTableIds = staffAssignments[staff.id] ?? [];

    setSavingStaffId(staff.id);
    setPageError(null);

    try {
      const response = await updateStaffMemberTables(staff.id, nextTableIds);
      setStaffMembers((current) => current.map((member) => (member.id === staff.id ? response.staff : member)));
      setStaffAssignments((current) => ({
        ...current,
        [staff.id]: (response.staff.assigned_tables ?? []).map((table) => table.id),
      }));
      showToast(response.message || t('adminStaff.updatedTables', { name: staff.name }), 'primary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, t('adminStaff.failedUpdateTables', { name: staff.name })));
    } finally {
      setSavingStaffId(null);
    }
  };

  return (
    <DashboardLayout title={t('adminStaff.pageTitle')}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]">
        <GlassCard noise={false}>
          <h2 className="text-2xl font-semibold text-text">{t('adminStaff.heading')}</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="staff-name" className="mb-2 block text-sm font-medium text-text">Staff Name</label>
              <GlassInput id="staff-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Maya Hassan" disabled={creating} required />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="staff-email" className="mb-2 block text-sm font-medium text-text">Email (Optional)</label>
                <GlassInput id="staff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="maya@restaurant.com" disabled={creating} />
              </div>
              <div>
                <label htmlFor="staff-phone" className="mb-2 block text-sm font-medium text-text">Phone (Optional)</label>
                <GlassInput id="staff-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+961 70 000 000" disabled={creating} />
              </div>
            </div>
            <div>
              <div className="mb-2 block text-sm font-medium text-text">Role</div>
              <div className="flex flex-wrap gap-2">
                <GlassChip type="button" active={role === 'staff'} onClick={() => setRole('staff')} className="px-4 py-2 text-sm" disabled={creating}>Staff</GlassChip>
                <GlassChip type="button" active={role === 'chef'} onClick={() => setRole('chef')} className="px-4 py-2 text-sm" disabled={creating}>Chef</GlassChip>
              </div>
            </div>

            {role === 'staff' ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-text">{t('adminStaff.assignedTables')}</label>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted2">{t('adminStaff.selectedCount', { count: selectedTableIds.length })}</span>
                </div>
                <div className="relative isolate overflow-hidden rounded-xl2 border border-stroke/70 bg-panel2/30 p-4">
                  {managementLoading ? (
                    <p className="text-sm text-muted">{t('common.loading')}</p>
                  ) : manualModeRequiresCount ? (
                    <p className="text-sm text-muted">Set manual table count first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tables.map((table) => (
                        <GlassChip
                          key={table.id}
                          type="button"
                          active={selectedTableIds.includes(table.id)}
                          onClick={() => setSelectedTableIds((current) => toggleTableId(current, table.id))}
                          className="px-4 py-2 text-sm"
                          disabled={creating}
                        >
                          {table.name}
                        </GlassChip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {pageError ? <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">{pageError}</div> : null}

            <LiquidButton type="submit" tone="primary" disabled={creating || managementLoading}>
              {creating ? t('adminStaff.creating') : t('adminStaff.createStaff')}
            </LiquidButton>
          </form>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard noise={false}>
            <h3 className="text-lg font-semibold text-text">Table Management</h3>
            <p className="mt-2 text-sm text-muted">Mode: {management?.mode ?? '...'}</p>
            {management?.mode === 'MANUAL' ? (
              <div className="mt-4 space-y-3">
                <GlassInput value={manualCountInput} onChange={(event) => setManualCountInput(event.target.value)} placeholder="Number of tables" type="number" min={1} />
                <LiquidButton type="button" tone="primary" onClick={handleSaveManualCount} disabled={savingManualCount}>
                  {savingManualCount ? t('adminDashboard.saving') : 'Save Table Count'}
                </LiquidButton>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Tables are synced from Room Plan items.</p>
            )}
          </GlassCard>

          <GlassCard interactive={false} noise={false}>
            <h3 className="text-lg font-semibold text-text">{t('adminStaff.latestCreated')}</h3>
            {createdStaff ? (
              <div className="mt-4 space-y-3 text-sm text-muted">
                <div className="relative isolate overflow-hidden rounded-xl2 border border-sage/35 bg-sage/10 p-4">
                  <p className="text-base font-semibold text-text">{createdStaff.name}</p>
                  <p className="mt-1">Role: {createdStaff.role === 'chef' ? 'Chef' : 'Staff'}</p>
                  <p>Email: {createdStaff.email || 'Not provided'}</p>
                  <p>Phone: {createdStaff.phone || 'Not provided'}</p>
                  <p>Login: {createdStaff.email || createdStaff.phone || 'Use assigned contact'}</p>
                  <p>Temporary password: <span className="font-semibold text-text">{temporaryPassword || 'Unavailable'}</span></p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted">{t('adminStaff.latestCreatedEmpty')}</p>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard className="mt-6" noise={false}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-text">{t('adminStaff.assignmentsTitle')}</h3>
          <LiquidButton type="button" tone="tertiary" onClick={loadStaffMembers} disabled={staffLoading}>
            {staffLoading ? t('common.loading') : t('adminStaff.refresh')}
          </LiquidButton>
        </div>

        {staffLoading ? (
          <p className="text-sm text-muted">{t('adminStaff.loadingAssignments')}</p>
        ) : staffMembers.length === 0 ? (
          <p className="text-sm text-muted">{t('adminStaff.noStaffYet')}</p>
        ) : manualModeRequiresCount ? (
          <p className="text-sm text-muted">Set manual table count to start assignments.</p>
        ) : (
          <div className="space-y-4">
            {staffMembers.map((staff) => {
              const assignedIds = staffAssignments[staff.id] ?? [];
              const assignedNames = assignedIds
                .map((tableId) => tableNameById.get(tableId))
                .filter((tableName): tableName is string => Boolean(tableName));

              return (
                <div key={staff.id} className="relative isolate overflow-hidden rounded-xl2 border border-stroke/70 bg-panel2/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-text">{staff.name}</p>
                      <p className="mt-1 text-sm text-muted">{staff.email || staff.phone || t('adminStaff.noLoginContact')}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted2">{t('adminStaff.assignedNow', { tables: assignedNames.join(', ') || t('adminStaff.noTablesAssigned') })}</p>
                    </div>
                    <LiquidButton type="button" tone="primary" onClick={() => handleSaveAssignments(staff)} disabled={savingStaffId === staff.id}>
                      {savingStaffId === staff.id ? t('adminDashboard.saving') : t('adminStaff.saveTables')}
                    </LiquidButton>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tables.map((table) => (
                      <GlassChip
                        key={`${staff.id}-${table.id}`}
                        type="button"
                        active={assignedIds.includes(table.id)}
                        onClick={() => setStaffAssignments((current) => ({
                          ...current,
                          [staff.id]: toggleTableId(current[staff.id] ?? [], table.id),
                        }))}
                        className="px-4 py-2 text-sm"
                        disabled={savingStaffId === staff.id}
                      >
                        {table.name}
                      </GlassChip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminStaffPage;
