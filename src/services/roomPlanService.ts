import api from './api';
import type {
  CreateReservationPayload,
  ReservationRecord,
  RoomPlan,
  RoomPlanAvailabilityRow,
  RoomPlanItem,
  ReservationStatus,
} from '../types';

interface RoomPlansResponse {
  room_plans: RoomPlan[];
}

interface RoomPlanResponse {
  room_plan: RoomPlan;
}

interface RoomPlanItemsResponse {
  items: RoomPlanItem[];
  message?: string;
}

interface ReservationsResponse {
  reservations: ReservationRecord[];
}

interface ReservationResponse {
  reservation: ReservationRecord;
  message?: string;
}

interface AvailabilityResponse {
  room_plan_id: number;
  availability: RoomPlanAvailabilityRow[];
}

interface PublicRoomPlansResponse {
  room_plans: RoomPlan[];
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
}

export const fetchRoomPlans = async (): Promise<RoomPlan[]> => {
  const response = await api.get<RoomPlansResponse>('/room-plans');
  return response.data.room_plans ?? [];
};

export const fetchRoomPlan = async (roomPlanId: number): Promise<RoomPlan> => {
  const response = await api.get<RoomPlanResponse>(`/room-plans/${roomPlanId}`);
  return response.data.room_plan;
};

export const createRoomPlan = async (payload: { name: string; width: number; height: number }): Promise<RoomPlan> => {
  const response = await api.post<RoomPlanResponse>('/room-plans', payload);
  return response.data.room_plan;
};

export const updateRoomPlan = async (
  roomPlanId: number,
  payload: Partial<Pick<RoomPlan, 'name' | 'width' | 'height'>>
): Promise<RoomPlan> => {
  const response = await api.patch<RoomPlanResponse>(`/room-plans/${roomPlanId}`, payload);
  return response.data.room_plan;
};

export const deleteRoomPlan = async (roomPlanId: number): Promise<void> => {
  await api.delete(`/room-plans/${roomPlanId}`);
};

export const uploadRoomPlanBackground = async (roomPlanId: number, file: File): Promise<RoomPlan> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<RoomPlanResponse>(`/room-plans/${roomPlanId}/background`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.room_plan;
};

export const saveRoomPlanItemsBulk = async (roomPlanId: number, items: RoomPlanItem[]): Promise<RoomPlanItem[]> => {
  const response = await api.put<RoomPlanItemsResponse>(`/room-plans/${roomPlanId}/items/bulk`, {
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
      seats: item.seats,
      z_index: item.z_index,
      container: item.container,
      is_active: item.is_active,
    })),
  });

  return response.data.items ?? [];
};

export const duplicateRoomPlanItem = async (roomPlanId: number, itemId: number): Promise<RoomPlanItem> => {
  const response = await api.post<{ item: RoomPlanItem }>(`/room-plans/${roomPlanId}/items/${itemId}/duplicate`);
  return response.data.item;
};

export const deleteRoomPlanItem = async (roomPlanId: number, itemId: number): Promise<void> => {
  await api.delete(`/room-plans/${roomPlanId}/items/${itemId}`);
};

export const fetchAdminReservations = async (params?: {
  reservation_date?: string;
  room_plan_id?: number;
}): Promise<ReservationRecord[]> => {
  const response = await api.get<ReservationsResponse>('/admin/reservations', {
    params,
  });
  return response.data.reservations ?? [];
};

export const createAdminReservation = async (payload: CreateReservationPayload): Promise<ReservationRecord> => {
  const response = await api.post<ReservationResponse>('/admin/reservations', payload);
  return response.data.reservation;
};

export const updateAdminReservation = async (
  reservationId: number,
  payload: Partial<CreateReservationPayload & { status: ReservationStatus }>
): Promise<ReservationRecord> => {
  const response = await api.patch<ReservationResponse>(`/admin/reservations/${reservationId}`, payload);
  return response.data.reservation;
};

export const setAdminReservationStatus = async (
  reservationId: number,
  action: 'busy' | 'complete' | 'cancel' | 'no-show'
): Promise<ReservationRecord> => {
  const response = await api.post<ReservationResponse>(`/admin/reservations/${reservationId}/${action}`);
  return response.data.reservation;
};

export const fetchPublicRoomPlans = async (): Promise<PublicRoomPlansResponse> => {
  const response = await api.get<PublicRoomPlansResponse>('/reservations/room-plans');
  return response.data;
};

export const fetchPublicRoomPlan = async (roomPlanId: number): Promise<RoomPlan> => {
  const response = await api.get<RoomPlanResponse>(`/reservations/room-plans/${roomPlanId}`);
  return response.data.room_plan;
};

export const fetchTableAvailability = async (params: {
  room_plan_id: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
}): Promise<RoomPlanAvailabilityRow[]> => {
  const response = await api.get<AvailabilityResponse>('/reservations/availability', {
    params,
  });

  return response.data.availability ?? [];
};

export const createPublicReservation = async (payload: CreateReservationPayload): Promise<ReservationRecord> => {
  const response = await api.post<ReservationResponse>('/reservations', payload);
  return response.data.reservation;
};
