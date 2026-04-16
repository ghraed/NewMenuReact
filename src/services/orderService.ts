import api from './api';
import type {
  ActiveTableSessionRecord,
  AccountOrderRequest,
  CreateGuestOrderRequest,
  GuestTableDishResponse,
  GuestTableMenuResponse,
  OrderRecord,
  PublishedDishSummary,
  RestaurantSummary,
  RestaurantTableSummary,
  TableSessionSummary,
  TableWaveRecord,
  UpdatePendingOrderRequest,
} from '../types';
import { buildGuestAccessHeaders } from '../utils/guestAccess';

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

interface TableSessionActionResponse {
  message: string;
  table_session?: TableSessionSummary;
}

interface PendingWavesResponse {
  waves: TableWaveRecord[];
}

interface VerifyGuestTablePinResponse {
  message: string;
  restaurant: RestaurantSummary;
  table: GuestTableMenuResponse['table'];
  table_session: TableSessionSummary;
  guest_access: {
    token: string;
    verified: boolean;
    joined_at: string | null;
    last_seen_at: string | null;
    expires_at: string | null;
  };
  protected_actions: GuestTableMenuResponse['protected_actions'];
}

interface ActiveTableSessionsResponse {
  table_sessions: ActiveTableSessionRecord[];
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

export const fetchGuestTableMenu = async (
  tableId: number | string,
  guestAccessToken?: string | null
): Promise<GuestTableMenuResponse> => {
  const response = await api.get<GuestTableMenuResponse>(`/menu/table/${tableId}`, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });
  return response.data;
};

export const fetchGuestTableDish = async (
  tableId: number | string,
  dishId: number | string,
  guestAccessToken?: string | null
): Promise<GuestTableDishResponse> => {
  const response = await api.get<GuestTableDishResponse>(`/menu/table/${tableId}/dish/${dishId}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...buildGuestAccessHeaders(guestAccessToken),
    },
  });

  return response.data;
};

export const verifyGuestTablePin = async (
  tableId: number | string,
  pin: string
): Promise<VerifyGuestTablePinResponse> => {
  const response = await api.post<VerifyGuestTablePinResponse>(`/menu/table/${tableId}/verify-pin`, {
    pin,
  }, {
    headers: buildGuestAccessHeaders(),
  });

  return response.data;
};

export const createGuestOrder = async (
  restaurantSlug: string,
  payload: CreateGuestOrderRequest
): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/menu/${restaurantSlug}/orders`, payload);
  return response.data;
};

export const createGuestTableSessionOrder = async (
  sessionId: number | string,
  payload: CreateGuestOrderRequest,
  guestAccessToken?: string | null
): Promise<OrderResponse> => {
  const response = await api.post<OrderResponse>(`/table-session/${sessionId}/order`, payload, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });
  return response.data;
};

export const fetchGuestTableSessionOrders = async (
  sessionId: number | string,
  guestAccessToken?: string | null
): Promise<OrderRecord[]> => {
  const response = await api.get<PendingOrdersResponse>(`/table-session/${sessionId}/orders`, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });

  return response.data.orders;
};

export const sendGuestWave = async (
  restaurantSlug: string,
  payload: { table_reference: string }
): Promise<WaveResponse> => {
  const response = await api.post<WaveResponse>(`/menu/${restaurantSlug}/waves`, payload);
  return response.data;
};

export const callGuestTableWaiter = async (
  sessionId: number | string,
  guestAccessToken?: string | null
): Promise<WaveResponse> => {
  const response = await api.post<WaveResponse>(`/table-session/${sessionId}/call-waiter`, undefined, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });
  return response.data;
};

export const requestGuestTableBill = async (
  sessionId: number | string,
  guestAccessToken?: string | null
): Promise<TableSessionActionResponse> => {
  const response = await api.post<TableSessionActionResponse>(`/table-session/${sessionId}/request-bill`, undefined, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });
  return response.data;
};

export const fetchActiveTableSessions = async (): Promise<ActiveTableSessionRecord[]> => {
  const response = await api.get<ActiveTableSessionsResponse>('/table-sessions/active');
  return response.data.table_sessions;
};

export const resetActiveTableSessionPin = async (sessionId: number | string): Promise<{
  message: string;
  table_session: TableSessionSummary;
  current_pin: string | null;
}> => {
  const response = await api.post<{
    message: string;
    table_session: TableSessionSummary;
    current_pin: string | null;
  }>(`/table-sessions/${sessionId}/reset-pin`);
  return response.data;
};

export const finalizeGuestTableSession = async (sessionId: number | string): Promise<TableSessionActionResponse> => {
  const response = await api.post<TableSessionActionResponse>(`/table-sessions/${sessionId}/finalize`);
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
