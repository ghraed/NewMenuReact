import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/useAuth';
import { areFeaturesEnabled } from '../../utils/features';
import RestaurantBrandMark from '../Common/RestaurantBrandMark';
import { useAppTheme } from '../../hooks/useGuestTheme';
import { GlassIconButton, LiquidBackground, LiquidButton } from '../ui/liquid-glass';

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
const NAV_COLLAPSED_WIDTH = 88;
const NAV_EXPANDED_WIDTH = 280;

const NavIcon: React.FC<{ name: string }> = ({ name }) => {
  const pathByName: Record<string, string> = {
    kitchen: 'M4 6h16M6 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M9 10h6M9 14h6',
    receipt: 'M7 3h10v18l-5-3-5 3V3zM9 7h6M9 11h6',
    cart: 'M3 5h2l2.2 10.5a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L21 8H8M10 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01',
    calendar: 'M7 2v3M17 2v3M4 7h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z',
    dashboard: 'M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-5H4v5z',
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

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className={navIconClass} strokeWidth={1.8} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.75v2.5M12 18.75v2.5M4.75 12h-2.5M21.75 12h-2.5M5.88 5.88 4.1 4.1M19.9 19.9l-1.78-1.78M18.12 5.88 19.9 4.1M4.1 19.9l1.78-1.78" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className={navIconClass} strokeWidth={1.8} aria-hidden="true">
    <path d="M20.3 14.1A8.7 8.7 0 1 1 9.9 3.7a7.1 7.1 0 0 0 10.4 10.4Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navHovered, setNavHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  ));
  const [showTopScrollCue, setShowTopScrollCue] = useState(false);
  const [showBottomScrollCue, setShowBottomScrollCue] = useState(false);
  const lastPathnameRef = useRef(location.pathname);
  const navScrollRef = useRef<HTMLDivElement | null>(null);

  const navExpanded = navHovered;
  const contentLeftOffset = isDesktop
    ? NAV_COLLAPSED_WIDTH + (navExpanded ? NAV_EXPANDED_WIDTH - NAV_COLLAPSED_WIDTH : 0)
    : 0;

  const navItems: NavItem[] = user?.role === 'chef'
    ? [
      { path: '/admin/dashboard', label: t('admin.dashboard'), icon: 'dashboard' },
      { path: '/admin/dishes/create', label: t('admin.createDish'), icon: 'plus' },
      { path: '/chef/dashboard', label: 'Kitchen Dashboard', icon: 'kitchen' },
      { path: '/admin/events', label: 'Event Planner', icon: 'calendar', requiredFeatures: ['event_reservations'] },
    ]
    : user?.role === 'accountant'
      ? [
        { path: '/admin/accounting', label: t('admin.accounting'), icon: 'card', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
        { path: '/admin/finance', label: 'Finance', icon: 'chart', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
        { path: '/admin/finance/expenses', label: 'Expenses', icon: 'receipt', requiredFeatures: ['finance_dashboard', 'expense_management'] },
        { path: '/admin/finance/payroll', label: 'Payroll', icon: 'payroll', requiredFeatures: ['payroll_management'] },
        { path: '/admin/currency', label: 'Currency', icon: 'currency' },
      ]
      : user?.role === 'stock_manager'
        ? [
          { path: '/admin/dashboard', label: t('admin.dashboard'), icon: 'dashboard' },
          { path: '/admin/dishes/create', label: t('admin.createDish'), icon: 'plus' },
          { path: '/admin/events', label: 'Event Planner', icon: 'calendar', requiredFeatures: ['event_reservations'] },
          { path: '/admin/inventory/ingredients', label: t('admin.inventoryIngredients'), icon: 'box', requiredFeatures: ['inventory'] },
          { path: '/admin/inventory/stock-history', label: t('admin.stockHistory'), icon: 'scroll', requiredFeatures: ['inventory'] },
        ]
        : user?.role === 'staff'
          ? [
            { path: '/staff/orders', label: t('admin.pendingOrders'), icon: 'receipt' },
            { path: '/admin/reservations', label: 'Reservations', icon: 'calendar' },
          ]
          : [
            { path: '/admin/dashboard', label: t('admin.dashboard'), icon: 'dashboard' },
            { path: '/admin/room-plans', label: 'Room Plans', icon: 'map', requiredFeatures: ['room_plan_editor'] },
            { path: '/admin/reservations', label: 'Reservations', icon: 'calendar', requiredFeatures: ['table_reservations'] },
            { path: '/admin/events', label: 'Event Planner', icon: 'calendar', requiredFeatures: ['event_reservations'] },
            { path: '/admin/accounting', label: t('admin.accounting'), icon: 'card', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
            { path: '/admin/finance', label: 'Finance', icon: 'chart', requiredFeatures: ['finance_dashboard', 'dish_profitability'] },
            { path: '/admin/finance/expenses', label: 'Expenses', icon: 'receipt', requiredFeatures: ['finance_dashboard', 'expense_management'] },
            { path: '/admin/finance/payroll', label: 'Payroll', icon: 'payroll', requiredFeatures: ['payroll_management'] },
            { path: '/admin/staff', label: t('admin.staff'), icon: 'users' },
            { path: '/admin/staff/scheduling', label: 'Staff Schedule', icon: 'schedule', requiredFeatures: ['staff_scheduling'] },
            { path: '/staff/orders', label: t('admin.staffOrders'), icon: 'receipt', requiredFeatures: ['realtime_staff_orders'] },
            { path: '/staff/pos', label: 'Cashier POS', icon: 'cart', requiredFeatures: ['realtime_staff_orders', 'table_ordering'] },
            { path: '/admin/currency', label: 'Currency', icon: 'currency' },
            { path: '/admin/dishes/create', label: t('admin.createDish'), icon: 'plus' },
            { path: '/admin/inventory/ingredients', label: t('admin.inventoryIngredients'), icon: 'box', requiredFeatures: ['inventory'] },
            { path: '/admin/inventory/stock-history', label: t('admin.stockHistory'), icon: 'scroll', requiredFeatures: ['inventory'] },
            { path: '/admin/ingredients/library', label: t('admin.ingredientsLibrary'), icon: 'leaf' },
            { path: '/admin/ingredients/global', label: 'Global Ingredients', icon: 'globe' },
          ];

  const visibleNavItems = useMemo(() => navItems.filter((item) => (
    areFeaturesEnabled(user?.restaurant?.feature_flags, item.requiredFeatures)
  )), [navItems, user?.restaurant?.feature_flags]);

  const activeLanguage = (i18n.resolvedLanguage || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';

  useEffect(() => {
    document.documentElement.style.setProperty('--admin-content-left', `${contentLeftOffset}px`);
  }, [contentLeftOffset]);

  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== lastPathnameRef.current) {
      setMobileNavOpen(false);
      lastPathnameRef.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    const element = navScrollRef.current;
    if (!element || !navExpanded) {
      setShowTopScrollCue(false);
      setShowBottomScrollCue(false);
      return;
    }

    const updateScrollCue = () => {
      const maxScrollTop = element.scrollHeight - element.clientHeight;
      const nextTop = element.scrollTop > 6;
      const nextBottom = maxScrollTop - element.scrollTop > 6;
      setShowTopScrollCue(nextTop);
      setShowBottomScrollCue(nextBottom);
    };

    updateScrollCue();
    element.addEventListener('scroll', updateScrollCue, { passive: true });
    window.addEventListener('resize', updateScrollCue);
    return () => {
      element.removeEventListener('scroll', updateScrollCue);
      window.removeEventListener('resize', updateScrollCue);
    };
  }, [navExpanded, visibleNavItems.length]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const toggleLanguage = () => {
    const nextLanguage = activeLanguage === 'en' ? 'ar' : 'en';
    void i18n.changeLanguage(nextLanguage);
  };

  const roleLabel = user?.role === 'chef'
    ? 'Kitchen Team'
    : user?.role === 'accountant'
      ? 'Accounting Team'
      : user?.role === 'stock_manager'
        ? 'Stock Manager'
        : user?.role === 'staff'
          ? t('admin.staffTitle')
          : t('admin.adminTitle');

  const renderNav = (isMobile = false) => (
    <ul className={isMobile ? 'space-y-1' : 'space-y-0.5'}>
      {visibleNavItems.map((item) => {
        const isActive = location.pathname === item.path;

        return (
          <li key={item.path}>
            <Link
              to={item.path}
              title={!isMobile && !navExpanded ? item.label : undefined}
              className={[
                'flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors',
                !isMobile && !navExpanded ? 'justify-center px-0' : '',
                isActive ? 'bg-gold/22 text-text' : 'text-muted hover:bg-bg1 hover:text-text',
              ].join(' ')}
            >
              <span className={[
                'inline-flex h-8 w-8 items-center justify-center rounded-full',
                isActive ? 'bg-gold/28 text-gold2' : 'bg-bg1/75 text-muted2',
              ].join(' ')}>
                <NavIcon name={item.icon} />
              </span>
              {isMobile || navExpanded ? <span className="truncate transition-all duration-200 ease-out">{item.label}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <LiquidBackground>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen border-r border-stroke bg-bg1 transition-[width] duration-300 ease-fluid lg:flex lg:flex-col"
        style={{ width: navExpanded ? NAV_EXPANDED_WIDTH : NAV_COLLAPSED_WIDTH }}
        onMouseEnter={() => setNavHovered(true)}
        onMouseLeave={() => setNavHovered(false)}
      >
        <div className="border-b border-stroke px-3 py-4">
          <div className={['flex items-center gap-3', navExpanded ? '' : 'justify-center'].join(' ')}>
            <RestaurantBrandMark
              name={user?.restaurant?.name}
              logoUrl={user?.restaurant?.logo_url}
              className="h-10 w-10"
              fallbackClassName="text-sm"
            />
            {navExpanded ? (
              <div className="min-w-0 animate-[fade-in_180ms_ease-out]">
                <p className="truncate text-xs font-semibold text-gold2/90">{roleLabel}</p>
                <p className="truncate text-xs text-muted">{user?.restaurant?.name || t('admin.dashboard')}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          {showTopScrollCue ? (
            <div className="pointer-events-none absolute inset-x-2 top-0 z-20 flex h-10 items-start justify-center bg-gradient-to-b from-bg1 via-bg1/80 to-transparent pt-1">
              <span className="text-[10px] font-semibold tracking-[0.08em] text-gold2/80">˄</span>
            </div>
          ) : null}

          <div
            ref={navScrollRef}
            className={[
              'min-h-0 h-full px-2 py-3',
              navExpanded ? 'overflow-y-auto no-scrollbar' : 'overflow-hidden',
            ].join(' ')}
          >
            {renderNav()}
          </div>

          {showBottomScrollCue ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-0 z-20 flex h-11 items-end justify-center bg-gradient-to-t from-bg1 via-bg1/86 to-transparent pb-1">
              <span className="animate-bounce text-[10px] font-semibold tracking-[0.08em] text-gold2/80">˅</span>
            </div>
          ) : null}
        </div>

        <div className="border-t border-stroke px-2 py-3">
          <LiquidButton tone="tertiary" onClick={handleLogout} className={navExpanded ? 'w-full' : 'w-full px-0'}>
            {navExpanded ? t('admin.logout') : '⎋'}
          </LiquidButton>
        </div>
      </aside>

      <div className="min-h-screen" style={{ marginLeft: isDesktop ? NAV_COLLAPSED_WIDTH : 0 }}>
        <div
          className="transition-[margin-left] duration-300 ease-fluid"
          style={{ marginLeft: isDesktop && navExpanded ? NAV_EXPANDED_WIDTH - NAV_COLLAPSED_WIDTH : 0 }}
        >
          <header className="sticky top-0 z-30 border-b border-stroke bg-bg0/92 backdrop-blur">
            <div className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-bg1 text-text lg:hidden"
                aria-label={t('admin.navigation')}
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((previous) => !previous)}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-text">{title}</p>
                <p className="truncate text-xs text-muted">{t('admin.controlRoom')}</p>
              </div>

              <a href="/" target="_blank" rel="noreferrer" className="hidden sm:block">
                <GlassIconButton aria-label={t('admin.guestView')}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </GlassIconButton>
              </a>

              <button
                type="button"
                aria-label={`Language: ${activeLanguage.toUpperCase()}`}
                onClick={toggleLanguage}
                className="inline-flex h-10 min-w-[3.1rem] items-center justify-center rounded-full border border-stroke bg-bg1 px-3 text-xs font-semibold tracking-[0.08em] text-text"
              >
                {activeLanguage === 'en' ? 'EN' : 'AR'}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'light' ? t('theme.switchToDark') : t('theme.switchToLight')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-bg1 text-gold"
              >
                {theme === 'light' ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </header>

          <main className="p-3 sm:p-5">
            <section className="rounded-3xl border border-stroke bg-bg1 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.24)] sm:p-6">
              {children}
            </section>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/46"
              onClick={() => setMobileNavOpen(false)}
            />

            <motion.aside
              className="absolute left-0 top-0 flex h-full w-[86vw] max-w-[320px] flex-col border-r border-stroke bg-bg1 p-3"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-text">{t('admin.navigation')}</p>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label={t('common.close', { defaultValue: 'Close' })}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  </svg>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">{renderNav(true)}</div>

              <div className="mt-3 border-t border-stroke pt-3">
                <LiquidButton tone="tertiary" onClick={handleLogout} className="w-full">
                  {t('admin.logout')}
                </LiquidButton>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </LiquidBackground>
  );
};

export default DashboardLayout;
