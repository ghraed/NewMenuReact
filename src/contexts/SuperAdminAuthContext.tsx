/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useMemo, useState } from 'react';
import superAdminApi, { SUPER_ADMIN_TOKEN_STORAGE_KEY } from '../services/superAdminApi';

export interface SuperAdminAuthUser {
  id: number;
  name: string;
  email: string;
  role: 'saas_owner';
}

interface SuperAdminAuthContextValue {
  user: SuperAdminAuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<SuperAdminAuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<SuperAdminAuthUser>;
}

export const SuperAdminAuthContext = createContext<SuperAdminAuthContextValue | undefined>(undefined);

export const SuperAdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SuperAdminAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = React.useCallback(async () => {
    const response = await superAdminApi.get('/super-admin/auth/me');
    const nextUser = response.data.user as SuperAdminAuthUser;
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = localStorage.getItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);

      try {
        await refreshUser();
      } catch {
        localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const response = await superAdminApi.post('/super-admin/auth/login', { email, password });
    const nextToken = response.data.token as string;
    const nextUser = response.data.user as SuperAdminAuthUser;

    localStorage.setItem(SUPER_ADMIN_TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);

    return nextUser;
  };

  const logout = async () => {
    try {
      await superAdminApi.post('/super-admin/auth/logout');
    } catch {
      // Ignore API errors and always clear local state.
    } finally {
      localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo<SuperAdminAuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token,
      login,
      logout,
      refreshUser,
    }),
    [user, token, loading, refreshUser]
  );

  return (
    <SuperAdminAuthContext.Provider value={value}>
      {children}
    </SuperAdminAuthContext.Provider>
  );
};
