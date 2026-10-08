import { OWNER_SESSION_STORAGE_KEY, OWNER_IDENTITY_STORAGE_KEY, readOwnerIdentity, setVerifiedOwnerIdentity } from '../services/ownerAuthSession';
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import superAdminApi from '../services/superAdminApi';

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
const SUPER_ADMIN_TOKEN_STORAGE_KEY = 'owner_auth_token';
const HTTP_ONLY_AUTH_SESSION = 'http-only-cookie';

export const SuperAdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SuperAdminAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);
  const loginAbort = useRef<AbortController | null>(null);
  const legacyToken = useRef<string | null>(null);
  const invalidateSession = React.useCallback(() => { ++sessionVersion.current; loginAbort.current?.abort(); setVerifiedOwnerIdentity(null, null); }, []);

  const refreshUser = React.useCallback(async () => {
    const version = sessionVersion.current;
    const revision = localStorage.getItem(OWNER_SESSION_STORAGE_KEY);
    const response = await superAdminApi.get('/super-admin/auth/me', legacyToken.current ? { headers: { Authorization: `Bearer ${legacyToken.current}` } } : undefined);
    if (version !== sessionVersion.current || revision !== localStorage.getItem(OWNER_SESSION_STORAGE_KEY)) throw new Error('The owner session changed.');
    const nextUser = response.data.user as SuperAdminAuthUser;
    const expected = readOwnerIdentity();
    if (expected && expected !== nextUser.id) throw new Error('The owner cookie changed.');
    const nextRevision = revision || crypto.randomUUID();
    localStorage.setItem(OWNER_SESSION_STORAGE_KEY, nextRevision);
    localStorage.setItem(OWNER_IDENTITY_STORAGE_KEY, String(nextUser.id));
    localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
    legacyToken.current = null;
    setVerifiedOwnerIdentity(nextUser.id, nextRevision);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const version = ++sessionVersion.current;
      const state = localStorage.getItem(OWNER_IDENTITY_STORAGE_KEY);
      if (state === 'pending' || state === 'signed-out') {
        setVerifiedOwnerIdentity(null, null);
        setUser(null); setToken(null); setLoading(state === 'pending');
        return;
      }
      legacyToken.current = localStorage.getItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
      localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
      if (legacyToken.current) localStorage.removeItem(OWNER_IDENTITY_STORAGE_KEY);
      try {
        await refreshUser();
        setToken(HTTP_ONLY_AUTH_SESSION);
      } catch {
        if (version !== sessionVersion.current) return;
        localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
        localStorage.removeItem(OWNER_SESSION_STORAGE_KEY);
        localStorage.removeItem(OWNER_IDENTITY_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } finally {
        if (version === sessionVersion.current) setLoading(false);
      }
    };

    void bootstrap();
    const changed = (event: StorageEvent) => {
      if ([OWNER_SESSION_STORAGE_KEY, OWNER_IDENTITY_STORAGE_KEY, SUPER_ADMIN_TOKEN_STORAGE_KEY].includes(event.key || '')) {
        setVerifiedOwnerIdentity(null, null); setUser(null); setToken(null); setLoading(true);
        void bootstrap();
      }
    };
    window.addEventListener('storage', changed);
    return () => { invalidateSession(); window.removeEventListener('storage', changed); };
  }, [refreshUser, invalidateSession]);

  const login = async (email: string, password: string) => {
    const version = ++sessionVersion.current;
    loginAbort.current?.abort();
    const abort = new AbortController();
    loginAbort.current = abort;
    const revision = crypto.randomUUID();
    localStorage.setItem(OWNER_IDENTITY_STORAGE_KEY, 'pending');
    localStorage.setItem(OWNER_SESSION_STORAGE_KEY, revision);
    setVerifiedOwnerIdentity(null, null);
    localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
    let response;
    try {
      response = await superAdminApi.post('/super-admin/auth/login', { email, password }, { signal: abort.signal });
    } catch (error) {
      if (version === sessionVersion.current && revision === localStorage.getItem(OWNER_SESSION_STORAGE_KEY)) {
        localStorage.setItem(OWNER_IDENTITY_STORAGE_KEY, 'signed-out');
        setLoading(false);
      }
      throw error;
    }
    const nextUser = response.data.user as SuperAdminAuthUser;

    if (version !== sessionVersion.current || revision !== localStorage.getItem(OWNER_SESSION_STORAGE_KEY)) throw new Error('The owner session changed.');
    localStorage.setItem(OWNER_IDENTITY_STORAGE_KEY, String(nextUser.id));
    setVerifiedOwnerIdentity(nextUser.id, revision);
    localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
    setToken(HTTP_ONLY_AUTH_SESSION);
    setUser(nextUser);
    setLoading(false);

    return nextUser;
  };

  const logout = async () => {
    const version = ++sessionVersion.current;
    loginAbort.current?.abort();
    await superAdminApi.post('/super-admin/auth/logout');
    if (version !== sessionVersion.current) return;
    localStorage.setItem(OWNER_IDENTITY_STORAGE_KEY, 'signed-out');
    localStorage.setItem(OWNER_SESSION_STORAGE_KEY, crypto.randomUUID());
    setVerifiedOwnerIdentity(null, null);
    localStorage.removeItem(SUPER_ADMIN_TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
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
