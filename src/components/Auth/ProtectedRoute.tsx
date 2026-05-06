import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import LoadingSpinner from '../Common/LoadingSpinner';
import type { UserRole } from '../../types';
import { getDefaultRouteForRole, roleCanAccess } from '../../utils/auth';
import { areFeaturesEnabled } from '../../utils/features';
import NotFoundView from '../Common/NotFoundView';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredFeatures?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredFeatures }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!roleCanAccess(user?.role, allowedRoles)) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  if (!areFeaturesEnabled(user?.restaurant?.feature_flags, requiredFeatures)) {
    return <NotFoundView />;
  }

  return <React.Fragment key={location.key || `${location.pathname}${location.search}${location.hash}`}>{children}</React.Fragment>;
};

export default ProtectedRoute;
