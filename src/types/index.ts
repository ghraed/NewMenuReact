// src/types/index.ts
export type DishAssetType = 'usdz' | 'glb' | 'preview_image' | 'ingredient_image';
export type UserRole = 'admin' | 'staff' | 'chef';
export type OrderStatus = 'pending_staff_confirmation' | 'staff_confirmed' | 'staff_cancelled' | 'accounted';
export type KitchenOrderStatus = 'new' | 'in_progress' | 'ready' | 'served';
export type DiscountType = 'fixed' | 'percentage';
export type TableWaveStatus = 'pending' | 'resolved';
export type TableWaveRequestType = 'call_waiter' | 'request_bill';
export type TableSessionStatus = 'active' | 'closed' | 'expired' | 'suspended';
export type InvoiceSplitMode = 'none' | 'equal' | 'by_person_order';
export type CurrencyCode = 'USD' | 'LBP' | 'SYP';
export type FinanceInvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export interface StaffMember {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  assigned_tables?: RestaurantTableSummary[];
  created_at?: string | null;
}

export interface AuthUserSummary {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  role: UserRole;
  restaurant: RestaurantSummary | null;
  assigned_tables?: RestaurantTableSummary[];
}

export interface CreateStaffRequest {
  name: string;
  email?: string;
  phone?: string;
  role?: Extract<UserRole, 'staff' | 'chef'>;
  table_ids?: number[];
}

export type TableManagementMode = 'ROOM_PLAN' | 'MANUAL';

