import api from './api';
import axios from 'axios';
import type {
  ActiveTableSessionRecord,
  AccountOrderRequest,
  CreateGuestOrderRequest,
  GuestDishIndexEntry,
  GuestDishesMeta,
  GuestTableDishResponse,
  GuestTableMenuResponse,
  InvoiceSplitMode,
  InvoiceSplitSummary,
  KitchenOrderRecord,
  OrderRecord,
  PosCheckoutRequest,
  PosCheckoutResponse,
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

interface KitchenOrdersResponse {
  orders: KitchenOrderRecord[];
}

interface KitchenOrderResponse {
  message: string;
  order: KitchenOrderRecord;
}

interface PublishedDishesResponse {
  dishes: PublishedDishSummary[];
}

interface GuestTablesResponse {
  restaurant: RestaurantSummary;
  tables: RestaurantTableSummary[];
}

export interface GuestMenuFetchOptions {
  include_dishes?: 'all' | 'page' | 'none';
  limit?: number;
  offset?: number;
  include_index?: boolean;
}

export interface GuestMenuListResponse {
  restaurant: RestaurantSummary;
  dishes?: GuestTableMenuResponse['dishes'];
  dish_index?: GuestDishIndexEntry[];
  dishes_page?: GuestTableMenuResponse['dishes_page'];
  dishes_meta?: GuestDishesMeta;
}

interface WaveResponse {
  message: string;
  wave: TableWaveRecord;
}

interface TableSessionActionResponse {
  message: string;
  table_session?: TableSessionSummary;
  invoice_preview?: {
    restaurant_name: string;
    table_name: string;
    generated_at: string;
    notes: string[];
    items: Array<{
      key: string;
      order_item_id?: number;
      dish_name: string;
      dish_name_ar?: string | null;
      quantity: number;
      unit_price: string;
      line_subtotal: string;
    }>;
    included_orders: string[];
    summary: {
      subtotal: string;
      discount_type: string | null;
      discount_value: string;
      discount_amount: string;
      taxable_subtotal: string;
      vat_rate: string;
      vat_amount: string;
      total: string;
    };
    invoice_split?: InvoiceSplitSummary;
  };
}

interface InvoiceSplitResponse {
  message?: string;
  invoice_split: InvoiceSplitSummary;
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

const isRouteMissing404 = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response?.status !== 404) {
    return false;
  }

  const contentTypeHeader = error.response?.headers?.['content-type'];
  const contentType = Array.isArray(contentTypeHeader)
    ? contentTypeHeader.join(';')
    : String(contentTypeHeader || '');

  return contentType.toLowerCase().includes('text/html');
};

const toFallbackTableSummary = (tableId: number | string) => {
  const numericTableId = Number(tableId);
  const normalizedId = Number.isFinite(numericTableId) && numericTableId > 0
    ? numericTableId
    : 0;

  return {
    id: normalizedId,
    number: normalizedId,
    name: normalizedId > 0 ? `Table ${normalizedId}` : 'Table',
  };
};

const defaultGuestAccess = (guestAccessToken?: string | null) => ({
  verified: false,
  token: guestAccessToken || undefined,
  joined_at: null,
  last_seen_at: null,
  expires_at: null,
});

const defaultProtectedActions = {
  ordering_unlocked: false,
  can_place_order: false,
  can_call_waiter: false,
  can_request_bill: false,
};

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
  guestAccessToken?: string | null,
  options?: GuestMenuFetchOptions
): Promise<GuestTableMenuResponse> => {
  try {
    const response = await api.get<GuestTableMenuResponse>(`/menu/table/${tableId}`, {
      params: {
        include_dishes: options?.include_dishes,
        limit: options?.limit,
        offset: options?.offset,
        include_index: options?.include_index ? 1 : undefined,
      },
      headers: buildGuestAccessHeaders(guestAccessToken),
    });
    return response.data;
  } catch (error) {
    if (!isRouteMissing404(error)) {
      throw error;
    }

    const fallbackResponse = await api.get<GuestMenuListResponse>('/menu/dishes', {
      params: {
        include_dishes: options?.include_dishes,
        limit: options?.limit,
        offset: options?.offset,
        include_index: options?.include_index ? 1 : undefined,
      },
    });

    return {
      restaurant: fallbackResponse.data.restaurant,
      table: toFallbackTableSummary(tableId),
      table_session: null,
      guest_access: defaultGuestAccess(guestAccessToken),
      protected_actions: defaultProtectedActions,
      dishes: fallbackResponse.data.dishes,
      dish_index: fallbackResponse.data.dish_index,
      dishes_page: fallbackResponse.data.dishes_page,
      dishes_meta: fallbackResponse.data.dishes_meta,
    };
  }
};

