import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/useAuth';
import { getDefaultRouteForRole } from '../utils/auth';
import {
  GlassBoard,
  GlassIconButton,
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

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();
  const { t } = useTranslation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRouteForRole(user?.role), { replace: true });
    }
  }, [isAuthenticated, navigate, user?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const nextUser = await login(identifier, password);
      showToast(t('login.success'), 'primary');
      const nextRoute = getDefaultRouteForRole(nextUser.role);
      if (typeof window !== 'undefined') {
        window.location.replace(nextRoute);
      } else {
        navigate(nextRoute, { replace: true });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('login.failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LiquidBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <GlassBoard className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stroke bg-panel2 px-3 py-2">
              <GlassIconButton aria-hidden="true">🍽️</GlassIconButton>
              <span className="text-xs uppercase tracking-[0.2em] text-gold2/90">{t('login.badge')}</span>
            </div>
            <h1 className="text-3xl font-semibold text-text">{t('login.title')}</h1>
            <p className="mt-2 text-sm text-muted">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="mb-1 block text-sm font-medium text-text">
                {t('login.identifier')}
              </label>
              <GlassInput
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                leftSlot={<span>✉️</span>}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-text">
                {t('login.password')}
              </label>
              <GlassInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                leftSlot={<span>🔒</span>}
              />
            </div>

            {error && (
              <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
                {error}
              </div>
            )}

            <LiquidButton type="submit" className="w-full" disabled={loading}>
              {loading ? t('login.submitting') : t('login.submit')}
            </LiquidButton>
          </form>
        </GlassBoard>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default LoginPage;
