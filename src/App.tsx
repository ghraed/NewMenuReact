import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GuestDishPage from './pages/GuestDishPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreateDishPage from './pages/CreateDishPage';
import './App.css'; // Import Tailwind CSS

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Guest route */}
        <Route
          path="/menu/:restaurant_slug/dish/:dish_id"
          element={<GuestDishPage />}
        />

        {/* Admin routes - NO AUTH PROTECTION FOR TESTING */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/dishes/create" element={<CreateDishPage />} />

        {/* Redirect root to dashboard for testing */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center p-8 bg-white rounded-lg shadow">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">AR Menu Platform</h1>
                <p className="text-gray-600 mb-4">Visit:</p>
                <ul className="text-left text-blue-600 space-y-1">
                  <li>• <a href="/dashboard" className="hover:underline">/dashboard</a> - Admin panel</li>
                  <li>• <a href="/login" className="hover:underline">/login</a> - Login page</li>
                  <li>• <a href="/menu/pizza-palace/dish/1" className="hover:underline">/menu/pizza-palace/dish/1</a> - Guest view</li>
                </ul>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;