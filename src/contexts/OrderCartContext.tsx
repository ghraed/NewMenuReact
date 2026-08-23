/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Dish,
  GuestAccessSummary,
  GuestOrderDraft,
  OrderCartItem,
  OrderCartRestaurant,
} from '../types';
import { resolveAssetUrl } from '../services/api';

interface OrderCartState {
  restaurant: OrderCartRestaurant | null;
  items: OrderCartItem[];
  draft: GuestOrderDraft;
}

interface AddDishOptions {
  restaurant: OrderCartRestaurant;
  quantity?: number;
}

interface OrderCartContextValue {
  restaurant: OrderCartRestaurant | null;
  items: OrderCartItem[];
  draft: GuestOrderDraft;
  totalItems: number;
  subtotal: number;
  setGuestContext: (context: {
    restaurant: OrderCartRestaurant;
    tableId: number;
    tableReference: string;
    tableSessionId: number;
    guestAccess?: GuestAccessSummary;
  }) => void;
  setGuestAccess: (access: {
    token: string;
    expiresAt: string | null;
  }) => void;
  clearGuestAccess: () => void;
  addDish: (dish: Dish, options: AddDishOptions) => void;
  removeDish: (dishId: number) => void;
  updateQuantity: (dishId: number, quantity: number) => void;
  clearCart: () => void;
  updateDraft: (nextDraft: Partial<GuestOrderDraft>) => void;
  getDishQuantity: (dishId: number) => number;
}

const ORDER_CART_STORAGE_KEY = 'guest_order_cart_state';

const defaultDraft: GuestOrderDraft = {
  tableId: null,
  tableSessionId: null,
  tableReference: '',
  guestAccessToken: null,
  guestAccessVerified: false,
  guestAccessExpiresAt: null,
  notes: '',
};

const defaultState: OrderCartState = {
  restaurant: null,
  items: [],
  draft: defaultDraft,
};

export const OrderCartContext = createContext<OrderCartContextValue | undefined>(undefined);

const normalizeState = (value: unknown): OrderCartState => {
  if (!value || typeof value !== 'object') {
    return defaultState;
  }

  const candidate = value as Partial<OrderCartState>;

  return {
    restaurant: candidate.restaurant && typeof candidate.restaurant.slug === 'string'
      ? candidate.restaurant
      : null,
    items: Array.isArray(candidate.items)
      ? candidate.items
          .filter((item): item is OrderCartItem => (
            typeof item?.dishId === 'number' &&
            typeof item?.name === 'string' &&
            typeof item?.description === 'string' &&
            typeof item?.price === 'number' &&
            typeof item?.quantity === 'number'
          ))
          .map((item) => ({
            ...item,
            quantity: Math.max(1, Math.floor(item.quantity)),
          }))
      : [],
    draft: {
      tableId: typeof candidate.draft?.tableId === 'number' ? candidate.draft.tableId : null,
      tableSessionId: typeof candidate.draft?.tableSessionId === 'number' ? candidate.draft.tableSessionId : null,
      tableReference: typeof candidate.draft?.tableReference === 'string' ? candidate.draft.tableReference : '',
      guestAccessToken: typeof candidate.draft?.guestAccessToken === 'string' ? candidate.draft.guestAccessToken : null,
      guestAccessVerified: candidate.draft?.guestAccessVerified === true,
      guestAccessExpiresAt: typeof candidate.draft?.guestAccessExpiresAt === 'string' ? candidate.draft.guestAccessExpiresAt : null,
      notes: typeof candidate.draft?.notes === 'string' ? candidate.draft.notes : '',
    },
  };
};

const dishToCartItem = (dish: Dish, quantity: number): OrderCartItem => ({
  dishId: dish.id,
  name: dish.name,
  description: dish.description || '',
  price: Number(dish.price),
  quantity,
  calories: dish.calories,
  previewImageUrl: resolveAssetUrl(
    dish.assets.find((asset) => asset.asset_type === 'preview_image')?.file_url
      || dish.image_url
      || dish.dish_ingredients?.find((row) => row.ingredient?.file_url)?.ingredient?.file_url
  ),
});

