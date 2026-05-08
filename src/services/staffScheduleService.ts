import api from './api';
import type { StaffShift } from '../types';

export interface StaffScheduleFilters {
  date_from?: string;
  date_to?: string;
  user_id?: number;
  position?: string;
  status?: string;
}

interface StaffScheduleListResponse {
  shifts: StaffShift[];
}

interface StaffScheduleMutationResponse {
  message: string;
  shift: StaffShift;
}

export interface CreateStaffShiftPayload {
  user_id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  position?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'absent' | 'replaced';
  notes?: string;
}

export type UpdateStaffShiftPayload = Partial<CreateStaffShiftPayload>;

export const fetchStaffSchedules = async (filters: StaffScheduleFilters): Promise<StaffShift[]> => {
  const response = await api.get<StaffScheduleListResponse>('/admin/staff/schedules', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      user_id: filters.user_id || undefined,
      position: filters.position || undefined,
      status: filters.status || undefined,
    },
  });

  return response.data.shifts;
};

export const createStaffShift = async (payload: CreateStaffShiftPayload): Promise<StaffShift> => {
  const response = await api.post<StaffScheduleMutationResponse>('/admin/staff/schedules', payload);
  return response.data.shift;
};

export const updateStaffShift = async (shiftId: number, payload: UpdateStaffShiftPayload): Promise<StaffShift> => {
  const response = await api.patch<StaffScheduleMutationResponse>(`/admin/staff/schedules/${shiftId}`, payload);
  return response.data.shift;
};
