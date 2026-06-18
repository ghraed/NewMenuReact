import api from './api';
import type { CreateStaffRequest, StaffMember } from '../types';

export interface CreateStaffResponse {
  message: string;
  staff: StaffMember;
  temporary_password: string;
}

export interface StaffListResponse {
  staff: StaffMember[];
}

export interface UpdateStaffTablesResponse {
  message: string;
  staff: StaffMember;
}

const sanitizeCreateStaffPayload = (payload: CreateStaffRequest): CreateStaffRequest => {
  const nextPayload: CreateStaffRequest = {
    name: payload.name.trim(),
  };

  if (payload.email?.trim()) {
    nextPayload.email = payload.email.trim();
  }

  if (payload.phone?.trim()) {
    nextPayload.phone = payload.phone.trim();
  }

  if (payload.password?.trim()) {
    nextPayload.password = payload.password;
  }

  if (payload.role) {
    nextPayload.role = payload.role;
  }

  if (payload.table_ids?.length) {
    nextPayload.table_ids = payload.table_ids;
  }

  return nextPayload;
};

export const createStaffMember = async (payload: CreateStaffRequest): Promise<CreateStaffResponse> => {
  const response = await api.post<CreateStaffResponse>('/restaurant/staff', sanitizeCreateStaffPayload(payload));
  return response.data;
};

export const fetchStaffMembers = async (): Promise<StaffMember[]> => {
  const response = await api.get<StaffListResponse>('/restaurant/staff');
  return response.data.staff;
};

export const updateStaffMemberTables = async (
  staffId: number,
  tableIds: number[]
): Promise<UpdateStaffTablesResponse> => {
  const response = await api.patch<UpdateStaffTablesResponse>(`/restaurant/staff/${staffId}/tables`, {
    table_ids: tableIds,
  });

  return response.data;
};
