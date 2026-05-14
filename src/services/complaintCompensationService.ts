import type {
  ComplaintAccountingBucket,
  ComplaintCategory,
  ComplaintReasonCode,
  OrderItemCompensationType,
  OrderItemIssueStatus,
  UserRole,
} from '../types';

export interface CompensationApprover {
  id?: number | null;
  name: string;
  role: UserRole;
}

export interface CompensationLedgerEntry {
  id: string;
  created_at: string;
  source: 'pos' | 'invoice';
  table_reference?: string;
  order_reference?: string;
  dish_id?: number | null;
  dish_name: string;
  quantity: number;
  status: OrderItemIssueStatus;
  compensation_type: OrderItemCompensationType;
  compensation_reason?: ComplaintReasonCode | null;
  complaint_category?: ComplaintCategory | null;
  compensation_note?: string | null;
  accounting_bucket?: ComplaintAccountingBucket | null;
  original_amount: number;
  final_amount: number;
  loss_amount: number;
  is_complimentary: boolean;
  approved_by?: CompensationApprover | null;
  approved_at?: string | null;
  evidence_photo_url?: string | null;
  customer_satisfaction_rating?: number | null;
  action: 'marked_problematic' | 'marked_cancelled' | 'marked_compensated' | 'marked_complimentary' | 'checkout';
}

export interface CompensationAuditLog {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_role: UserRole;
  action: CompensationLedgerEntry['action'];
  message: string;
  entry_id: string;
  dish_name: string;
  table_reference?: string;
  order_reference?: string;
}

export interface CompensationDashboardReport {
  total_compensation_cost: number;
  complaint_loss_total: number;
  complimentary_value_total: number;
  cancelled_item_count: number;
  problematic_item_count: number;
  complimentary_item_count: number;
  most_cancelled_dishes: Array<{ dish_name: string; count: number }>;
  most_common_reasons: Array<{ reason: string; count: number }>;
  staff_approvals: Array<{ staff_name: string; role: UserRole; approvals: number }>;
  daily_losses: Array<{ bucket: string; amount: number }>;
  weekly_losses: Array<{ bucket: string; amount: number }>;
  monthly_losses: Array<{ bucket: string; amount: number }>;
  complimentary_items: Array<{ dish_name: string; count: number; value: number }>;
}

const LEDGER_STORAGE_KEY = 'pos_compensation_ledger_v1';
const AUDIT_STORAGE_KEY = 'pos_compensation_audit_v1';

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const readCompensationLedger = (): CompensationLedgerEntry[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<CompensationLedgerEntry[]>(window.localStorage.getItem(LEDGER_STORAGE_KEY), []);
};

export const readCompensationAuditLogs = (): CompensationAuditLog[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<CompensationAuditLog[]>(window.localStorage.getItem(AUDIT_STORAGE_KEY), []);
};

export const appendCompensationLedgerEntries = (entries: CompensationLedgerEntry[]): void => {
  if (!entries.length) {
    return;
  }

  const current = readCompensationLedger();
  writeJson(LEDGER_STORAGE_KEY, [ ...entries, ...current ].slice(0, 2500));
};

export const appendCompensationAuditLogs = (logs: CompensationAuditLog[]): void => {
  if (!logs.length) {
    return;
  }

  const current = readCompensationAuditLogs();
  writeJson(AUDIT_STORAGE_KEY, [ ...logs, ...current ].slice(0, 5000));
};

const toDayBucket = (value: string): string => value.slice(0, 10);

const toWeekBucket = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'invalid-week';
  }

  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const toMonthBucket = (value: string): string => value.slice(0, 7);

const toRankedArray = (map: Map<string, number>, limit = 6): Array<{ key: string; value: number }> => (
  Array.from(map.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }))
);

