import ownerApi from './ownerApi';

export interface OwnerFeatureFlag {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  is_active_by_default: boolean;
  enabled: boolean;
  source?: 'default' | 'override';
}

export interface OwnerRestaurantSummary {
  id: number;
  name: string;
  slug: string;
  status: string;
}

export interface OwnerRestaurantWithFeatures extends OwnerRestaurantSummary {
  features: OwnerFeatureFlag[];
}

export interface OwnerGroupedFeatures {
  category: string;
  features: Array<Omit<OwnerFeatureFlag, 'enabled' | 'source'>>;
}

interface OwnerRestaurantsResponse {
  restaurants: OwnerRestaurantWithFeatures[];
}

interface OwnerFeaturesResponse {
  features: Array<Omit<OwnerFeatureFlag, 'enabled' | 'source'>>;
  grouped: OwnerGroupedFeatures[];
}

interface OwnerRestaurantFeaturesResponse {
  restaurant: OwnerRestaurantSummary;
  features: OwnerFeatureFlag[];
}

export const fetchOwnerRestaurants = async (): Promise<OwnerRestaurantWithFeatures[]> => {
  const response = await ownerApi.get<OwnerRestaurantsResponse>('/owner/restaurants');
  return response.data.restaurants ?? [];
};

export const fetchOwnerFeatures = async (): Promise<OwnerFeaturesResponse> => {
  const response = await ownerApi.get<OwnerFeaturesResponse>('/owner/features');
  return response.data;
};

export const fetchRestaurantFeatures = async (restaurantId: number): Promise<OwnerRestaurantFeaturesResponse> => {
  const response = await ownerApi.get<OwnerRestaurantFeaturesResponse>(`/owner/restaurants/${restaurantId}/features`);
  return response.data;
};

export const updateRestaurantFeature = async (
  restaurantId: number,
  featureId: number,
  enabled: boolean
): Promise<void> => {
  await ownerApi.patch(`/owner/restaurants/${restaurantId}/features/${featureId}`, { enabled });
};

export const bulkUpdateRestaurantFeatures = async (
  restaurantId: number,
  features: Array<{ key: string; enabled: boolean }>
): Promise<void> => {
  await ownerApi.patch(`/owner/restaurants/${restaurantId}/features/bulk`, { features });
};
