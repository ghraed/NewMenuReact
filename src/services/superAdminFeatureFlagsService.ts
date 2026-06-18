import superAdminApi from './superAdminApi';

export interface SuperAdminFeatureFlag {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  is_active_by_default: boolean;
  enabled: boolean;
  source?: 'default' | 'override';
}

export interface SuperAdminRestaurantSummary {
  id: number;
  name: string;
  slug: string;
  status: string;
  currency?: string;
  custom_domain?: string | null;
  custom_domain_status?: string | null;
  custom_domain_error?: string | null;
  ssl_issued_at?: string | null;
  menu_categories?: string[];
}

export interface SuperAdminRestaurantWithFeatures extends SuperAdminRestaurantSummary {
  features: SuperAdminFeatureFlag[];
}

export interface SuperAdminGroupedFeatures {
  category: string;
  features: Array<Omit<SuperAdminFeatureFlag, 'enabled' | 'source'>>;
}

interface SuperAdminRestaurantsResponse {
  restaurants: SuperAdminRestaurantWithFeatures[];
}

interface SuperAdminFeaturesResponse {
  features: Array<Omit<SuperAdminFeatureFlag, 'enabled' | 'source'>>;
  grouped: SuperAdminGroupedFeatures[];
}

interface SuperAdminRestaurantFeaturesResponse {
  restaurant: SuperAdminRestaurantSummary;
  features: SuperAdminFeatureFlag[];
}

export const fetchSuperAdminRestaurants = async (): Promise<SuperAdminRestaurantWithFeatures[]> => {
  const response = await superAdminApi.get<SuperAdminRestaurantsResponse>('/super-admin/restaurants');
  return response.data.restaurants ?? [];
};

export const fetchSuperAdminFeatures = async (): Promise<SuperAdminFeaturesResponse> => {
  const response = await superAdminApi.get<SuperAdminFeaturesResponse>('/super-admin/features');
  return response.data;
};

export const fetchRestaurantFeatures = async (restaurantId: number): Promise<SuperAdminRestaurantFeaturesResponse> => {
  const response = await superAdminApi.get<SuperAdminRestaurantFeaturesResponse>(`/super-admin/restaurants/${restaurantId}/features`);
  return response.data;
};

export const updateRestaurantFeature = async (
  restaurantId: number,
  featureId: number,
  enabled: boolean
): Promise<void> => {
  await superAdminApi.patch(`/super-admin/restaurants/${restaurantId}/features/${featureId}`, { enabled });
};

export const bulkUpdateRestaurantFeatures = async (
  restaurantId: number,
  features: Array<{ key: string; enabled: boolean }>
): Promise<void> => {
  await superAdminApi.patch(`/super-admin/restaurants/${restaurantId}/features/bulk`, { features });
};
