export const buildGuestMenuPath = (tableId: number | string): string => `/menu/table/${tableId}`;

export const buildGuestDishPath = (tableId: number | string, dishId: number | string): string => (
  `/menu/table/${tableId}/dish/${dishId}`
);

export const buildGuestDishIngredientsPath = (tableId: number | string, dishId: number | string): string => (
  `/menu/table/${tableId}/dish/${dishId}/ingredients`
);

export const buildGuestOrderReviewPath = (tableId: number | string): string => `/menu/table/${tableId}/review`;

export const buildGuestOrdersPath = (tableId: number | string): string => `/menu/table/${tableId}/orders`;

export const buildGuestInvoicePath = (tableId: number | string): string => `/menu/table/${tableId}/invoice`;
