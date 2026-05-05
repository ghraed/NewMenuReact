import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestDishListPage from './pages/GuestDishListPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { OwnerAuthProvider } from './contexts/OwnerAuthContext';
import { OrderCartProvider } from './contexts/OrderCartContext';
import { useAuth } from './contexts/useAuth';
import { useOwnerAuth } from './contexts/useOwnerAuth';
import { AppThemeProvider } from './hooks/useGuestTheme';
import AppThemeShell from './components/AppThemeShell';
import AppLocaleSync from './components/AppLocaleSync';
import { useTranslation } from 'react-i18next';
import OwnerProtectedRoute from './components/Auth/OwnerProtectedRoute';
import NotFoundView from './components/Common/NotFoundView';
import { GuestMenuResourceProvider } from './contexts/GuestMenuResourceContext';
import LoadingSpinner from './components/Common/LoadingSpinner';

const GuestDishPage = React.lazy(() => import('./pages/GuestDishPage'));
const GuestDishIngredientsPage = React.lazy(() => import('./pages/GuestDishIngredientsPage'));
const AdminRestaurantProfilePage = React.lazy(() => import('./pages/AdminRestaurantProfilePage'));
const CreateDishPage = React.lazy(() => import('./pages/CreateDishPage'));
const EditDishPage = React.lazy(() => import('./pages/EditDishPage'));
const IngredientLibrary = React.lazy(() => import('./pages/IngredientLibrary'));
const GlobalIngredientsPage = React.lazy(() => import('./pages/GlobalIngredientsPage'));
const AdminIngredientsPage = React.lazy(() => import('./pages/AdminIngredientsPage'));
const AdminStockHistoryPage = React.lazy(() => import('./pages/AdminStockHistoryPage'));
const AdminDishPage = React.lazy(() => import('./pages/AdminDishPage'));
const OrderReviewPage = React.lazy(() => import('./pages/OrderReviewPage'));
const GuestOrdersPage = React.lazy(() => import('./pages/GuestOrdersPage'));
const GuestInvoicePage = React.lazy(() => import('./pages/GuestInvoicePage'));
const StaffOrdersPage = React.lazy(() => import('./pages/StaffOrdersPage'));
const CashierPosPage = React.lazy(() => import('./pages/CashierPosPage'));
const ChefDashboardPage = React.lazy(() => import('./pages/ChefDashboardPage'));
const AdminStaffPage = React.lazy(() => import('./pages/AdminStaffPage'));
const AccountingOrdersPage = React.lazy(() => import('./pages/AccountingOrdersPage'));
const InvoicePrintPage = React.lazy(() => import('./pages/InvoicePrintPage'));
const AdminCurrencyPage = React.lazy(() => import('./pages/AdminCurrencyPage'));
const AdminFinanceDashboardPage = React.lazy(() => import('./pages/AdminFinanceDashboardPage'));
const AdminFinanceInvoiceDetailsPage = React.lazy(() => import('./pages/AdminFinanceInvoiceDetailsPage'));
const AdminPayrollManagementPage = React.lazy(() => import('./pages/AdminPayrollManagementPage'));
const AdminStaffSchedulingPage = React.lazy(() => import('./pages/AdminStaffSchedulingPage'));
const AdminRoomPlansPage = React.lazy(() => import('./pages/AdminRoomPlansPage'));
const AdminReservationsPage = React.lazy(() => import('./pages/AdminReservationsPage'));
const ReservationsPage = React.lazy(() => import('./pages/ReservationsPage'));
const LiquidGlassDemoPage = React.lazy(() => import('./pages/LiquidGlassDemoPage'));
const ChatBot = React.lazy(() => import('./components/ChatBot'));
const OwnerLoginPage = React.lazy(() => import('./pages/OwnerLoginPage'));
const OwnerDashboardPage = React.lazy(() => import('./pages/OwnerDashboardPage'));

const RoleHomeRedirect: React.FC = () => {
  const { defaultRoute, isAuthenticated } = useAuth();

  return <Navigate to={isAuthenticated ? defaultRoute : '/admin/login'} replace />;
};

