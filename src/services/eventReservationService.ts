import api from './api';
import type {
  Dish,
  EventForecast,
  EventReservationMenuItem,
  EventReservationRecord,
  EventReservationStatus,
  PublishedDishSummary,
} from '../types';

interface EventListResponse {
  events: EventReservationRecord[];
  pagination?: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

interface EventResponse {
  message?: string;
  event: EventReservationRecord;
}

interface EventForecastResponse {
  forecast: EventForecast;
}

interface EventOrderDraftResponse {
  message: string;
  created: boolean;
  order: {
    id: number;
    order_number: string | null;
    status: string;
    table_reference: string | null;
    total: string | number;
    created_at: string | null;
  };
}

interface DishListPayload {
  data?: unknown;
  current_page?: number;
  last_page?: number;
}

const parseDishListPage = (payload: unknown): { items: Dish[]; currentPage: number; lastPage: number } => {
  if (Array.isArray(payload)) {
    return { items: payload as Dish[], currentPage: 1, lastPage: 1 };
  }

  if (typeof payload !== 'object' || payload === null) {
    return { items: [], currentPage: 1, lastPage: 1 };
  }

  const pagePayload = payload as DishListPayload;
  const items = Array.isArray(pagePayload.data) ? (pagePayload.data as Dish[]) : [];
  const currentPage = Number.isFinite(pagePayload.current_page) ? Number(pagePayload.current_page) : 1;
  const lastPage = Number.isFinite(pagePayload.last_page) ? Number(pagePayload.last_page) : 1;

  return { items, currentPage, lastPage };
};

export interface EventReservationPayload {
  title: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  room_plan_id?: number | null;
  invoice_id?: number | null;
  event_date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
  status?: EventReservationStatus;
}

export const fetchAdminEvents = async (params?: {
  date_from?: string;
  date_to?: string;
  status?: EventReservationStatus | 'all';
}): Promise<EventReservationRecord[]> => {
  const response = await api.get<EventListResponse>('/admin/events', {
    params: {
      date_from: params?.date_from,
      date_to: params?.date_to,
      status: params?.status && params.status !== 'all' ? params.status : undefined,
    },
  });

  return response.data.events ?? [];
};

export const createAdminEvent = async (payload: EventReservationPayload): Promise<EventReservationRecord> => {
  const response = await api.post<EventResponse>('/admin/events', payload);
  return response.data.event;
};

export const updateAdminEvent = async (
  eventId: number,
  payload: Partial<EventReservationPayload>
): Promise<EventReservationRecord> => {
  const response = await api.patch<EventResponse>(`/admin/events/${eventId}`, payload);
  return response.data.event;
};

export const setAdminEventStatus = async (
  eventId: number,
  action: 'confirm' | 'cancel' | 'complete'
): Promise<EventReservationRecord> => {
  const response = await api.post<EventResponse>(`/admin/events/${eventId}/${action}`);
  return response.data.event;
};

export const fetchAdminEventDishOptions = async (): Promise<PublishedDishSummary[]> => {
  const perPage = 200;
  let currentPage = 1;
  let lastPage = 1;
  const dishes: PublishedDishSummary[] = [];

  do {
    const response = await api.get('/dishes', {
      params: {
        include_deleted: '0',
        page: String(currentPage),
        per_page: String(perPage),
      },
    });

    const parsed = parseDishListPage(response.data);
    dishes.push(
      ...parsed.items
        .filter((dish) => dish.status === 'published')
        .map((dish) => ({
          id: dish.id,
          name: dish.name,
          price: Number(dish.price),
          category: dish.category,
          is_orderable: dish.is_orderable,
          is_out_of_stock: dish.is_out_of_stock,
          alternative_dishes: dish.alternative_dishes?.map((alternative) => ({
            id: alternative.id,
            name: alternative.name,
            price: Number(alternative.price),
            category: alternative.category,
          })),
        }))
    );

    currentPage += 1;
    lastPage = parsed.lastPage;
  } while (currentPage <= lastPage);

  return dishes;
};

export const replaceAdminEventMenuItems = async (
  eventId: number,
  items: EventReservationMenuItem[]
): Promise<EventReservationRecord> => {
  const response = await api.put<EventResponse>(`/admin/events/${eventId}/menu-items`, {
    items: items.map((item) => ({
      dish_id: item.dish_id,
      planned_quantity: item.planned_quantity,
      prep_notes: item.prep_notes ?? null,
    })),
  });

  return response.data.event;
};

export const fetchAdminEventForecast = async (eventId: number): Promise<EventForecast> => {
  const response = await api.get<EventForecastResponse>(`/admin/events/${eventId}/forecast`);
  return response.data.forecast;
};

export const generateAdminEventOrderDraft = async (eventId: number): Promise<EventOrderDraftResponse> => {
  const response = await api.post<EventOrderDraftResponse>(`/admin/events/${eventId}/generate-order-draft`);
  return response.data;
};
