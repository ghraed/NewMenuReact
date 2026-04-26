/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useMemo, useState } from 'react';
import ownerApi, { OWNER_TOKEN_STORAGE_KEY } from '../services/ownerApi';

export interface OwnerAuthUser {
  id: number;
  name: string;
  email: string;
  role: 'saas_owner';
}

interface OwnerAuthContextValue {
  user: OwnerAuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<OwnerAuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<OwnerAuthUser>;
}

export const OwnerAuthContext = createContext<OwnerAuthContextValue | undefined>(undefined);

export const OwnerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<OwnerAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = React.useCallback(async () => {
    const response = await ownerApi.get('/owner/auth/me');
    const nextUser = response.data.user as OwnerAuthUser;
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);

      try {
        await refreshUser();
      } catch {
        localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const response = await ownerApi.post('/owner/auth/login', { email, password });
    const nextToken = response.data.token as string;
    const nextUser = response.data.user as OwnerAuthUser;

    localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);

    return nextUser;
  };

  const logout = async () => {
    try {
      await ownerApi.post('/owner/auth/logout');
    } catch {
      // Ignore API errors and always clear local state.
    } finally {
      localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo<OwnerAuthContextValue>(
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
    <OwnerAuthContext.Provider value={value}>
      {children}
    </OwnerAuthContext.Provider>
  );
};
