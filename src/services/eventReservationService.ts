import api from './api';
import type {
  EventForecast,
  EventReservationMenuItem,
  EventReservationRecord,
  EventReservationStatus,
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
