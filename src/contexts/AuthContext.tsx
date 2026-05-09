/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { resetEcho } from '../services/realtime';
import type { AuthUserSummary } from '../types';
import { getDefaultRouteForRole } from '../utils/auth';

export type AuthUser = AuthUserSummary;

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isChef: boolean;
  isStockManager: boolean;
  defaultRoute: string;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser>;
}

const TOKEN_STORAGE_KEY = 'admin_auth_token';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = React.useCallback(async () => {
    const response = await api.get('/auth/me');
    const nextUser = response.data.user as AuthUser;
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);

      try {
        await refreshUser();
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
        resetEcho();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [refreshUser]);

  const login = async (identifier: string, password: string) => {
    const response = await api.post('/auth/login', { email: identifier, password });
    const nextToken = response.data.token as string;
    const nextUser = response.data.user as AuthUser;

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    resetEcho();
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore API logout failures and clear local auth state
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      resetEcho();
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token,
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'staff',
      isChef: user?.role === 'chef',
      isStockManager: user?.role === 'stock_manager',
      defaultRoute: getDefaultRouteForRole(user?.role),
      login,
      logout,
      refreshUser,
    }),
    [user, token, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
