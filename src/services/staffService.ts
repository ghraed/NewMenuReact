import api from './api';
import type { CreateStaffRequest, StaffMember } from '../types';

interface CreateStaffResponse {
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

  return nextPayload;
};

export const createStaffMember = async (payload: CreateStaffRequest): Promise<CreateStaffResponse> => {
  const response = await api.post<CreateStaffResponse>('/restaurant/staff', sanitizeCreateStaffPayload(payload));
  return response.data;
};
