import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  GlassBoard,
  GlassIconButton,
  GlassInput,
  GlassPill,
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
  const { login, isAuthenticated } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin@example.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modern, setModern] = useState(document.body.classList.contains('modern'));

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const toggleModern = () => {
    document.body.classList.toggle('modern');
    setModern(document.body.classList.contains('modern'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      showToast('Successfully signed in', 'primary');
      navigate('/admin/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LiquidBackground>
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassBoard className="w-full max-w-md" modern={modern}>
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2">
              <GlassIconButton modern={modern}>🍽️</GlassIconButton>
              <GlassPill onClick={toggleModern} modern={modern} className="text-xs">{modern ? 'NEW' : 'OLD'}</GlassPill>
            </div>
            <h1 className="text-3xl font-bold text-lg-text">AR Menu Admin</h1>
            <p className="mt-2 text-sm text-slate-700/70">Login to manage dishes and 3D models</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-lg-text">
                Email
              </label>
              <GlassInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                leftSlot={<span>✉️</span>}
                modern={modern}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-lg-text">
                Password
              </label>
              <GlassInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                leftSlot={<span>🔒</span>}
                modern={modern}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200/80 bg-red-100/60 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <LiquidButton type="submit" className="w-full" disabled={loading} modern={modern}>
              {loading ? 'Logging in...' : 'Login'}
            </LiquidButton>
          </form>
        </GlassBoard>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default LoginPage;
