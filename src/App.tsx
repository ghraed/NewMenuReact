import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestDishListPage from './pages/GuestDishListPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { OwnerAuthProvider } from './contexts/OwnerAuthContext';
import { OrderCartProvider } from './contexts/OrderCartContext';
import { useAuth } from './contexts/useAuth';
import { useOwnerAuth } from './contexts/useOwnerAuth';
import { GlassBoard } from './components/ui/liquid-glass';
import { AppThemeProvider } from './hooks/useGuestTheme';
import AppThemeShell from './components/AppThemeShell';
import AppLocaleSync from './components/AppLocaleSync';
import { useTranslation } from 'react-i18next';
import OwnerProtectedRoute from './components/Auth/OwnerProtectedRoute';

const GuestDishPage = React.lazy(() => import('./pages/GuestDishPage'));
const GuestDishIngredientsPage = React.lazy(() => import('./pages/GuestDishIngredientsPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
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
const AdminStaffPage = React.lazy(() => import('./pages/AdminStaffPage'));
const AccountingOrdersPage = React.lazy(() => import('./pages/AccountingOrdersPage'));
const InvoicePrintPage = React.lazy(() => import('./pages/InvoicePrintPage'));
const AdminCurrencyPage = React.lazy(() => import('./pages/AdminCurrencyPage'));
const AdminFinanceDashboardPage = React.lazy(() => import('./pages/AdminFinanceDashboardPage'));
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

const lazyRoute = (element: React.ReactNode) => (
  <Suspense fallback={null}>
    {element}
  </Suspense>
);

const AppRoutes: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <AppThemeShell>
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
        <Route path="/order/review" element={lazyRoute(<OrderReviewPage />)} />
        <Route path="/liquid-glass-preview" element={lazyRoute(<LiquidGlassDemoPage />)} />
        <Route path="/invoice/print" element={lazyRoute(<InvoicePrintPage />)} />

        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/owner/login" element={lazyRoute(<OwnerLoginPage />)} />

        <Route
          path="/admin/dashboard"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminDashboard />)}
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
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminIngredientsPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/inventory/stock-history"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminStockHistoryPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/staff/orders"
          element={(
            <ProtectedRoute allowedRoles={['staff', 'admin']}>
              {lazyRoute(<StaffOrdersPage />)}
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
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AccountingOrdersPage />)}
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/finance"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              {lazyRoute(<AdminFinanceDashboardPage />)}
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
        <Route path="/accounting" element={<Navigate to="/admin/accounting" replace />} />
        <Route path="/finance" element={<Navigate to="/admin/finance" replace />} />
        <Route path="/dishes/create" element={<Navigate to="/admin/dishes/create" replace />} />

        <Route
          path="*"
          element={(
            <div className="flex min-h-screen items-center justify-center p-4">
              <GlassBoard className="w-full max-w-lg">
                <h1 className="text-2xl font-bold text-text">{t('app.brand')}</h1>
                <p className="mt-2 text-muted">{t('app.visit')}</p>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  <li>• <a href="/menu/table/1" className="underline underline-offset-4">/menu/table/1</a> - {t('app.guestDishList')}</li>
                  <li>• <a href="/menu/table/1/review" className="underline underline-offset-4">/menu/table/1/review</a> - {t('app.guestOrderReview')}</li>
                  <li>• <a href="/menu/table/1/orders" className="underline underline-offset-4">/menu/table/1/orders</a> - {t('app.guestOrders')}</li>
                  <li>• <a href="/admin/login" className="underline underline-offset-4">/admin/login</a> - {t('app.adminLogin')}</li>
                  <li>• <a href="/admin/staff" className="underline underline-offset-4">/admin/staff</a> - {t('app.adminStaff')}</li>
                  <li>• <a href="/admin/inventory/ingredients" className="underline underline-offset-4">/admin/inventory/ingredients</a> - {t('app.adminIngredients')}</li>
                  <li>• <a href="/staff/orders" className="underline underline-offset-4">/staff/orders</a> - {t('app.staffPendingOrders')}</li>
                  <li>• <a href="/admin/accounting" className="underline underline-offset-4">/admin/accounting</a> - {t('app.adminAccounting')}</li>
                  <li>• <a href="/admin/finance" className="underline underline-offset-4">/admin/finance</a> - Finance dashboard</li>
                  <li>• <a href="/liquid-glass-preview" className="underline underline-offset-4">/liquid-glass-preview</a> - {t('app.themePreview')}</li>
                </ul>
              </GlassBoard>
            </div>
          )}
        />
      </Routes>
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
            <BrowserRouter>
              <AppRoutes />
              <Suspense fallback={null}>
                <ChatBot />
              </Suspense>
            </BrowserRouter>
          </AppThemeProvider>
        </OrderCartProvider>
      </OwnerAuthProvider>
    </AuthProvider>
  );
};

export default App;
