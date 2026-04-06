import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import LoadingSpinner from '../Common/LoadingSpinner';
import type { UserRole } from '../../types';
import { getDefaultRouteForRole, roleCanAccess } from '../../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!roleCanAccess(user?.role, allowedRoles)) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
