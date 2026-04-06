/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useMemo, useState } from 'react';
import type {
  Dish,
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
  addDish: (dish: Dish, options: AddDishOptions) => void;
  removeDish: (dishId: number) => void;
  updateQuantity: (dishId: number, quantity: number) => void;
  clearCart: () => void;
  updateDraft: (nextDraft: Partial<GuestOrderDraft>) => void;
  getDishQuantity: (dishId: number) => number;
}

const ORDER_CART_STORAGE_KEY = 'guest_order_cart_state';

const defaultDraft: GuestOrderDraft = {
  guestName: '',
  guestPhone: '',
  guestEmail: '',
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
      guestName: typeof candidate.draft?.guestName === 'string' ? candidate.draft.guestName : '',
      guestPhone: typeof candidate.draft?.guestPhone === 'string' ? candidate.draft.guestPhone : '',
      guestEmail: typeof candidate.draft?.guestEmail === 'string' ? candidate.draft.guestEmail : '',
      notes: typeof candidate.draft?.notes === 'string' ? candidate.draft.notes : '',
    },
  };
};

const dishToCartItem = (dish: Dish, quantity: number): OrderCartItem => ({
  dishId: dish.id,
  name: dish.name,
  description: dish.description,
  price: Number(dish.price),
  quantity,
  calories: dish.calories,
  previewImageUrl: resolveAssetUrl(
    dish.assets.find((asset) => asset.asset_type === 'preview_image')?.file_url
      || dish.image_url
      || dish.assets.find((asset) => asset.asset_type === 'ingredient_image')?.file_url
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

  const addDish = (dish: Dish, options: AddDishOptions) => {
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
  };

  const removeDish = (dishId: number) => {
    setState((current) => {
      const nextItems = current.items.filter((item) => item.dishId !== dishId);

      return {
        ...current,
        restaurant: nextItems.length > 0 ? current.restaurant : null,
        items: nextItems,
      };
    });
  };

  const updateQuantity = (dishId: number, quantity: number) => {
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
  };

  const clearCart = () => {
    setState((current) => ({
      restaurant: null,
      items: [],
      draft: current.draft,
    }));
  };

  const updateDraft = (nextDraft: Partial<GuestOrderDraft>) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        ...nextDraft,
      },
    }));
  };

  const value = useMemo<OrderCartContextValue>(() => {
    const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      restaurant: state.restaurant,
      items: state.items,
      draft: state.draft,
      totalItems,
      subtotal,
      addDish,
      removeDish,
      updateQuantity,
      clearCart,
      updateDraft,
      getDishQuantity: (dishId: number) => state.items.find((item) => item.dishId === dishId)?.quantity ?? 0,
    };
  }, [state]);

  return <OrderCartContext.Provider value={value}>{children}</OrderCartContext.Provider>;
};
