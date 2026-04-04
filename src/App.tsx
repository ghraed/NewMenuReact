import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestDishListPage from './pages/GuestDishListPage';
import GuestDishPage from './pages/GuestDishPage';
import GuestDishIngredientsPage from './pages/GuestDishIngredientsPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreateDishPage from './pages/CreateDishPage';
import EditDishPage from './pages/EditDishPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import LiquidGlassDemoPage from './pages/LiquidGlassDemoPage';
import { GlassBoard } from './components/ui/liquid-glass';
import { AppThemeProvider } from './hooks/useGuestTheme';
import AppThemeShell from './components/AppThemeShell';

const AppRoutes: React.FC = () => {
  return (
    <AppThemeShell>
      <Routes>
        <Route path="/" element={<GuestDishListPage />} />
        <Route path="/menu/:restaurant_slug/dish/:dish_id" element={<GuestDishPage />} />
        <Route path="/menu/:restaurant_slug/dish/:dish_id/ingredients" element={<GuestDishIngredientsPage />} />
        <Route path="/liquid-glass-preview" element={<LiquidGlassDemoPage />} />

        <Route path="/admin/login" element={<LoginPage />} />

        <Route
          path="/admin/dashboard"
          element={(
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dishes/create"
          element={(
            <ProtectedRoute>
              <CreateDishPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/dishes/:dish_id/edit"
          element={(
            <ProtectedRoute>
              <EditDishPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin/theme-demo"
          element={(
            <ProtectedRoute>
              <LiquidGlassDemoPage />
            </ProtectedRoute>
          )}
        />

        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
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
                  <li>• <a href="/admin/login" className="underline underline-offset-4">/admin/login</a> - Admin login</li>
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
      <AppThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppThemeProvider>
    </AuthProvider>
  );
};

export default App;
