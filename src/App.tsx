import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestDishListPage from './pages/GuestDishListPage';
import GuestDishPage from './pages/GuestDishPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreateDishPage from './pages/CreateDishPage';
import EditDishPage from './pages/EditDishPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GuestDishListPage />} />
          <Route path="/menu/:restaurant_slug/dish/:dish_id" element={<GuestDishPage />} />

          <Route path="/admin/login" element={<LoginPage />} />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dishes/create"
            element={
              <ProtectedRoute>
                <CreateDishPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dishes/:dish_id/edit"
            element={
              <ProtectedRoute>
                <EditDishPage />
              </ProtectedRoute>
            }
          />

          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dishes/create" element={<Navigate to="/admin/dishes/create" replace />} />

          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-lg shadow">
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">AR Menu Platform</h1>
                  <p className="text-gray-600 mb-4">Visit:</p>
                  <ul className="text-left text-blue-600 space-y-1">
                    <li>• <a href="/" className="hover:underline">/</a> - Guest dishes list</li>
                    <li>• <a href="/admin/login" className="hover:underline">/admin/login</a> - Admin login</li>
                  </ul>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
