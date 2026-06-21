import React, { useEffect, useState } from 'react';
import { useSuperAdminAuth } from '../contexts/useSuperAdminAuth';
import { useAuth } from '../contexts/useAuth';
import { getDefaultRouteForRole } from '../utils/auth';
import {
  GlassBoard,
  GlassInput,
  GlassToast,
  LiquidBackground,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const SuperAdminLoginPage: React.FC = () => {
  const { login, isAuthenticated } = useSuperAdminAuth();
  const { isAuthenticated: isAdminSessionAuthenticated, user: adminSessionUser } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();

  const [email, setEmail] = useState('raed@rozer.fun');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminSessionAuthenticated) {
      window.location.replace(getDefaultRouteForRole(adminSessionUser?.role));
      return;
    }

    if (isAuthenticated) {
      window.location.replace('/super-admin/dashboard');
    }
  }, [adminSessionUser?.role, isAdminSessionAuthenticated, isAuthenticated]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      showToast('Welcome back, Super Admin.', 'primary');
      window.location.replace('/super-admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Super Admin login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LiquidBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <GlassBoard className="w-full max-w-lg">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Private Super Admin Access</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">Super Admin Control</h1>
            <p className="mt-2 text-sm text-muted">
              This portal is restricted to the Super Admin and is not visible in tenant admin navigation.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="super-admin-email" className="mb-1 block text-sm font-medium text-text">
                Super Admin Email
              </label>
              <GlassInput
                id="super-admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="super-admin-password" className="mb-1 block text-sm font-medium text-text">
                Password
              </label>
              <GlassInput
                id="super-admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 px-3 py-2 text-sm text-spicy">
                {error}
              </div>
            ) : null}

            <LiquidButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in as Super Admin'}
            </LiquidButton>
          </form>
        </GlassBoard>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default SuperAdminLoginPage;