export const OrderCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OrderCartState>(() => {
    try {
      const stored = localStorage.getItem(ORDER_CART_STORAGE_KEY);
      return stored ? normalizeState(JSON.parse(stored)) : defaultState;
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    localStorage.setItem(ORDER_CART_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setGuestContext = useCallback((context: {
    restaurant: OrderCartRestaurant;
    tableId: number;
    tableReference: string;
    tableSessionId: number;
    guestAccess?: GuestAccessSummary;
  }) => {
    setState((current) => {
      const sessionChanged = current.draft.tableSessionId !== context.tableSessionId;
      const shouldResetItems = (
        current.restaurant?.slug !== context.restaurant.slug
        || (current.draft.tableSessionId !== null && sessionChanged)
      );
      const hasExistingVerifiedAccess = (
        current.draft.guestAccessVerified
        && Boolean(current.draft.guestAccessToken)
      );
      const incomingVerifiedAccess = context.guestAccess?.verified === true;
      const incomingGuestAccessToken = (
        typeof context.guestAccess?.token === 'string' && context.guestAccess.token.trim() !== ''
          ? context.guestAccess.token
          : null
      );

      // Keep verified guest access when stale/unverified payloads arrive for the same session.
      const shouldKeepExistingAccess = !sessionChanged && hasExistingVerifiedAccess && !incomingVerifiedAccess;
      const nextGuestAccessToken = sessionChanged
        ? (incomingVerifiedAccess ? incomingGuestAccessToken : null)
        : incomingVerifiedAccess
          ? (incomingGuestAccessToken || current.draft.guestAccessToken)
          : shouldKeepExistingAccess
            ? current.draft.guestAccessToken
          : null;
      const nextGuestAccessVerified = sessionChanged
        ? incomingVerifiedAccess && Boolean(nextGuestAccessToken)
        : (incomingVerifiedAccess || shouldKeepExistingAccess) && Boolean(nextGuestAccessToken);
      const nextGuestAccessExpiresAt = sessionChanged
        ? (incomingVerifiedAccess ? (context.guestAccess?.expires_at ?? null) : null)
        : incomingVerifiedAccess
          ? context.guestAccess?.expires_at ?? current.draft.guestAccessExpiresAt
          : shouldKeepExistingAccess
            ? current.draft.guestAccessExpiresAt
            : null;

      return {
        restaurant: context.restaurant,
        items: shouldResetItems ? [] : current.items,
        draft: {
          ...current.draft,
          tableId: context.tableId,
          tableReference: context.tableReference,
          tableSessionId: context.tableSessionId,
          guestAccessToken: nextGuestAccessToken,
          guestAccessVerified: nextGuestAccessVerified && Boolean(nextGuestAccessToken),
          guestAccessExpiresAt: nextGuestAccessExpiresAt,
        },
      };
    });
  }, []);

  const setGuestAccess = useCallback((access: {
    token: string;
    expiresAt: string | null;
  }) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        guestAccessToken: access.token,
        guestAccessVerified: true,
        guestAccessExpiresAt: access.expiresAt,
      },
    }));
  }, []);

  const clearGuestAccess = useCallback(() => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        guestAccessToken: null,
        guestAccessVerified: false,
        guestAccessExpiresAt: null,
      },
    }));
  }, []);

  const addDish = useCallback((dish: Dish, options: AddDishOptions) => {
    if (dish.is_orderable === false || dish.is_out_of_stock === true) {
      return;
    }

    const quantityToAdd = Math.max(1, Math.floor(options.quantity ?? 1));

    setState((current) => {
      const sameRestaurant = !current.restaurant || current.restaurant.slug === options.restaurant.slug;
      const baseState = sameRestaurant
        ? current
        : {
            restaurant: options.restaurant,
            items: [],
            draft: current.draft,
          };

      const existingItem = baseState.items.find((item) => item.dishId === dish.id);

      return {
        ...baseState,
        restaurant: options.restaurant,
        items: existingItem
          ? baseState.items.map((item) => (
            item.dishId === dish.id
              ? { ...item, quantity: item.quantity + quantityToAdd }
              : item
          ))
          : [...baseState.items, dishToCartItem(dish, quantityToAdd)],
      };
    });
  }, []);

  const removeDish = useCallback((dishId: number) => {
    setState((current) => {
      const nextItems = current.items.filter((item) => item.dishId !== dishId);

      return {
        ...current,
        items: nextItems,
      };
    });
  }, []);

  const updateQuantity = useCallback((dishId: number, quantity: number) => {
    if (quantity <= 0) {
      removeDish(dishId);
      return;
    }

    setState((current) => ({
      ...current,
      items: current.items.map((item) => (
        item.dishId === dishId
          ? { ...item, quantity: Math.max(1, Math.floor(quantity)) }
          : item
      )),
    }));
  }, [removeDish]);

  const clearCart = useCallback(() => {
    setState((current) => ({
      restaurant: current.restaurant,
      items: [],
      draft: current.draft,
    }));
  }, []);

  const updateDraft = useCallback((nextDraft: Partial<GuestOrderDraft>) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        ...nextDraft,
      },
    }));
  }, []);

  const value = useMemo<OrderCartContextValue>(() => {
    const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      restaurant: state.restaurant,
      items: state.items,
      draft: state.draft,
      totalItems,
      subtotal,
      setGuestContext,
      setGuestAccess,
      clearGuestAccess,
      addDish,
      removeDish,
      updateQuantity,
      clearCart,
      updateDraft,
      getDishQuantity: (dishId: number) => state.items.find((item) => item.dishId === dishId)?.quantity ?? 0,
    };
  }, [
    state,
    setGuestContext,
    setGuestAccess,
    clearGuestAccess,
    addDish,
    removeDish,
    updateQuantity,
    clearCart,
    updateDraft,
  ]);

  return <OrderCartContext.Provider value={value}>{children}</OrderCartContext.Provider>;
};
