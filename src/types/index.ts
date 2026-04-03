// src/types/index.ts
export type DishAssetType = 'usdz' | 'glb' | 'preview_image' | 'ingredient_image';

export interface DishAssetMetadata extends Record<string, unknown> {
  file_name?: string;
  label?: string;
  quantity?: string | null;
  order_index?: number;
}

export interface Dish {
  id: number;
  uuid: string;
  name: string;
  description: string;
  price: number;
  category: string;
  status: 'draft' | 'published';
  image_url?: string;
  assets: DishAsset[];
  model_state?: 'none' | 'processing' | 'ready' | 'error';
  is_model_ready?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface DishAsset {
  id: number;
  uuid: string;
  asset_type: DishAssetType;
  file_url: string;
  file_size: number;
  mime_type: string;
  metadata: DishAssetMetadata;
}

export interface QRCodeData {
  url: string;
  qr_image: string;
}

export interface AnalyticsEvent {
  event_type: 'page_view' | '3d_viewer_opened' | 'ar_launch_attempt' | 'ar_launch_success' | "3d_model_loaded" | "3d_model_error";
  device_type: 'mobile' | 'tablet' | 'desktop';
  platform: 'ios' | 'android' | 'unknown';
}

export interface DeviceCapabilities {
  hasWebXR: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  hasCameraAccess: boolean;
}

export const trackEvent: (
  eventType: AnalyticsEvent, 
  properties?: Record<string, unknown>  // Add this
) => void = (eventType, properties) => {
  // Your analytics implementation
  console.log(eventType, properties);
};
