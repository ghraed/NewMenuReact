import superAdminApi from './superAdminApi';

export interface SuperAdminContactRequestSummary {
  id: number;
  title: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_contact_method?: string | null;
  business_type?: string | null;
  status?: string | null;
  source_page?: string | null;
  created_at?: string | null;
}

export interface SuperAdminContactRequestMessage {
  id: number;
  role: string;
  content: string;
  created_at?: string | null;
}

export interface SuperAdminContactRequestDetail extends SuperAdminContactRequestSummary {
  message?: string | null;
  conversation_summary?: string | null;
  session_uuid?: string | null;
  messages: SuperAdminContactRequestMessage[];
}

interface SuperAdminContactRequestsResponse {
  requests: SuperAdminContactRequestSummary[];
}

interface SuperAdminContactRequestResponse {
  request: SuperAdminContactRequestDetail;
}

export const fetchSuperAdminContactRequests = async (): Promise<SuperAdminContactRequestSummary[]> => {
  const response = await superAdminApi.get<SuperAdminContactRequestsResponse>('/super-admin/contact-requests');
  return response.data.requests ?? [];
};

export const fetchSuperAdminContactRequest = async (
  requestId: string | number
): Promise<SuperAdminContactRequestDetail> => {
  const response = await superAdminApi.get<SuperAdminContactRequestResponse>(
    `/super-admin/contact-requests/${requestId}`
  );

  return response.data.request;
};
