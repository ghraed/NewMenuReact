import React, { useEffect, useRef, useState } from 'react';
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

const navIconClass = 'h-4 w-4 fill-none stroke-current';

const NavIcon: React.FC<{ name: string }> = ({ name }) => {
  const pathByName: Record<string, string> = {
    kitchen: 'M4 6h16M6 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M9 10h6M9 14h6',
    receipt: 'M7 3h10v18l-5-3-5 3V3zM9 7h6M9 11h6',
    cart: 'M3 5h2l2.2 10.5a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L21 8H8M10 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01',
    calendar: 'M7 2v3M17 2v3M4 7h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z',
    dashboard: 'M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-5H4v5z',
    tag: 'M20 12l-8 8-9-9V4h7l10 8zM7.5 8.5h.01',
    map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14',
    chart: 'M4 19h16M7 16V9M12 16V5M17 16v-7',
    payroll: 'M12 1v22M3 6h13a4 4 0 1 1 0 8H8a4 4 0 1 0 0 8h13',
    schedule: 'M8 2v3M16 2v3M4 7h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 12h8M8 16h5',
    card: 'M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 0a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2M3 11h18',
    currency: 'M12 2v20M5 7h9a3 3 0 1 1 0 6H10a3 3 0 1 0 0 6h9',
    users: 'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm9 10v-2a4 4 0 0 0-3-3.87M15.5 3.3a4 4 0 0 1 0 7.75',
    plus: 'M12 5v14M5 12h14',
    box: 'M3 8l9-5 9 5-9 5-9-5zm0 0v8l9 5 9-5V8',
    scroll: 'M6 4h11a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3zM8 8h8M8 12h8M8 16h5',
    leaf: 'M4 14c7-1 11-5 14-12 2 8-1 16-9 18-5 1-7-2-5-6z',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-7 10h14M12 2c3 3 4 7 4 10s-1 7-4 10m0-20c-3 3-4 7-4 10s1 7 4 10',
  };
  const d = pathByName[name] ?? pathByName.dashboard;
  return (
    <svg viewBox="0 0 24 24" className={navIconClass} strokeWidth={1.8} aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const lastPathnameRef = useRef(location.pathname);

  const navItems: NavItem[] = user?.role === 'chef'
    ? [
      { path: '/chef/dashboard', label: 'Kitchen Dashboard', icon: 'kitchen' },
    ]
    : user?.role === 'staff'
      ? [
        { path: '/staff/orders', label: t('admin.pendingOrders'), icon: 'receipt', requiredFeatures: ['realtime_staff_orders'] },
        { path: '/staff/pos', label: 'Cashier POS', icon: 'cart', requiredFeatures: ['realtime_staff_orders', 'table_ordering'] },
        { path: '/admin/reservations', label: 'Reservations', icon: 'calendar', requiredFeatures: ['table_reservations'] },
      ]
      : [
        { path: '/admin/dashboard', label: t('admin.dashboard'), icon: 'dashboard' },
        { path: '/admin/profile', label: t('adminDashboard.profileTitle'), icon: 'tag' },
        { path: '/admin/room-plans', label: 'Room Plans', icon: 'map', requiredFeatures: ['room_plan_editor'] },
        { path: '/admin/reservations', label: 'Reservations', icon: 'calendar', requiredFeatures: ['table_reservations'] },
        { path: '/admin/finance', label: 'Finance', icon: 'chart', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
        { path: '/admin/finance/expenses', label: 'Expenses', icon: 'receipt', requiredFeatures: ['finance_dashboard', 'expense_management'] },
        { path: '/admin/finance/payroll', label: 'Payroll', icon: 'payroll', requiredFeatures: ['payroll_management'] },
        { path: '/admin/staff/scheduling', label: 'Staff Schedule', icon: 'schedule', requiredFeatures: ['staff_scheduling'] },
        { path: '/staff/orders', label: t('admin.staffOrders'), icon: 'receipt', requiredFeatures: ['realtime_staff_orders'] },
        { path: '/staff/pos', label: 'Cashier POS', icon: 'cart', requiredFeatures: ['realtime_staff_orders', 'table_ordering'] },
        { path: '/admin/accounting', label: t('admin.accounting'), icon: 'card', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
        { path: '/admin/currency', label: 'Currency', icon: 'currency' },
        { path: '/admin/staff', label: t('admin.staff'), icon: 'users' },
        { path: '/admin/dishes/create', label: t('admin.createDish'), icon: 'plus' },
        { path: '/admin/inventory/ingredients', label: t('admin.inventoryIngredients'), icon: 'box', requiredFeatures: ['inventory'] },
        { path: '/admin/inventory/stock-history', label: t('admin.stockHistory'), icon: 'scroll', requiredFeatures: ['inventory'] },
        { path: '/admin/ingredients/library', label: t('admin.ingredientsLibrary'), icon: 'leaf' },
        { path: '/admin/ingredients/global', label: 'Global Ingredients', icon: 'globe' },
        // { path: '/liquid-glass-preview', label: t('admin.themePreview'), icon: '✨' },
      ];

  const visibleNavItems = navItems.filter((item) => (
    areFeaturesEnabled(user?.restaurant?.feature_flags, item.requiredFeatures)
  ));

  useEffect(() => {
    if (location.pathname !== lastPathnameRef.current) {
      setMobileNavOpen(false);
      lastPathnameRef.current = location.pathname;
    }
  }, [location.pathname]);

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
            {/* <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold2/80">
                {t('admin.navigation')}
              </div> */}
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
                      <span className="inline-flex items-center justify-center text-gold2/95">
                        <NavIcon name={item.icon} />
                      </span>
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
                className="absolute inset-0 h-[100dvh] overflow-y-auto overscroll-contain border-t border-gold/20 bg-gradient-to-b from-bg0 via-bg1 to-bg0 px-5 pb-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
                initial={{ y: '-8%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-6%', opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
                  <div className="sticky top-0 z-10 mb-6 bg-gradient-to-b from-bg0 via-bg1/95 to-transparent pb-2 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold2/85">{t('admin.navigation')}</p>
                  </div>
                  <button
                    type="button"
                    className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[60] inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-stroke bg-bg1/85 text-text shadow-lux2 backdrop-blur transition hover:border-gold/40 lg:hidden"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label={t('common.close', { defaultValue: 'Close' })}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6l-12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </button>
                  <div className="h-12" aria-hidden="true" />
                  <ul className="grid gap-3 pb-[max(env(safe-area-inset-bottom,0px),1rem)] sm:grid-cols-2">
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
                            <span className="inline-flex items-center justify-center text-gold2/95">
                              <NavIcon name={item.icon} />
                            </span>
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
