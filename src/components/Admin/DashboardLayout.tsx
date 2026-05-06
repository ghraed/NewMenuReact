import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/useAuth';
import { areFeaturesEnabled } from '../../utils/features';
import RestaurantBrandMark from '../Common/RestaurantBrandMark';
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

type NavItem = {
  path: string;
  label: string;
  icon: string;
  requiredFeatures?: string[];
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems: NavItem[] = user?.role === 'chef'
    ? [
      { path: '/chef/dashboard', label: 'Kitchen Dashboard', icon: '👨‍🍳' },
    ]
    : user?.role === 'staff'
      ? [
        { path: '/staff/orders', label: t('admin.pendingOrders'), icon: '🧾', requiredFeatures: ['realtime_staff_orders'] },
        { path: '/staff/pos', label: 'Cashier POS', icon: '🛒', requiredFeatures: ['realtime_staff_orders', 'table_ordering'] },
        { path: '/admin/reservations', label: 'Reservations', icon: '📅', requiredFeatures: ['table_reservations'] },
      ]
      : [
        { path: '/admin/dashboard', label: t('admin.dashboard'), icon: '📊' },
        { path: '/admin/profile', label: t('adminDashboard.profileTitle'), icon: '🏷️' },
        { path: '/admin/room-plans', label: 'Room Plans', icon: '🗺️', requiredFeatures: ['room_plan_editor'] },
        { path: '/admin/reservations', label: 'Reservations', icon: '📅', requiredFeatures: ['table_reservations'] },
        { path: '/admin/finance', label: 'Finance', icon: '📈', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
        { path: '/admin/finance/payroll', label: 'Payroll', icon: '💼', requiredFeatures: ['payroll_management'] },
        { path: '/staff/orders', label: t('admin.staffOrders'), icon: '🧾', requiredFeatures: ['realtime_staff_orders'] },
        { path: '/staff/pos', label: 'Cashier POS', icon: '🛒', requiredFeatures: ['realtime_staff_orders', 'table_ordering'] },
        { path: '/admin/accounting', label: t('admin.accounting'), icon: '💳', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
        { path: '/admin/currency', label: 'Currency', icon: '💱' },
        { path: '/admin/staff', label: t('admin.staff'), icon: '👥' },
        { path: '/admin/staff/scheduling', label: 'Staff Schedule', icon: '🗓️', requiredFeatures: ['staff_scheduling'] },
        { path: '/admin/dishes/create', label: t('admin.createDish'), icon: '➕' },
        { path: '/admin/inventory/ingredients', label: t('admin.inventoryIngredients'), icon: '📦', requiredFeatures: ['inventory'] },
        { path: '/admin/inventory/stock-history', label: t('admin.stockHistory'), icon: '📜', requiredFeatures: ['inventory'] },
        { path: '/admin/ingredients/library', label: t('admin.ingredientsLibrary'), icon: '🥬' },
        { path: '/admin/ingredients/global', label: 'Global Ingredients', icon: '🌐' },
        { path: '/liquid-glass-preview', label: t('admin.themePreview'), icon: '✨' },
      ];

  const visibleNavItems = navItems.filter((item) => (
    areFeaturesEnabled(user?.restaurant?.feature_flags, item.requiredFeatures)
  ));

  useEffect(() => {
    if (!mobileNavOpen || typeof window === 'undefined') {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      setMobileNavOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [location.pathname, mobileNavOpen]);

  const handleLogout = async () => {
    await logout();
    if (typeof window !== 'undefined') {
      window.location.replace('/admin/login');
      return;
    }
    navigate('/admin/login', { replace: true });
  };

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <RestaurantBrandMark
                name={user?.restaurant?.name}
                logoUrl={user?.restaurant?.logo_url}
                className="h-11 w-11"
                fallbackClassName="text-base"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold2/85">{t('admin.controlRoom')}</p>
                <h1 className="text-2xl font-semibold text-text">
                  {user?.role === 'chef' ? 'Kitchen Team'
                    : user?.role === 'staff' ? t('admin.staffTitle')
                      : t('admin.adminTitle')}
                </h1>
                <p className="text-xs text-muted">{user?.restaurant?.name || t('admin.dashboard')}</p>
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

        <div className="sticky top-4 z-[70] mb-6 hidden lg:block">
            <GlassBoard className="p-3">
              <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold2/80">
                {t('admin.navigation')}
              </div>
              <ul className="flex min-w-0 flex-nowrap items-center justify-between gap-1">
                {visibleNavItems.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <li key={item.path} className="relative shrink-0">
                      <Link
                        to={item.path}
                        aria-label={item.label}
                        className={`group relative flex h-11 w-11 items-center justify-center rounded-full text-base transition ${isActive
                            ? 'bg-gold/80 text-bg0 shadow-[0_12px_28px_rgba(215,180,106,0.3)]'
                            : 'border border-stroke bg-bg1/70 text-muted hover:border-gold/35 hover:text-text'
                          }`}
                      >
                        <span>{item.icon}</span>
                        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-gold/25 bg-bg1/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold2 opacity-0 shadow-lux2 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </GlassBoard>
        </div>

        <AnimatePresence>
          {mobileNavOpen ? (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <button
                type="button"
                aria-label="Close navigation"
                className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
                onClick={() => setMobileNavOpen(false)}
              />
              <motion.aside
                className="absolute inset-0 border-t border-gold/20 bg-gradient-to-b from-bg0 via-bg1 to-bg0 p-5"
                initial={{ y: '-8%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-6%', opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
                  <div className="mb-6 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold2/85">{t('admin.navigation')}</p>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-bg1/70 text-text transition hover:border-gold/40"
                      onClick={() => setMobileNavOpen(false)}
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {visibleNavItems.map((item, index) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <motion.li
                          key={item.path}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                        >
                          <Link
                            to={item.path}
                            className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm transition ${isActive
                                ? 'border border-gold/35 bg-gold/15 text-gold2'
                                : 'border border-stroke bg-bg1/65 text-text hover:border-gold/30'
                              }`}
                          >
                            <span className="text-base">{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

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
