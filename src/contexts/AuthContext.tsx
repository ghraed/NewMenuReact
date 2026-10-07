/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { resetEcho } from '../services/realtime';
import type { AuthUserSummary } from '../types';
import { getDefaultRouteForRole } from '../utils/auth';
import { quarantineLegacyProtectedStorage, setVerifiedBrowserIdentity } from '../services/protectedBrowserStorage';
import LoadingSpinner from '../components/Common/LoadingSpinner';

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

export const AuthScopeBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = React.useContext(AuthContext);
  if (!auth || auth.loading) return <LoadingSpinner />;
  const key = auth.user ? `${auth.user.restaurant?.id ?? 'unresolved'}:${auth.user.id}` : 'anonymous';
  return <React.Fragment key={key}>{children}</React.Fragment>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);
  const sessionToken = useRef<string | null>(null);
  const invalidateSession = React.useCallback(() => {
    ++sessionVersion.current;
    setVerifiedBrowserIdentity(null, null);
  }, []);

  const refreshUser = React.useCallback(async () => {
    const version = sessionVersion.current;
    const requestToken = sessionToken.current;
    if (!requestToken) throw new Error('No authenticated session.');
    const response = await api.get('/auth/me', { headers: { Authorization: `Bearer ${requestToken}` } });
    if (version !== sessionVersion.current || requestToken !== localStorage.getItem(TOKEN_STORAGE_KEY)) {
      throw new Error('The authenticated session changed.');
    }
    const nextUser = response.data.user as AuthUser;
    setVerifiedBrowserIdentity(nextUser, requestToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    setVerifiedBrowserIdentity(null, null);
    quarantineLegacyProtectedStorage();
    const bootstrap = async (storedToken: string | null) => {
      const version = ++sessionVersion.current;
      sessionToken.current = storedToken;
      setVerifiedBrowserIdentity(null, null);
      setUser(null);
      setToken(storedToken);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await refreshUser();
      } catch {
        if (version !== sessionVersion.current) return;
        const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (currentToken !== storedToken) {
          void bootstrap(currentToken);
          return;
        }
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        sessionToken.current = null;
        setVerifiedBrowserIdentity(null, null);
        setToken(null);
        setUser(null);
        resetEcho();
      } finally {
        if (version === sessionVersion.current) setLoading(false);
      }
    };
    void bootstrap(localStorage.getItem(TOKEN_STORAGE_KEY));
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_STORAGE_KEY || event.key === null) {
        resetEcho();
        void bootstrap(localStorage.getItem(TOKEN_STORAGE_KEY));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      invalidateSession();
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshUser, invalidateSession]);

  const login = async (identifier: string, password: string) => {
    const version = ++sessionVersion.current;
    sessionToken.current = null;
    setVerifiedBrowserIdentity(null, null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    resetEcho();
    setToken(null);
    setUser(null);
    setLoading(false);
    const response = await api.post('/auth/login', { email: identifier, password });
    if (version !== sessionVersion.current) throw new Error('The authenticated session changed.');
    const nextToken = response.data.token as string;
    const nextUser = response.data.user as AuthUser;

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    sessionToken.current = nextToken;
    setVerifiedBrowserIdentity(nextUser, nextToken);
    resetEcho();
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    const requestToken = sessionToken.current;
    ++sessionVersion.current;
    sessionToken.current = null;
    setVerifiedBrowserIdentity(null, null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    resetEcho();
    setToken(null);
    setUser(null);
    setLoading(false);
    try {
      if (requestToken) await api.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${requestToken}` } });
    } catch {
      // ignore API logout failures and clear local auth state
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token && !!user,
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
