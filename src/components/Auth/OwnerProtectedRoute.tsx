import React from 'react';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useOwnerAuth } from '../../contexts/useOwnerAuth';

interface OwnerProtectedRouteProps {
  children: React.ReactNode;
}

const OwnerProtectedRoute: React.FC<OwnerProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, user } = useOwnerAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || user?.role !== 'saas_owner') {
    return <Navigate to="/owner/login" replace />;
  }

  return <>{children}</>;
};

export default OwnerProtectedRoute;
