import api from './api';
import type { TableManagementSummary } from '../types';

interface UpdateManualCountResponse extends TableManagementSummary {
  message: string;
}

export const fetchTableManagement = async (): Promise<TableManagementSummary> => {
  const response = await api.get<TableManagementSummary>('/restaurant/table-management');
  return response.data;
};

export const updateManualTableCount = async (count: number): Promise<UpdateManualCountResponse> => {
  const response = await api.put<UpdateManualCountResponse>('/restaurant/table-management/manual-count', { count });
  return response.data;
};

