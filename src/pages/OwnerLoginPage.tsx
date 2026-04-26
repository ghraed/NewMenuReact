import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerAuth } from '../contexts/useOwnerAuth';
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

const OwnerLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useOwnerAuth();
  const { toast, showToast, dismiss } = useGlassToast();

  const [email, setEmail] = useState('raed@rozer.fun');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/owner/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      showToast('Welcome back, owner.', 'primary');
      navigate('/owner/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Owner login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LiquidBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <GlassBoard className="w-full max-w-lg">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Private Owner Access</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">SaaS Owner Control</h1>
            <p className="mt-2 text-sm text-muted">
              This portal is restricted to the platform owner and is not visible in tenant admin navigation.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="owner-email" className="mb-1 block text-sm font-medium text-text">
                Owner Email
              </label>
              <GlassInput
                id="owner-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="owner-password" className="mb-1 block text-sm font-medium text-text">
                Password
              </label>
              <GlassInput
                id="owner-password"
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
              {loading ? 'Signing in...' : 'Sign in as Owner'}
            </LiquidButton>
          </form>
        </GlassBoard>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default OwnerLoginPage;
