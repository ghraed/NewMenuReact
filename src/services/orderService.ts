import api from './api';
import type {
  AccountOrderRequest,
  CreateGuestOrderRequest,
  OrderRecord,
  PublishedDishSummary,
  RestaurantSummary,
  RestaurantTableSummary,
  TableWaveRecord,
  UpdatePendingOrderRequest,
} from '../types';

interface OrderResponse {
  message: string;
  order: OrderRecord;
}

interface PendingOrdersResponse {
  orders: OrderRecord[];
}

interface PublishedDishesResponse {
  dishes: PublishedDishSummary[];
}

interface GuestTablesResponse {
  restaurant: RestaurantSummary;
  tables: RestaurantTableSummary[];
}

interface WaveResponse {
  message: string;
  wave: TableWaveRecord;
}

interface PendingWavesResponse {
  waves: TableWaveRecord[];
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

export const sendGuestWave = async (
  restaurantSlug: string,
  payload: { table_reference: string }
): Promise<WaveResponse> => {
  const response = await api.post<WaveResponse>(`/menu/${restaurantSlug}/waves`, payload);
  return response.data;
};

export const fetchPendingOrders = async (): Promise<OrderRecord[]> => {
  const response = await api.get<PendingOrdersResponse>('/orders/pending-confirmation');
  return response.data.orders;
};

export const fetchPendingWaves = async (): Promise<TableWaveRecord[]> => {
  const response = await api.get<PendingWavesResponse>('/waves/pending');
  return response.data.waves;
};

export const resolvePendingWave = async (waveId: number): Promise<WaveResponse> => {
  const response = await api.post<WaveResponse>(`/waves/${waveId}/resolve`);
  return response.data;
};

export const confirmPendingOrder = async (orderId: number): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/orders/${orderId}/confirm`);
  return response.data;
};

export const updatePendingOrder = async (
  orderId: number,
  payload: UpdatePendingOrderRequest
): Promise<OrderResponse> => {
  const response = await api.patch<OrderResponse>(`/orders/${orderId}`, payload);
  return response.data;
};

export const cancelPendingOrder = async (orderId: number): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/orders/${orderId}/cancel`);
  return response.data;
};

export const fetchPublishedDishes = async (): Promise<PublishedDishSummary[]> => {
  const response = await api.get<PublishedDishesResponse>('/dishes/published');
  return response.data.dishes;
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
