export const buildGuestMenuPath = (tableId: number | string): string => `/menu/table/${tableId}`;

const toDishSlug = (dishName: string, fallbackId?: number | string): string => {
  const normalized = dishName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized) {
    return normalized;
  }

  return fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim() !== ''
    ? String(fallbackId)
    : 'dish';
};

export const buildGuestDishPath = (
  tableId: number | string,
  dishId: number | string,
  dishName?: string | null,
): string => `/menu/table/${tableId}/dish/${toDishSlug(dishName || '', dishId)}`;

export const buildGuestDishIngredientsPath = (
  tableId: number | string,
  dishId: number | string,
  dishName?: string | null,
): string => `/menu/table/${tableId}/dish/${toDishSlug(dishName || '', dishId)}/ingredients`;

export const buildGuestRestaurantDishPath = (
  restaurantSlug: string,
  dishId: number | string,
  dishName?: string | null,
): string => `/menu/${encodeURIComponent(restaurantSlug)}/dish/${toDishSlug(dishName || '', dishId)}`;

export const buildGuestRestaurantDishIngredientsPath = (
  restaurantSlug: string,
  dishId: number | string,
  dishName?: string | null,
): string => `/menu/${encodeURIComponent(restaurantSlug)}/dish/${toDishSlug(dishName || '', dishId)}/ingredients`;

export const buildGenericGuestDishPath = (dishId: number | string, dishName?: string | null): string => (
  `/menu/dish/${toDishSlug(dishName || '', dishId)}`
);

export const buildGenericGuestDishIngredientsPath = (dishId: number | string, dishName?: string | null): string => (
  `/menu/dish/${toDishSlug(dishName || '', dishId)}/ingredients`
);

export const buildGuestOrderReviewPath = (tableId: number | string): string => `/menu/table/${tableId}/review`;

export const buildGuestOrdersPath = (tableId: number | string): string => `/menu/table/${tableId}/orders`;

export const buildGuestInvoicePath = (tableId: number | string): string => `/menu/table/${tableId}/invoice`;
