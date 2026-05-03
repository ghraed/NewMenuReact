/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { fetchGuestTableMenu } from '../services/orderService';
import type { GuestMenuFetchOptions, GuestMenuListResponse } from '../services/orderService';
import type {
  Dish,
  GuestAccessSummary,
  GuestDishIndexEntry,
  GuestDishesMeta,
  GuestProtectedActions,
  GuestTableSummary,
  RestaurantSummary,
  TableSessionSummary,
} from '../types';

const DEFAULT_TTL_MS = 10_000;

export interface GuestMenuResourceData {
  restaurant: RestaurantSummary;
  dishes: Dish[];
  dish_index: GuestDishIndexEntry[];
  dishes_meta: GuestDishesMeta | null;
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
  includeDishes?: 'all' | 'page' | 'none';
  limit?: number;
  offset?: number;
  includeIndex?: boolean;
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
  const includeDishes = query.includeDishes || 'all';
  const limit = typeof query.limit === 'number' ? query.limit : 'na';
  const offset = typeof query.offset === 'number' ? query.offset : 'na';
  const includeIndex = query.includeIndex === true ? '1' : '0';

  if (query.tableId && Number.isFinite(query.tableId) && query.tableId > 0) {
    return `table:${query.tableId}:token:${token}:lang:${language}:dishes:${includeDishes}:limit:${limit}:offset:${offset}:index:${includeIndex}`;
  }

  const slug = (query.restaurantSlug || '').trim();
  if (slug !== '') {
    return `slug:${slug}:lang:${language}:dishes:${includeDishes}:limit:${limit}:offset:${offset}:index:${includeIndex}`;
  }

  return `menu:default:lang:${language}:dishes:${includeDishes}:limit:${limit}:offset:${offset}:index:${includeIndex}`;
};

const deriveDishIndexFromDishes = (dishes: Dish[]): GuestDishIndexEntry[] => {
  return dishes.map((dish) => ({
    id: dish.id,
    uuid: dish.uuid,
    name: dish.name,
    name_ar: dish.name_ar ?? null,
    description: dish.description,
    description_ar: dish.description_ar ?? null,
    category: dish.category,
    category_ar: dish.category_ar ?? null,
    is_anchor: dish.is_anchor ?? false,
    is_profitable: dish.is_profitable ?? false,
    is_orderable: dish.is_orderable,
    is_out_of_stock: dish.is_out_of_stock,
    image_url: dish.image_url ?? null,
    ingredients: (dish.dish_ingredients || [])
      .map((row) => row.ingredient)
      .filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient))
      .map((ingredient) => ({
        name: ingredient.name,
        name_ar: ingredient.name_ar ?? null,
      })),
  }));
};

const normalizeGuestMenuResourceData = (payload: {
  restaurant: RestaurantSummary;
  dishes?: Dish[];
  dishes_page?: Dish[];
  dish_index?: GuestDishIndexEntry[];
  dishes_meta?: GuestDishesMeta;
  table: GuestTableSummary | null;
  table_session: TableSessionSummary | null;
  guest_access: GuestAccessSummary | null;
  protected_actions: GuestProtectedActions | null;
}): GuestMenuResourceData => {
  const dishes = Array.isArray(payload.dishes)
    ? payload.dishes
    : Array.isArray(payload.dishes_page)
      ? payload.dishes_page
      : [];

  const dishIndex = Array.isArray(payload.dish_index) && payload.dish_index.length > 0
    ? payload.dish_index
    : deriveDishIndexFromDishes(dishes);

  return {
    restaurant: payload.restaurant,
    dishes,
    dish_index: dishIndex,
    dishes_meta: payload.dishes_meta ?? null,
    table: payload.table,
    table_session: payload.table_session,
    guest_access: payload.guest_access,
    protected_actions: payload.protected_actions,
  };
};

const fetchGuestMenuResource = async (query: GuestMenuQuery): Promise<GuestMenuResourceData> => {
  const menuOptions: GuestMenuFetchOptions = {
    include_dishes: query.includeDishes,
    limit: query.limit,
    offset: query.offset,
    include_index: query.includeIndex,
  };

  if (query.tableId && Number.isFinite(query.tableId) && query.tableId > 0) {
    const response = await fetchGuestTableMenu(query.tableId, query.guestAccessToken, menuOptions);
    return normalizeGuestMenuResourceData({
      restaurant: response.restaurant,
      dishes: response.dishes,
      dishes_page: response.dishes_page,
      dish_index: response.dish_index,
      dishes_meta: response.dishes_meta,
      table: response.table,
      table_session: response.table_session,
      guest_access: response.guest_access,
      protected_actions: response.protected_actions,
    });
  }

  const slug = (query.restaurantSlug || '').trim();
  const endpoint = slug ? `/menu/${slug}/dishes` : '/menu/dishes';
  const response = await api.get<GuestMenuListResponse>(endpoint, {
    params: {
      include_dishes: menuOptions.include_dishes,
      limit: menuOptions.limit,
      offset: menuOptions.offset,
      include_index: menuOptions.include_index ? 1 : undefined,
    },
  });

  return normalizeGuestMenuResourceData({
    restaurant: response.data.restaurant,
    dishes: response.data.dishes,
    dishes_page: response.data.dishes_page,
    dish_index: response.data.dish_index,
    dishes_meta: response.data.dishes_meta,
    table: null,
    table_session: null,
    guest_access: null,
    protected_actions: null,
  });
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
