import React, { useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { useAuth } from '../contexts/useAuth';
import { createStaffMember } from '../services/staffService';
import type { StaffMember } from '../types';
import {
  GlassCard,
  GlassInput,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

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

const AdminStaffPage: React.FC = () => {
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [createdStaff, setCreatedStaff] = useState<StaffMember | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName) {
      setError('Staff name is required.');
      return;
    }

    if (!normalizedEmail && !normalizedPhone) {
      setError('Add either an email address or a phone number.');
      return;
    }

    setLoading(true);

    try {
      const response = await createStaffMember({
        name: normalizedName,
        email: normalizedEmail || undefined,
        phone: normalizedPhone || undefined,
      });

      setCreatedStaff(response.staff);
      setTemporaryPassword(response.temporary_password);
      setName('');
      setEmail('');
      setPhone('');
      showToast(response.message || 'Staff member created.', 'primary');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create staff member'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Staff Management">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <GlassCard>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-gold2/80">Restaurant Team</p>
            <h2 className="mt-2 text-2xl font-semibold text-text">Create a staff account</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Add a team member who can sign in and confirm guest orders for
              {' '}
              <span className="font-medium text-text">{user?.restaurant?.name ?? 'your restaurant'}</span>.
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
                disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                  leftSlot={<span>📱</span>}
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-stroke/70 bg-panel2/40 p-4 text-sm text-muted">
              <p>At least one contact method is required so the staff member can be identified and onboarded.</p>
              <LiquidButton type="submit" tone="primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Staff'}
              </LiquidButton>
            </div>
          </form>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard>
            <h3 className="text-lg font-semibold text-text">Access summary</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li>Staff can log in and access `/staff/orders` to confirm or cancel guest table orders.</li>
              <li>Staff should not get admin dish-management routes.</li>
              <li>Admins still keep full access to dishes, ingredients, staff setup, and accounting.</li>
            </ul>
          </GlassCard>

          <GlassCard>
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

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminStaffPage;
