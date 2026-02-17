import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { GlassChip, GlassSurface, LiquidBackground, LiquidButton } from '../ui/liquid-glass';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/dishes/create', label: 'Create Dish', icon: '➕' },
    { path: '/admin/theme-demo', label: 'Theme Demo', icon: '🫧' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <GlassSurface className="mb-6 px-5 py-4" iridescent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🍽️</div>
              <h1 className="text-2xl font-bold text-lg-text">AR Menu Admin</h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/45 bg-white/35 px-4 py-2 text-sm text-lg-text backdrop-blur-xl transition hover:bg-white/55"
              >
                Guest View
              </a>
              <LiquidButton tone="neutral" onClick={handleLogout}>
                Logout
              </LiquidButton>
            </div>
          </div>
        </GlassSurface>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <GlassSurface className="p-4">
              <h2 className="mb-4 px-1 text-sm font-semibold text-lg-muted">Navigation</h2>
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/45 bg-white/30 px-3 py-2 text-sm text-lg-text backdrop-blur-xl transition hover:bg-white/50"
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <GlassChip active={isActive}>{isActive ? 'Active' : 'Open'}</GlassChip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </GlassSurface>
          </div>

          <div className="lg:col-span-3">
            <GlassSurface className="overflow-hidden" sheen={false}>
              <div className="border-b border-white/45 bg-white/30 px-6 py-4">
                <h1 className="text-2xl font-bold text-lg-text">{title}</h1>
              </div>
              <div className="p-6">{children}</div>
            </GlassSurface>
          </div>
        </div>
      </div>
    </LiquidBackground>
  );
};

export default DashboardLayout;