const OwnerHomeRedirect: React.FC = () => {
  const { isAuthenticated } = useOwnerAuth();

  return <Navigate to={isAuthenticated ? '/owner/dashboard' : '/owner/login'} replace />;
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

const AppRoutes: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <AppThemeShell>
      <RouteErrorBoundary>
        <Routes key={i18n.resolvedLanguage}>
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
        <Route path="/invoice/print" element={lazyRoute(<InvoicePrintPage />)} />

        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/owner/login" element={lazyRoute(<OwnerLoginPage />)} />

        <Route
          path="/admin/room-plans"
          element={(
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredFeatures={['room_plan_editor']}>
              {lazyRoute(<AdminRoomPlansPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/reservations"
          element={(
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredFeatures={['table_reservations']}>
              {lazyRoute(<AdminReservationsPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dashboard"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/profile"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminRestaurantProfilePage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/owner/dashboard"
          element={(
            <OwnerProtectedRoute>
              {lazyRoute(<OwnerDashboardPage />)}
            </OwnerProtectedRoute>
          )}
        />

        <Route
          path="/admin/dishes/create"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<CreateDishPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dish/:dish_id"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminDishPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dishes/:dish_id/edit"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<EditDishPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/ingredients/library"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<IngredientLibrary />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/ingredients/global"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<GlobalIngredientsPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/inventory/ingredients"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['inventory']}>
              {lazyRoute(<AdminIngredientsPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/inventory/stock-history"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['inventory']}>
              {lazyRoute(<AdminStockHistoryPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/staff/orders"
          element={(
            <ProtectedRoute allowedRoles={['staff', 'admin']} requiredFeatures={['realtime_staff_orders']}>
              {lazyRoute(<StaffOrdersPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/staff/pos"
          element={(
            <ProtectedRoute allowedRoles={['staff', 'admin']} requiredFeatures={['realtime_staff_orders', 'table_ordering']}>
              {lazyRoute(<CashierPosPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/chef/dashboard"
          element={(
            <ProtectedRoute allowedRoles={['chef']}>
              {lazyRoute(<ChefDashboardPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/staff"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminStaffPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/accounting"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['finance_dashboard', 'dish_profitability']}>
              {lazyRoute(<AccountingOrdersPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/finance"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['finance_dashboard', 'dish_profitability']}>
              {lazyRoute(<AdminFinanceDashboardPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/finance/invoices/:invoice_id"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['finance_dashboard', 'dish_profitability']}>
              {lazyRoute(<AdminFinanceInvoiceDetailsPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/finance/payroll"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['payroll_management']}>
              {lazyRoute(<AdminPayrollManagementPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/staff/scheduling"
          element={(
            <ProtectedRoute allowedRoles={['admin']} requiredFeatures={['staff_scheduling']}>
              {lazyRoute(<AdminStaffSchedulingPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/currency"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminCurrencyPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/theme-demo"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<LiquidGlassDemoPage />)}
            </ProtectedRoute>
          )}
        />

        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/dashboard" element={<RoleHomeRedirect />} />
        <Route path="/admin" element={<RoleHomeRedirect />} />
        <Route path="/owner" element={<OwnerHomeRedirect />} />
        <Route path="/staff" element={<Navigate to="/staff/orders" replace />} />
        <Route path="/chef" element={<Navigate to="/chef/dashboard" replace />} />
        <Route path="/accounting" element={<Navigate to="/admin/accounting" replace />} />
        <Route path="/finance" element={<Navigate to="/admin/finance" replace />} />
        <Route path="/dishes/create" element={<Navigate to="/admin/dishes/create" replace />} />

        <Route
          path="*"
          element={<NotFoundView title={t('app.brand')} message={t('app.visit')} />}
        />
        </Routes>
      </RouteErrorBoundary>
    </AppThemeShell>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <OwnerAuthProvider>
        <OrderCartProvider>
          <AppThemeProvider>
            <AppLocaleSync />
            <GuestMenuResourceProvider>
              <BrowserRouter>
                <AppRoutes />
                <Suspense fallback={null}>
                  <ChatBot />
                </Suspense>
              </BrowserRouter>
            </GuestMenuResourceProvider>
          </AppThemeProvider>
        </OrderCartProvider>
      </OwnerAuthProvider>
    </AuthProvider>
  );
};

export default App;
