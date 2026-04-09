import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { useAuth } from '../contexts/useAuth';
import { fetchGuestTables } from '../services/orderService';
import { createStaffMember, fetchStaffMembers, updateStaffMemberTables } from '../services/staffService';
import type { RestaurantTableSummary, StaffMember } from '../types';
import {
  GlassCard,
  GlassChip,
  GlassInput,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

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

const AdminStaffPage: React.FC = () => {
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<AssignmentState>({});
  const [createdStaff, setCreatedStaff] = useState<StaffMember | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingStaffId, setSavingStaffId] = useState<number | null>(null);

  const tableNameById = useMemo(() => (
    new Map(tables.map((table) => [table.id, table.name]))
  ), [tables]);

  const syncStaffMembers = useCallback((nextStaffMembers: StaffMember[]) => {
    setStaffMembers(nextStaffMembers);
    setStaffAssignments(mapAssignments(nextStaffMembers));
  }, []);

  const loadTables = useCallback(async () => {
    if (!user?.restaurant?.slug) {
      setTables([]);
      return;
    }

    setTablesLoading(true);

    try {
      const response = await fetchGuestTables(user.restaurant.slug);
      setTables(response.tables);
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load restaurant tables.'));
    } finally {
      setTablesLoading(false);
    }
  }, [user?.restaurant?.slug]);

  const loadStaffMembers = useCallback(async () => {
    setStaffLoading(true);

    try {
      const nextStaffMembers = await fetchStaffMembers();
      syncStaffMembers(nextStaffMembers);
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load staff members.'));
    } finally {
      setStaffLoading(false);
    }
  }, [syncStaffMembers]);

  useEffect(() => {
    setPageError(null);
    loadTables();
    loadStaffMembers();
  }, [loadTables, loadStaffMembers]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName) {
      setPageError('Staff name is required.');
      return;
    }

    if (!normalizedEmail && !normalizedPhone) {
      setPageError('Add either an email address or a phone number.');
      return;
    }

    setCreating(true);

    try {
      const response = await createStaffMember({
        name: normalizedName,
        email: normalizedEmail || undefined,
        phone: normalizedPhone || undefined,
        table_ids: selectedTableIds,
      });

      setCreatedStaff(response.staff);
      setTemporaryPassword(response.temporary_password);
      setName('');
      setEmail('');
      setPhone('');
      setSelectedTableIds([]);
      await loadStaffMembers();
      showToast(response.message || 'Staff member created.', 'primary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to create staff member.'));
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
      setStaffMembers((current) => current.map((member) => (
        member.id === staff.id ? response.staff : member
      )));
      setStaffAssignments((current) => ({
        ...current,
        [staff.id]: (response.staff.assigned_tables ?? []).map((table) => table.id),
      }));
      showToast(response.message || `Updated tables for ${staff.name}.`, 'primary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, `Failed to update tables for ${staff.name}.`));
    } finally {
      setSavingStaffId(null);
    }
  };

  return (
    <DashboardLayout title="Staff Management">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]">
        <GlassCard>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-gold2/80">Restaurant Team</p>
            <h2 className="mt-2 text-2xl font-semibold text-text">Create a staff account</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Add a team member for
              {' '}
              <span className="font-medium text-text">{user?.restaurant?.name ?? 'your restaurant'}</span>
              {' '}
              and assign the tables they are responsible for.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="staff-name" className="mb-1 block text-sm font-medium text-text">
                Staff name
              </label>
              <GlassInput
                id="staff-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Maya Hassan"
                disabled={creating}
                required
                leftSlot={<span>👤</span>}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="staff-email" className="mb-1 block text-sm font-medium text-text">
                  Email
                </label>
                <GlassInput
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="maya@restaurant.com"
                  disabled={creating}
                  leftSlot={<span>✉️</span>}
                />
              </div>

              <div>
                <label htmlFor="staff-phone" className="mb-1 block text-sm font-medium text-text">
                  Phone number
                </label>
                <GlassInput
                  id="staff-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+961 70 000 000"
                  disabled={creating}
                  leftSlot={<span>📱</span>}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-text">Assigned tables</label>
                <span className="text-xs uppercase tracking-[0.18em] text-muted2">
                  {selectedTableIds.length} selected
                </span>
              </div>
              <div className="rounded-xl2 border border-stroke/70 bg-panel2/30 p-4">
                {tablesLoading ? (
                  <p className="text-sm text-muted">Loading restaurant tables...</p>
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

            {pageError ? (
              <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
                {pageError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-stroke/70 bg-panel2/40 p-4 text-sm text-muted">
              <p>At least one contact method is required. Table assignments control which guest orders the staff member can review.</p>
              <LiquidButton type="submit" tone="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Staff'}
              </LiquidButton>
            </div>
          </form>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard>
            <h3 className="text-lg font-semibold text-text">Access summary</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li>Admins can assign each staff member to one or many tables.</li>
              <li>Staff only see pending confirmations for their assigned tables.</li>
              <li>Admins still keep full access to dishes, ingredients, staff setup, and accounting.</li>
            </ul>
          </GlassCard>

          <GlassCard interactive={false} noise={false}>
            <h3 className="text-lg font-semibold text-text">Latest created staff</h3>
            {createdStaff ? (
              <div className="mt-4 space-y-3 text-sm text-muted">
                <div className="rounded-xl2 border border-sage/35 bg-sage/10 p-4">
                  <p className="text-base font-semibold text-text">{createdStaff.name}</p>
                  <p className="mt-1">Role: {createdStaff.role}</p>
                  <p>Email: {createdStaff.email || 'Not provided'}</p>
                  <p>Phone: {createdStaff.phone || 'Not provided'}</p>
                  <p>Login: {createdStaff.email || createdStaff.phone || 'Use assigned contact'}</p>
                  <p>Temporary password: <span className="font-semibold text-text">{temporaryPassword || 'Unavailable'}</span></p>
                  <p>
                    Tables:
                    {' '}
                    <span className="font-medium text-text">
                      {(createdStaff.assigned_tables ?? []).map((table) => table.name).join(', ') || 'No tables assigned yet'}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted">
                The newly created staff member will appear here after a successful submission.
              </p>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard className="mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold2/80">Assignments</p>
            <h3 className="mt-2 text-xl font-semibold text-text">Current staff table coverage</h3>
          </div>
          <LiquidButton type="button" tone="tertiary" onClick={loadStaffMembers} disabled={staffLoading}>
            {staffLoading ? 'Refreshing...' : 'Refresh Staff'}
          </LiquidButton>
        </div>

        {staffLoading ? (
          <p className="text-sm text-muted">Loading staff assignments...</p>
        ) : staffMembers.length === 0 ? (
          <p className="text-sm text-muted">No staff members yet. Create one above to start assigning tables.</p>
        ) : (
          <div className="space-y-4">
            {staffMembers.map((staff) => {
              const assignedIds = staffAssignments[staff.id] ?? [];
              const assignedNames = assignedIds
                .map((tableId) => tableNameById.get(tableId))
                .filter((tableName): tableName is string => Boolean(tableName));

              return (
                <div key={staff.id} className="rounded-xl2 border border-stroke/70 bg-panel2/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-text">{staff.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {staff.email || staff.phone || 'No login contact saved'}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted2">
                        Assigned now: {assignedNames.join(', ') || 'No tables assigned'}
                      </p>
                    </div>

                    <LiquidButton
                      type="button"
                      tone="primary"
                      onClick={() => handleSaveAssignments(staff)}
                      disabled={savingStaffId === staff.id}
                    >
                      {savingStaffId === staff.id ? 'Saving...' : 'Save Tables'}
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
