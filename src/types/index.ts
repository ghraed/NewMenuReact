// src/types/index.ts
export type DishAssetType = 'usdz' | 'glb' | 'preview_image' | 'ingredient_image';
export type UserRole = 'admin' | 'staff';
export type OrderStatus = 'pending_confirmation' | 'confirmed';
export type DiscountType = 'fixed' | 'percentage';

export interface StaffMember {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  created_at?: string | null;
}

export interface CreateStaffRequest {
  name: string;
  email?: string;
  phone?: string;
}

export interface DishAssetMetadata extends Record<string, unknown> {
  file_name?: string;
  label?: string;
  quantity?: string | null;
  order_index?: number;
  ingredient_library_id?: number | null;
}

export interface Dish {
  id: number;
  uuid: string;
  name: string;
  description: string;
  price: number;
  calories?: number | null;
  category: string;
  status: 'draft' | 'published';
  image_url?: string;
  assets: DishAsset[];
  suggested_dishes?: Dish[];
  related_dishes?: Dish[];
  model_state?: 'none' | 'processing' | 'ready' | 'error';
  is_model_ready?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RestaurantSummary {
  id: number;
  name: string;
  slug: string;
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

export interface IngredientLibraryItem {
  id: number;
  uuid: string;
  name: string;
  file_url?: string | null;
  source_file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  created_at: string;
  updated_at: string;
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

export interface OrderCartRestaurant {
  id?: number;
  name?: string;
  slug: string;
}

export interface OrderCartItem {
  dishId: number;
  name: string;
  description: string;
  price: number;
  quantity: number;
  calories?: number | null;
  previewImageUrl?: string;
}

export interface GuestOrderDraft {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  notes: string;
}

export interface CreateGuestOrderRequest {
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  notes?: string;
  items: Array<{
    dish_id: number;
    quantity: number;
  }>;
}

export interface ConfirmOrderRequest {
  vat_rate?: number;
  discount_type?: DiscountType;
  discount_value?: number;
}

export interface OrderInvoiceSummary {
  subtotal: string;
  discount_type: DiscountType | null;
  discount_value: string;
  discount_amount: string;
  taxable_subtotal: string;
  vat_rate: string;
  vat_amount: string;
  total: string;
}

export interface OrderActorSummary {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface OrderLineItem {
  id: number;
  dish_id: number | null;
  dish_name: string;
  unit_price: string;
  quantity: number;
  line_subtotal: string;
}

export interface OrderRecord {
  id: number;
  uuid: string;
  order_number: string | null;
  invoice_number: string | null;
  status: OrderStatus;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
  notes?: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  restaurant: RestaurantSummary;
  items: OrderLineItem[];
  invoice: OrderInvoiceSummary;
  confirmed_by: OrderActorSummary | null;
}

export const trackEvent: (
  eventType: AnalyticsEvent, 
  properties?: Record<string, unknown>  // Add this
) => void = (eventType, properties) => {
  // Your analytics implementation
  console.log(eventType, properties);
};
