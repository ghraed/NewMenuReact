import superAdminApi from './superAdminApi';

export interface SuperAdminSetupUserOption {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  role: string;
  has_restaurant: boolean;
}

export interface SuperAdminSetupCategoryOption {
  value: string;
  arabic: string;
}

export interface SuperAdminRestaurantSetupOptions {
  users: SuperAdminSetupUserOption[];
  restaurant_statuses: string[];
  currencies: string[];
  menu_categories: SuperAdminSetupCategoryOption[];
}

export interface CreateSuperAdminRestaurantPayload {
  name: string;
  slug: string;
  user_id?: number;
  admin_user?: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  };
  status: string;
  currency: string;
  custom_domain: string;
  menu_categories: string[];
}

export interface SuperAdminRestaurantSetupSummary {
  id: number;
  name: string;
  slug: string;
  status: string;
  currency: string;
  custom_domain?: string | null;
  custom_domain_status?: string | null;
  custom_domain_error?: string | null;
  ssl_issued_at?: string | null;
  menu_categories?: string[];
}

export interface UpdateSuperAdminRestaurantPayload {
  name: string;
  slug: string;
  status: string;
  currency: string;
  custom_domain: string;
  menu_categories: string[];
}

export const fetchSuperAdminRestaurantSetupOptions = async (): Promise<SuperAdminRestaurantSetupOptions> => {
  const response = await superAdminApi.get<SuperAdminRestaurantSetupOptions>('/super-admin/restaurant-setup/options');
  return response.data;
};

export const createSuperAdminRestaurant = async (payload: CreateSuperAdminRestaurantPayload): Promise<{
  message: string;
  restaurant: SuperAdminRestaurantSetupSummary;
}> => {
  const response = await superAdminApi.post('/super-admin/restaurants', payload);
  return response.data;
};

export const updateSuperAdminRestaurant = async (
  restaurantId: number,
  payload: UpdateSuperAdminRestaurantPayload
): Promise<{
  message: string;
  restaurant: SuperAdminRestaurantSetupSummary;
}> => {
  const response = await superAdminApi.patch(`/super-admin/restaurants/${restaurantId}`, payload);
  return response.data;
};
