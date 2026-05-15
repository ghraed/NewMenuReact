import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassChip,
  GlassInput,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import {
  accountConfirmedOrder,
  fetchAccountingOrders,
  fetchGuestTables,
  fetchPublishedDishes,
  fetchStaffTableSessionInvoiceSplit,
  finalizeGuestTableSession,
} from '../services/orderService';
import { fetchInvoices } from '../services/invoiceService';
import { createExpense, fetchExpenseCategories } from '../services/financeExpenseService';
import { ensureEchoConnection, getEcho } from '../services/realtime';
import { cx, focusRing, glassControl, glassControlHover } from '../theme/liquidGlass';
import { savePrintableInvoice } from '../utils/printableInvoice';
import { calculateInvoicePreview } from '../utils/financeMath';
import { clearBillAdjustmentsForTable, upsertBillAdjustmentsForTable } from '../utils/billAdjustments';
import {
  ADJUSTMENT_ACTION_LABELS,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_REASON_OPTIONS,
  COMPLAINT_ACCOUNTING_BUCKET_LABELS,
  COMPLAINT_REASON_LABELS,
  COMPENSATION_TYPE_LABELS,
  ISSUE_STATUS_LABELS,
  OPERATIONAL_LOSS_CATEGORY_BADGE_LABELS,
  OPERATIONAL_LOSS_CATEGORY_LABELS,
  getDefaultAccountingBucketFromOperationalLoss,
  getComplaintCategoryFromReason,
  getDefaultComplaintBucket,
  getDefaultOperationalLossCategory,
  getOperationalLossCategoryFromReason,
  inferAdjustmentActionType,
} from '../utils/orderItemCompensation';
import type {
  AdjustmentActionType,
  AccountOrderRequest,
  ComplaintAccountingBucket,
  ComplaintCategory,
  ComplaintReasonCode,
  DiscountType,
  FinalizeInvoiceStatusMode,
  FinanceExpenseCategory,
  FinancePaymentMethod,
  InvoiceSplitSummary,
  OrderRecord,
  OrderItemCompensationType,
  OrderItemIssueStatus,
  OrderLineItem,
  OperationalLossCategory,
  PublishedDishSummary,
  RestaurantTableSummary,
} from '../types';

const ACCOUNTING_FALLBACK_POLL_INTERVAL_MS = 30000;

type TableDraftState = Record<string, {
  vatRate: string;
  discountType: '' | DiscountType;
  discountValue: string;
}>;

const emptyAccountingDraft = {
  vatRate: '0',
  discountType: '',
  discountValue: '0',
} satisfies {
  vatRate: string;
  discountType: '' | DiscountType;
  discountValue: string;
};

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;

const findExpenseCategoryId = (
  categories: FinanceExpenseCategory[],
  preferredCodes: string[],
  preferredNameHints: string[]
): number | null => {
  for (const code of preferredCodes) {
    const match = categories.find((category) => category.code?.toLowerCase() === code.toLowerCase());
    if (match) {
      return match.id;
    }
  }

  for (const nameHint of preferredNameHints) {
    const match = categories.find((category) => category.name?.toLowerCase().includes(nameHint.toLowerCase()));
    if (match) {
      return match.id;
    }
  }

  return null;
};

const resolveGiftExpenseCategoryId = (categories: FinanceExpenseCategory[]): number | null => (
  findExpenseCategoryId(
    categories,
    ['goodwill_expense', 'customer_retention', 'marketing_expense'],
    ['goodwill', 'retention', 'complimentary', 'gift', 'marketing']
  )
);

const resolveIssueExpenseCategoryId = (categories: FinanceExpenseCategory[]): number | null => (
  findExpenseCategoryId(
    categories,
    ['quality_control_loss', 'customer_complaint_loss', 'quality_issue', 'wastage'],
    ['quality', 'complaint', 'wastage', 'loss']
  )
);

const resolveExpenseCategoryIdByBucket = (
  categories: FinanceExpenseCategory[],
  accountingBucket?: string | null
): number | null => {
  if (accountingBucket === 'customer_complaint_loss') {
    return findExpenseCategoryId(
      categories,
      ['customer_complaint_loss', 'quality_control_loss', 'wastage'],
      ['complaint', 'quality', 'wastage']
    );
  }

  if (accountingBucket === 'quality_control_loss') {
    return findExpenseCategoryId(
      categories,
      ['quality_control_loss', 'customer_complaint_loss', 'wastage'],
      ['quality', 'complaint', 'wastage']
    );
  }

  if (accountingBucket === 'quality_loss') {
    return resolveIssueExpenseCategoryId(categories) ?? resolveGiftExpenseCategoryId(categories);
  }

  if (accountingBucket === 'customer_retention' || accountingBucket === 'marketing_expense') {
    return resolveGiftExpenseCategoryId(categories) ?? resolveIssueExpenseCategoryId(categories);
  }

  if (accountingBucket === 'wastage') {
    return findExpenseCategoryId(
      categories,
      ['wastage', 'quality_control_loss', 'customer_complaint_loss'],
      ['wastage', 'quality', 'loss']
    );
  }

  if (accountingBucket === 'goodwill_expense') {
    return resolveGiftExpenseCategoryId(categories) ?? resolveIssueExpenseCategoryId(categories);
  }

  return resolveIssueExpenseCategoryId(categories) ?? resolveGiftExpenseCategoryId(categories);
};

interface AccountingCompDraft {
  status: OrderItemIssueStatus;
  compensationType: OrderItemCompensationType;
  reason: ComplaintReasonCode | '';
  category: ComplaintCategory | '';
  operationalLossCategory: OperationalLossCategory | '';
  note: string;
  partialDiscountPercent: string;
  partialDiscountType: DiscountType;
  partialDiscountValue: string;
  accountingBucket: ComplaintAccountingBucket | '';
}

