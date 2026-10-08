import { AUTH_SESSION_STORAGE_KEY, AUTH_IDENTITY_STORAGE_KEY, HTTP_ONLY_AUTH_SESSION, newAuthSessionRevision, readAuthSessionIdentity } from '../services/browserAuthSession';
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
  const loginAbort = useRef<AbortController | null>(null);
  const legacyBootstrapToken = useRef<string | null>(null);
  const invalidateSession = React.useCallback(() => {
    ++sessionVersion.current;
    loginAbort.current?.abort();
    setVerifiedBrowserIdentity(null, null);
  }, []);

  const refreshUser = React.useCallback(async () => {
    const version = sessionVersion.current;
    const revision = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    const legacy = legacyBootstrapToken.current;
    const response = await api.get('/auth/me', legacy ? { headers: { Authorization: `Bearer ${legacy}` } } : undefined);
    if (version !== sessionVersion.current || revision !== localStorage.getItem(AUTH_SESSION_STORAGE_KEY)) {
      throw new Error('The authenticated session changed.');
    }
    const nextUser = response.data.user as AuthUser;
    const expected = readAuthSessionIdentity();
    if (expected && (expected.userId !== nextUser.id || expected.restaurantId !== nextUser.restaurant?.id)) {
      throw new Error('The cookie session no longer matches the verified browser identity.');
    }
    const nextRevision = revision || newAuthSessionRevision();
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, nextRevision);
    localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, JSON.stringify({ userId: nextUser.id, restaurantId: nextUser.restaurant?.id || 0 }));
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    legacyBootstrapToken.current = null;
    setVerifiedBrowserIdentity(nextUser, nextRevision, AUTH_SESSION_STORAGE_KEY);
    setToken(HTTP_ONLY_AUTH_SESSION);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    setVerifiedBrowserIdentity(null, null);
    quarantineLegacyProtectedStorage();
    const bootstrap = async () => {
      const version = ++sessionVersion.current;
      const signal = JSON.parse(localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY) || 'null');
      if (signal?.pending || signal?.signedOut) {
        setVerifiedBrowserIdentity(null, null);
        setUser(null);
        setToken(null);
        setLoading(Boolean(signal.pending));
        return;
      }
      legacyBootstrapToken.current = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (legacyBootstrapToken.current) {
        localStorage.removeItem(AUTH_IDENTITY_STORAGE_KEY);
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, newAuthSessionRevision());
      }
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setVerifiedBrowserIdentity(null, null);
      setUser(null);
      setToken(null);
      setLoading(true);
      try { await refreshUser(); }
      catch {
        if (version !== sessionVersion.current) return;
        localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        localStorage.removeItem(AUTH_IDENTITY_STORAGE_KEY);
        setVerifiedBrowserIdentity(null, null);
        setToken(null);
        setUser(null);
        resetEcho();
      } finally {
        if (version === sessionVersion.current) setLoading(false);
      }
    };
    void bootstrap();
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_STORAGE_KEY || event.key === AUTH_SESSION_STORAGE_KEY || event.key === AUTH_IDENTITY_STORAGE_KEY || event.key === null) {
        resetEcho();
        void bootstrap();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { invalidateSession(); window.removeEventListener('storage', onStorage); };
  }, [refreshUser, invalidateSession]);

  const login = async (identifier: string, password: string) => {
    const version = ++sessionVersion.current;
    loginAbort.current?.abort();
    const abort = new AbortController();
    loginAbort.current = abort;
    const revision = newAuthSessionRevision();
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, JSON.stringify({ pending: true }));
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, revision);
    legacyBootstrapToken.current = null;
    setVerifiedBrowserIdentity(null, null);
    resetEcho();
    setToken(null);
    setUser(null);
    setLoading(false);
    try {
      const response = await api.post('/auth/login', { email: identifier, password }, { signal: abort.signal });
      if (version !== sessionVersion.current || revision !== localStorage.getItem(AUTH_SESSION_STORAGE_KEY)) {
        throw new Error('The authenticated session changed.');
      }
      const nextUser = response.data.user as AuthUser;
      localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, JSON.stringify({ userId: nextUser.id, restaurantId: nextUser.restaurant?.id || 0 }));
      setVerifiedBrowserIdentity(nextUser, revision, AUTH_SESSION_STORAGE_KEY);
      setToken(HTTP_ONLY_AUTH_SESSION);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      if (version === sessionVersion.current && revision === localStorage.getItem(AUTH_SESSION_STORAGE_KEY)) {
        localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, JSON.stringify({ signedOut: true }));
      }
      throw error;
    }
  };

  const logout = React.useCallback(async () => {
    const version = ++sessionVersion.current;
    loginAbort.current?.abort();
    // Hide protected work immediately; restore the same verified session only if
    // transport fails and no newer login has replaced it.
    const previousUser = user;
    const previousToken = token;
    const previousRevision = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    setVerifiedBrowserIdentity(null, null);
    setUser(null);
    setToken(null);
    try { await api.post('/auth/logout'); }
    catch (error) {
      if (version === sessionVersion.current && previousRevision === localStorage.getItem(AUTH_SESSION_STORAGE_KEY)) {
        setVerifiedBrowserIdentity(previousUser, previousRevision, AUTH_SESSION_STORAGE_KEY);
        setUser(previousUser);
        setToken(previousToken);
      }
      throw error;
    }
    if (version !== sessionVersion.current) return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(AUTH_IDENTITY_STORAGE_KEY);
    setVerifiedBrowserIdentity(null, null);
    resetEcho();
    setToken(null);
    setUser(null);
  }, [user, token]);

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
    [user, token, loading, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
