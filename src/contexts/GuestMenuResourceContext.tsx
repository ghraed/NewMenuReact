/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { fetchGuestTableMenu } from '../services/orderService';
import type { Dish, GuestAccessSummary, GuestProtectedActions, GuestTableSummary, RestaurantSummary, TableSessionSummary } from '../types';

const DEFAULT_TTL_MS = 10_000;

export interface GuestMenuResourceData {
  restaurant: RestaurantSummary;
  dishes: Dish[];
  table: GuestTableSummary | null;
  table_session: TableSessionSummary | null;
  guest_access: GuestAccessSummary | null;
  protected_actions: GuestProtectedActions | null;
}

export interface GuestMenuQuery {
  tableId?: number | null;
  restaurantSlug?: string | null;
  guestAccessToken?: string | null;
  language?: string | null;
}

interface GuestMenuCacheEntry {
  data: GuestMenuResourceData | null;
  error: string | null;
  loading: boolean;
  lastLoadedAt: number | null;
}

interface GuestMenuResourceContextValue {
  buildKey: (query: GuestMenuQuery) => string | null;
  read: (key: string) => GuestMenuCacheEntry | null;
  ensure: (query: GuestMenuQuery, options?: { force?: boolean; ttlMs?: number }) => Promise<GuestMenuCacheEntry>;
}

const GuestMenuResourceContext = createContext<GuestMenuResourceContextValue | undefined>(undefined);

const toErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to load guest menu data.';
};

const buildQueryKey = (query: GuestMenuQuery): string | null => {
  const language = (query.language || '').trim() || 'default';
  const token = query.guestAccessToken || 'no-token';

  if (query.tableId && Number.isFinite(query.tableId) && query.tableId > 0) {
    return `table:${query.tableId}:token:${token}:lang:${language}`;
  }

  const slug = (query.restaurantSlug || '').trim();
  if (slug !== '') {
    return `slug:${slug}:lang:${language}`;
  }

  return `menu:default:lang:${language}`;
};

const fetchGuestMenuResource = async (query: GuestMenuQuery): Promise<GuestMenuResourceData> => {
  if (query.tableId && Number.isFinite(query.tableId) && query.tableId > 0) {
    const response = await fetchGuestTableMenu(query.tableId, query.guestAccessToken);
    return {
      restaurant: response.restaurant,
      dishes: response.dishes,
      table: response.table,
      table_session: response.table_session,
      guest_access: response.guest_access,
      protected_actions: response.protected_actions,
    };
  }

  const slug = (query.restaurantSlug || '').trim();
  const endpoint = slug ? `/menu/${slug}/dishes` : '/menu/dishes';
  const response = await api.get<{ restaurant: RestaurantSummary; dishes: Dish[] }>(endpoint);

  return {
    restaurant: response.data.restaurant,
    dishes: response.data.dishes,
    table: null,
    table_session: null,
    guest_access: null,
    protected_actions: null,
  };
};

export const GuestMenuResourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<Map<string, GuestMenuCacheEntry>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<GuestMenuCacheEntry>>>(new Map());
  const [, setVersion] = useState(0);

  const notify = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const read = useCallback((key: string): GuestMenuCacheEntry | null => {
    return cacheRef.current.get(key) ?? null;
  }, []);

  const ensure = useCallback(async (
    query: GuestMenuQuery,
    options?: { force?: boolean; ttlMs?: number }
  ): Promise<GuestMenuCacheEntry> => {
    const key = buildQueryKey(query);
    if (!key) {
      return {
        data: null,
        error: null,
        loading: false,
        lastLoadedAt: null,
      };
    }

    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const force = options?.force === true;
    const existing = cacheRef.current.get(key);
    const isFresh = Boolean(
      existing?.data
      && existing.lastLoadedAt
      && (Date.now() - existing.lastLoadedAt) < ttlMs
    );

    if (!force && isFresh) {
      return existing as GuestMenuCacheEntry;
    }

    const inFlight = inFlightRef.current.get(key);
    if (inFlight) {
      return inFlight;
    }

    cacheRef.current.set(key, {
      data: existing?.data ?? null,
      error: null,
      loading: true,
      lastLoadedAt: existing?.lastLoadedAt ?? null,
    });
    notify();

    const requestPromise = (async () => {
      try {
        const data = await fetchGuestMenuResource(query);
        const nextEntry: GuestMenuCacheEntry = {
          data,
          error: null,
          loading: false,
          lastLoadedAt: Date.now(),
        };
        cacheRef.current.set(key, nextEntry);
        return nextEntry;
      } catch (error) {
        const nextEntry: GuestMenuCacheEntry = {
          data: existing?.data ?? null,
          error: toErrorMessage(error),
          loading: false,
          lastLoadedAt: existing?.lastLoadedAt ?? null,
        };
        cacheRef.current.set(key, nextEntry);
        return nextEntry;
      } finally {
        inFlightRef.current.delete(key);
        notify();
      }
    })();

    inFlightRef.current.set(key, requestPromise);
    return requestPromise;
  }, [notify]);

  const value = useMemo<GuestMenuResourceContextValue>(() => ({
    buildKey: buildQueryKey,
    read,
    ensure,
  }), [ensure, read]);

  return (
    <GuestMenuResourceContext.Provider value={value}>
      {children}
    </GuestMenuResourceContext.Provider>
  );
};

export const useGuestMenuResource = (
  query: GuestMenuQuery,
  options?: { enabled?: boolean; ttlMs?: number }
) => {
  const context = useContext(GuestMenuResourceContext);
  if (!context) {
    throw new Error('useGuestMenuResource must be used within GuestMenuResourceProvider');
  }

  const key = context.buildKey(query);
  const enabled = options?.enabled !== false && Boolean(key);
  const snapshot = key ? context.read(key) : null;

  const status = !enabled
    ? 'idle'
    : snapshot?.loading
      ? 'loading'
      : snapshot?.error
        ? 'error'
        : snapshot?.data
          ? 'success'
          : 'idle';

  return {
    key,
    enabled,
    status,
    data: snapshot?.data ?? null,
    loading: snapshot?.loading ?? false,
    error: snapshot?.error ?? null,
    lastLoadedAt: snapshot?.lastLoadedAt ?? null,
    refresh: () => context.ensure(query, { force: true, ttlMs: options?.ttlMs }),
    ensure: () => context.ensure(query, { force: false, ttlMs: options?.ttlMs }),
  };
};