export const buildCompensationDashboardReport = (
  entries: CompensationLedgerEntry[]
): CompensationDashboardReport => {
  const cancelledByDish = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  const staffApprovalCounts = new Map<string, { role: UserRole; approvals: number }>();
  const dailyLosses = new Map<string, number>();
  const weeklyLosses = new Map<string, number>();
  const monthlyLosses = new Map<string, number>();
  const complimentaryByDish = new Map<string, { count: number; value: number }>();

  let totalCompensationCost = 0;
  let complaintLossTotal = 0;
  let complimentaryValueTotal = 0;
  let cancelledItemCount = 0;
  let problematicItemCount = 0;
  let complimentaryItemCount = 0;

  entries.forEach((entry) => {
    const lossAmount = Number.isFinite(entry.loss_amount) ? Math.max(entry.loss_amount, 0) : 0;
    totalCompensationCost += lossAmount;

    if (entry.status === 'cancelled') {
      cancelledItemCount += entry.quantity;
      cancelledByDish.set(entry.dish_name, (cancelledByDish.get(entry.dish_name) || 0) + entry.quantity);
    }

    if (entry.status === 'problematic') {
      problematicItemCount += entry.quantity;
    }

    if (entry.is_complimentary) {
      complimentaryItemCount += entry.quantity;
      complimentaryValueTotal += lossAmount;
      const current = complimentaryByDish.get(entry.dish_name) || { count: 0, value: 0 };
      complimentaryByDish.set(entry.dish_name, {
        count: current.count + entry.quantity,
        value: current.value + lossAmount,
      });
    } else {
      complaintLossTotal += lossAmount;
    }

    if (entry.compensation_reason) {
      reasonCounts.set(entry.compensation_reason, (reasonCounts.get(entry.compensation_reason) || 0) + 1);
    }

    if (entry.approved_by?.name) {
      const existing = staffApprovalCounts.get(entry.approved_by.name);
      if (!existing) {
        staffApprovalCounts.set(entry.approved_by.name, {
          role: entry.approved_by.role,
          approvals: 1,
        });
      } else {
        staffApprovalCounts.set(entry.approved_by.name, {
          role: existing.role,
          approvals: existing.approvals + 1,
        });
      }
    }

    const dayBucket = toDayBucket(entry.created_at);
    const weekBucket = toWeekBucket(entry.created_at);
    const monthBucket = toMonthBucket(entry.created_at);
    dailyLosses.set(dayBucket, (dailyLosses.get(dayBucket) || 0) + lossAmount);
    weeklyLosses.set(weekBucket, (weeklyLosses.get(weekBucket) || 0) + lossAmount);
    monthlyLosses.set(monthBucket, (monthlyLosses.get(monthBucket) || 0) + lossAmount);
  });

  const mostCancelledDishes = toRankedArray(cancelledByDish).map(({ key, value }) => ({
    dish_name: key,
    count: value,
  }));

  const mostCommonReasons = toRankedArray(reasonCounts).map(({ key, value }) => ({
    reason: key,
    count: value,
  }));

  const staffApprovals = Array.from(staffApprovalCounts.entries())
    .map(([staffName, details]) => ({
      staff_name: staffName,
      role: details.role,
      approvals: details.approvals,
    }))
    .sort((left, right) => right.approvals - left.approvals || left.staff_name.localeCompare(right.staff_name));

  const toLossSeries = (map: Map<string, number>): Array<{ bucket: string; amount: number }> => (
    Array.from(map.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([bucket, amount]) => ({ bucket, amount: Number(amount.toFixed(2)) }))
  );

  const complimentaryItems = Array.from(complimentaryByDish.entries())
    .map(([dishName, details]) => ({
      dish_name: dishName,
      count: details.count,
      value: Number(details.value.toFixed(2)),
    }))
    .sort((left, right) => right.value - left.value || left.dish_name.localeCompare(right.dish_name))
    .slice(0, 8);

  return {
    total_compensation_cost: Number(totalCompensationCost.toFixed(2)),
    complaint_loss_total: Number(complaintLossTotal.toFixed(2)),
    complimentary_value_total: Number(complimentaryValueTotal.toFixed(2)),
    cancelled_item_count: cancelledItemCount,
    problematic_item_count: problematicItemCount,
    complimentary_item_count: complimentaryItemCount,
    most_cancelled_dishes: mostCancelledDishes,
    most_common_reasons: mostCommonReasons,
    staff_approvals: staffApprovals,
    daily_losses: toLossSeries(dailyLosses),
    weekly_losses: toLossSeries(weeklyLosses),
    monthly_losses: toLossSeries(monthlyLosses),
    complimentary_items: complimentaryItems,
  };
};

