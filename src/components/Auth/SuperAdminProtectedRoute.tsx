import React from 'react';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useSuperAdminAuth } from '../../contexts/useSuperAdminAuth';
import { useAuth } from '../../contexts/useAuth';
import { getDefaultRouteForRole } from '../../utils/auth';

interface SuperAdminProtectedRouteProps {
  children: React.ReactNode;
}

const SuperAdminProtectedRoute: React.FC<SuperAdminProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, user } = useSuperAdminAuth();
  const { isAuthenticated: isAdminSessionAuthenticated, user: adminSessionUser } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAdminSessionAuthenticated) {
    return <Navigate to={getDefaultRouteForRole(adminSessionUser?.role)} replace />;
  }

  if (!isAuthenticated || user?.role !== 'saas_owner') {
    return <Navigate to="/super-admin/login" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminProtectedRoute;
