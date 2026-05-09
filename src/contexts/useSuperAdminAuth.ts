import { useContext } from 'react';
import { SuperAdminAuthContext } from './SuperAdminAuthContext';

export const useSuperAdminAuth = () => {
  const context = useContext(SuperAdminAuthContext);

  if (!context) {
    throw new Error('useSuperAdminAuth must be used within SuperAdminAuthProvider');
  }

  return context;
};
