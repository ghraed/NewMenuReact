import type {
  AdjustmentActionType,
  ComplaintAccountingBucket,
  ComplaintCategory,
  ComplaintReasonCode,
  DiscountType,
  OperationalLossCategory,
  OrderItemCompensationType,
  OrderItemIssueStatus,
} from '../types';
import { getVerifiedBrowserIdentity, isCurrentBrowserIdentity, protectedStorageKey, type BrowserIdentity } from '../services/protectedBrowserStorage';

export interface BillItemAdjustment {
  key: string;
  source_order_reference?: string | null;
  order_item_id?: number | null;
  dish_name: string;
  quantity?: number;
  status: OrderItemIssueStatus;
  compensation_type: OrderItemCompensationType;
  compensation_reason?: ComplaintReasonCode | null;
  complaint_category?: ComplaintCategory | null;
  operational_loss_category?: OperationalLossCategory | null;
  adjustment_action_type?: AdjustmentActionType | null;
  compensation_note?: string | null;
  approved_by_staff_name?: string | null;
  approved_by_staff_role?: string | null;
  approved_at?: string | null;
  original_unit_price?: string | null;
  final_unit_price?: string | null;
  partial_discount_type?: DiscountType | null;
  partial_discount_value?: string | null;
  is_complimentary?: boolean;
  accounting_bucket?: ComplaintAccountingBucket | null;
  local_only?: boolean;
}

const STORAGE_KEY = 'bill_item_adjustments_v1';

type BillAdjustmentStore = Record<string, BillItemAdjustment[]>;

const readStore = (restaurantId?: number): BillAdjustmentStore => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const key = restaurantId !== undefined
      ? (Number.isSafeInteger(restaurantId) && restaurantId > 0 ? `protected_v2:restaurant:${restaurantId}:${STORAGE_KEY}` : null)
      : protectedStorageKey(STORAGE_KEY);
    const raw = key ? window.localStorage.getItem(key) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as BillAdjustmentStore : {};
  } catch {
    return {};
  }
};

const writeStore = (store: BillAdjustmentStore, expected: BrowserIdentity | null): void => {
  if (typeof window === 'undefined') return;
  if (!isCurrentBrowserIdentity(expected)) return;
  const key = protectedStorageKey(STORAGE_KEY);
  if (key) window.localStorage.setItem(key, JSON.stringify(store));
};

export const readBillAdjustmentsForTable = (tableName: string, restaurantId?: number): BillItemAdjustment[] => {
  if (!tableName) return [];
  const entries = readStore(restaurantId)[tableName];
  return Array.isArray(entries) ? entries : [];
};

const normalizeOrderReference = (value: string): string => value.trim().toLowerCase();

export const readBillAdjustmentsForTableInvoice = (
  tableName: string,
  includedOrders: string[],
  restaurantId?: number
): BillItemAdjustment[] => {
  const adjustments = readBillAdjustmentsForTable(tableName, restaurantId);
  if (includedOrders.length === 0) {
    return adjustments;
  }

  const included = new Set(includedOrders.map(normalizeOrderReference));

  const matchedAdjustments = adjustments.filter((adjustment) => {
    if (adjustment.local_only !== true) {
      return true;
    }

    if (!adjustment.source_order_reference) {
      return false;
    }

    return included.has(normalizeOrderReference(adjustment.source_order_reference));
  });

  const hasMatchedLocalOnlyAdjustment = matchedAdjustments.some((adjustment) => adjustment.local_only === true);
  if (hasMatchedLocalOnlyAdjustment) {
    return matchedAdjustments;
  }

  const unmatchedLocalOnlyAdjustments = adjustments.filter((adjustment) => adjustment.local_only === true);
  if (unmatchedLocalOnlyAdjustments.length === 0) {
    return matchedAdjustments;
  }

  return [
    ...matchedAdjustments,
    ...unmatchedLocalOnlyAdjustments,
  ];
};

export const upsertBillAdjustmentsForTable = (tableName: string, nextAdjustments: BillItemAdjustment[], expected = getVerifiedBrowserIdentity()): void => {
  if (!tableName || nextAdjustments.length === 0 || !isCurrentBrowserIdentity(expected)) return;

  const store = readStore();
  const existing = store[tableName] || [];
  const map = new Map<string, BillItemAdjustment>();

  existing.forEach((item) => map.set(item.key, item));
  nextAdjustments.forEach((item) => map.set(item.key, item));

  store[tableName] = Array.from(map.values());
  writeStore(store, expected);
};

export const clearBillAdjustmentsForTable = (tableName: string, expected = getVerifiedBrowserIdentity()): void => {
  if (!tableName || !isCurrentBrowserIdentity(expected)) {
    return;
  }
  const store = readStore();
  if (!(tableName in store)) {
    return;
  }
  delete store[tableName];
  writeStore(store, expected);
};
