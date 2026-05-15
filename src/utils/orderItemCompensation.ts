import type {
  AdjustmentActionType,
  ComplaintAccountingBucket,
  ComplaintCategory,
  ComplaintReasonCode,
  OperationalLossCategory,
  OrderItemCompensationType,
  OrderItemIssueStatus,
  OrderLineItem,
} from '../types';

export interface ComplaintReasonOption {
  value: ComplaintReasonCode;
  label: string;
  category: ComplaintCategory;
}

export const COMPLAINT_REASON_OPTIONS: ComplaintReasonOption[] = [
  { value: 'kitchen_mistake', label: 'Kitchen Mistake', category: 'quality_control' },
  { value: 'burned_food', label: 'Burned Food', category: 'quality_control' },
  { value: 'wrong_order_sent', label: 'Wrong Order Sent', category: 'service' },
  { value: 'quality_complaint', label: 'Quality Complaint', category: 'quality_control' },
  { value: 'customer_satisfaction_recovery', label: 'Customer Satisfaction Recovery', category: 'service' },
  { value: 'quality_issue', label: 'Quality issue', category: 'quality_control' },
  { value: 'wrong_cooking', label: 'Wrong cooking', category: 'quality_control' },
  { value: 'foreign_object', label: 'Foreign object', category: 'safety' },
  { value: 'fly_or_hair', label: 'Fly / hair found', category: 'safety' },
  { value: 'allergy_risk', label: 'Allergy risk', category: 'safety' },
  { value: 'temperature_issue', label: 'Temperature issue', category: 'quality_control' },
  { value: 'late_service', label: 'Late service', category: 'service' },
  { value: 'other', label: 'Other', category: 'other' },
];

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  quality_control: 'Quality Control',
  service: 'Service',
  safety: 'Safety',
  other: 'Other',
};

export const COMPLAINT_REASON_LABELS: Record<ComplaintReasonCode, string> = COMPLAINT_REASON_OPTIONS
  .reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {} as Record<ComplaintReasonCode, string>);

export const ISSUE_STATUS_LABELS: Record<OrderItemIssueStatus, string> = {
  normal: 'Normal',
  problematic: 'Problematic',
  cancelled: 'Cancelled',
  compensated: 'Compensated',
};

export const COMPENSATION_TYPE_LABELS: Record<OrderItemCompensationType, string> = {
  none: 'None',
  full_waiver: 'Fully waived',
  partial_discount: 'Partial discount',
  complimentary: 'Complimentary',
};

export const COMPLAINT_ACCOUNTING_BUCKET_LABELS: Record<ComplaintAccountingBucket, string> = {
  wastage: 'Wastage',
  customer_complaint_loss: 'Customer Complaint Loss',
  quality_control_loss: 'Quality Control Loss',
  marketing_expense: 'Marketing Expense',
  customer_retention: 'Customer Retention',
  goodwill_expense: 'Goodwill Expense',
};

export const OPERATIONAL_LOSS_CATEGORY_LABELS: Record<OperationalLossCategory, string> = {
  kitchen_mistake: 'Kitchen Mistake',
  burned_food: 'Burned Food',
  wrong_order_sent: 'Wrong Order Sent',
  quality_complaint: 'Quality Complaint',
  customer_satisfaction_recovery: 'Customer Satisfaction Recovery',
};

export const OPERATIONAL_LOSS_CATEGORY_BADGE_LABELS: Record<OperationalLossCategory, string> = {
  kitchen_mistake: 'Kitchen Mistake',
  burned_food: 'Burned Food',
  wrong_order_sent: 'Wrong Order Sent',
  quality_complaint: 'Quality Complaint',
  customer_satisfaction_recovery: 'Guest Recovery',
};

const OPERATIONAL_REASON_TO_CATEGORY: Partial<Record<ComplaintReasonCode, OperationalLossCategory>> = {
  kitchen_mistake: 'kitchen_mistake',
  burned_food: 'burned_food',
  wrong_order_sent: 'wrong_order_sent',
  quality_complaint: 'quality_complaint',
  customer_satisfaction_recovery: 'customer_satisfaction_recovery',
  quality_issue: 'quality_complaint',
  wrong_cooking: 'kitchen_mistake',
  foreign_object: 'quality_complaint',
  fly_or_hair: 'quality_complaint',
  allergy_risk: 'quality_complaint',
  temperature_issue: 'quality_complaint',
  late_service: 'customer_satisfaction_recovery',
};

