import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestDishListPage from './pages/GuestDishListPage';
import GuestDishPage from './pages/GuestDishPage';
import GuestDishIngredientsPage from './pages/GuestDishIngredientsPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreateDishPage from './pages/CreateDishPage';
import EditDishPage from './pages/EditDishPage';
import IngredientLibraryPage from './pages/IngredientLibraryPage';
import AdminDishPage from './pages/AdminDishPage';
import OrderReviewPage from './pages/OrderReviewPage';
import StaffOrdersPage from './pages/StaffOrdersPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AccountingOrdersPage from './pages/AccountingOrdersPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { OrderCartProvider } from './contexts/OrderCartContext';
import { useAuth } from './contexts/useAuth';
import LiquidGlassDemoPage from './pages/LiquidGlassDemoPage';
import { GlassBoard } from './components/ui/liquid-glass';
import { AppThemeProvider } from './hooks/useGuestTheme';
import AppThemeShell from './components/AppThemeShell';

const RoleHomeRedirect: React.FC = () => {
  const { defaultRoute, isAuthenticated } = useAuth();

  return <Navigate to={isAuthenticated ? defaultRoute : '/admin/login'} replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <AppThemeShell>
      <Routes>
        <Route path="/" element={<GuestDishListPage />} />
        <Route path="/menu/:restaurant_slug" element={<GuestDishListPage />} />
        <Route path="/menu/:restaurant_slug/dish/:dish_id" element={<GuestDishPage />} />
        <Route path="/dish/:dish_id" element={<GuestDishPage />} />
        <Route path="/menu/:restaurant_slug/dish/:dish_id/ingredients" element={<GuestDishIngredientsPage />} />
        <Route path="/order/review" element={<OrderReviewPage />} />
        <Route path="/liquid-glass-preview" element={<LiquidGlassDemoPage />} />

        <Route path="/admin/login" element={<LoginPage />} />

        <Route
          path="/admin/dashboard"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dishes/create"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <CreateDishPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dish/:dish_id"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDishPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dishes/:dish_id/edit"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <EditDishPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/ingredients/library"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <IngredientLibraryPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/staff/orders"
          element={(
            <ProtectedRoute allowedRoles={['staff', 'admin']}>
              <StaffOrdersPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/staff"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminStaffPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/accounting"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <AccountingOrdersPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/theme-demo"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <LiquidGlassDemoPage />
            </ProtectedRoute>
          )}
        />

        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/dashboard" element={<RoleHomeRedirect />} />
        <Route path="/admin" element={<RoleHomeRedirect />} />
        <Route path="/staff" element={<Navigate to="/staff/orders" replace />} />
        <Route path="/accounting" element={<Navigate to="/admin/accounting" replace />} />
        <Route path="/dishes/create" element={<Navigate to="/admin/dishes/create" replace />} />

        <Route
          path="*"
          element={(
            <div className="flex min-h-screen items-center justify-center p-4">
              <GlassBoard className="w-full max-w-lg">
                <h1 className="text-2xl font-bold text-text">AR Menu Platform</h1>
                <p className="mt-2 text-muted">Visit:</p>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  <li>• <a href="/" className="underline underline-offset-4">/</a> - Guest dishes list</li>
                  <li>• <a href="/order/review" className="underline underline-offset-4">/order/review</a> - Guest order review</li>
                  <li>• <a href="/admin/login" className="underline underline-offset-4">/admin/login</a> - Admin login</li>
                  <li>• <a href="/admin/staff" className="underline underline-offset-4">/admin/staff</a> - Admin staff creation</li>
                  <li>• <a href="/staff/orders" className="underline underline-offset-4">/staff/orders</a> - Staff pending orders</li>
                  <li>• <a href="/admin/accounting" className="underline underline-offset-4">/admin/accounting</a> - Admin accounting queue</li>
                  <li>• <a href="/liquid-glass-preview" className="underline underline-offset-4">/liquid-glass-preview</a> - Theme preview</li>
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
      <OrderCartProvider>
        <AppThemeProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AppThemeProvider>
      </OrderCartProvider>
    </AuthProvider>
  );
};

export default App;
