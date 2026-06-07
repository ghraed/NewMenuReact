import React, { Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import GuestDishListPage from './pages/GuestDishListPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminRestaurantProfilePage from './pages/AdminRestaurantProfilePage';
import AdminUserProfilePage from './pages/AdminUserProfilePage';
import CreateDishPage from './pages/CreateDishPage';
import EditDishPage from './pages/EditDishPage';
import IngredientLibrary from './pages/IngredientLibrary';
import GlobalIngredientsPage from './pages/GlobalIngredientsPage';
import AdminIngredientsPage from './pages/AdminIngredientsPage';
import AdminStockHistoryPage from './pages/AdminStockHistoryPage';
import AdminIngredientTrackerPage from './pages/AdminIngredientTrackerPage';
import AdminDishPage from './pages/AdminDishPage';
import StaffOrdersPage from './pages/StaffOrdersPage';
import TodayOrdersPage from './pages/TodayOrdersPage';
import TodayOrderDetailsPage from './pages/TodayOrderDetailsPage';
import CashierPosPage from './pages/CashierPosPage';
import ChefDashboardPage from './pages/ChefDashboardPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AccountingOrdersPage from './pages/AccountingOrdersPage';
import AdminCurrencyPage from './pages/AdminCurrencyPage';
import AdminFinanceDashboardPage from './pages/AdminFinanceDashboardPage';
import AdminFinanceExpensesPage from './pages/AdminFinanceExpensesPage';
import AdminFinanceInvoiceDetailsPage from './pages/AdminFinanceInvoiceDetailsPage';
import AdminPayrollManagementPage from './pages/AdminPayrollManagementPage';
import AdminStaffSchedulingPage from './pages/AdminStaffSchedulingPage';
import AdminRoomPlansPage from './pages/AdminRoomPlansPage';
import AdminReservationsPage from './pages/AdminReservationsPage';
import AdminEventsPage from './pages/AdminEventsPage';
import SuperAdminLoginPage from './pages/SuperAdminLoginPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { SuperAdminAuthProvider } from './contexts/SuperAdminAuthContext';
import { OrderCartProvider } from './contexts/OrderCartContext';
import { useAuth } from './contexts/useAuth';
import { useSuperAdminAuth } from './contexts/useSuperAdminAuth';
import { AppThemeProvider } from './hooks/useGuestTheme';
import AppThemeShell from './components/AppThemeShell';
import AppLocaleSync from './components/AppLocaleSync';
import SuperAdminProtectedRoute from './components/Auth/SuperAdminProtectedRoute';
import NotFoundView from './components/Common/NotFoundView';
import AppChangeGuards from './components/AppChangeGuards';
import { GuestMenuResourceProvider } from './contexts/GuestMenuResourceContext';
import LoadingSpinner from './components/Common/LoadingSpinner';

const GuestDishPage = React.lazy(() => import('./pages/GuestDishPage'));
const GuestDishIngredientsPage = React.lazy(() => import('./pages/GuestDishIngredientsPage'));
const OrderReviewPage = React.lazy(() => import('./pages/OrderReviewPage'));
const GuestOrdersPage = React.lazy(() => import('./pages/GuestOrdersPage'));
const GuestInvoicePage = React.lazy(() => import('./pages/GuestInvoicePage'));
const InvoicePrintPage = React.lazy(() => import('./pages/InvoicePrintPage'));
const ReservationsPage = React.lazy(() => import('./pages/ReservationsPage'));
const LiquidGlassDemoPage = React.lazy(() => import('./pages/LiquidGlassDemoPage'));
const RozerContactAiPage = React.lazy(() => import('./pages/RozerContactAiPage'));
const ChatBot = React.lazy(() => import('./components/ChatBot'));

const ROUTE_DEBUG_PATTERNS = [
  '/',
  '/menu',
  '/menu/table/:table_id',
  '/menu/table/:table_id/dish/:dish_id',
  '/menu/table/:table_id/dish/:dish_id/ingredients',
  '/menu/table/:table_id/review',
  '/menu/table/:table_id/orders',
  '/menu/table/:table_id/invoice',
  '/menu/dish/:dish_id',
  '/menu/dish/:dish_id/ingredients',
  '/menu/:restaurant_slug',
  '/menu/:restaurant_slug/dish/:dish_id',
  '/menu/:restaurant_slug/dish/:dish_id/ingredients',
  '/dish/:dish_id',
  '/reservations',
  '/order/review',
  '/invoice/print',
  '/contact-us',
  '/admin/login',
  '/admin/dashboard',
  '/admin/profile',
  '/admin/user-profile',
  '/admin/room-plans',
  '/admin/reservations',
  '/admin/events',
  '/admin/dishes/create',
  '/admin/dish/:dish_id',
  '/admin/dishes/:dish_id/edit',
  '/admin/ingredients/library',
  '/admin/ingredients/global',
  '/admin/inventory/ingredients',
  '/admin/inventory/stock-history',
  '/admin/inventory/ingredient-tracker',
  '/admin/staff',
  '/admin/staff/scheduling',
  '/admin/accounting',
  '/admin/finance',
  '/admin/finance/expenses',
  '/admin/finance/invoices/:invoice_id',
  '/admin/finance/payroll',
  '/admin/currency',
  '/admin/theme-demo',
  '/staff/orders',
  '/staff/today-orders',
  '/staff/today-orders/:order_id',
  '/staff/pos',
  '/chef/dashboard',
  '/super-admin/login',
  '/super-admin/dashboard',
  '/owner/login',
  '/owner/dashboard',
];

const RoleHomeRedirect: React.FC = () => {
  const { defaultRoute, isAuthenticated } = useAuth();

  return <Navigate to={isAuthenticated ? defaultRoute : '/admin/login'} replace />;
};

const SuperAdminHomeRedirect: React.FC = () => {
  const { isAuthenticated } = useSuperAdminAuth();

  return <Navigate to={isAuthenticated ? '/super-admin/dashboard' : '/super-admin/login'} replace />;
};

class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Keep this visible in production logs for blank-screen debugging.
    console.error('Route render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <NotFoundView
          title="Something went wrong"
          message="A page error occurred. Please refresh once. If it keeps happening, clear site data and login again."
        />
      );
    }

    return this.props.children;
  }
}

