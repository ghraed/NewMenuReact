import type {
  ComplaintAccountingBucket,
  ComplaintCategory,
  ComplaintReasonCode,
  OrderItemCompensationType,
  OrderItemIssueStatus,
} from '../types';

export interface BillItemAdjustment {
  key: string;
  order_item_id?: number | null;
  dish_name: string;
  quantity?: number;
  status: OrderItemIssueStatus;
  compensation_type: OrderItemCompensationType;
  compensation_reason?: ComplaintReasonCode | null;
  complaint_category?: ComplaintCategory | null;
  compensation_note?: string | null;
  approved_by_staff_name?: string | null;
  approved_at?: string | null;
  original_unit_price?: string | null;
  final_unit_price?: string | null;
  is_complimentary?: boolean;
  accounting_bucket?: ComplaintAccountingBucket | null;
  local_only?: boolean;
}

const STORAGE_KEY = 'bill_item_adjustments_v1';

type BillAdjustmentStore = Record<string, BillItemAdjustment[]>;

const readStore = (): BillAdjustmentStore => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BillAdjustmentStore;
  } catch {
    return {};
  }
};

const writeStore = (store: BillAdjustmentStore): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

export const readBillAdjustmentsForTable = (tableName: string): BillItemAdjustment[] => {
  if (!tableName) return [];
  return readStore()[tableName] || [];
};

export const upsertBillAdjustmentsForTable = (tableName: string, nextAdjustments: BillItemAdjustment[]): void => {
  if (!tableName || nextAdjustments.length === 0) return;

  const store = readStore();
  const existing = store[tableName] || [];
  const map = new Map<string, BillItemAdjustment>();

  existing.forEach((item) => map.set(item.key, item));
  nextAdjustments.forEach((item) => map.set(item.key, item));

  store[tableName] = Array.from(map.values());
  writeStore(store);
};