export const fetchGuestTableDish = async (
  tableId: number | string,
  dishId: number | string,
  guestAccessToken?: string | null
): Promise<GuestTableDishResponse> => {
  try {
    const response = await api.get<GuestTableDishResponse>(`/menu/table/${tableId}/dish/${dishId}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...buildGuestAccessHeaders(guestAccessToken),
      },
    });

    return response.data;
  } catch (error) {
    if (!isRouteMissing404(error)) {
      throw error;
    }

    const fallbackResponse = await api.get<{ dish: GuestTableDishResponse['dish']; restaurant: GuestTableDishResponse['restaurant'] }>(`/menu/dish/${dishId}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    return {
      restaurant: fallbackResponse.data.restaurant,
      table: toFallbackTableSummary(tableId),
      table_session: null,
      guest_access: defaultGuestAccess(guestAccessToken),
      protected_actions: defaultProtectedActions,
      dish: fallbackResponse.data.dish,
    };
  }
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
  restaurantSlug: string | undefined,
  payload: CreateGuestOrderRequest
): Promise<OrderResponse> => {
  const endpoint = restaurantSlug ? `/menu/${restaurantSlug}/orders` : '/menu/orders';
  const response = await api.post<OrderResponse>(endpoint, payload);
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

export const fetchGuestTableSessionInvoiceSplit = async (
  sessionId: number | string,
  guestAccessToken?: string | null
): Promise<InvoiceSplitSummary> => {
  const response = await api.get<InvoiceSplitResponse>(`/table-session/${sessionId}/invoice-split`, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });

  return response.data.invoice_split;
};

export const updateGuestTableSessionInvoiceSplit = async (
  sessionId: number | string,
  payload: {
    mode: InvoiceSplitMode;
    split_count?: number;
    people?: Array<{
      person_index: number;
      items: Array<{ order_item_id: number; quantity: number }>;
    }>;
  },
  guestAccessToken?: string | null
): Promise<InvoiceSplitSummary> => {
  const response = await api.patch<InvoiceSplitResponse>(`/table-session/${sessionId}/invoice-split`, payload, {
    headers: buildGuestAccessHeaders(guestAccessToken),
  });

  return response.data.invoice_split;
};

export const sendGuestWave = async (
  restaurantSlug: string | undefined,
  payload: { table_reference: string }
): Promise<WaveResponse> => {
  const endpoint = restaurantSlug ? `/menu/${restaurantSlug}/waves` : '/menu/waves';
  const response = await api.post<WaveResponse>(endpoint, payload);
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

export const activateGuestTableSession = async (tableId: number | string): Promise<{
  message: string;
  table_session: TableSessionSummary;
  current_pin: string | null;
  table: RestaurantTableSummary | null;
}> => {
  const response = await api.post<{
    message: string;
    table_session: TableSessionSummary;
    current_pin: string | null;
    table: RestaurantTableSummary | null;
  }>('/table-sessions/activate', {
    table_id: tableId,
  });
  return response.data;
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

export const fetchStaffTableSessionInvoiceSplit = async (sessionId: number | string): Promise<InvoiceSplitSummary> => {
  const response = await api.get<InvoiceSplitResponse>(`/table-sessions/${sessionId}/invoice-split`);
  return response.data.invoice_split;
};

export const fetchPendingOrders = async (): Promise<OrderRecord[]> => {
  const response = await api.get<PendingOrdersResponse>('/orders/pending-confirmation');
  return response.data.orders;
};

export const fetchKitchenOrders = async (
  status?: KitchenOrderRecord['kitchen_status'] | 'all'
): Promise<KitchenOrderRecord[]> => {
  const response = await api.get<KitchenOrdersResponse>('/kitchen/orders', {
    params: status && status !== 'all' ? { status } : undefined,
  });

  return response.data.orders;
};

export const fetchKitchenOrderDetails = async (orderId: number): Promise<KitchenOrderRecord> => {
  const response = await api.get<{ order: KitchenOrderRecord }>(`/kitchen/orders/${orderId}`);
  return response.data.order;
};

export const startKitchenOrder = async (orderId: number): Promise<KitchenOrderResponse> => {
  const response = await api.post<KitchenOrderResponse>(`/kitchen/orders/${orderId}/start`);
  return response.data;
};

export const markKitchenOrderReady = async (orderId: number): Promise<KitchenOrderResponse> => {
  const response = await api.post<KitchenOrderResponse>(`/kitchen/orders/${orderId}/ready`);
  return response.data;
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

export const quickPosCheckout = async (payload: PosCheckoutRequest): Promise<PosCheckoutResponse> => {
  const response = await api.post<PosCheckoutResponse>('/pos/checkout', payload);
  return response.data;
};
