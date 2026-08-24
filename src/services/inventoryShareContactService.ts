import api from './api';

export interface InventoryShareContact {
  id: number;
  name: string;
  phone: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ContactListResponse {
  contacts: InventoryShareContact[];
}

interface ContactMutationResponse {
  message: string;
  contact: InventoryShareContact;
}

export const fetchInventoryShareContacts = async (): Promise<InventoryShareContact[]> => {
  const response = await api.get<ContactListResponse>('/inventory/share-contacts');
  return Array.isArray(response.data.contacts) ? response.data.contacts : [];
};

export const createInventoryShareContact = async (payload: {
  name: string;
  phone: string;
}): Promise<InventoryShareContact> => {
  const response = await api.post<ContactMutationResponse>('/inventory/share-contacts', payload);
  return response.data.contact;
};

export const updateInventoryShareContact = async (
  contactId: number,
  payload: { name: string; phone: string }
): Promise<InventoryShareContact> => {
  const response = await api.patch<ContactMutationResponse>(`/inventory/share-contacts/${contactId}`, payload);
  return response.data.contact;
};

export const deleteInventoryShareContact = async (contactId: number): Promise<void> => {
  await api.delete(`/inventory/share-contacts/${contactId}`);
};
