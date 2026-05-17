import React, { useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';

type UserProfileForm = {
  name: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const AdminUserProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);

  const initialForm = useMemo<UserProfileForm>(() => ({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    password: '',
    passwordConfirm: '',
  }), [user?.name, user?.phone, user?.email]);

  const [form, setForm] = useState<UserProfileForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof UserProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);

    const nextName = form.name.trim();
    const nextPhone = form.phone.trim();
    const nextPassword = form.password.trim();
    const nextPasswordConfirm = form.passwordConfirm.trim();

    if (!nextName) {
      setError('Name is required.');
      return;
    }

    if (nextPassword || nextPasswordConfirm) {
      if (nextPassword.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (nextPassword !== nextPasswordConfirm) {
        setError('Password and confirmation must match.');
        return;
      }
    }

    const payload: Record<string, string | null> = {
      name: nextName,
      phone: nextPhone || null,
    };

    if (nextPassword) {
      payload.password = nextPassword;
      payload.password_confirmation = nextPasswordConfirm;
    }

    setSaving(true);
    try {
      try {
        await api.patch('/auth/me', payload);
      } catch (firstError: unknown) {
        const status = typeof firstError === 'object' && firstError !== null && 'response' in firstError
          ? (firstError as { response?: { status?: number } }).response?.status
          : null;

        if (status === 404 || status === 405) {
          await api.put('/auth/me', payload);
        } else {
          throw firstError;
        }
      }

      await refreshUser();
      setForm((current) => ({
        ...current,
        password: '',
        passwordConfirm: '',
      }));
      showToast('Profile updated successfully.', 'secondary', 4200);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="My Profile">
      <GlassCard>
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted2">User Profile</h3>
          <p className="mt-1 text-xs text-muted">Manage your account details securely.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">Full Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="Enter your full name"
              disabled={saving}
              className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text"
            />
          </div>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">Email</span>
            <input
              type="email"
              value={form.email}
              disabled
              className="w-full cursor-not-allowed rounded-2xl border border-stroke bg-bg1/55 px-4 py-2.5 text-sm text-muted opacity-80"
            />
            <span className="mt-1 block text-[11px] text-muted">Email cannot be changed.</span>
          </div>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">Phone</span>
            <input
              type="text"
              value={form.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
              placeholder="Enter your phone number"
              disabled={saving}
              className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text"
            />
          </div>

          <div className="hidden md:block" />

          <div className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">New Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => handleChange('password', event.target.value)}
              placeholder="Minimum 8 characters"
              disabled={saving}
              className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text"
            />
          </div>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">Confirm Password</span>
            <input
              type="password"
              value={form.passwordConfirm}
              onChange={(event) => handleChange('passwordConfirm', event.target.value)}
              placeholder="Re-enter password"
              disabled={saving}
              className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm text-text"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-spicy/35 bg-spicy/12 px-3 py-2 text-sm text-spicy">{error}</div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <LiquidButton tone="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </LiquidButton>
        </div>
      </GlassCard>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminUserProfilePage;
