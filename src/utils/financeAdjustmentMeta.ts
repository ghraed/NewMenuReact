import type { AdjustmentActionType, FinanceExpense, OperationalLossCategory } from '../types';
import {
  getDefaultOperationalLossCategory,
  inferAdjustmentActionType,
} from './orderItemCompensation';

export interface InvoiceAdjustmentExpenseMeta {
  isAdjustment: boolean;
  adjustmentReference: string | null;
  invoiceNumber: string | null;
  operationalLossCategory: OperationalLossCategory | null;
  actionType: AdjustmentActionType | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

const readTokenFromNotes = (notes: string, token: string): string | null => {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*:\\s*([^;\\n]+)`, 'i');
  const match = notes.match(regex);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
};

export const parseInvoiceAdjustmentExpenseMeta = (expense: FinanceExpense): InvoiceAdjustmentExpenseMeta => {
  const notes = expense.notes || '';
  const description = expense.description || '';
  const categoryCode = (expense.category?.code || '').toLowerCase();
  const categoryName = (expense.category?.name || '').toLowerCase();
  const reference = expense.reference_no || '';
  const combined = `${reference}\n${description}\n${notes}\n${categoryCode}\n${categoryName}`.toLowerCase();

  const operationalRaw = readTokenFromNotes(notes, 'operational_loss_category');
  const actionRaw = readTokenFromNotes(notes, 'action_type');
  const adjustmentReference = readTokenFromNotes(notes, 'adjustment ref')
    || readTokenFromNotes(notes, 'adjustment_reference')
    || (reference.toUpperCase().startsWith('ADJ-') ? reference : null);
  const invoiceNumber = readTokenFromNotes(notes, 'invoice number');
  const approvedBy = readTokenFromNotes(notes, 'approved_by');
  const approvedAt = readTokenFromNotes(notes, 'approved_at');

  const operationalLossCategory = ([
    'kitchen_mistake',
    'burned_food',
    'wrong_order_sent',
    'quality_complaint',
    'customer_satisfaction_recovery',
  ] as const).find((value) => value === operationalRaw) ?? null;

  const actionType = ([
    'issue_refund',
    'complimentary_gift',
    'service_recovery',
    'operational_waste',
  ] as const).find((value) => value === actionRaw) ?? null;

  const isAdjustment = combined.includes('source: invoice adjustment')
    || combined.includes('invoice adjustment')
    || combined.includes('adj-')
    || combined.includes('operational_loss_category')
    || combined.includes('action_type')
    || combined.includes('complimentary')
    || combined.includes('guest recovery')
    || combined.includes('quality complaint')
    || combined.includes('burned food')
    || combined.includes('wrong order sent')
    || combined.includes('kitchen mistake')
    || combined.includes('customer satisfaction recovery');

  return {
    isAdjustment,
    adjustmentReference,
    invoiceNumber,
    operationalLossCategory,
    actionType,
    approvedBy,
    approvedAt,
  };
};

export interface OperationalLossDashboardReport {
  totalAdjustmentCost: number;
  issueRefundCost: number;
  complimentaryGiftCost: number;
  serviceRecoveryCost: number;
  dailyLosses: Array<{ bucket: string; amount: number }>;
  weeklyLosses: Array<{ bucket: string; amount: number }>;
  monthlyLosses: Array<{ bucket: string; amount: number }>;
  byCategory: Array<{ category: OperationalLossCategory; count: number; amount: number }>;
  byAction: Array<{ action: AdjustmentActionType; count: number; amount: number }>;
  approvers: Array<{ name: string; approvals: number }>;
}

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

const toSortedSeries = (map: Map<string, number>): Array<{ bucket: string; amount: number }> => (
  Array.from(map.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([bucket, amount]) => ({ bucket, amount: Number(amount.toFixed(2)) }))
);

export const buildOperationalLossDashboardReport = (expenses: FinanceExpense[]): OperationalLossDashboardReport => {
  const dailyLosses = new Map<string, number>();
  const weeklyLosses = new Map<string, number>();
  const monthlyLosses = new Map<string, number>();
  const categoryMap = new Map<OperationalLossCategory, { count: number; amount: number }>();
  const actionMap = new Map<AdjustmentActionType, { count: number; amount: number }>();
  const approverMap = new Map<string, number>();

  let totalAdjustmentCost = 0;
  let issueRefundCost = 0;
  let complimentaryGiftCost = 0;
  let serviceRecoveryCost = 0;

  expenses.forEach((expense) => {
    const meta = parseInvoiceAdjustmentExpenseMeta(expense);
    if (!meta.isAdjustment) {
      return;
    }

    const amount = Math.max(0, (expense.total_cents ?? expense.amount_cents ?? 0) / 100);
    totalAdjustmentCost += amount;

    const derivedLossCategory = meta.operationalLossCategory || getDefaultOperationalLossCategory('problematic', 'full_waiver');
    const derivedAction = meta.actionType || inferAdjustmentActionType({
      status: 'problematic',
      compensationType: 'full_waiver',
      isComplimentary: false,
      operationalLossCategory: derivedLossCategory,
    });

    if (derivedAction === 'issue_refund' || derivedAction === 'operational_waste') {
      issueRefundCost += amount;
    }
    if (derivedAction === 'complimentary_gift') {
      complimentaryGiftCost += amount;
    }
    if (derivedAction === 'service_recovery') {
      serviceRecoveryCost += amount;
    }

    const categoryStats = categoryMap.get(derivedLossCategory) || { count: 0, amount: 0 };
    categoryMap.set(derivedLossCategory, {
      count: categoryStats.count + 1,
      amount: categoryStats.amount + amount,
    });

    const actionStats = actionMap.get(derivedAction) || { count: 0, amount: 0 };
    actionMap.set(derivedAction, {
      count: actionStats.count + 1,
      amount: actionStats.amount + amount,
    });

    if (meta.approvedBy) {
      approverMap.set(meta.approvedBy, (approverMap.get(meta.approvedBy) || 0) + 1);
    }

    const dateCandidate = meta.approvedAt || `${expense.expense_date}T00:00:00Z`;
    const dayBucket = toDayBucket(dateCandidate);
    const weekBucket = toWeekBucket(dateCandidate);
    const monthBucket = toMonthBucket(dateCandidate);
    dailyLosses.set(dayBucket, (dailyLosses.get(dayBucket) || 0) + amount);
    weeklyLosses.set(weekBucket, (weeklyLosses.get(weekBucket) || 0) + amount);
    monthlyLosses.set(monthBucket, (monthlyLosses.get(monthBucket) || 0) + amount);
  });

  return {
    totalAdjustmentCost: Number(totalAdjustmentCost.toFixed(2)),
    issueRefundCost: Number(issueRefundCost.toFixed(2)),
    complimentaryGiftCost: Number(complimentaryGiftCost.toFixed(2)),
    serviceRecoveryCost: Number(serviceRecoveryCost.toFixed(2)),
    dailyLosses: toSortedSeries(dailyLosses),
    weeklyLosses: toSortedSeries(weeklyLosses),
    monthlyLosses: toSortedSeries(monthlyLosses),
    byCategory: Array.from(categoryMap.entries())
      .map(([category, stats]) => ({ category, count: stats.count, amount: Number(stats.amount.toFixed(2)) }))
      .sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category)),
    byAction: Array.from(actionMap.entries())
      .map(([action, stats]) => ({ action, count: stats.count, amount: Number(stats.amount.toFixed(2)) }))
      .sort((left, right) => right.amount - left.amount || left.action.localeCompare(right.action)),
    approvers: Array.from(approverMap.entries())
      .map(([name, approvals]) => ({ name, approvals }))
      .sort((left, right) => right.approvals - left.approvals || left.name.localeCompare(right.name)),
  };
};
