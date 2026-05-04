import api from './api';
import type { StaffShift } from '../types';

export interface StaffScheduleFilters {
  date_from?: string;
  date_to?: string;
  user_id?: number;
}

interface StaffScheduleListResponse {
  shifts: StaffShift[];
}

export const fetchStaffSchedules = async (filters: StaffScheduleFilters): Promise<StaffShift[]> => {
  const response = await api.get<StaffScheduleListResponse>('/admin/staff/schedules', {
    params: {
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      user_id: filters.user_id || undefined,
    },
  });

  return response.data.shifts;
};
