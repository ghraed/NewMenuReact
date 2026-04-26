import { useContext } from 'react';
import { OwnerAuthContext } from './OwnerAuthContext';

export const useOwnerAuth = () => {
  const context = useContext(OwnerAuthContext);

  if (!context) {
    throw new Error('useOwnerAuth must be used within OwnerAuthProvider');
  }

  return context;
};