export const getDefaultComplaintBucket = (
  status: OrderItemIssueStatus,
  compensationType: OrderItemCompensationType
): ComplaintAccountingBucket | null => {
  if (compensationType === 'complimentary') {
    return 'goodwill_expense';
  }
  if (status === 'cancelled') {
    return 'customer_complaint_loss';
  }
  if (status === 'problematic') {
    return 'quality_control_loss';
  }
  if (status === 'compensated') {
    return 'wastage';
  }
  return null;
};

export const getOperationalLossCategoryFromReason = (
  reason: ComplaintReasonCode | null | undefined
): OperationalLossCategory | null => {
  if (!reason) {
    return null;
  }
  return OPERATIONAL_REASON_TO_CATEGORY[reason] ?? null;
};

export const getDefaultOperationalLossCategory = (
  status: OrderItemIssueStatus,
  compensationType: OrderItemCompensationType
): OperationalLossCategory => {
  if (compensationType === 'complimentary') {
    return 'customer_satisfaction_recovery';
  }
  if (status === 'problematic' || status === 'cancelled') {
    return 'quality_complaint';
  }
  if (status === 'compensated') {
    return 'kitchen_mistake';
  }
  return 'quality_complaint';
};

export const getDefaultAccountingBucketFromOperationalLoss = (
  lossCategory: OperationalLossCategory | null | undefined
): ComplaintAccountingBucket => {
  if (!lossCategory) {
    return 'quality_control_loss';
  }
  if (lossCategory === 'customer_satisfaction_recovery') {
    return 'goodwill_expense';
  }
  if (lossCategory === 'wrong_order_sent') {
    return 'customer_complaint_loss';
  }
  return 'quality_control_loss';
};

export const inferAdjustmentActionType = (input: {
  status: OrderItemIssueStatus;
  compensationType: OrderItemCompensationType;
  isComplimentary: boolean;
  operationalLossCategory?: OperationalLossCategory | null;
}): AdjustmentActionType => {
  if (input.operationalLossCategory === 'customer_satisfaction_recovery') {
    return input.isComplimentary ? 'service_recovery' : 'issue_refund';
  }
  if (input.isComplimentary || input.compensationType === 'complimentary') {
    return 'complimentary_gift';
  }
  if (input.status === 'cancelled' || input.status === 'problematic' || input.compensationType === 'full_waiver') {
    return 'issue_refund';
  }
  return 'operational_waste';
};

export const ADJUSTMENT_ACTION_LABELS: Record<AdjustmentActionType, string> = {
  issue_refund: 'Refund / Issue',
  complimentary_gift: 'Complimentary Gift',
  service_recovery: 'Guest Recovery',
  operational_waste: 'Operational Waste',
};

export const getComplaintCategoryFromReason = (
  reason: ComplaintReasonCode | null | undefined
): ComplaintCategory | null => {
  if (!reason) {
    return null;
  }
  return COMPLAINT_REASON_OPTIONS.find((option) => option.value === reason)?.category ?? null;
};

export const getCompensationSuggestions = (
  reason: ComplaintReasonCode | null | undefined
): string[] => {
  if (!reason) {
    return [];
  }
  switch (reason) {
    case 'quality_issue':
    case 'temperature_issue':
      return [ 'Offer free dessert', 'Apply 20% discount' ];
    case 'wrong_cooking':
      return [ 'Refire dish at priority', 'Apply 15% discount' ];
    case 'foreign_object':
    case 'fly_or_hair':
    case 'allergy_risk':
      return [ 'Offer full waiver', 'Offer complimentary beverage' ];
    case 'late_service':
      return [ 'Offer complimentary coffee', 'Apply 10% discount' ];
    default:
      return [ 'Offer free dessert', 'Apply 20% discount' ];
  }
};

const parseAmount = (value: string | number | null | undefined): number => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
};

export interface OrderItemFinancials {
  originalUnitPrice: number;
  finalUnitPrice: number;
  originalLineTotal: number;
  finalLineTotal: number;
  waivedAmount: number;
}

export const getOrderItemFinancials = (item: OrderLineItem): OrderItemFinancials => {
  const quantity = Math.max(item.quantity, 0);
  const fallbackUnitPrice = parseAmount(item.unit_price);
  const originalUnitPrice = parseAmount(item.original_unit_price) || fallbackUnitPrice;
  const finalUnitPrice = parseAmount(item.final_unit_price) || fallbackUnitPrice;
  const originalLineTotal = originalUnitPrice * quantity;
  const fallbackLineSubtotal = parseAmount(item.line_subtotal);
  const finalLineTotal = item.final_unit_price ? finalUnitPrice * quantity : fallbackLineSubtotal;
  const waivedAmount = Math.max(originalLineTotal - finalLineTotal, 0);

  return {
    originalUnitPrice,
    finalUnitPrice,
    originalLineTotal,
    finalLineTotal,
    waivedAmount,
  };
};
