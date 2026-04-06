import api from './api';
import type {
  ConfirmOrderRequest,
  CreateGuestOrderRequest,
  OrderRecord,
} from '../types';

interface OrderResponse {
  message: string;
  order: OrderRecord;
}

interface PendingOrdersResponse {
  orders: OrderRecord[];
}

const sanitizeConfirmPayload = (payload: ConfirmOrderRequest): ConfirmOrderRequest => {
  const nextPayload: ConfirmOrderRequest = {};

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

export const confirmPendingOrder = async (
  orderId: number,
  payload: ConfirmOrderRequest
): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/orders/${orderId}/confirm`, sanitizeConfirmPayload(payload));
  return response.data;
};
