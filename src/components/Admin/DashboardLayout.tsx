import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/useAuth';
import {
  GlassBoard,
  GlassIconButton,
  GlassPill,
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

  const navItems = user?.role === 'staff'
    ? [
        { path: '/staff/orders', label: t('admin.pendingOrders'), icon: '🧾' },
      ]
    : [
        { path: '/admin/dashboard', label: t('admin.dashboard'), icon: '📊' },
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
              <a href="/" target="_blank" rel="noreferrer">
                <GlassIconButton aria-label={t('admin.guestView')}>👁️</GlassIconButton>
              </a>
              <LiquidButton tone="tertiary" onClick={handleLogout} className="px-4 py-2 text-sm">
                {t('admin.logout')}
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <GlassBoard className="p-4">
              <h2 className="mb-4 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted2">{t('admin.navigation')}</h2>
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <li key={item.path}>
                      <Link to={item.path} className="flex w-full items-center justify-between gap-2 rounded-[26px] px-2 py-1.5">
                        <span className="flex items-center gap-2 text-sm text-text">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <GlassPill active={isActive} className="px-2.5 py-1 text-[11px]">
                          {isActive ? t('admin.active') : t('admin.open')}
                        </GlassPill>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </GlassBoard>
          </div>

          <div className="lg:col-span-3">
            <GlassBoard className="overflow-visible p-0">
              <div className="border-b border-stroke px-6 py-4">
                <h1 className="text-2xl font-semibold text-text">{title}</h1>
              </div>
              <div className="p-6">{children}</div>
            </GlassBoard>
          </div>
        </div>
      </div>
    </LiquidBackground>
  );
};

export default DashboardLayout;
