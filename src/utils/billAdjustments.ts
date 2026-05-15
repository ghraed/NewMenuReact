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

const normalizeOrderReference = (value: string): string => value.trim().toLowerCase();

export const readBillAdjustmentsForTableInvoice = (
  tableName: string,
  includedOrders: string[]
): BillItemAdjustment[] => {
  const adjustments = readBillAdjustmentsForTable(tableName);
  if (includedOrders.length === 0) {
    return adjustments;
  }

  const included = new Set(includedOrders.map(normalizeOrderReference));

  return adjustments.filter((adjustment) => {
    if (adjustment.local_only !== true) {
      return true;
    }

    if (!adjustment.source_order_reference) {
      return false;
    }

    return included.has(normalizeOrderReference(adjustment.source_order_reference));
  });
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

export const clearBillAdjustmentsForTable = (tableName: string): void => {
  if (!tableName) {
    return;
  }
  const store = readStore();
  if (!(tableName in store)) {
    return;
  }
  delete store[tableName];
  writeStore(store);
};