const makeDefaultCompDraft = (): AccountingCompDraft => ({
  status: 'normal',
  compensationType: 'none',
  reason: '',
  category: '',
  operationalLossCategory: '',
  note: '',
  partialDiscountPercent: '0',
  partialDiscountType: 'percentage',
  partialDiscountValue: '0',
  accountingBucket: '',
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const parseDateToMillis = (value?: string | null): number => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortAccountingOrders = (rows: OrderRecord[]): OrderRecord[] => (
  [...rows].sort((left, right) => {
    const confirmedDifference = parseDateToMillis(right.confirmed_at) - parseDateToMillis(left.confirmed_at);
    if (confirmedDifference !== 0) {
      return confirmedDifference;
    }

    return parseDateToMillis(right.created_at) - parseDateToMillis(left.created_at);
  })
);

const AccountingOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [tableDrafts, setTableDrafts] = useState<TableDraftState>({});
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [visibleInvoiceTable, setVisibleInvoiceTable] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [processingTarget, setProcessingTarget] = useState<string | null>(null);
  const [sessionInvoiceSplit, setSessionInvoiceSplit] = useState<InvoiceSplitSummary | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [publishedDishes, setPublishedDishes] = useState<PublishedDishSummary[]>([]);
  const [selectedGiftDishId, setSelectedGiftDishId] = useState<string>('');
  const [localItemOverrides, setLocalItemOverrides] = useState<Record<string, Partial<OrderLineItem>>>({});
  const [localGiftItemsByTable, setLocalGiftItemsByTable] = useState<Record<string, OrderLineItem[]>>({});
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [compDraft, setCompDraft] = useState<AccountingCompDraft>(makeDefaultCompDraft());
  const [isRealtimeDegraded, setIsRealtimeDegraded] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement | null>(null);
  const tableSearchInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoadedOrdersRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<number>>(new Set());
  const refreshInFlightRef = useRef(false);
  const canManageCompensation = user?.role === 'admin' || user?.role === 'accountant';

  const discountOptions = useMemo(() => ([
    { value: '', label: t('accountingPage.noDiscount') },
    { value: 'fixed', label: t('accountingPage.fixedAmount') },
    { value: 'percentage', label: t('accountingPage.percentage') },
  ] satisfies Array<{ value: '' | DiscountType; label: string }>), [t]);

  const getOrderLabel = useCallback((order: OrderRecord): string => (
    order.order_number || t('accountingPage.orderNumberLabel', { id: order.id })
  ), [t]);

  const upsertAccountingOrder = useCallback((nextOrder: OrderRecord) => {
    setOrders((current) => {
      const existingIndex = current.findIndex((order) => order.id === nextOrder.id);
      if (existingIndex === -1) {
        const nextRows = sortAccountingOrders([nextOrder, ...current]);
        knownOrderIdsRef.current = new Set(nextRows.map((order) => order.id));
        return nextRows;
      }

      const nextRows = [...current];
      nextRows[existingIndex] = nextOrder;
      const sortedRows = sortAccountingOrders(nextRows);
      knownOrderIdsRef.current = new Set(sortedRows.map((order) => order.id));
      return sortedRows;
    });
  }, []);

  const removeAccountingOrder = useCallback((orderId: number) => {
    setOrders((current) => {
      const nextRows = current.filter((order) => order.id !== orderId);
      knownOrderIdsRef.current = new Set(nextRows.map((order) => order.id));
      return nextRows;
    });
  }, []);

  const loadOrders = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const nextOrders = await fetchAccountingOrders();
      const previousKnownOrderIds = knownOrderIdsRef.current;
      const newOrders = hasLoadedOrdersRef.current
        ? nextOrders.filter((order) => !previousKnownOrderIds.has(order.id))
        : [];

      const sortedOrders = sortAccountingOrders(nextOrders);
      setOrders(sortedOrders);
      setError(null);
      knownOrderIdsRef.current = new Set(sortedOrders.map((order) => order.id));
      hasLoadedOrdersRef.current = true;

      if (newOrders.length === 1) {
        const nextOrder = newOrders[0];
        showToast(
          t('accountingPage.newOrderArrived', { order: getOrderLabel(nextOrder), table: nextOrder.table_reference }),
          'secondary'
        );
      } else if (newOrders.length > 1) {
        showToast(t('accountingPage.newOrdersArrived', { count: newOrders.length }), 'secondary', 4200);
      }
    } catch (err: unknown) {
      if (!silent) {
        setError(getErrorMessage(err, t('accountingPage.failedLoadOrders')));
      }
    } finally {
      refreshInFlightRef.current = false;

      if (!silent) {
        setLoading(false);
      }
    }
  }, [getOrderLabel, showToast, t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      ensureEchoConnection();
      void loadOrders({ silent: true });
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [loadOrders]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isRealtimeDegraded) {
      return undefined;
    }

    const runSilentRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      void loadOrders({ silent: true });
    };

    const intervalId = window.setInterval(runSilentRefresh, ACCOUNTING_FALLBACK_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRealtimeDegraded, loadOrders]);

  useEffect(() => {
    if (!user?.restaurant?.id) {
      return undefined;
    }

    const echo = getEcho();
    if (!echo) {
      setIsRealtimeDegraded(true);
      return undefined;
    }

    const channelName = `restaurant.${user.restaurant.id}.accounting`;
    const channel = echo.private(channelName);

    setIsRealtimeDegraded(false);

    channel.listen('.accounting-order.created', (event: { order?: OrderRecord }) => {
      if (!event.order) return;
      const isNewOrder = !knownOrderIdsRef.current.has(event.order.id);
      upsertAccountingOrder(event.order);

      if (isNewOrder) {
        showToast(
          t('accountingPage.newOrderArrived', { order: getOrderLabel(event.order), table: event.order.table_reference }),
          'secondary',
          4200
        );
      }
    });

    channel.listen('.accounting-order.updated', (event: { order?: OrderRecord }) => {
      if (!event.order) return;
      upsertAccountingOrder(event.order);
    });

    channel.listen('.accounting-order.removed', (event: { order?: OrderRecord }) => {
      if (!event.order) return;
      removeAccountingOrder(event.order.id);
    });

    const pusherConnection = (echo.connector as { pusher?: { connection?: { bind: (event: string, cb: (...args: unknown[]) => void) => void; unbind: (event: string, cb: (...args: unknown[]) => void) => void } } }).pusher?.connection;

    const handleConnected = () => {
      setIsRealtimeDegraded(false);
      void loadOrders({ silent: true });
    };
    const handleDisconnected = () => {
      setIsRealtimeDegraded(true);
    };
    const handleError = () => {
      setIsRealtimeDegraded(true);
    };

    pusherConnection?.bind('connected', handleConnected);
    pusherConnection?.bind('disconnected', handleDisconnected);
    pusherConnection?.bind('error', handleError);

    return () => {
      pusherConnection?.unbind('connected', handleConnected);
      pusherConnection?.unbind('disconnected', handleDisconnected);
      pusherConnection?.unbind('error', handleError);
      echo.leave(channelName);
    };
  }, [getOrderLabel, loadOrders, removeAccountingOrder, showToast, t, upsertAccountingOrder, user?.restaurant?.id]);

  useEffect(() => {
    const restaurantSlug = user?.restaurant?.slug;

    if (!restaurantSlug) {
      setTables([]);
      return;
    }

    const loadTables = async () => {
      setTablesLoading(true);
      setTablesError(null);

      try {
        const response = await fetchGuestTables(restaurantSlug);
        setTables(response.tables);
      } catch (err: unknown) {
        setTablesError(getErrorMessage(err, t('accountingPage.failedLoadTables')));
      } finally {
        setTablesLoading(false);
      }
    };

    loadTables();
  }, [t, user?.restaurant?.slug]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublishedDishes()
      .then((dishes) => {
        if (cancelled) return;
        setPublishedDishes(dishes.filter((dish) => dish.is_orderable !== false));
      })
      .catch(() => {
        if (cancelled) return;
        setPublishedDishes([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTableMenuOpen) {
      setTableSearchQuery('');
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!tableMenuRef.current?.contains(event.target as Node)) {
        setIsTableMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isTableMenuOpen]);

  useEffect(() => {
    if (!isTableMenuOpen || typeof window === 'undefined') {
      return undefined;
    }

    const prefersDesktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!prefersDesktopPointer) {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      tableSearchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isTableMenuOpen]);

  const filteredOrders = useMemo(() => (
    selectedTable
      ? orders.filter((order) => order.table?.name === selectedTable || order.table_reference === selectedTable)
      : orders
  ), [orders, selectedTable]);

  const filteredTableOptions = useMemo(() => {
    const normalizedQuery = tableSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return tables;
    }

    return tables.filter((table) => table.name.toLowerCase().includes(normalizedQuery));
  }, [tables, tableSearchQuery]);

  const selectedTableStats = useMemo(() => {
    if (!selectedTable) {
      return null;
    }

    const total = filteredOrders.reduce((sum, order) => (
      sum + order.items.reduce((lineSum, item) => lineSum + Number(item.line_subtotal || 0), 0)
    ), 0);

    return {
      orderCount: filteredOrders.length,
      subtotal: total,
    };
  }, [filteredOrders, selectedTable]);

  const orderCountLabel = useMemo(() => (
    t('accountingPage.orderCountLabel', { count: filteredOrders.length })
  ), [filteredOrders.length, t]);

  const updateTableDraft = (tableName: string, nextValue: Partial<TableDraftState[string]>) => {
    setTableDrafts((current) => ({
      ...current,
      [tableName]: {
        vatRate: current[tableName]?.vatRate ?? emptyAccountingDraft.vatRate,
        discountType: current[tableName]?.discountType ?? emptyAccountingDraft.discountType,
        discountValue: current[tableName]?.discountValue ?? emptyAccountingDraft.discountValue,
        ...nextValue,
      },
    }));
  };

  const selectedTableOrders = useMemo(() => (
    selectedTable
      ? (() => {
          const tableOrders = orders.filter((order) => order.table?.name === selectedTable || order.table_reference === selectedTable);
          const giftItems = localGiftItemsByTable[selectedTable] || [];
          let giftAttached = false;

          return tableOrders.map((order) => {
            const nextItems = order.items.map((item) => {
              const override = localItemOverrides[`${order.id}:${item.id}`];
              return override ? { ...item, ...override } : item;
            });

            if (!giftAttached && giftItems.length > 0) {
              giftAttached = true;
              return {
                ...order,
                items: [...nextItems, ...giftItems],
              };
            }

            return {
              ...order,
              items: nextItems,
            };
          });
        })()
      : []
  ), [localGiftItemsByTable, localItemOverrides, orders, selectedTable]);

  const splitFeatureEnabled = user?.restaurant?.feature_flags?.invoice_splitting === true;
  const finalizeInvoiceStatusMode: FinalizeInvoiceStatusMode = (
    user?.restaurant?.finalize_invoice_status_mode === 'paid' ? 'paid' : 'issued'
  );
  const requiresPaymentCapture = finalizeInvoiceStatusMode === 'paid';

  const selectedTableSessionIds = useMemo(() => (
    Array.from(new Set(
      selectedTableOrders
        .map((order) => order.table_session_id)
        .filter((sessionId): sessionId is number => typeof sessionId === 'number')
    ))
  ), [selectedTableOrders]);

  const selectedTableDraft = useMemo(() => (
    selectedTable
      ? tableDrafts[selectedTable] || emptyAccountingDraft
      : emptyAccountingDraft
  ), [selectedTable, tableDrafts]);

  const selectedTableInvoiceSubtotal = useMemo(() => (
    selectedTableOrders.reduce((sum, order) => (
      sum + order.items.reduce((lineSum, item) => lineSum + Number(item.line_subtotal || 0), 0)
    ), 0)
  ), [selectedTableOrders]);

  const selectedTableEffectiveSubtotal = selectedTableInvoiceSubtotal;

  const selectedTablePreview = useMemo(() => (
    selectedTable
      ? calculateInvoicePreview({
        subtotal: selectedTableEffectiveSubtotal,
          discountType: selectedTableDraft.discountType,
          discountValue: selectedTableDraft.discountValue,
          vatRate: selectedTableDraft.vatRate,
        })
      : null
  ), [selectedTable, selectedTableDraft, selectedTableEffectiveSubtotal]);

  const isViewingSelectedInvoice = selectedTable !== '' && selectedTableOrders.length > 0;
  const isShowingSelectedInvoicePreview = isViewingSelectedInvoice && visibleInvoiceTable === selectedTable;

  const selectedTableLineItems = useMemo(() => {
    if (!selectedTable) {
      return [];
    }

    const grouped = new Map<string, {
      key: string;
      dish_name: string;
      dish_name_ar?: string | null;
      source_refs: Array<{ order_id: number; order_item_id: number }>;
      quantity: number;
      unit_price: string;
      line_subtotal: string;
      original_line_subtotal: string;
      status: 'normal' | 'problematic' | 'cancelled' | 'compensated';
      compensation_type: 'none' | 'full_waiver' | 'partial_discount' | 'complimentary';
      compensation_reason: string | null;
      compensation_note: string | null;
      approved_by_name: string | null;
      approved_by_role: string | null;
      approved_at: string | null;
      partial_discount_percentage: string | null;
      partial_discount_type: DiscountType | null;
      partial_discount_value: string | null;
      is_complimentary: boolean;
      accounting_bucket: string | null;
      operational_loss_category: OperationalLossCategory | null;
      adjustment_action_type: AdjustmentActionType | null;
    }>();

    selectedTableOrders.forEach((order) => {
      order.items.forEach((item) => {
        const status = item.status || 'normal';
        const compensationType = item.compensation_type || 'none';
        const reason = item.compensation_reason || null;
        const note = item.compensation_note || null;
        const approvedByName = item.approved_by?.name || null;
        const approvedByRole = item.approved_by?.role || null;
        const approvedAt = item.approved_at || null;
        const partialDiscountPercentage = item.partial_discount_percentage || null;
        const partialDiscountType = item.partial_discount_type || null;
        const partialDiscountValue = item.partial_discount_value || null;
        const isComplimentary = item.is_complimentary === true || compensationType === 'complimentary';
        const accountingBucket = item.accounting_bucket || null;
        const operationalLossCategory = item.operational_loss_category
          || getOperationalLossCategoryFromReason(reason as ComplaintReasonCode | null)
          || getDefaultOperationalLossCategory(status, compensationType);
        const adjustmentActionType = item.adjustment_action_type
          || inferAdjustmentActionType({
            status,
            compensationType,
            isComplimentary,
            operationalLossCategory,
          });
        const key = [
          item.dish_id ?? item.dish_name,
          item.unit_price,
          status,
          compensationType,
          reason || 'none',
          note || 'none',
          accountingBucket || 'none',
          operationalLossCategory || 'none',
          adjustmentActionType || 'none',
        ].join('-');
        const existing = grouped.get(key);
        const quantity = (existing?.quantity || 0) + item.quantity;
        const lineSubtotal = (Number(existing?.line_subtotal || 0) + Number(item.line_subtotal || 0)).toFixed(2);
        const itemOriginalUnit = Number(item.original_unit_price || item.unit_price || 0);
        const originalLineSubtotal = (
          Number(existing?.original_line_subtotal || 0)
          + (itemOriginalUnit * item.quantity)
        ).toFixed(2);

        grouped.set(key, {
          key,
          dish_name: item.dish_name,
          dish_name_ar: null,
          source_refs: [
            ...(existing?.source_refs || []),
            { order_id: order.id, order_item_id: item.id },
          ],
          quantity,
          unit_price: item.unit_price,
          line_subtotal: lineSubtotal,
          original_line_subtotal: originalLineSubtotal,
          status,
          compensation_type: compensationType,
          compensation_reason: reason,
          compensation_note: note,
          approved_by_name: approvedByName,
          approved_by_role: approvedByRole,
          approved_at: approvedAt,
          partial_discount_percentage: partialDiscountPercentage,
          partial_discount_type: partialDiscountType,
          partial_discount_value: partialDiscountValue,
          is_complimentary: isComplimentary,
          accounting_bucket: accountingBucket,
          operational_loss_category: operationalLossCategory,
          adjustment_action_type: adjustmentActionType,
        });
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.dish_name.localeCompare(b.dish_name));
  }, [selectedTable, selectedTableOrders]);

  const selectedTableIssueItems = useMemo(() => (
    selectedTableLineItems
      .map((item) => {
        const original = Number(item.original_line_subtotal || 0);
        const final = Number(item.line_subtotal || 0);
        const lossValue = Math.max(0, original - final);
        const hasIssue = item.status !== 'normal' || item.compensation_type !== 'none' || lossValue > 0;
        return hasIssue
          ? {
              key: item.key,
              dish_name: item.dish_name,
              status: item.status,
              compensation_type: item.compensation_type,
              operational_loss_category: item.operational_loss_category,
              adjustment_action_type: item.adjustment_action_type,
              lossValue,
            }
          : null;
      })
      .filter((item): item is {
        key: string;
        dish_name: string;
        status: OrderItemIssueStatus;
        compensation_type: OrderItemCompensationType;
        operational_loss_category: OperationalLossCategory | null;
        adjustment_action_type: AdjustmentActionType | null;
        lossValue: number;
      } => Boolean(item))
  ), [selectedTableLineItems]);

  const openCompensationEditor = (lineKey: string) => {
    if (!canManageCompensation) {
      showToast('Only Admin or Accountant can create or approve complimentary/recovery adjustments.', 'secondary');
      return;
    }

    const line = selectedTableLineItems.find((entry) => entry.key === lineKey);
    if (!line) {
      return;
    }

    setEditingLineKey(lineKey);
    setCompDraft({
      status: line.status,
      compensationType: line.compensation_type,
      reason: (line.compensation_reason as ComplaintReasonCode | null) || '',
      category: '',
      operationalLossCategory: (line.operational_loss_category as OperationalLossCategory | null) || '',
      note: line.compensation_note || '',
      partialDiscountPercent: (line as { partial_discount_percentage?: string | null }).partial_discount_percentage || '0',
      partialDiscountType: (
        (line as { partial_discount_type?: DiscountType | null }).partial_discount_type === 'fixed'
          ? 'fixed'
          : 'percentage'
      ),
      partialDiscountValue: (line as { partial_discount_value?: string | null }).partial_discount_value || '0',
      accountingBucket: (line.accounting_bucket as ComplaintAccountingBucket | null) || '',
    });
  };

  const applyLineCompensationFromAccounting = () => {
    if (!selectedTable || !editingLineKey) {
      return;
    }

    if (!canManageCompensation) {
      showToast('You are not authorized to edit item compensation.', 'secondary');
      return;
    }

    const line = selectedTableLineItems.find((entry) => entry.key === editingLineKey);
    if (!line) {
      return;
    }

    if (compDraft.status !== 'normal' && !compDraft.reason) {
      showToast('Please select a complaint reason before saving.', 'secondary');
      return;
    }

    const partialDiscountPercent = Math.max(0, Math.min(100, Number(compDraft.partialDiscountPercent || '0')));
    const partialDiscountType: DiscountType = compDraft.partialDiscountType === 'fixed' ? 'fixed' : 'percentage';
    const partialDiscountValue = Math.max(0, Number(compDraft.partialDiscountValue || '0'));
    const approvedAt = new Date().toISOString();
    const refSet = new Set(line.source_refs.map((ref) => `${ref.order_id}:${ref.order_item_id}`));

    const updates: Record<string, Partial<OrderLineItem>> = {};
    const persistedAdjustments: Array<{
      key: string;
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
    }> = [];
    selectedTableOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!refSet.has(`${order.id}:${item.id}`)) {
          return;
        }

        const originalUnit = Number(item.original_unit_price || item.unit_price || 0);
        const normalizedOriginalUnit = Number.isFinite(originalUnit) ? originalUnit : 0;

        let nextFinalUnit = normalizedOriginalUnit;
        if (compDraft.status !== 'normal') {
          if (compDraft.compensationType === 'complimentary' || compDraft.compensationType === 'full_waiver' || compDraft.status === 'cancelled') {
            nextFinalUnit = 0;
          } else if (compDraft.compensationType === 'partial_discount') {
            if (partialDiscountType === 'fixed') {
              nextFinalUnit = Math.max(normalizedOriginalUnit - partialDiscountValue, 0);
            } else {
              nextFinalUnit = normalizedOriginalUnit * (1 - (partialDiscountPercent / 100));
            }
          }
        }

        const nextLineSubtotal = Number((nextFinalUnit * item.quantity).toFixed(2));
        const nextOperationalLossCategory: OperationalLossCategory = compDraft.status === 'normal'
          ? getDefaultOperationalLossCategory(compDraft.status, compDraft.compensationType)
          : (
            compDraft.operationalLossCategory
            || getOperationalLossCategoryFromReason(compDraft.reason || null)
            || getDefaultOperationalLossCategory(compDraft.status, compDraft.compensationType)
          );
        const nextIsComplimentary = compDraft.status !== 'normal' && compDraft.compensationType === 'complimentary';
        const nextActionType: AdjustmentActionType = compDraft.status === 'normal'
          ? 'issue_refund'
          : inferAdjustmentActionType({
            status: compDraft.status,
            compensationType: compDraft.compensationType,
            isComplimentary: nextIsComplimentary,
            operationalLossCategory: nextOperationalLossCategory,
          });
        const nextAdjustment = {
          key: `${order.id}:${item.id}`,
          order_item_id: item.id,
          dish_name: item.dish_name,
          quantity: item.quantity,
          status: compDraft.status,
          compensation_type: compDraft.status === 'normal' ? 'none' : compDraft.compensationType,
          compensation_reason: compDraft.status === 'normal' ? null : (compDraft.reason || null),
          complaint_category: compDraft.status === 'normal'
            ? null
            : (compDraft.category || getComplaintCategoryFromReason(compDraft.reason || null) || 'other'),
          operational_loss_category: compDraft.status === 'normal' ? null : nextOperationalLossCategory,
          adjustment_action_type: compDraft.status === 'normal' ? null : nextActionType,
          compensation_note: compDraft.note.trim() || null,
          approved_by_staff_name: compDraft.status === 'normal' ? null : (user?.name || null),
          approved_by_staff_role: compDraft.status === 'normal' ? null : (user?.role || null),
          approved_at: compDraft.status === 'normal' ? null : approvedAt,
          original_unit_price: normalizedOriginalUnit.toFixed(2),
          final_unit_price: compDraft.status === 'normal' ? normalizedOriginalUnit.toFixed(2) : nextFinalUnit.toFixed(2),
          partial_discount_type: compDraft.compensationType === 'partial_discount' && compDraft.status !== 'normal'
            ? partialDiscountType
            : null,
          partial_discount_value: compDraft.compensationType === 'partial_discount' && compDraft.status !== 'normal'
            ? partialDiscountValue.toFixed(2)
            : null,
          is_complimentary: nextIsComplimentary,
          accounting_bucket: compDraft.status === 'normal'
            ? null
            : (
              compDraft.accountingBucket
              || getDefaultAccountingBucketFromOperationalLoss(nextOperationalLossCategory)
              || getDefaultComplaintBucket(compDraft.status, compDraft.compensationType)
              || null
            ),
        };
        persistedAdjustments.push(nextAdjustment);
        updates[`${order.id}:${item.id}`] = {
          status: nextAdjustment.status,
          compensation_type: nextAdjustment.compensation_type,
          compensation_reason: nextAdjustment.compensation_reason,
          complaint_category: nextAdjustment.complaint_category,
          operational_loss_category: nextAdjustment.operational_loss_category,
          adjustment_action_type: nextAdjustment.adjustment_action_type,
          compensation_note: compDraft.note.trim() || null,
          approved_at: compDraft.status === 'normal' ? null : approvedAt,
          approved_by: compDraft.status === 'normal'
            ? null
            : (user ? {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email,
                phone: user.phone ?? null,
              } : null),
          original_unit_price: normalizedOriginalUnit.toFixed(2),
          final_unit_price: compDraft.status === 'normal' ? normalizedOriginalUnit.toFixed(2) : nextFinalUnit.toFixed(2),
          partial_discount_percentage: compDraft.compensationType === 'partial_discount' && compDraft.status !== 'normal'
            ? (partialDiscountType === 'percentage' ? partialDiscountPercent.toFixed(2) : null)
            : null,
          partial_discount_type: compDraft.compensationType === 'partial_discount' && compDraft.status !== 'normal'
            ? partialDiscountType
            : null,
          partial_discount_value: compDraft.compensationType === 'partial_discount' && compDraft.status !== 'normal'
            ? partialDiscountValue.toFixed(2)
            : null,
          is_complimentary: nextIsComplimentary,
          accounting_bucket: compDraft.status === 'normal'
            ? null
            : (
              compDraft.accountingBucket
              || getDefaultAccountingBucketFromOperationalLoss(nextOperationalLossCategory)
              || getDefaultComplaintBucket(compDraft.status, compDraft.compensationType)
              || null
            ),
          line_subtotal: nextLineSubtotal.toFixed(2),
        };
      });
    });

    upsertBillAdjustmentsForTable(selectedTable, persistedAdjustments);

    setLocalItemOverrides((current) => ({
      ...current,
      ...updates,
    }));

    setEditingLineKey(null);
    setCompDraft(makeDefaultCompDraft());
    if (compDraft.status !== 'normal' && compDraft.compensationType === 'partial_discount' && partialDiscountType === 'fixed') {
      showToast(
        'Item compensation updated. Fixed partial discount is applied in invoice totals; if backend lacks partial discount fields, finance will use finalized net values.',
        'tertiary',
        6200
      );
    } else {
      showToast('Item compensation updated from accounting.', 'secondary');
    }
  };

  const addComplimentaryDishFromAccounting = () => {
    if (!selectedTable || selectedTableOrders.length === 0) {
      showToast('Select a table with active orders before adding a complimentary item.', 'secondary');
      return;
    }

    if (!canManageCompensation) {
      showToast('You are not authorized to add complimentary items.', 'secondary');
      return;
    }

    const dishId = Number(selectedGiftDishId);
    const selectedDish = publishedDishes.find((dish) => dish.id === dishId);
    if (!selectedDish) {
      showToast('Choose a dish to add as complimentary.', 'secondary');
      return;
    }

    const targetOrder = selectedTableOrders[0];
    const targetOrderId = targetOrder?.id;
    const targetOrderReference = targetOrder?.order_number || (targetOrderId ? String(targetOrderId) : null);
    if (!targetOrderId) {
      showToast('No target order found for this table.', 'secondary');
      return;
    }

    const now = new Date().toISOString();
    const generatedItemId = -Date.now();

    const giftItem: OrderLineItem = {
      id: generatedItemId,
      dish_id: selectedDish.id,
      dish_name: selectedDish.name,
      unit_price: selectedDish.price.toFixed(2),
      quantity: 1,
      line_subtotal: '0.00',
      status: 'compensated',
      compensation_type: 'complimentary',
      compensation_reason: 'customer_satisfaction_recovery',
      complaint_category: 'service',
      operational_loss_category: 'customer_satisfaction_recovery',
      adjustment_action_type: 'service_recovery',
      compensation_note: 'Customer satisfaction recovery',
      approved_by: user ? {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone ?? null,
      } : null,
      approved_at: now,
      original_unit_price: selectedDish.price.toFixed(2),
      final_unit_price: '0.00',
      is_complimentary: true,
      accounting_bucket: 'goodwill_expense',
    };

    upsertBillAdjustmentsForTable(selectedTable, [{
      key: `gift:${selectedTable}:${generatedItemId}`,
      source_order_reference: targetOrderReference,
      dish_name: selectedDish.name,
      quantity: 1,
      status: 'compensated',
      compensation_type: 'complimentary',
      compensation_reason: 'customer_satisfaction_recovery',
      complaint_category: 'service',
      operational_loss_category: 'customer_satisfaction_recovery',
      adjustment_action_type: 'service_recovery',
      compensation_note: 'Customer satisfaction recovery',
      approved_by_staff_name: user?.name || null,
      approved_by_staff_role: user?.role || null,
      approved_at: now,
      original_unit_price: selectedDish.price.toFixed(2),
      final_unit_price: '0.00',
      is_complimentary: true,
      accounting_bucket: 'goodwill_expense',
      local_only: true,
    }]);

    setLocalGiftItemsByTable((current) => ({
      ...current,
      [selectedTable]: [ ...(current[selectedTable] || []), giftItem ],
    }));

    showToast(`${selectedDish.name} added as complimentary.`, 'secondary');
  };

  const selectedTableNotes = useMemo(() => (
    selectedTableOrders
      .map((order) => order.notes?.trim())
      .filter((note): note is string => Boolean(note))
  ), [selectedTableOrders]);

  const selectedTableActors = useMemo(() => {
    const names = Array.from(new Set(
      selectedTableOrders
        .map((order) => order.confirmed_by?.name?.trim())
        .filter((name): name is string => Boolean(name))
    ));

    return names;
  }, [selectedTableOrders]);

  useEffect(() => {
    if (!splitFeatureEnabled) {
      setSessionInvoiceSplit(null);
      setSplitLoading(false);
      return;
    }

    if (selectedTableSessionIds.length !== 1) {
      setSessionInvoiceSplit(null);
      setSplitLoading(false);
      return;
    }

    const [sessionId] = selectedTableSessionIds;
    let cancelled = false;
    setSplitLoading(true);

    void fetchStaffTableSessionInvoiceSplit(sessionId)
      .then((split) => {
        if (cancelled) return;
        setSessionInvoiceSplit(split);
      })
      .catch(() => {
        if (cancelled) return;
        setSessionInvoiceSplit(null);
      })
      .finally(() => {
        if (cancelled) return;
        setSplitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTableOrders, selectedTableSessionIds, splitFeatureEnabled]);

  const handleFinalizeSelectedTable = async () => {
    if (!selectedTable || selectedTableOrders.length === 0 || !selectedTablePreview) {
      return;
    }

    const basePayload: AccountOrderRequest = {
      vat_rate: selectedTablePreview.vatRate,
    };

    if (selectedTablePreview.discountType) {
      basePayload.discount_type = selectedTablePreview.discountType;
      basePayload.discount_value = selectedTablePreview.discountValue;
    }

    setProcessingTarget(`table:${selectedTable}`);
    setError(null);

    try {
      if (requiresPaymentCapture) {
        const normalizedReference = paymentReference.trim();

        if (!normalizedReference) {
          throw new Error('Payment reference is required before marking this invoice as paid.');
        }
      }

      const fallbackMessages: string[] = [];
      await Promise.all(selectedTableOrders.map(async (order, orderIndex) => {
        const orderPayload: AccountOrderRequest = {
          ...basePayload,
          items: order.items
            .filter((item) => typeof item.dish_id === 'number')
            .map((item) => ({
              order_item_id: item.id > 0 ? item.id : null,
              dish_id: Number(item.dish_id),
              quantity: Math.max(1, Number(item.quantity || 1)),
              status: item.status || 'normal',
              compensation_type: item.compensation_type || 'none',
              compensation_reason: item.compensation_reason || null,
              complaint_category: item.complaint_category || null,
              operational_loss_category: item.operational_loss_category || null,
              adjustment_action_type: item.adjustment_action_type || null,
              compensation_note: item.compensation_note || null,
              approved_by_staff_id: item.approved_by?.id || null,
              approved_by_staff_name: item.approved_by?.name || null,
              approved_by_staff_role: item.approved_by?.role || null,
              approved_at: item.approved_at || null,
              original_unit_price: Number(item.original_unit_price || item.unit_price || 0),
              final_unit_price: Number(item.final_unit_price || item.unit_price || 0),
              partial_discount_percentage: item.partial_discount_percentage ? Number(item.partial_discount_percentage) : null,
              partial_discount_type: item.partial_discount_type || null,
              partial_discount_value: item.partial_discount_value ? Number(item.partial_discount_value) : null,
              is_complimentary: item.is_complimentary === true,
              accounting_bucket: item.accounting_bucket || null,
              customer_satisfaction_rating: item.customer_satisfaction_rating || null,
              evidence_photo_url: item.evidence_photo_url || null,
            })),
        };

        try {
          await accountConfirmedOrder(order.id, orderPayload);
        } catch {
          await accountConfirmedOrder(order.id, basePayload);
          fallbackMessages.push(
            order.order_number
              ? `Order ${order.order_number}`
              : `Order #${orderIndex + 1}`
          );
        }
      }));

      if (fallbackMessages.length > 0) {
        showToast(
          `Compensation metadata sync was skipped for ${fallbackMessages.join(', ')}. Finalization continued with base accounting totals.`,
          'tertiary',
          6200
        );
      }
      const uniqueSessionIds = Array.from(new Set(
        selectedTableOrders
          .map((order) => order.table_session_id)
          .filter((sessionId): sessionId is number => typeof sessionId === 'number')
      ));

      if (uniqueSessionIds.length === 0) {
        throw new Error(
          'Unable to finalize this table because no active table session was found for the selected orders.'
        );
      }

      const finalizePayload = requiresPaymentCapture
        ? {
            payment_method: paymentMethod,
            payment_reference: paymentReference.trim(),
          }
        : undefined;

      const finalizeResponses = await Promise.all(
        uniqueSessionIds.map((sessionId) => finalizeGuestTableSession(sessionId, finalizePayload))
      );

      const responsesMissingFinanceInvoice = finalizeResponses.some((response) => (
        typeof response.invoice_id !== 'number'
        || !response.invoice_number
        || !response.invoice_status
      ));

      if (responsesMissingFinanceInvoice) {
        throw new Error(
          'Finalize completed session closure, but no finance invoice record was returned. Please contact support to enable finalize-to-finance persistence.'
        );
      }

      const finalizedInvoiceNumbers = finalizeResponses
        .map((response) => response.invoice_number?.trim())
        .filter((invoiceNumber): invoiceNumber is string => Boolean(invoiceNumber));

      if (finalizedInvoiceNumbers.length > 0) {
        try {
          const financeInvoiceResponse = await fetchInvoices({ per_page: 200 });
          const knownFinanceInvoiceNumbers = new Set(
            financeInvoiceResponse.invoices
              .map((invoice) => invoice.invoice_number?.trim())
              .filter((invoiceNumber): invoiceNumber is string => Boolean(invoiceNumber))
          );

          const missingInvoiceNumber = finalizedInvoiceNumbers.find(
            (invoiceNumber) => !knownFinanceInvoiceNumbers.has(invoiceNumber)
          );

          if (missingInvoiceNumber) {
            showToast(
              `Finalized table session successfully. Finance record ${missingInvoiceNumber} is still syncing and may appear shortly; please refresh finance.`,
              'tertiary',
              5600
            );
          }
        } catch {
          showToast(
            'Finalized table session successfully, but finance visibility check could not be completed. Please refresh finance shortly.',
            'tertiary',
            5600
          );
        }
      }

      const finalizedOrderIds = new Set(selectedTableOrders.map((order) => order.id));

      const expenseAdjustmentCandidates = selectedTableLineItems
        .map((line) => {
          const original = Math.max(0, Number(line.original_line_subtotal || 0));
          const final = Math.max(0, Number(line.line_subtotal || 0));
          const lossValue = Math.max(0, original - final);
          return {
            line,
            original,
            final,
            lossValue,
          };
        })
        .filter((entry) => entry.lossValue > 0);

      if (expenseAdjustmentCandidates.length > 0) {
        try {
          const categories = await fetchExpenseCategories();
          const anyExpenseCategoryId = resolveIssueExpenseCategoryId(categories) ?? resolveGiftExpenseCategoryId(categories);
          if (!anyExpenseCategoryId) {
            showToast(
              'Invoice finalized. Issue/gift losses were not posted to finance expenses because no matching expense category is configured.',
              'tertiary',
              6200
            );
          } else {
            const primaryInvoiceNumber = finalizedInvoiceNumbers[0] || 'N/A';
            await Promise.all(expenseAdjustmentCandidates.map(async ({ line, lossValue, original, final }, index) => {
              const expenseCategoryId = resolveExpenseCategoryIdByBucket(categories, line.accounting_bucket) ?? anyExpenseCategoryId;
              const operationalLossCategory = (line.operational_loss_category as OperationalLossCategory | null)
                || getOperationalLossCategoryFromReason(line.compensation_reason as ComplaintReasonCode | null)
                || getDefaultOperationalLossCategory(line.status, line.compensation_type);
              const actionType = (line.adjustment_action_type as AdjustmentActionType | null)
                || inferAdjustmentActionType({
                  status: line.status,
                  compensationType: line.compensation_type,
                  isComplimentary: line.is_complimentary === true,
                  operationalLossCategory,
                });
              const adjustmentReference = `ADJ-${primaryInvoiceNumber}-${index + 1}`;

              await createExpense({
                expense_category_id: expenseCategoryId,
                expense_date: (line.approved_at || new Date().toISOString()).slice(0, 10),
                amount_cents: Math.round(lossValue * 100),
                tax_amount_cents: 0,
                currency: (user?.restaurant?.currency || 'USD').toUpperCase(),
                status: 'approved',
                payment_method: null,
                reference_no: adjustmentReference,
                description: `Invoice adjustment (${ADJUSTMENT_ACTION_LABELS[actionType]}): ${line.dish_name}`,
                notes: [
                  `Source: invoice adjustment.`,
                  `Adjustment ref: ${adjustmentReference};`,
                  `Invoice number: ${primaryInvoiceNumber};`,
                  `Auto-created from accounting adjustment.`,
                  `Table: ${selectedTable}; invoice: ${primaryInvoiceNumber};`,
                  `status: ${line.status}; compensation: ${line.compensation_type};`,
                  `action_type: ${actionType};`,
                  `operational_loss_category: ${operationalLossCategory};`,
                  `operational_loss_label: ${OPERATIONAL_LOSS_CATEGORY_LABELS[operationalLossCategory]};`,
                  `original: ${original.toFixed(2)}; final: ${final.toFixed(2)}; loss: ${lossValue.toFixed(2)};`,
                  line.approved_by_name ? `approved_by: ${line.approved_by_name};` : null,
                  line.approved_by_role ? `approved_role: ${line.approved_by_role};` : null,
                  line.approved_at ? `approved_at: ${line.approved_at};` : null,
                  line.compensation_reason ? `reason: ${line.compensation_reason};` : null,
                  line.compensation_note ? `note: ${line.compensation_note};` : null,
                ].filter(Boolean).join(' '),
                due_date: null,
                paid_at: null,
              });
            }));
          }
        } catch {
          showToast(
            'Invoice finalized. Issue/gift finance expense sync could not be completed; please review Finance > Expenses.',
            'tertiary',
            6200
          );
        }
      }

      setOrders((current) => current.filter((order) => !finalizedOrderIds.has(order.id)));
      setLocalGiftItemsByTable((current) => {
        if (!selectedTable) {
          return current;
        }
        const next = { ...current };
        delete next[selectedTable];
        return next;
      });
      clearBillAdjustmentsForTable(selectedTable);
      showToast(
        t('accountingPage.finalizedOrders', { count: selectedTableOrders.length, table: selectedTable }),
        'secondary',
        4200
      );
      if (requiresPaymentCapture) {
        setPaymentMethod('cash');
        setPaymentReference('');
      }
      setVisibleInvoiceTable('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('accountingPage.failedFinalize', { table: selectedTable })));
    } finally {
      setProcessingTarget(null);
    }
  };

  const handlePrintInvoice = () => {
    if (typeof window === 'undefined' || !selectedTablePreview || !selectedTable || selectedTableOrders.length === 0) {
      return;
    }

    savePrintableInvoice({
      sourceTableId: selectedTable,
      restaurantName: user?.restaurant?.name || t('accountingPage.restaurantFallback'),
      tableName: selectedTable,
      generatedAt: new Date().toLocaleString(),
      notes: selectedTableNotes,
      items: selectedTableLineItems.map((item) => ({
        key: item.key,
        dishName: item.dish_name,
        dishNameArabic: item.dish_name_ar || undefined,
        quantity: item.quantity,
        unitPrice: `$${item.unit_price}`,
        lineSubtotal: formatMoney(Number(item.line_subtotal)),
        originalLineSubtotal: formatMoney(Number(item.original_line_subtotal)),
        status: item.status,
        compensationType: item.compensation_type,
        reasonLabel: item.compensation_reason
          ? COMPLAINT_REASON_LABELS[item.compensation_reason as ComplaintReasonCode] || item.compensation_reason
          : undefined,
        note: [
          item.compensation_note,
          item.operational_loss_category ? `Loss: ${OPERATIONAL_LOSS_CATEGORY_LABELS[item.operational_loss_category]}` : null,
          item.adjustment_action_type ? `Type: ${ADJUSTMENT_ACTION_LABELS[item.adjustment_action_type]}` : null,
        ].filter(Boolean).join(' • ') || undefined,
        badgeLabel: item.status !== 'normal' ? ISSUE_STATUS_LABELS[item.status] : undefined,
        approvedBy: item.approved_by_name || undefined,
        approvedAt: item.approved_at || undefined,
        accountingBucketLabel: item.accounting_bucket
          ? COMPLAINT_ACCOUNTING_BUCKET_LABELS[item.accounting_bucket as keyof typeof COMPLAINT_ACCOUNTING_BUCKET_LABELS]
          : undefined,
        isComplimentary: item.is_complimentary,
      })),
      includedOrders: selectedTableOrders.map((order) => order.order_number || t('accountingPage.orderNumberLabel', { id: order.id })),
      summary: {
        subtotal: formatMoney(selectedTablePreview.subtotal),
        discountLabel: selectedTablePreview.discountType === 'percentage'
          ? t('accountingPage.discountWithValue', { value: selectedTablePreview.discountValue.toFixed(2) })
          : t('accountingPage.discount'),
        discountAmount: formatMoney(selectedTablePreview.discountAmount),
        taxableSubtotal: formatMoney(selectedTablePreview.taxableSubtotal),
        vatLabel: t('accountingPage.vatWithValue', { value: selectedTablePreview.vatRate.toFixed(2) }),
        vatAmount: formatMoney(selectedTablePreview.vatAmount),
        total: formatMoney(selectedTablePreview.total),
      },
      split: sessionInvoiceSplit?.enabled ? {
        enabled: sessionInvoiceSplit.enabled,
        mode: sessionInvoiceSplit.mode,
        splitCount: sessionInvoiceSplit.split_count,
        breakdown: sessionInvoiceSplit.breakdown.map((item) => ({
          key: item.key,
          label: item.label,
          amount: formatMoney(Number(item.amount)),
        })),
      } : undefined,
    });

    const printUrl = `${window.location.origin}/invoice/print`;
    const printWindow = window.open(printUrl, '_blank', 'noopener,noreferrer');

    if (!printWindow) {
      window.location.assign(printUrl);
    }
  };

  return (
    <DashboardLayout title={t('accountingPage.title')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">{t('accountingPage.heading')}</h2>
          <p className="mt-1 text-sm text-muted">{orderCountLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div ref={tableMenuRef} className="relative min-w-[220px]">
            <button
              type="button"
              disabled={tablesLoading}
              aria-haspopup="listbox"
              aria-expanded={isTableMenuOpen}
              onClick={() => setIsTableMenuOpen((current) => !current)}
              className={cx(
                'flex w-full items-center justify-between gap-3 rounded-full border px-4 py-2.5 text-left text-sm text-text',
                glassControl,
                glassControlHover,
                focusRing,
                tablesLoading && 'cursor-not-allowed opacity-60'
              )}
            >
              <span className="truncate">{tablesLoading ? t('accountingPage.loadingTables') : selectedTable || t('accountingPage.allTables')}</span>
              <span className={cx('text-xs text-muted2 transition-transform', isTableMenuOpen && 'rotate-180')}>▾</span>
            </button>

            {isTableMenuOpen ? (
              <div
                role="listbox"
                className="absolute right-0 z-30 mt-2 w-full min-w-[220px] rounded-[28px] border border-stroke bg-bg1 p-2 shadow-lux2"
              >
                <div className="px-1 pb-2">
                  <GlassInput
                    ref={tableSearchInputRef}
                    type="search"
                    value={tableSearchQuery}
                    onChange={(event) => setTableSearchQuery(event.target.value)}
                    placeholder={t('accountingPage.searchTablesPlaceholder')}
                    leftSlot={<span>⌕</span>}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable('');
                    setVisibleInvoiceTable('');
                    setTableSearchQuery('');
                    setIsTableMenuOpen(false);
                  }}
                  className={cx(
                    'flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-sm transition',
                    !selectedTable ? 'bg-gold/15 text-text' : 'text-muted hover:bg-white/5 hover:text-text'
                  )}
                >
                  <span>{t('accountingPage.allTables')}</span>
                  {!selectedTable ? <span className="text-gold2">{t('accountingPage.selected')}</span> : null}
                </button>

                <div className="my-2 h-px bg-white/10" />

                <div className="max-h-72 overflow-y-auto">
                  {filteredTableOptions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted">
                      {t('accountingPage.noTablesMatch', { query: tableSearchQuery.trim() })}
                    </div>
                  ) : filteredTableOptions.map((table) => {
                    const isActive = selectedTable === table.name;

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => {
                          setSelectedTable(table.name);
                          if (visibleInvoiceTable !== table.name) {
                            setVisibleInvoiceTable('');
                          }
                          setTableSearchQuery('');
                          setIsTableMenuOpen(false);
                        }}
                        className={cx(
                          'flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-sm transition',
                          isActive ? 'bg-gold/15 text-text' : 'text-muted hover:bg-white/5 hover:text-text'
                        )}
                      >
                        <span>{table.name}</span>
                        {isActive ? <span className="text-gold2">{t('accountingPage.selected')}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <LiquidButton tone="tertiary" onClick={() => void loadOrders()} disabled={loading}>
            {loading ? t('accountingPage.refreshing') : t('accountingPage.refresh')}
          </LiquidButton>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {error}
        </div>
      ) : null}

      {tablesError ? (
        <div className="mb-4 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {tablesError}
        </div>
      ) : null}

      {selectedTable && selectedTableStats ? (
        <GlassCard className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('accountingPage.selectedTable')}</p>
              <h3 className="mt-2 text-2xl font-semibold text-text">{selectedTable}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted">{t('accountingPage.ordersInQueue', { count: selectedTableStats.orderCount })}</p>
                <p className="mt-1 text-lg font-semibold text-text">${selectedTableStats.subtotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-muted">{t('accountingPage.loadingQueue')}</div>
      ) : null}

      {!loading && !selectedTable ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">🧾</div>
          <h3 className="mb-2 text-xl font-medium text-text">{t('accountingPage.selectTableToCreateInvoice')}</h3>
          <p className="text-muted">
            {t('accountingPage.selectTableHint')}
          </p>
        </div>
      ) : null}

      {!loading && selectedTable && filteredOrders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">💳</div>
          <h3 className="mb-2 text-xl font-medium text-text">
            {t('accountingPage.noOrdersForTable', { table: selectedTable })}
          </h3>
          <p className="text-muted">
            {t('accountingPage.noOrdersHint')}
          </p>
        </div>
      ) : null}

      {!loading && isViewingSelectedInvoice && selectedTable && selectedTableOrders.length > 0 && selectedTablePreview ? (
        <GlassCard className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('accountingPage.tableInvoice')}</p>
              <h3 className="mt-2 text-2xl font-semibold text-text">{selectedTable}</h3>
              <p className="mt-2 text-sm text-muted">
                {t('accountingPage.confirmedOrdersIncluded', { count: selectedTableOrders.length })}
                {selectedTableActors.length > 0 ? ` • ${t('accountingPage.confirmedBy', { names: selectedTableActors.join(', ') })}` : ''}
              </p>
              {selectedTableNotes.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {selectedTableNotes.map((note, index) => (
                    <p
                      key={`${selectedTable}-note-${index + 1}`}
                      className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted"
                    >
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('accountingPage.combinedSubtotal')}</p>
              <p className="mt-2 text-2xl font-semibold text-text">{formatMoney(selectedTablePreview.subtotal)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">{t('accountingPage.itemsAcrossTable')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedGiftDishId}
                    onChange={(event) => setSelectedGiftDishId(event.target.value)}
                    className="themed-native-select rounded-full border border-white/10 bg-bg1/70 px-3 py-1.5 text-xs text-text outline-none transition focus:border-gold"
                    disabled={!canManageCompensation}
                  >
                    <option value="">Select complimentary dish</option>
                    {publishedDishes.map((dish) => (
                      <option key={dish.id} value={dish.id}>
                        {dish.name} (${dish.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <LiquidButton
                    tone="tertiary"
                    className="px-3 py-1.5 text-xs"
                    disabled={!canManageCompensation}
                    onClick={addComplimentaryDishFromAccounting}
                  >
                    Add Gift Dish
                  </LiquidButton>
                </div>
              </div>
              {!canManageCompensation ? (
                <p className="mt-2 text-xs text-amber-200">
                  Complimentary, refund, and service-recovery adjustments are restricted to Admin and Accountant roles.
                </p>
              ) : null}
              <div className="mt-3 space-y-3">
                {selectedTableIssueItems.length > 0 ? (
                  <div className="rounded-[20px] border border-amber-300/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/90">
                      Issue / Gift Tracking ({selectedTableIssueItems.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTableIssueItems.map((item) => (
                        <span
                          key={`issue-chip-${item.key}`}
                          className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs text-text"
                        >
                          {item.dish_name}
                          {` • ${ISSUE_STATUS_LABELS[item.status]}`}
                          {item.compensation_type !== 'none' ? ` • ${COMPENSATION_TYPE_LABELS[item.compensation_type]}` : ''}
                          {item.operational_loss_category ? ` • ${OPERATIONAL_LOSS_CATEGORY_BADGE_LABELS[item.operational_loss_category]}` : ''}
                          {item.adjustment_action_type ? ` • ${ADJUSTMENT_ACTION_LABELS[item.adjustment_action_type]}` : ''}
                          {item.lossValue > 0 ? ` • loss ${formatMoney(item.lossValue)}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedTableLineItems.map((item) => {
                  const isCancelledOrProblematic = item.status === 'cancelled' || item.status === 'problematic';
                  const isComplimentary = item.is_complimentary;
                  const reasonLabel = item.compensation_reason
                    ? COMPLAINT_REASON_LABELS[item.compensation_reason as ComplaintReasonCode] || item.compensation_reason
                    : null;
                  const hasDiscountedLine = Number(item.original_line_subtotal) > Number(item.line_subtotal);

                  return (
                    <div
                      key={item.key}
                      className={`rounded-[20px] border px-4 py-3 ${
                        isComplimentary
                          ? 'border-emerald-400/30 bg-emerald-500/10'
                          : isCancelledOrProblematic
                            ? 'border-rose-400/30 bg-rose-500/10'
                            : 'border-white/10 bg-black/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate font-medium ${
                            isComplimentary
                              ? 'text-emerald-500'
                              : isCancelledOrProblematic
                                ? 'text-rose-500 line-through'
                                : 'text-text'
                          }`}>
                            {item.dish_name}
                          </p>
                          <p className="text-sm text-muted">
                            {item.quantity} × <span className={isComplimentary ? 'line-through text-emerald-500/80' : ''}>${item.unit_price}</span>
                            {item.compensation_type !== 'none' ? ` • ${COMPENSATION_TYPE_LABELS[item.compensation_type]}` : ''}
                          </p>
                          {reasonLabel ? (
                            <p className="text-xs text-muted2">
                              Reason: {reasonLabel}
                              {item.compensation_note ? ` • ${item.compensation_note}` : ''}
                            </p>
                          ) : null}
                          {item.operational_loss_category ? (
                            <p className="text-[11px] text-muted2">
                              Internal Loss: {OPERATIONAL_LOSS_CATEGORY_LABELS[item.operational_loss_category]}
                              {item.adjustment_action_type ? ` • ${ADJUSTMENT_ACTION_LABELS[item.adjustment_action_type]}` : ''}
                            </p>
                          ) : null}
                          {item.approved_by_name ? (
                            <p className="text-[11px] text-muted2">
                              Approved by {item.approved_by_name}
                              {item.approved_at ? ` • ${new Date(item.approved_at).toLocaleString()}` : ''}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`text-sm font-semibold ${
                            isComplimentary
                              ? 'text-emerald-500'
                              : isCancelledOrProblematic
                                ? 'text-rose-500'
                                : 'text-gold2'
                          }`}
                          >
                            ${item.line_subtotal}
                          </div>
                          {hasDiscountedLine ? (
                            <div className="text-xs text-muted line-through">${item.original_line_subtotal}</div>
                          ) : null}
                          {item.status !== 'normal' ? (
                            <div className="mt-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted2">
                              {ISSUE_STATUS_LABELS[item.status]}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <LiquidButton
                          tone="tertiary"
                          className="px-3 py-1.5 text-xs"
                          disabled={!canManageCompensation}
                          onClick={() => openCompensationEditor(item.key)}
                        >
                          Edit Issue / Compensation
                        </LiquidButton>
                      </div>

                      {editingLineKey === item.key ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="grid gap-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Status</span>
                                <select
                                  value={compDraft.status}
                                  onChange={(event) => {
                                    const nextStatus = event.target.value as OrderItemIssueStatus;
                                    const defaultType: OrderItemCompensationType = nextStatus === 'normal'
                                      ? 'none'
                                      : nextStatus === 'cancelled'
                                        ? 'full_waiver'
                                        : 'partial_discount';
                                    setCompDraft((current) => ({
                                      ...current,
                                      status: nextStatus,
                                      compensationType: defaultType,
                                      operationalLossCategory: nextStatus === 'normal'
                                        ? ''
                                        : (getDefaultOperationalLossCategory(nextStatus, defaultType) || ''),
                                      accountingBucket: nextStatus === 'normal'
                                        ? ''
                                        : (getDefaultComplaintBucket(nextStatus, defaultType) || getDefaultAccountingBucketFromOperationalLoss(getDefaultOperationalLossCategory(nextStatus, defaultType))),
                                    }));
                                  }}
                                  className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                >
                                  {(['normal', 'problematic', 'cancelled', 'compensated'] as OrderItemIssueStatus[]).map((status) => (
                                    <option key={status} value={status}>{ISSUE_STATUS_LABELS[status]}</option>
                                  ))}
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Compensation Type</span>
                                <select
                                  value={compDraft.compensationType}
                                  disabled={compDraft.status === 'normal'}
                                  onChange={(event) => {
                                    const nextType = event.target.value as OrderItemCompensationType;
                                    setCompDraft((current) => ({
                                      ...current,
                                      compensationType: nextType,
                                      operationalLossCategory: current.status === 'normal'
                                        ? current.operationalLossCategory
                                        : (current.operationalLossCategory || getDefaultOperationalLossCategory(current.status, nextType)),
                                      accountingBucket: getDefaultComplaintBucket(current.status, nextType)
                                        || getDefaultAccountingBucketFromOperationalLoss(current.operationalLossCategory || getDefaultOperationalLossCategory(current.status, nextType))
                                        || current.accountingBucket,
                                    }));
                                  }}
                                  className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45 disabled:opacity-60"
                                >
                                  {(['none', 'full_waiver', 'partial_discount', 'complimentary'] as OrderItemCompensationType[]).map((type) => (
                                    <option key={type} value={type}>{COMPENSATION_TYPE_LABELS[type]}</option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Reason</span>
                                <select
                                  value={compDraft.reason}
                                  onChange={(event) => {
                                    const nextReason = event.target.value as ComplaintReasonCode | '';
                                    setCompDraft((current) => ({
                                      ...current,
                                      reason: nextReason,
                                      category: getComplaintCategoryFromReason(nextReason || null) || current.category,
                                      operationalLossCategory: getOperationalLossCategoryFromReason(nextReason || null) || current.operationalLossCategory,
                                    }));
                                  }}
                                  className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                >
                                  <option value="">Select reason</option>
                                  {COMPLAINT_REASON_OPTIONS.map((reasonOption) => (
                                    <option key={reasonOption.value} value={reasonOption.value}>{reasonOption.label}</option>
                                  ))}
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Category</span>
                                <select
                                  value={compDraft.category}
                                  onChange={(event) => setCompDraft((current) => ({ ...current, category: event.target.value as ComplaintCategory | '' }))}
                                  className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                >
                                  <option value="">Auto from reason</option>
                                  {(['quality_control', 'service', 'safety', 'other'] as ComplaintCategory[]).map((category) => (
                                    <option key={category} value={category}>{COMPLAINT_CATEGORY_LABELS[category]}</option>
                                  ))}
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Operational Loss</span>
                                <select
                                  value={compDraft.operationalLossCategory}
                                  onChange={(event) => {
                                    const nextLossCategory = event.target.value as OperationalLossCategory | '';
                                    setCompDraft((current) => ({
                                      ...current,
                                      operationalLossCategory: nextLossCategory,
                                      accountingBucket: nextLossCategory
                                        ? (getDefaultAccountingBucketFromOperationalLoss(nextLossCategory) || current.accountingBucket)
                                        : current.accountingBucket,
                                    }));
                                  }}
                                  className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                >
                                  <option value="">Auto from reason</option>
                                  {(['kitchen_mistake', 'burned_food', 'wrong_order_sent', 'quality_complaint', 'customer_satisfaction_recovery'] as OperationalLossCategory[]).map((lossCategory) => (
                                    <option key={lossCategory} value={lossCategory}>{OPERATIONAL_LOSS_CATEGORY_LABELS[lossCategory]}</option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            {compDraft.compensationType === 'partial_discount' ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="block">
                                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Partial Discount Type</span>
                                  <select
                                    value={compDraft.partialDiscountType}
                                    onChange={(event) => setCompDraft((current) => ({
                                      ...current,
                                      partialDiscountType: event.target.value as DiscountType,
                                    }))}
                                    className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                  >
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed">Fixed Value (per unit)</option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">
                                    {compDraft.partialDiscountType === 'percentage' ? 'Partial Discount %' : 'Partial Discount Value'}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={compDraft.partialDiscountType === 'percentage' ? '100' : undefined}
                                    step="0.01"
                                    value={compDraft.partialDiscountType === 'percentage' ? compDraft.partialDiscountPercent : compDraft.partialDiscountValue}
                                    onChange={(event) => setCompDraft((current) => (
                                      current.partialDiscountType === 'percentage'
                                        ? { ...current, partialDiscountPercent: event.target.value }
                                        : { ...current, partialDiscountValue: event.target.value }
                                    ))}
                                    className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                  />
                                </label>
                              </div>
                            ) : null}

                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Accounting Bucket</span>
                              <select
                                value={compDraft.accountingBucket}
                                onChange={(event) => setCompDraft((current) => ({ ...current, accountingBucket: event.target.value as ComplaintAccountingBucket | '' }))}
                                className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                              >
                                <option value="">Auto bucket</option>
                                {(['wastage', 'customer_complaint_loss', 'quality_control_loss', 'marketing_expense', 'customer_retention', 'goodwill_expense'] as ComplaintAccountingBucket[]).map((bucket) => (
                                  <option key={bucket} value={bucket}>{COMPLAINT_ACCOUNTING_BUCKET_LABELS[bucket]}</option>
                                ))}
                              </select>
                            </label>
                            {compDraft.status !== 'normal' ? (
                              <p className="text-xs text-muted2">
                                Action Type: {ADJUSTMENT_ACTION_LABELS[inferAdjustmentActionType({
                                  status: compDraft.status,
                                  compensationType: compDraft.compensationType,
                                  isComplimentary: compDraft.compensationType === 'complimentary',
                                  operationalLossCategory: compDraft.operationalLossCategory || getOperationalLossCategoryFromReason(compDraft.reason || null) || null,
                                })]}
                              </p>
                            ) : null}

                            <label className="block">
                              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Note (optional)</span>
                              <textarea
                                value={compDraft.note}
                                rows={2}
                                onChange={(event) => setCompDraft((current) => ({ ...current, note: event.target.value }))}
                                className="w-full rounded-2xl border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                              />
                            </label>

                            <div className="flex flex-wrap justify-end gap-2">
                              <LiquidButton
                                tone="secondary"
                                className="px-3 py-1.5 text-xs"
                                onClick={() => {
                                  setEditingLineKey(null);
                                  setCompDraft(makeDefaultCompDraft());
                                }}
                              >
                                Cancel
                              </LiquidButton>
                              <LiquidButton
                                className="px-3 py-1.5 text-xs"
                                onClick={applyLineCompensationFromAccounting}
                              >
                                Save Compensation
                              </LiquidButton>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted2">{t('accountingPage.includedOrders')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTableOrders.map((order) => (
                    <span
                      key={order.id}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted"
                    >
                      {order.order_number || t('accountingPage.orderNumberLabel', { id: order.id })}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-text">{t('accountingPage.invoiceSettings')}</p>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">{t('accountingPage.vatPercent')}</label>
                  <GlassInput
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={selectedTableDraft.vatRate}
                    rightSlot="%"
                    onChange={(event) => updateTableDraft(selectedTable, { vatRate: event.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">{t('accountingPage.discountType')}</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {discountOptions.map((option) => (
                      <GlassChip
                        key={`table-${selectedTable}-${option.value || 'none'}`}
                        type="button"
                        active={selectedTableDraft.discountType === option.value}
                        onClick={() => updateTableDraft(selectedTable, {
                          discountType: option.value,
                          discountValue: option.value ? selectedTableDraft.discountValue : '0',
                        })}
                        className="px-4 py-2 text-sm"
                      >
                        {option.label}
                      </GlassChip>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">
                    {selectedTableDraft.discountType === 'percentage' ? t('accountingPage.discountPercent') : t('accountingPage.discountValue')}
                  </label>
                  <GlassInput
                    type="number"
                    min="0"
                    max={selectedTableDraft.discountType === 'percentage' ? '100' : undefined}
                    step="0.01"
                    value={selectedTableDraft.discountValue}
                    disabled={!selectedTableDraft.discountType}
                    rightSlot={selectedTableDraft.discountType === 'percentage' ? '%' : '$'}
                    onChange={(event) => updateTableDraft(selectedTable, { discountValue: event.target.value })}
                  />
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted2">{t('accountingPage.liveTableInvoicePreview')}</p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('accountingPage.subtotal')}</span>
                      <span className="font-medium text-text">{formatMoney(selectedTablePreview.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {selectedTablePreview.discountType === 'percentage'
                          ? t('accountingPage.discountWithValue', { value: selectedTablePreview.discountValue.toFixed(2) })
                          : t('accountingPage.discount')}
                      </span>
                      <span className="font-medium text-rose-200">- {formatMoney(selectedTablePreview.discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('accountingPage.taxableSubtotal')}</span>
                      <span className="font-medium text-text">{formatMoney(selectedTablePreview.taxableSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('accountingPage.vatWithValue', { value: selectedTablePreview.vatRate.toFixed(2) })}</span>
                      <span className="font-medium text-text">+ {formatMoney(selectedTablePreview.vatAmount)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-base">
                      <span className="font-semibold text-text">{t('accountingPage.finalTotal')}</span>
                      <span className="text-lg font-semibold text-gold2">{formatMoney(selectedTablePreview.total)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted2">
                    {t('accountingPage.finalizeHint', { table: selectedTable })}
                  </p>
                </div>

                {splitFeatureEnabled ? (
                  <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted2">
                      {t('guestOrders.splitSectionTitle', { defaultValue: 'Invoice Split' })}
                    </p>
                    <p className="mt-2 text-xs text-muted2">
                      {t('accountingPage.splitScopeHint', {
                        defaultValue: 'Guest split is calculated for the full table invoice across all session orders.',
                      })}
                    </p>
                    {selectedTableSessionIds.length !== 1 ? (
                      <p className="mt-3 text-sm text-muted">
                        {t('accountingPage.splitSessionUnavailable', {
                          defaultValue: 'Split breakdown appears when exactly one active table session is selected.',
                        })}
                      </p>
                    ) : splitLoading ? (
                      <p className="mt-3 text-sm text-muted">
                        {t('accountingPage.loadingSplit', { defaultValue: 'Loading split breakdown...' })}
                      </p>
                    ) : sessionInvoiceSplit?.mode === 'by_person_order' && sessionInvoiceSplit.is_complete === false ? (
                      <p className="mt-3 text-sm text-muted">
                        {t('accountingPage.splitIncompleteGuest', {
                          defaultValue: 'Guest split is not fully saved yet. Accountant view updates after all items are assigned.',
                        })}
                      </p>
                    ) : sessionInvoiceSplit?.enabled && sessionInvoiceSplit.breakdown.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {sessionInvoiceSplit.breakdown.map((item) => (
                          <div
                            key={`accounting-split-${item.key}`}
                            className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/10 px-3 py-2.5"
                          >
                            <span className="text-sm text-text">{item.label}</span>
                            <span className="text-sm font-semibold text-gold2">{formatMoney(Number(item.amount))}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">
                        {t('accountingPage.noSplitConfigured', {
                          defaultValue: 'No split settings configured yet for this table session.',
                        })}
                      </p>
                    )}
                  </div>
                ) : null}

                {requiresPaymentCapture ? (
                  <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted2">
                      {t('accountingPage.paymentDetailsTitle', { defaultValue: 'Payment Details' })}
                    </p>
                    <p className="mt-2 text-xs text-muted2">
                      {t('accountingPage.paymentDetailsHint', {
                        defaultValue: 'This restaurant marks finalized invoices as paid, so payment details are required.',
                      })}
                    </p>
                    <div className="mt-3 grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">
                          {t('accountingPage.paymentMethod', { defaultValue: 'Payment Method' })}
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(event) => setPaymentMethod(event.target.value as FinancePaymentMethod)}
                          className="themed-native-select w-full rounded-full border border-white/10 bg-bg1/70 px-3 py-2 text-sm text-text outline-none transition focus:border-gold"
                        >
                          <option value="cash">{t('accountingPage.paymentMethodCash', { defaultValue: 'Cash' })}</option>
                          <option value="card">{t('accountingPage.paymentMethodCard', { defaultValue: 'Card' })}</option>
                          <option value="transfer">{t('accountingPage.paymentMethodTransfer', { defaultValue: 'Transfer' })}</option>
                          <option value="other">{t('accountingPage.paymentMethodOther', { defaultValue: 'Other' })}</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">
                          {t('accountingPage.paymentReference', { defaultValue: 'Payment Reference' })}
                        </label>
                        <GlassInput
                          type="text"
                          value={paymentReference}
                          onChange={(event) => setPaymentReference(event.target.value)}
                          placeholder={t('accountingPage.paymentReferencePlaceholder', {
                            defaultValue: 'Receipt number, transaction id, or note',
                          })}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <LiquidButton
                  tone="tertiary"
                  onClick={() => setVisibleInvoiceTable(
                    isShowingSelectedInvoicePreview ? '' : selectedTable
                  )}
                  disabled={processingTarget === `table:${selectedTable}`}
                >
                  {isShowingSelectedInvoicePreview ? t('accountingPage.hideInvoicePreview') : t('accountingPage.showInvoiceInPage')}
                </LiquidButton>

                <LiquidButton
                  tone="secondary"
                  onClick={handlePrintInvoice}
                  disabled={processingTarget === `table:${selectedTable}`}
                >
                  {t('accountingPage.printInvoice')}
                </LiquidButton>

                <LiquidButton
                  tone="primary"
                  onClick={handleFinalizeSelectedTable}
                  disabled={
                    processingTarget === `table:${selectedTable}`
                    || (requiresPaymentCapture && paymentReference.trim() === '')
                  }
                >
                  {processingTarget === `table:${selectedTable}` ? t('accountingPage.finalizing') : t('accountingPage.finalizeTableInvoice', { table: selectedTable })}
                </LiquidButton>
              </div>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {!loading && isShowingSelectedInvoicePreview && selectedTable && selectedTablePreview ? (
        <GlassCard className="mt-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-white/10 pb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gold2/85">{t('invoice.preview')}</p>
                <h3 className="mt-3 text-3xl font-semibold text-text">{t('invoice.tableTitle', { table: selectedTable })}</h3>
                <p className="mt-2 text-sm text-muted">
                  {user?.restaurant?.name || t('accountingPage.restaurantFallback')}
                  {' • '}
                  {new Date().toLocaleString()}
                </p>
              </div>

              <div className="rounded-[22px] border border-gold/20 bg-gold/10 px-5 py-4 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('invoice.amountDue')}</p>
                <p className="mt-2 text-3xl font-semibold text-text">{formatMoney(selectedTablePreview.total)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <p className="text-sm font-semibold text-text">{t('accountingPage.invoiceItems')}</p>
                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
                  <div className="grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted2">
                    <span>{t('accountingPage.item')}</span>
                    <span className="text-right">{t('accountingPage.qty')}</span>
                    <span className="text-right">{t('accountingPage.total')}</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {selectedTableLineItems.map((item) => {
                      const isCancelledOrProblematic = item.status === 'cancelled' || item.status === 'problematic';
                      const isComplimentary = item.is_complimentary;
                      const reasonLabel = item.compensation_reason
                        ? COMPLAINT_REASON_LABELS[item.compensation_reason as ComplaintReasonCode] || item.compensation_reason
                        : null;
                      const hasDiscountedLine = Number(item.original_line_subtotal) > Number(item.line_subtotal);

                      return (
                        <div
                          key={`invoice-${item.key}`}
                          className={`grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 px-4 py-4 text-sm ${
                            isComplimentary
                              ? 'bg-emerald-500/[0.08] text-emerald-100'
                              : isCancelledOrProblematic
                                ? 'bg-rose-500/[0.08] text-rose-100'
                                : 'text-text'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`truncate font-medium ${isCancelledOrProblematic ? 'line-through' : ''}`}>{item.dish_name}</p>
                            <p className="mt-1 text-xs text-muted">
                              {isComplimentary ? (
                                <span className="line-through text-emerald-100/80">{t('common.eachPrice', { price: item.unit_price })}</span>
                              ) : (
                                t('common.eachPrice', { price: item.unit_price })
                              )}
                              {item.compensation_type !== 'none' ? ` • ${COMPENSATION_TYPE_LABELS[item.compensation_type]}` : ''}
                            </p>
                            {reasonLabel ? (
                              <p className="mt-1 text-xs text-muted2">
                                Reason: {reasonLabel}
                                {item.compensation_note ? ` • ${item.compensation_note}` : ''}
                              </p>
                            ) : null}
                            {item.operational_loss_category ? (
                              <p className="mt-1 text-[11px] text-muted2">
                                Internal Loss: {OPERATIONAL_LOSS_CATEGORY_LABELS[item.operational_loss_category]}
                                {item.adjustment_action_type ? ` • ${ADJUSTMENT_ACTION_LABELS[item.adjustment_action_type]}` : ''}
                              </p>
                            ) : null}
                            {item.status !== 'normal' ? (
                              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted2">
                                {ISSUE_STATUS_LABELS[item.status]}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-right text-muted">{item.quantity}</span>
                          <span className="text-right font-medium">
                            {formatMoney(Number(item.line_subtotal))}
                            {hasDiscountedLine ? (
                              <span className="block text-xs text-muted line-through">
                                {formatMoney(Number(item.original_line_subtotal))}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedTableNotes.length > 0 ? (
                  <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted2">{t('common.notesForTeam')}</p>
                    <div className="mt-3 space-y-2 text-sm text-muted">
                      {selectedTableNotes.map((note, index) => (
                        <p key={`invoice-note-${index + 1}`}>{note}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-semibold text-text">{t('accountingPage.invoiceSummary')}</p>
                <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-5">
                  <div className="space-y-3 text-sm text-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('accountingPage.subtotal')}</span>
                      <span className="font-medium text-text">{formatMoney(selectedTablePreview.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {selectedTablePreview.discountType === 'percentage'
                          ? t('accountingPage.discountWithValue', { value: selectedTablePreview.discountValue.toFixed(2) })
                          : t('accountingPage.discount')}
                      </span>
                      <span className="font-medium text-rose-200">- {formatMoney(selectedTablePreview.discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('accountingPage.taxableSubtotal')}</span>
                      <span className="font-medium text-text">{formatMoney(selectedTablePreview.taxableSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('accountingPage.vatWithValue', { value: selectedTablePreview.vatRate.toFixed(2) })}</span>
                      <span className="font-medium text-text">+ {formatMoney(selectedTablePreview.vatAmount)}</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base font-semibold text-text">{t('accountingPage.grandTotal')}</span>
                      <span className="text-2xl font-semibold text-gold2">{formatMoney(selectedTablePreview.total)}</span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-muted2">
                    {t('accountingPage.inPageInvoiceHint')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      ) : null}

      
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AccountingOrdersPage;
