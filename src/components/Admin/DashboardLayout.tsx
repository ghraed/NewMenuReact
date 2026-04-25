import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/useAuth';
import {
  GlassBoard,
  GlassIconButton,
  LiquidBackground,
  LiquidButton,
} from '../ui/liquid-glass';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = user?.role === 'staff'
    ? [
        { path: '/staff/orders', label: t('admin.pendingOrders'), icon: '🧾' },
      ]
    : [
        { path: '/admin/dashboard', label: t('admin.dashboard'), icon: '📊' },
        { path: '/admin/finance', label: 'Finance', icon: '📈' },
        { path: '/staff/orders', label: t('admin.staffOrders'), icon: '🧾' },
        { path: '/admin/accounting', label: t('admin.accounting'), icon: '💳' },
        { path: '/admin/currency', label: 'Currency', icon: '💱' },
        { path: '/admin/staff', label: t('admin.staff'), icon: '👥' },
        { path: '/admin/dishes/create', label: t('admin.createDish'), icon: '➕' },
        { path: '/admin/inventory/ingredients', label: t('admin.inventoryIngredients'), icon: '📦' },
        { path: '/admin/inventory/stock-history', label: t('admin.stockHistory'), icon: '📜' },
        { path: '/admin/ingredients/library', label: t('admin.ingredientsLibrary'), icon: '🥬' },
        { path: '/admin/ingredients/global', label: 'Global Ingredients', icon: '🌐' },
        { path: '/liquid-glass-preview', label: t('admin.themePreview'), icon: '✨' },
      ];

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-gold/30 bg-gold/10 p-2 text-lg">🍽️</div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold2/85">{t('admin.controlRoom')}</p>
                <h1 className="text-2xl font-semibold text-text">
                  {user?.role === 'staff' ? t('admin.staffTitle') : t('admin.adminTitle')}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/30 bg-bg1/70 text-lg text-text shadow-lux2 transition hover:border-gold/60 lg:hidden"
                aria-label={t('admin.navigation')}
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((previous) => !previous)}
              >
                ☰
              </button>
              <a href="/" target="_blank" rel="noreferrer">
                <GlassIconButton aria-label={t('admin.guestView')}>👁️</GlassIconButton>
              </a>
              <LiquidButton tone="tertiary" onClick={handleLogout} className="px-4 py-2 text-sm">
                {t('admin.logout')}
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        <div className="mb-6 hidden lg:block">
          <GlassBoard className="sticky top-4 z-40 p-3">
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold2/80">
              {t('admin.navigation')}
            </div>
            <ul className="flex min-w-0 items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <li key={item.path} className="min-w-0 flex-1">
                    <Link
                      to={item.path}
                      className={`group flex w-full items-center justify-center rounded-full px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition xl:text-[11px] ${
                        isActive
                          ? 'bg-gold/80 text-bg0 shadow-[0_12px_28px_rgba(215,180,106,0.3)]'
                          : 'border border-stroke bg-bg1/70 text-muted hover:border-gold/35 hover:text-text'
                      }`}
                    >
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </GlassBoard>
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute right-3 top-3 w-[min(92vw,360px)]">
              <GlassBoard className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold2/85">{t('admin.navigation')}</p>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-text transition hover:border-gold/40"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <ul className="space-y-2">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition ${
                            isActive
                              ? 'border border-gold/35 bg-gold/15 text-gold2'
                              : 'border border-stroke bg-bg1/65 text-text hover:border-gold/30'
                          }`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </GlassBoard>
            </div>
          </div>
        ) : null}

        <div>
          <GlassBoard className="overflow-visible p-0">
            <div className="border-b border-stroke px-6 py-4">
              <h1 className="text-2xl font-semibold text-text">{title}</h1>
            </div>
            <div className="p-6">{children}</div>
          </GlassBoard>
          </div>
      </div>
    </LiquidBackground>
  );
};

export default DashboardLayout;
