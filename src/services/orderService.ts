import api from './api';
import type {
  AccountOrderRequest,
  CreateGuestOrderRequest,
  OrderRecord,
  RestaurantSummary,
  RestaurantTableSummary,
} from '../types';

interface OrderResponse {
  message: string;
  order: OrderRecord;
}

interface PendingOrdersResponse {
  orders: OrderRecord[];
}

interface GuestTablesResponse {
  restaurant: RestaurantSummary;
  tables: RestaurantTableSummary[];
}

const sanitizeAccountingPayload = (payload: AccountOrderRequest): AccountOrderRequest => {
  const nextPayload: AccountOrderRequest = {};

  if (typeof payload.vat_rate === 'number' && !Number.isNaN(payload.vat_rate)) {
    nextPayload.vat_rate = payload.vat_rate;
  }

  if (payload.discount_type) {
    nextPayload.discount_type = payload.discount_type;
  }

  if (typeof payload.discount_value === 'number' && !Number.isNaN(payload.discount_value)) {
    nextPayload.discount_value = payload.discount_value;
  }

  return nextPayload;
};

export const fetchGuestTables = async (restaurantSlug: string): Promise<GuestTablesResponse> => {
  const response = await api.get<GuestTablesResponse>(`/menu/${restaurantSlug}/tables`);
  return response.data;
};

export const createGuestOrder = async (
  restaurantSlug: string,
  payload: CreateGuestOrderRequest
): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/menu/${restaurantSlug}/orders`, payload);
  return response.data;
};

export const fetchPendingOrders = async (): Promise<OrderRecord[]> => {
  const response = await api.get<PendingOrdersResponse>('/orders/pending-confirmation');
  return response.data.orders;
};

export const confirmPendingOrder = async (orderId: number): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/orders/${orderId}/confirm`);
  return response.data;
};

export const cancelPendingOrder = async (orderId: number): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/orders/${orderId}/cancel`);
  return response.data;
};

export const fetchAccountingOrders = async (): Promise<OrderRecord[]> => {
  const response = await api.get<PendingOrdersResponse>('/orders/accounting');
  return response.data.orders;
};

export const accountConfirmedOrder = async (
  orderId: number,
  payload: AccountOrderRequest
): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/orders/${orderId}/account`, sanitizeAccountingPayload(payload));
  return response.data;
};
