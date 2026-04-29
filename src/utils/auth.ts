import type { UserRole } from '../types';

export const getDefaultRouteForRole = (role?: UserRole | null): string => (
  role === 'chef'
    ? '/chef/dashboard'
    : role === 'staff'
      ? '/staff/orders'
      : '/admin/dashboard'
);

export const roleCanAccess = (role: UserRole | null | undefined, allowedRoles?: UserRole[]): boolean => {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
};