export interface TableManagementSummary {
  mode: TableManagementMode;
  manual_table_count: number | null;
  active_tables: RestaurantTableSummary[];
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
  name_ar?: string | null;
  description: string;
  description_ar?: string | null;
  price: number;
  currency?: CurrencyCode | null;
  dollar_rate?: number | null;
  original_currency?: CurrencyCode | null;
  price_is_usd_base?: boolean;
  calories?: number | null;
  category: string;
  category_ar?: string | null;
  status: 'draft' | 'published';
  is_anchor?: boolean;
  is_profitable?: boolean;
  image_url?: string;
  assets: DishAsset[];
  dish_ingredients?: DishRecipeIngredient[];
  suggested_dishes?: Dish[];
  related_dishes?: Dish[];
  alternative_dishes?: Dish[];
  model_state?: 'none' | 'processing' | 'ready' | 'error';
  is_model_ready?: boolean;
  is_orderable?: boolean;
  is_out_of_stock?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RestaurantSummary {
  id: number;
  name: string;
  slug: string;
  currency?: CurrencyCode | null;
  dollar_rate?: number | null;
  max_tables?: number;
  feature_flags?: Record<string, boolean>;
}

export interface RestaurantTableSummary {
  id: number;
  name: string;
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

export interface DishRecipeIngredient {
  id: number;
  dish_id: number;
  ingredient_id: number;
  quantity: string;
  unit: IngredientStockUnit;
  order_index?: number;
  show_in_animation?: boolean;
  ingredient?: InventoryIngredient | null;
}

export interface IngredientLibraryItem {
  id: number;
  uuid: string;
  name: string;
  name_ar?: string | null;
  category?: string | null;
  global_ingredient_id?: number | null;
  file_url?: string | null;
  image_url?: string | null;
  image_status?: 'exists' | 'missing' | 'generating' | 'failed';
  source_file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalIngredient {
  id: number;
  uuid: string;
  name: string;
  name_ar?: string | null;
  normalized_name: string;
  file_url?: string | null;
  image_url?: string | null;
  mime_type?: string | null;
  created_at: string;
  updated_at: string;
}

export type IngredientStockUnit = 'g' | 'ml' | 'piece';

export interface InventoryIngredient {
  id: number;
  uuid: string;
  name: string;
  name_ar?: string | null;
  global_ingredient_id?: number | null;
  file_url?: string | null;
  unit: IngredientStockUnit;
  current_quantity: string;
  low_stock_threshold: string;
  target_quantity?: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface InventoryStockMovementRecord {
  id: number;
  ingredient_name: string;
  movement_type: string;
  quantity: string;
  quantity_before: string | null;
  quantity_after: string | null;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface InventoryPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
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
  feature_flags?: Record<string, boolean>;
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
  tableId: number | null;
  tableSessionId: number | null;
  tableReference: string;
  guestAccessToken: string | null;
  guestAccessVerified: boolean;
  guestAccessExpiresAt: string | null;
  notes: string;
}

export interface CreateGuestOrderRequest {
  table_reference?: string;
  notes?: string;
  items: Array<{
    dish_id: number;
    quantity: number;
  }>;
}

export interface GuestTableSummary {
  id: number;
  number: number;
  name: string;
}

export interface TableSessionSummary {
  id: number;
  uuid: string;
  status: TableSessionStatus;
  table_id: number;
  table_reference: string;
  opened_at: string | null;
  last_activity_at: string | null;
  expires_at: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
  pin_locked_until?: string | null;
  invoice_split_mode?: InvoiceSplitMode;
  invoice_split_count?: number | null;
}

export interface InvoiceSplitBreakdownItem {
  key: string;
  label: string;
  amount: string;
}

export interface InvoiceSplitPersonItem {
  order_item_id: number;
  dish_name: string;
  quantity: number;
  unit_price: string;
  line_subtotal: string;
}

export interface InvoiceSplitPerson {
  person_index: number;
  label: string;
  total: string;
  items: InvoiceSplitPersonItem[];
}

export interface InvoiceSplitEditableItem {
  order_item_id: number;
  key: string;
  dish_name: string;
  quantity: number;
  unit_price: string;
  line_subtotal: string;
  remaining_quantity?: number;
}

export interface InvoiceSplitSummary {
  enabled: boolean;
  mode: InvoiceSplitMode | null;
  split_count: number | null;
  breakdown: InvoiceSplitBreakdownItem[];
  people?: InvoiceSplitPerson[];
  editable_items?: InvoiceSplitEditableItem[];
  remaining_items?: InvoiceSplitEditableItem[];
  is_complete?: boolean;
}

export interface GuestAccessSummary {
  verified: boolean;
  token?: string;
  joined_at: string | null;
  last_seen_at: string | null;
  expires_at: string | null;
}

export interface GuestProtectedActions {
  ordering_unlocked: boolean;
  can_place_order: boolean;
  can_call_waiter: boolean;
  can_request_bill: boolean;
}

export interface GuestTableMenuResponse {
  restaurant: RestaurantSummary;
  table: GuestTableSummary;
  table_session: TableSessionSummary | null;
  guest_access: GuestAccessSummary;
  protected_actions: GuestProtectedActions;
  dishes: Dish[];
}

export interface GuestTableDishResponse {
  restaurant: RestaurantSummary;
  table: GuestTableSummary;
  table_session: TableSessionSummary | null;
  guest_access: GuestAccessSummary;
  protected_actions: GuestProtectedActions;
  dish: Dish;
}

export interface ActiveTableSessionRecord extends TableSessionSummary {
  current_pin: string | null;
  table: RestaurantTableSummary | null;
}

export interface UpdatePendingOrderRequest {
  items: Array<{
    dish_id: number;
    quantity: number;
  }>;
}

export interface AccountOrderRequest {
  vat_rate?: number;
  discount_type?: DiscountType;
  discount_value?: number;
}

export type PosPaymentMethod = 'cash' | 'card' | 'wallet';

export interface PosCheckoutRequest {
  table_reference?: string;
  notes?: string;
  items: Array<{
    dish_id: number;
    quantity: number;
  }>;
  vat_rate?: number;
  discount_type?: DiscountType;
  discount_value?: number;
  payment_method: PosPaymentMethod;
  amount_received?: number;
}

export interface PosCheckoutResponse {
  message: string;
  order: OrderRecord;
  payment: {
    method: PosPaymentMethod;
    amount_received: string;
    change_due: string;
    total: string;
  };
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
  email?: string | null;
  phone?: string | null;
  role: UserRole;
}

export interface OrderLineItem {
  id: number;
  dish_id: number | null;
  dish_name: string;
  unit_price: string;
  quantity: number;
  line_subtotal: string;
  modifiers?: string[];
  dish_notes?: string | null;
}

export interface OrderRecord {
  id: number;
  uuid: string;
  order_number: string | null;
  invoice_number: string | null;
  status: OrderStatus;
  kitchen_status?: KitchenOrderStatus | null;
  table_session_id?: number | null;
  table_reference: string;
  table: RestaurantTableSummary | null;
  notes?: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  accounted_at: string | null;
  kitchen_started_at?: string | null;
  kitchen_ready_at?: string | null;
  kitchen_completed_at?: string | null;
  restaurant: RestaurantSummary;
  items: OrderLineItem[];
  invoice: OrderInvoiceSummary;
  confirmed_by: OrderActorSummary | null;
  cancelled_by: OrderActorSummary | null;
  accounted_by: OrderActorSummary | null;
}

export interface KitchenOrderRecord extends OrderRecord {
  kitchen_status: KitchenOrderStatus;
  guest_identifier?: string | null;
  time_ordered?: string | null;
  waiter_name?: string | null;
  special_requests?: string | null;
}

export interface FinanceInvoiceItem {
  id: number;
  name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  order_index: number;
}

export interface FinanceInvoice {
  id: number;
  uuid: string;
  restaurant_id: number;
  invoice_number: string;
  invoice_date: string;
  status: FinanceInvoiceStatus;
  subtotal: string;
  total: string;
  notes?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items: FinanceInvoiceItem[];
}

export interface FinanceInvoiceDetails extends FinanceInvoice {
  table_reference?: string | null;
  waiter_name?: string | null;
  waiter?: OrderActorSummary | null;
  discount_type?: DiscountType | null;
  discount_value?: string;
  discount_amount?: string;
  taxable_subtotal?: string;
  vat_rate?: string;
  vat_amount?: string;
}

export interface FinanceRevenuePoint {
  bucket: string;
  label: string;
  revenue: number;
  invoice_count: number;
}

export interface TableWaveRecord {
  id: number;
  uuid: string;
  status: TableWaveStatus;
  request_type: TableWaveRequestType;
  table_session_id?: number | null;
  table_reference: string;
  table: RestaurantTableSummary | null;
  restaurant: RestaurantSummary;
  created_at: string | null;
  resolved_at: string | null;
  resolved_by: OrderActorSummary | null;
}

export interface PublishedDishSummary {
  id: number;
  name: string;
  price: number;
  category: string;
  is_orderable?: boolean;
  is_out_of_stock?: boolean;
  alternative_dishes?: Array<{
    id: number;
    name: string;
    price: number;
    category: string;
  }>;
}

export const trackEvent: (
  eventType: AnalyticsEvent, 
  properties?: Record<string, unknown>  // Add this
) => void = (eventType, properties) => {
  // Your analytics implementation
  console.log(eventType, properties);
};

export type RoomPlanItemType =
  | 'table'
  | 'table_circle'
  | 'window'
  | 'counter'
  | 'bar'
  | 'kitchen'
  | 'cashier'
  | 'fridge'
  | 'sofa'
  | 'plant'
  | 'wc';

export type RoomPlanItemContainer = 'room' | 'wrapper';

export interface RoomPlanItem {
  id: number;
  room_plan_id: number;
  restaurant_table_id?: number | null;
  type: RoomPlanItemType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  seats?: number | null;
  z_index: number;
  container: RoomPlanItemContainer;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RoomPlan {
  id: number;
  restaurant_id: number;
  name: string;
  width: number;
  height: number;
  background_image_path?: string | null;
  background_image_url?: string | null;
  items?: RoomPlanItem[];
  items_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export type ReservationStatus = 'reserved' | 'busy' | 'cancelled' | 'completed' | 'no_show';
export type ReservationVisualStatus = ReservationStatus | 'free';

export interface ReservationRecord {
  id: number;
  restaurant_id: number;
  room_plan_id: number;
  room_plan_item_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  reservation_date: string;
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  status: ReservationStatus;
  notes?: string | null;
  room_plan?: RoomPlan;
  room_plan_item?: RoomPlanItem;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RoomPlanAvailabilityRow {
  room_plan_item_id: number;
  restaurant_table_id?: number | null;
  label: string;
  status: ReservationVisualStatus;
  color: 'green' | 'orange' | 'red' | 'gray';
  is_selectable: boolean;
}

export interface CreateReservationPayload {
  room_plan_id: number;
  room_plan_item_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}