const lazyRoute = (element: React.ReactNode) => (
  <Suspense fallback={<LoadingSpinner fullPage text="Loading page..." />}>
    {element}
  </Suspense>
);

const RouteScrollManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    if (location.hash) {
      return;
    }

    window.scrollTo(0, 0);
    const frameId = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    const timeoutId = window.setTimeout(() => window.scrollTo(0, 0), 120);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
};

const AppRoutes: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const matchedRoutePaths = ROUTE_DEBUG_PATTERNS.filter((pattern) => (
      Boolean(matchPath({ path: pattern, end: true }, location.pathname))
    ));

    console.debug('[router] location update', {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      matchedRoutePaths,
    });
  }, [location.pathname, location.search, location.hash]);

  return (
    <AppThemeShell>
      <RouteScrollManager />
      <AppChangeGuards />
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<GuestDishListPage />} />
          <Route path="/menu" element={<GuestDishListPage />} />
          <Route path="/menu/table/:table_id" element={<GuestDishListPage />} />
          <Route path="/menu/table/:table_id/dish/:dish_id" element={lazyRoute(<GuestDishPage />)} />
          <Route path="/menu/table/:table_id/dish/:dish_id/ingredients" element={lazyRoute(<GuestDishIngredientsPage />)} />
          <Route path="/menu/table/:table_id/review" element={lazyRoute(<OrderReviewPage />)} />
          <Route path="/menu/table/:table_id/orders" element={lazyRoute(<GuestOrdersPage />)} />
          <Route path="/menu/table/:table_id/invoice" element={lazyRoute(<GuestInvoicePage />)} />
          <Route path="/menu/dish/:dish_id" element={lazyRoute(<GuestDishPage />)} />
          <Route path="/menu/dish/:dish_id/ingredients" element={lazyRoute(<GuestDishIngredientsPage />)} />
          <Route path="/menu/:restaurant_slug" element={<GuestDishListPage />} />
          <Route path="/menu/:restaurant_slug/dish/:dish_id" element={lazyRoute(<GuestDishPage />)} />
          <Route path="/dish/:dish_id" element={lazyRoute(<GuestDishPage />)} />
          <Route path="/menu/:restaurant_slug/dish/:dish_id/ingredients" element={lazyRoute(<GuestDishIngredientsPage />)} />
          <Route path="/reservations" element={lazyRoute(<ReservationsPage />)} />
          <Route path="/order/review" element={lazyRoute(<OrderReviewPage />)} />
          <Route path="/liquid-glass-preview" element={lazyRoute(<LiquidGlassDemoPage />)} />
          <Route path="/contact-us" element={lazyRoute(<RozerContactAiPage />)} />
          <Route path="/invoice/print" element={lazyRoute(<InvoicePrintPage />)} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/super-admin/login" element={lazyRoute(<SuperAdminLoginPage />)} />

          <Route element={<ProtectedRoute allowedRoles={['admin', 'chef', 'stock_manager', 'staff', 'accountant']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/profile" element={lazyRoute(<AdminRestaurantProfilePage />)} />
            <Route path="/admin/user-profile" element={lazyRoute(<AdminUserProfilePage />)} />
            <Route path="/admin/dishes/create" element={lazyRoute(<CreateDishPage />)} />
            <Route path="/admin/dish/:dish_id" element={lazyRoute(<AdminDishPage />)} />
            <Route path="/admin/dishes/:dish_id/edit" element={lazyRoute(<EditDishPage />)} />
            <Route path="/admin/ingredients/library" element={lazyRoute(<IngredientLibrary />)} />
            <Route path="/admin/ingredients/global" element={lazyRoute(<GlobalIngredientsPage />)} />
            <Route path="/admin/staff" element={lazyRoute(<AdminStaffPage />)} />
            <Route path="/admin/currency" element={lazyRoute(<AdminCurrencyPage />)} />
            <Route path="/admin/theme-demo" element={lazyRoute(<LiquidGlassDemoPage />)} />

            <Route element={<ProtectedRoute requiredFeatures={['staff_scheduling']} />}>
              <Route path="/admin/staff/scheduling" element={lazyRoute(<AdminStaffSchedulingPage />)} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'accountant']} requiredFeatures={['finance_dashboard', 'dish_profitability']} />}>
            <Route path="/admin/accounting" element={lazyRoute(<AccountingOrdersPage />)} />
            <Route path="/admin/finance" element={lazyRoute(<AdminFinanceDashboardPage />)} />
            <Route path="/admin/finance/invoices/:invoice_id" element={lazyRoute(<AdminFinanceInvoiceDetailsPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'accountant']} requiredFeatures={['finance_dashboard', 'expense_management']} />}>
            <Route path="/admin/finance/expenses" element={lazyRoute(<AdminFinanceExpensesPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'accountant']} requiredFeatures={['payroll_management']} />}>
            <Route path="/admin/finance/payroll" element={lazyRoute(<AdminPayrollManagementPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'stock_manager']} requiredFeatures={['inventory']} />}>
            <Route path="/admin/inventory/ingredients" element={lazyRoute(<AdminIngredientsPage />)} />
            <Route path="/admin/inventory/stock-history" element={lazyRoute(<AdminStockHistoryPage />)} />
            <Route path="/admin/inventory/ingredient-tracker" element={lazyRoute(<AdminIngredientTrackerPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'staff']} requiredFeatures={['room_plan_editor']} />}>
            <Route path="/admin/room-plans" element={lazyRoute(<AdminRoomPlansPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'staff']} />}>
            <Route path="/admin/reservations" element={lazyRoute(<AdminReservationsPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'chef', 'stock_manager']} requiredFeatures={['event_reservations']} />}>
            <Route path="/admin/events" element={lazyRoute(<AdminEventsPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['staff', 'admin']} />}>
            <Route path="/staff/orders" element={lazyRoute(<StaffOrdersPage />)} />
            <Route path="/staff/today-orders" element={lazyRoute(<TodayOrdersPage />)} />
            <Route path="/staff/today-orders/:order_id" element={lazyRoute(<TodayOrderDetailsPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} requiredFeatures={['table_ordering']} />}>
            <Route path="/staff/pos" element={lazyRoute(<CashierPosPage />)} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['chef']} />}>
            <Route path="/chef/dashboard" element={lazyRoute(<ChefDashboardPage />)} />
          </Route>

          <Route
            path="/super-admin/dashboard"
            element={(
              <SuperAdminProtectedRoute>
                {lazyRoute(<SuperAdminDashboardPage />)}
              </SuperAdminProtectedRoute>
            )}
          />

          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/dashboard" element={<RoleHomeRedirect />} />
          <Route path="/admin" element={<RoleHomeRedirect />} />
          <Route path="/super-admin" element={<SuperAdminHomeRedirect />} />
          <Route path="/owner" element={<Navigate to="/super-admin" replace />} />
          <Route path="/owner/login" element={<Navigate to="/super-admin/login" replace />} />
          <Route path="/owner/dashboard" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/staff" element={<Navigate to="/staff/orders" replace />} />
          <Route path="/chef" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/accounting" element={<Navigate to="/admin/accounting" replace />} />
          <Route path="/finance" element={<Navigate to="/admin/finance" replace />} />
          <Route path="/dishes/create" element={<Navigate to="/admin/dishes/create" replace />} />

          <Route
            path="*"
            element={<NotFoundView title="404" message="This route is unavailable." />}
          />
        </Routes>
      </RouteErrorBoundary>
    </AppThemeShell>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SuperAdminAuthProvider>
        <OrderCartProvider>
          <AppThemeProvider>
            <AppLocaleSync />
            <GuestMenuResourceProvider>
              <BrowserRouter unstable_useTransitions={false}>
                <AppRoutes />
                <Suspense fallback={null}>
                  <ChatBot />
                </Suspense>
              </BrowserRouter>
            </GuestMenuResourceProvider>
          </AppThemeProvider>
        </OrderCartProvider>
      </SuperAdminAuthProvider>
    </AuthProvider>
  );
};

export default App;
