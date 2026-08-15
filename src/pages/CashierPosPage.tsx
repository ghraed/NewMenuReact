import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchGuestTables, fetchPublishedDishes, quickPosCheckout } from '../services/orderService';
import {
  appendCompensationAuditLogs,
  appendCompensationLedgerEntries,
  buildCompensationDashboardReport,
  readCompensationLedger,
  type CompensationAuditLog,
  type CompensationLedgerEntry,
} from '../services/complaintCompensationService';
import { calculateInvoicePreview, parseFiniteNumber } from '../utils/financeMath';
import type {
  ComplaintAccountingBucket,
  ComplaintCategory,
  ComplaintReasonCode,
  OrderItemCompensationType,
  OrderItemIssueStatus,
  PosPaymentMethod,
  PublishedDishSummary,
  UserRole,
} from '../types';
import {
  COMPLAINT_ACCOUNTING_BUCKET_LABELS,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_REASON_LABELS,
  COMPLAINT_REASON_OPTIONS,
  COMPENSATION_TYPE_LABELS,
  ISSUE_STATUS_LABELS,
  getCompensationSuggestions,
  getComplaintCategoryFromReason,
  getDefaultComplaintBucket,
} from '../utils/orderItemCompensation';
import { formatPriceWithCurrency, normalizeCurrency, readGuestCurrencySettings } from '../utils/currency';

interface PosCartItem {
  lineId: string;
  dish: PublishedDishSummary;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  issueStatus: OrderItemIssueStatus;
  compensationType: OrderItemCompensationType;
  complaintReason: ComplaintReasonCode | '';
  complaintCategory: ComplaintCategory | '';
  complaintNote: string;
  approvedBy: {
    id?: number | null;
    name: string;
    role: UserRole;
  } | null;
  approvedAt: string | null;
  accountingBucket: ComplaintAccountingBucket | '';
  isComplimentary: boolean;
  partialDiscountPercent: number | null;
  evidencePhotoUrl: string;
  customerSatisfactionRating: number | '';
}

interface HeldPosOrder {
  id: string;
  createdAt: string;
  tableReference: string;
  note: string;
  discountType: '' | 'fixed' | 'percentage';
  discountValue: string;
  vatRate: string;
  paymentMethod: PosPaymentMethod;
  items: PosCartItem[];
}

interface CompensationDraft {
  status: OrderItemIssueStatus;
  compensationType: OrderItemCompensationType;
  reason: ComplaintReasonCode | '';
  category: ComplaintCategory | '';
  note: string;
  partialDiscountPercent: string;
  accountingBucket: ComplaintAccountingBucket | '';
  evidencePhotoUrl: string;
  customerSatisfactionRating: string;
}

const QUICK_TABLE_OPTIONS = ['POS-WALK-IN', 'PICKUP', 'DELIVERY'];
const AUTHORIZED_COMPENSATION_ROLES: UserRole[] = ['admin', 'accountant'];

const makeLineId = (): string => `POS-LINE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const makeDefaultDraft = (): CompensationDraft => ({
  status: 'normal',
  compensationType: 'none',
  reason: '',
  category: '',
  note: '',
  partialDiscountPercent: '0',
  accountingBucket: '',
  evidencePhotoUrl: '',
  customerSatisfactionRating: '',
});

const clampPercent = (value: number): number => Math.min(Math.max(value, 0), 100);

const toLineMoney = (item: PosCartItem): { originalLineTotal: number; finalLineTotal: number; waivedTotal: number } => {
  const originalLineTotal = item.originalUnitPrice * item.quantity;
  const finalLineTotal = item.finalUnitPrice * item.quantity;
  return {
    originalLineTotal,
    finalLineTotal,
    waivedTotal: Math.max(originalLineTotal - finalLineTotal, 0),
  };
};

const getCompensationAction = (item: PosCartItem): CompensationLedgerEntry['action'] => {
  if (item.isComplimentary || item.compensationType === 'complimentary') {
    return 'marked_complimentary';
  }
  if (item.issueStatus === 'cancelled') {
    return 'marked_cancelled';
  }
  if (item.issueStatus === 'problematic') {
    return 'marked_problematic';
  }
  return 'marked_compensated';
};

const buildCompensationPayloadFromItem = (
  item: PosCartItem,
  action: CompensationLedgerEntry['action'],
  source: CompensationLedgerEntry['source'],
  tableReference: string
): CompensationLedgerEntry => {
  const { originalLineTotal, finalLineTotal, waivedTotal } = toLineMoney(item);

  return {
    id: `${source}-${item.lineId}-${Date.now()}`,
    created_at: new Date().toISOString(),
    source,
    table_reference: tableReference,
    dish_id: item.dish.id,
    dish_name: item.dish.name,
    quantity: item.quantity,
    status: item.issueStatus,
    compensation_type: item.compensationType,
    compensation_reason: item.complaintReason || null,
    complaint_category: item.complaintCategory || null,
    compensation_note: item.complaintNote || null,
    accounting_bucket: item.accountingBucket || null,
    original_amount: Number(originalLineTotal.toFixed(2)),
    final_amount: Number(finalLineTotal.toFixed(2)),
    loss_amount: Number(waivedTotal.toFixed(2)),
    is_complimentary: item.isComplimentary,
    approved_by: item.approvedBy || null,
    approved_at: item.approvedAt,
    evidence_photo_url: item.evidencePhotoUrl || null,
    customer_satisfaction_rating: item.customerSatisfactionRating === ''
      ? null
      : Number(item.customerSatisfactionRating),
    action,
  };
};

const buildAuditLogFromEntry = (
  entry: CompensationLedgerEntry,
  actor: { name: string; role: UserRole }
): CompensationAuditLog => ({
  id: `audit-${entry.id}`,
  timestamp: new Date().toISOString(),
  actor_name: actor.name,
  actor_role: actor.role,
  action: entry.action,
  message: `${actor.name} marked ${entry.dish_name} as ${entry.status}.`,
  entry_id: entry.id,
  dish_name: entry.dish_name,
  table_reference: entry.table_reference,
  order_reference: entry.order_reference,
});

const CashierPosPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const storedGuestCurrency = readGuestCurrencySettings()?.currency;
  const currency = normalizeCurrency(storedGuestCurrency || user?.restaurant?.currency || 'USD');
  const toMoney = useCallback((value: number): string => (
    formatPriceWithCurrency(Number.isFinite(value) ? value : 0, currency)
  ), [currency]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dishes, setDishes] = useState<PublishedDishSummary[]>([]);
  const [tableOptions, setTableOptions] = useState<string[]>(QUICK_TABLE_OPTIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
  const [tableReference, setTableReference] = useState<string>('POS-WALK-IN');
  const [orderNote, setOrderNote] = useState('');
  const [discountType, setDiscountType] = useState<'' | 'fixed' | 'percentage'>('');
  const [discountValue, setDiscountValue] = useState('0');
  const [vatRate, setVatRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [heldOrders, setHeldOrders] = useState<HeldPosOrder[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [compDraft, setCompDraft] = useState<CompensationDraft>(makeDefaultDraft());
  const [, setReportRefreshKey] = useState(0);

  const actor = useMemo(() => ({
    id: user?.id,
    name: user?.name || 'Unknown staff',
    role: (user?.role || 'staff') as UserRole,
  }), [user?.id, user?.name, user?.role]);

  const canManageCompensation = AUTHORIZED_COMPENSATION_ROLES.includes(actor.role);

  const loadPosData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextDishes = await fetchPublishedDishes();
      setDishes(nextDishes.filter((dish) => (
        dish.is_orderable !== false && dish.is_out_of_stock !== true
      )));

      const restaurantSlug = user?.restaurant?.slug;
      if (restaurantSlug) {
        const tablesResponse = await fetchGuestTables(restaurantSlug);
        const namedTables = tablesResponse.tables.map((table) => table.name);
        const deduplicated = Array.from(new Set([...QUICK_TABLE_OPTIONS, ...namedTables]));
        setTableOptions(deduplicated);
      } else {
        setTableOptions(QUICK_TABLE_OPTIONS);
      }
    } catch (loadError: unknown) {
      const message = typeof loadError === 'object'
        && loadError !== null
        && 'response' in loadError
        && (loadError as { response?: { data?: { message?: string } } }).response?.data?.message
        ? (loadError as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to load POS data.';
      setError(message || 'Failed to load POS data.');
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant?.slug]);

  useEffect(() => {
    void loadPosData();
  }, [loadPosData]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(dishes.map((dish) => dish.category).filter(Boolean)));
    return ['All', ...unique];
  }, [dishes]);

  const visibleDishes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return dishes.filter((dish) => {
      const matchesCategory = selectedCategory === 'All' || dish.category === selectedCategory;
      const matchesSearch = normalizedSearch === ''
        || dish.name.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [dishes, searchQuery, selectedCategory]);
  const hasCatalogFilters = searchQuery.trim().length > 0 || selectedCategory !== 'All';

  const originalSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.originalUnitPrice * item.quantity), 0),
    [cartItems]
  );

  const adjustedSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.finalUnitPrice * item.quantity), 0),
    [cartItems]
  );

  const compensationCost = useMemo(
    () => Math.max(originalSubtotal - adjustedSubtotal, 0),
    [adjustedSubtotal, originalSubtotal]
  );

  const invoicePreview = useMemo(() => calculateInvoicePreview({
    subtotal: adjustedSubtotal,
    discountType,
    discountValue,
    vatRate,
  }), [adjustedSubtotal, discountType, discountValue, vatRate]);

  const { discountAmount, vatAmount, total } = invoicePreview;

  const compensationReport = buildCompensationDashboardReport(readCompensationLedger());

  const addDish = (dish: PublishedDishSummary, complimentary = false): void => {
    const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;
    if (isOutOfStock) {
      showToast(
        t('common.outOfStockCannotAdd', {
          dish: dish.name,
          defaultValue: '{{dish}} is out of stock and cannot be added.',
        }),
        'secondary'
      );
      return;
    }

    setCartItems((current) => {
      const match = current.find((item) => (
        item.dish.id === dish.id
        && item.isComplimentary === complimentary
        && item.issueStatus === (complimentary ? 'compensated' : 'normal')
      ));

      if (match) {
        return current.map((item) => (
          item.lineId === match.lineId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }

      const createdAt = new Date().toISOString();
      const line: PosCartItem = {
        lineId: makeLineId(),
        dish,
        quantity: 1,
        originalUnitPrice: dish.price,
        finalUnitPrice: complimentary ? 0 : dish.price,
        issueStatus: complimentary ? 'compensated' : 'normal',
        compensationType: complimentary ? 'complimentary' : 'none',
        complaintReason: complimentary ? 'other' : '',
        complaintCategory: complimentary ? 'service' : '',
        complaintNote: complimentary ? 'Customer compensation' : '',
        approvedBy: complimentary ? actor : null,
        approvedAt: complimentary ? createdAt : null,
        accountingBucket: complimentary ? 'goodwill_expense' : '',
        isComplimentary: complimentary,
        partialDiscountPercent: complimentary ? 100 : null,
        evidencePhotoUrl: '',
        customerSatisfactionRating: '',
      };

      return [...current, line];
    });
  };

  const setLineQuantity = (lineId: string, quantity: number): void => {
    setCartItems((current) => {
      if (quantity <= 0) {
        return current.filter((item) => item.lineId !== lineId);
      }
      return current.map((item) => (
        item.lineId === lineId ? { ...item, quantity } : item
      ));
    });
  };

  const clearOrder = useCallback(() => {
    setCartItems([]);
    setOrderNote('');
    setDiscountType('');
    setDiscountValue('0');
    setVatRate('0');
    setPaymentMethod('cash');
    setEditingLineId(null);
    setCompDraft(makeDefaultDraft());
    showToast('Current POS order cleared.', 'secondary');
  }, [showToast]);

  const holdCurrentOrder = useCallback(() => {
    if (!cartItems.length) {
      showToast('Cannot hold an empty order.', 'secondary');
      return;
    }

    const heldOrder: HeldPosOrder = {
      id: `HOLD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      tableReference,
      note: orderNote,
      discountType,
      discountValue,
      vatRate,
      paymentMethod,
      items: cartItems.map((item) => ({ ...item })),
    };

    setHeldOrders((current) => [heldOrder, ...current].slice(0, 25));
    clearOrder();
    showToast(`Order ${heldOrder.id} moved to hold list.`, 'secondary');
  }, [cartItems, clearOrder, discountType, discountValue, orderNote, paymentMethod, showToast, tableReference, vatRate]);

  const resumeHeldOrder = (heldOrder: HeldPosOrder): void => {
    setCartItems(heldOrder.items);
    setTableReference(heldOrder.tableReference);
    setOrderNote(heldOrder.note);
    setDiscountType(heldOrder.discountType);
    setDiscountValue(heldOrder.discountValue);
    setVatRate(heldOrder.vatRate);
    setPaymentMethod(heldOrder.paymentMethod);
    setHeldOrders((current) => current.filter((item) => item.id !== heldOrder.id));
    showToast(`Resumed ${heldOrder.id}.`, 'secondary');
  };

  const openCompensationEditor = (line: PosCartItem): void => {
    setEditingLineId(line.lineId);
    setCompDraft({
      status: line.issueStatus,
      compensationType: line.compensationType,
      reason: line.complaintReason,
      category: line.complaintCategory,
      note: line.complaintNote,
      partialDiscountPercent: line.partialDiscountPercent !== null ? String(line.partialDiscountPercent) : '0',
      accountingBucket: line.accountingBucket,
      evidencePhotoUrl: line.evidencePhotoUrl,
      customerSatisfactionRating: line.customerSatisfactionRating === ''
        ? ''
        : String(line.customerSatisfactionRating),
    });
  };

  const applyCompensation = (): void => {
    const target = cartItems.find((line) => line.lineId === editingLineId);
    if (!target) {
      return;
    }

    if (!canManageCompensation) {
      showToast('You are not authorized to cancel or compensate items.', 'secondary');
      return;
    }

    if (compDraft.status !== 'normal' && !compDraft.reason) {
      showToast('Please select a complaint reason before saving.', 'secondary');
      return;
    }

    const isComplimentary = compDraft.compensationType === 'complimentary';
    const status = compDraft.status;
    const partialDiscountPercent = clampPercent(parseFiniteNumber(compDraft.partialDiscountPercent || '0'));

    let nextFinalUnitPrice = target.originalUnitPrice;
    if (status !== 'normal') {
      if (isComplimentary || compDraft.compensationType === 'full_waiver' || status === 'cancelled') {
        nextFinalUnitPrice = 0;
      } else if (compDraft.compensationType === 'partial_discount') {
        nextFinalUnitPrice = target.originalUnitPrice * (1 - (partialDiscountPercent / 100));
      }
    }

    const approvedAt = new Date().toISOString();

    const nextItem: PosCartItem = {
      ...target,
      issueStatus: status,
      compensationType: compDraft.status === 'normal' ? 'none' : compDraft.compensationType,
      complaintReason: compDraft.status === 'normal' ? '' : compDraft.reason,
      complaintCategory: compDraft.status === 'normal'
        ? ''
        : (compDraft.category || getComplaintCategoryFromReason(compDraft.reason || null) || 'other'),
      complaintNote: compDraft.note,
      finalUnitPrice: compDraft.status === 'normal' ? target.originalUnitPrice : Number(nextFinalUnitPrice.toFixed(2)),
      approvedBy: compDraft.status === 'normal' ? null : actor,
      approvedAt: compDraft.status === 'normal' ? null : approvedAt,
      accountingBucket: compDraft.status === 'normal'
        ? ''
        : (compDraft.accountingBucket || getDefaultComplaintBucket(status, compDraft.compensationType) || ''),
      isComplimentary,
      partialDiscountPercent: compDraft.status === 'normal' || compDraft.compensationType !== 'partial_discount'
        ? null
        : partialDiscountPercent,
      evidencePhotoUrl: compDraft.evidencePhotoUrl.trim(),
      customerSatisfactionRating: compDraft.customerSatisfactionRating === ''
        ? ''
        : Math.min(Math.max(Math.round(parseFiniteNumber(compDraft.customerSatisfactionRating)), 1), 5),
    };

    setCartItems((current) => current.map((line) => (line.lineId === nextItem.lineId ? nextItem : line)));

    if (nextItem.issueStatus !== 'normal') {
      const entry = buildCompensationPayloadFromItem(nextItem, getCompensationAction(nextItem), 'pos', tableReference);
      appendCompensationLedgerEntries([entry]);
      appendCompensationAuditLogs([buildAuditLogFromEntry(entry, actor)]);
      setReportRefreshKey((current) => current + 1);
    }

    setEditingLineId(null);
    setCompDraft(makeDefaultDraft());
    showToast('Compensation details saved and logged.', 'secondary');
  };

  const checkout = useCallback(async () => {
    if (!cartItems.length) {
      showToast('Add at least one dish before checkout.', 'secondary');
      return;
    }

    const invalidCompensation = cartItems.find((item) => (
      item.issueStatus !== 'normal' && (!item.complaintReason || !item.approvedBy || !item.approvedAt)
    ));

    if (invalidCompensation) {
      showToast(`Complete reason and approval for ${invalidCompensation.dish.name} before checkout.`, 'secondary', 4800);
      return;
    }

    setCheckoutBusy(true);
    try {
      const response = await quickPosCheckout({
        table_reference: tableReference.trim() || 'POS-WALK-IN',
        notes: orderNote || undefined,
        items: cartItems.map((item) => ({
          dish_id: item.dish.id,
          quantity: item.quantity,
          status: item.issueStatus,
          compensation_type: item.compensationType,
          compensation_reason: item.complaintReason || null,
          complaint_category: item.complaintCategory || null,
          compensation_note: item.complaintNote || null,
          approved_by_staff_id: item.approvedBy?.id ?? null,
          approved_by_staff_name: item.approvedBy?.name ?? null,
          approved_by_staff_role: item.approvedBy?.role ?? null,
          approved_at: item.approvedAt,
          original_unit_price: item.originalUnitPrice,
          final_unit_price: item.finalUnitPrice,
          partial_discount_percentage: item.partialDiscountPercent,
          is_complimentary: item.isComplimentary,
          accounting_bucket: item.accountingBucket || null,
          customer_satisfaction_rating: item.customerSatisfactionRating === '' ? null : Number(item.customerSatisfactionRating),
          evidence_photo_url: item.evidencePhotoUrl.trim() || null,
        })),
        vat_rate: parseFiniteNumber(vatRate),
        discount_type: discountType || undefined,
        discount_value: parseFiniteNumber(discountValue),
        payment_method: paymentMethod,
      });

      const checkoutLedgerEntries = cartItems
        .filter((item) => item.issueStatus !== 'normal')
        .map((item) => buildCompensationPayloadFromItem(item, 'checkout', 'pos', tableReference));

      if (checkoutLedgerEntries.length > 0) {
        appendCompensationLedgerEntries(checkoutLedgerEntries);
        appendCompensationAuditLogs(checkoutLedgerEntries.map((entry) => buildAuditLogFromEntry(entry, actor)));
        setReportRefreshKey((current) => current + 1);
      }

      clearOrder();
      showToast(`Checkout complete: ${response.order.invoice_number || response.order.order_number}.`, 'secondary', 4500);
    } catch (checkoutError: unknown) {
      const message = typeof checkoutError === 'object'
        && checkoutError !== null
        && 'response' in checkoutError
        && (checkoutError as { response?: { data?: { message?: string } } }).response?.data?.message
        ? (checkoutError as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'POS checkout failed.';

      showToast(message || 'POS checkout failed.', 'secondary', 4500);
    } finally {
      setCheckoutBusy(false);
    }
  }, [
    actor,
    cartItems,
    clearOrder,
    discountType,
    discountValue,
    orderNote,
    paymentMethod,
    showToast,
    tableReference,
    vatRate,
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === 'F2') {
        event.preventDefault();
        clearOrder();
      }

      if (event.key === 'F4') {
        event.preventDefault();
        holdCurrentOrder();
      }

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        void checkout();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [checkout, clearOrder, holdCurrentOrder]);

  return (
    <DashboardLayout title={t('cashierPosPage.pageTitle')}>
      {loading ? (
        <div className="py-12 text-center text-muted">{t('cashierPosPage.loading')}</div>
      ) : error ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>
      ) : (
        <div className="space-y-4">
          {!canManageCompensation ? (
            <div className="rounded-xl2 border border-amber-500/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {t('cashierPosPage.readOnlyCompensation')}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <div className="space-y-4">
              <GlassCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text">{t('cashierPosPage.productCatalog')}</h2>
                    <p className="text-xs text-muted">{t('cashierPosPage.shortcutHint')}</p>
                  </div>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t('cashierPosPage.searchDishes')}
                    className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45 sm:w-72"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selectedCategory === category
                          ? 'border-gold/60 bg-gold/20 text-gold2'
                          : 'border-stroke bg-bg1/70 text-muted hover:border-gold/35 hover:text-text'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </GlassCard>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleDishes.length === 0 ? (
                  <GlassCard className="md:col-span-2 xl:col-span-3">
                    <div className="py-8 text-center">
                      <p className="text-base font-semibold text-text">{t('cashierPosPage.noDishesTitle')}</p>
                      <p className="mt-1 text-sm text-muted">
                        {hasCatalogFilters
                          ? t('cashierPosPage.noDishesFiltered')
                          : t('cashierPosPage.noDishesAvailable')}
                      </p>
                    </div>
                  </GlassCard>
                ) : visibleDishes.map((dish) => (
                  <GlassCard key={dish.id}>
                    <div className="flex h-full flex-col justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted">{dish.category}</p>
                        <h3 className="mt-1 text-base font-semibold text-text">{dish.name}</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="text-lg font-semibold text-gold2">{toMoney(dish.price)}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <LiquidButton onClick={() => addDish(dish)} className="px-3 py-1.5 text-xs">
                            {t('cashierPosPage.add')}
                          </LiquidButton>
                          <LiquidButton
                            tone="tertiary"
                            disabled={!canManageCompensation}
                            onClick={() => addDish(dish, true)}
                            className="px-3 py-1.5 text-xs"
                          >
                            {t('cashierPosPage.complimentary')}
                          </LiquidButton>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>

              <GlassCard>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.heldOrders')}</h3>
                  <span className="rounded-full border border-gold/35 bg-gold/10 px-2 py-1 text-xs text-gold2">
                    {heldOrders.length}
                  </span>
                </div>
                {heldOrders.length === 0 ? (
                  <p className="text-sm text-muted">{t('cashierPosPage.noHeldOrders')}</p>
                ) : (
                  <div className="space-y-2">
                    {heldOrders.map((heldOrder) => (
                      <div
                        key={heldOrder.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-bg1/60 px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text">{heldOrder.id}</p>
                          <p className="text-xs text-muted">{heldOrder.tableReference} • {new Date(heldOrder.createdAt).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <LiquidButton tone="tertiary" onClick={() => resumeHeldOrder(heldOrder)} className="px-3 py-1.5 text-xs">
                            {t('cashierPosPage.resume')}
                          </LiquidButton>
                          <LiquidButton
                            tone="secondary"
                            onClick={() => setHeldOrders((current) => current.filter((item) => item.id !== heldOrder.id))}
                            className="px-3 py-1.5 text-xs"
                          >
                            {t('cashierPosPage.remove')}
                          </LiquidButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            <div className="space-y-4">
              <GlassCard>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text">{t('cashierPosPage.currentSale')}</h2>
                  <LiquidButton tone="tertiary" onClick={clearOrder} className="px-3 py-1.5 text-xs">
                    {t('cashierPosPage.clear')}
                  </LiquidButton>
                </div>

                {cartItems.length === 0 ? (
                  <p className="text-sm text-muted">{t('cashierPosPage.noItemsSelected')}</p>
                ) : (
                  <div className="space-y-2">
                    {cartItems.map((item) => {
                      const { originalLineTotal, finalLineTotal } = toLineMoney(item);
                      const isRed = item.issueStatus === 'cancelled' || item.issueStatus === 'problematic';
                      const isGreen = item.isComplimentary;

                      return (
                        <div
                          key={item.lineId}
                          className={`rounded-2xl border px-3 py-2.5 ${
                            isGreen
                              ? 'border-emerald-400/35 bg-emerald-500/10'
                              : isRed
                                ? 'border-rose-400/35 bg-rose-500/10'
                                : 'border-stroke bg-bg1/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-semibold ${isRed ? 'text-rose-200 line-through' : 'text-text'}`}>
                                {item.dish.name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted2">
                                  {ISSUE_STATUS_LABELS[item.issueStatus]}
                                </span>
                                {item.isComplimentary ? (
                                  <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-100">
                                    Complimentary
                                  </span>
                                ) : null}
                                {item.issueStatus === 'cancelled' ? (
                                  <span className="rounded-full border border-rose-300/40 bg-rose-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-rose-100">
                                    Cancelled
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted">
                                {toMoney(item.originalUnitPrice)} {t('cashierPosPage.each')}
                                {item.finalUnitPrice !== item.originalUnitPrice ? ` → ${toMoney(item.finalUnitPrice)} ${t('cashierPosPage.each')}` : ''}
                              </p>
                              {item.complaintReason ? (
                                <p className="mt-1 text-xs text-muted2">
                                  {t('cashierPosPage.reason')}: {COMPLAINT_REASON_LABELS[item.complaintReason]}
                                  {item.complaintNote ? ` • ${item.complaintNote}` : ''}
                                </p>
                              ) : null}
                              {item.approvedBy?.name && item.approvedAt ? (
                                <p className="mt-1 text-[11px] text-muted2">
                                  {t('cashierPosPage.approvedBy', { name: item.approvedBy.name, date: new Date(item.approvedAt).toLocaleString() })}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`text-sm font-semibold ${isGreen ? 'text-emerald-200' : isRed ? 'text-rose-200' : 'text-gold2'}`}>
                                {toMoney(finalLineTotal)}
                              </p>
                              {finalLineTotal !== originalLineTotal ? (
                                <p className="text-xs text-muted line-through">{toMoney(originalLineTotal)}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full border border-stroke bg-bg1 text-text"
                                onClick={() => setLineQuantity(item.lineId, item.quantity - 1)}
                              >
                                -
                              </button>
                              <span className="min-w-6 text-center text-sm font-semibold text-text">{item.quantity}</span>
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full border border-stroke bg-bg1 text-text"
                                onClick={() => setLineQuantity(item.lineId, item.quantity + 1)}
                              >
                                +
                              </button>
                            </div>
                            <LiquidButton
                              tone="tertiary"
                              disabled={!canManageCompensation}
                              onClick={() => openCompensationEditor(item)}
                              className="px-3 py-1.5 text-xs"
                            >
                              {t('cashierPosPage.editIssueCompensation')}
                            </LiquidButton>
                          </div>

                          {editingLineId === item.lineId ? (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="grid gap-3">
                                <div className="grid gap-2 md:grid-cols-2">
                                  <label className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.status')}</span>
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
                                          accountingBucket: nextStatus === 'normal'
                                            ? ''
                                            : (getDefaultComplaintBucket(nextStatus, defaultType) || ''),
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
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.compensationType')}</span>
                                    <select
                                      value={compDraft.compensationType}
                                      disabled={compDraft.status === 'normal'}
                                      onChange={(event) => {
                                        const nextType = event.target.value as OrderItemCompensationType;
                                        setCompDraft((current) => ({
                                          ...current,
                                          compensationType: nextType,
                                          accountingBucket: getDefaultComplaintBucket(current.status, nextType) || current.accountingBucket,
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

                                <div className="grid gap-2 md:grid-cols-2">
                                  <label className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.reason')}</span>
                                    <select
                                      value={compDraft.reason}
                                      onChange={(event) => {
                                        const nextReason = event.target.value as ComplaintReasonCode | '';
                                        setCompDraft((current) => ({
                                          ...current,
                                          reason: nextReason,
                                          category: getComplaintCategoryFromReason(nextReason || null) || current.category,
                                        }));
                                      }}
                                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                    >
                                      <option value="">{t('cashierPosPage.selectReason')}</option>
                                      {COMPLAINT_REASON_OPTIONS.map((reasonOption) => (
                                        <option key={reasonOption.value} value={reasonOption.value}>{reasonOption.label}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.category')}</span>
                                    <select
                                      value={compDraft.category}
                                      onChange={(event) => setCompDraft((current) => ({ ...current, category: event.target.value as ComplaintCategory | '' }))}
                                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                    >
                                      <option value="">{t('cashierPosPage.autoFromReason')}</option>
                                      {(['quality_control', 'service', 'safety', 'other'] as ComplaintCategory[]).map((category) => (
                                        <option key={category} value={category}>{COMPLAINT_CATEGORY_LABELS[category]}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>

                                {compDraft.compensationType === 'partial_discount' ? (
                                  <label className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.partialDiscount')}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={compDraft.partialDiscountPercent}
                                      onChange={(event) => setCompDraft((current) => ({ ...current, partialDiscountPercent: event.target.value }))}
                                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                    />
                                  </label>
                                ) : null}

                                <label className="block">
                                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">{t('cashierPosPage.accountingBucket')}</span>
                                  <select
                                    value={compDraft.accountingBucket}
                                    onChange={(event) => setCompDraft((current) => ({ ...current, accountingBucket: event.target.value as ComplaintAccountingBucket | '' }))}
                                    className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                  >
                                    <option value="">{t('cashierPosPage.autoBucket')}</option>
                                    {(['wastage', 'customer_complaint_loss', 'quality_control_loss', 'marketing_expense', 'customer_retention', 'goodwill_expense'] as ComplaintAccountingBucket[]).map((bucket) => (
                                      <option key={bucket} value={bucket}>{COMPLAINT_ACCOUNTING_BUCKET_LABELS[bucket]}</option>
                                    ))}
                                  </select>
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Note (optional)</span>
                                  <textarea
                                    value={compDraft.note}
                                    rows={2}
                                    onChange={(event) => setCompDraft((current) => ({ ...current, note: event.target.value }))}
                                    className="w-full rounded-2xl border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                  />
                                </label>

                                <div className="grid gap-2 md:grid-cols-2">
                                  <label className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Photo evidence URL</span>
                                    <input
                                      type="url"
                                      value={compDraft.evidencePhotoUrl}
                                      onChange={(event) => setCompDraft((current) => ({ ...current, evidencePhotoUrl: event.target.value }))}
                                      placeholder="https://..."
                                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Satisfaction (1-5)</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={compDraft.customerSatisfactionRating}
                                      onChange={(event) => setCompDraft((current) => ({ ...current, customerSatisfactionRating: event.target.value }))}
                                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                                    />
                                  </label>
                                </div>

                                {compDraft.reason ? (
                                  <div className="rounded-xl border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold2">
                                    Suggestions: {getCompensationSuggestions(compDraft.reason).join(' • ')}
                                  </div>
                                ) : null}

                                <div className="flex flex-wrap justify-end gap-2">
                                  <LiquidButton
                                    tone="secondary"
                                    onClick={() => {
                                      setEditingLineId(null);
                                      setCompDraft(makeDefaultDraft());
                                    }}
                                    className="px-3 py-1.5 text-xs"
                                  >
                                    Cancel
                                  </LiquidButton>
                                  <LiquidButton
                                    onClick={applyCompensation}
                                    className="px-3 py-1.5 text-xs"
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
                )}
              </GlassCard>

              <GlassCard>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Table / Channel</span>
                    <select
                      value={tableReference}
                      onChange={(event) => setTableReference(event.target.value)}
                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                    >
                      {tableOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Note</span>
                    <textarea
                      value={orderNote}
                      onChange={(event) => setOrderNote(event.target.value)}
                      rows={2}
                      placeholder="Optional note..."
                      className="w-full rounded-2xl border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Discount Type</span>
                      <select
                        value={discountType}
                        disabled={!canManageCompensation}
                        onChange={(event) => setDiscountType(event.target.value as '' | 'fixed' | 'percentage')}
                        className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45 disabled:opacity-60"
                      >
                        <option value="">No Discount</option>
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Discount Value</span>
                      <input
                        value={discountValue}
                        disabled={!canManageCompensation}
                        onChange={(event) => setDiscountValue(event.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45 disabled:opacity-60"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">VAT %</span>
                    <input
                      value={vatRate}
                      disabled={!canManageCompensation}
                      onChange={(event) => setVatRate(event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45 disabled:opacity-60"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'wallet'] as PosPaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase transition ${
                          paymentMethod === method
                            ? 'border-gold/60 bg-gold/20 text-gold2'
                            : 'border-stroke bg-bg1/70 text-muted hover:border-gold/35 hover:text-text'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between text-muted">
                    <span>Original Subtotal</span>
                    <span>{toMoney(originalSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-200">
                    <span>Compensation (Complaints/Gifts)</span>
                    <span>- {toMoney(compensationCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>Adjusted Subtotal</span>
                    <span>{toMoney(adjustedSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>Discount</span>
                    <span>- {toMoney(discountAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>VAT</span>
                    <span>{toMoney(vatAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-stroke pt-2 text-base font-semibold text-text">
                    <span>Total</span>
                    <span>{toMoney(total)}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <LiquidButton tone="tertiary" onClick={holdCurrentOrder} disabled={checkoutBusy}>
                    Hold (F4)
                  </LiquidButton>
                  <LiquidButton onClick={() => void checkout()} disabled={checkoutBusy}>
                    {checkoutBusy ? 'Processing...' : 'Checkout (Ctrl+Enter)'}
                  </LiquidButton>
                </div>
              </GlassCard>
            </div>
          </div>

          <GlassCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-text">Complaint & Compensation Dashboard</h3>
                <p className="text-sm text-muted">Audit trail and financial impact from cancelled/complimentary items.</p>
              </div>
              <LiquidButton tone="tertiary" className="px-3 py-1.5 text-xs" onClick={() => setReportRefreshKey((current) => current + 1)}>
                Refresh Report
              </LiquidButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.13em] text-muted2">Total Compensation Cost</p>
                <p className="mt-1 text-lg font-semibold text-text">{toMoney(compensationReport.total_compensation_cost)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.13em] text-muted2">Complaint Loss</p>
                <p className="mt-1 text-lg font-semibold text-rose-200">{toMoney(compensationReport.complaint_loss_total)}</p>
              </div>
              <div className="rounded-2xl border border-stroke bg-bg1/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.13em] text-muted2">Complimentary Value</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">{toMoney(compensationReport.complimentary_value_total)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.13em] text-muted2">Most Cancelled Dishes</p>
                <div className="mt-2 space-y-2 text-sm">
                  {compensationReport.most_cancelled_dishes.length === 0 ? (
                    <p className="text-muted">No cancelled items yet.</p>
                  ) : compensationReport.most_cancelled_dishes.map((dish) => (
                    <div key={dish.dish_name} className="flex items-center justify-between text-text">
                      <span>{dish.dish_name}</span>
                      <span className="text-rose-200">{dish.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.13em] text-muted2">Most Common Reasons</p>
                <div className="mt-2 space-y-2 text-sm">
                  {compensationReport.most_common_reasons.length === 0 ? (
                    <p className="text-muted">No complaint reasons yet.</p>
                  ) : compensationReport.most_common_reasons.map((reason) => (
                    <div key={reason.reason} className="flex items-center justify-between text-text">
                      <span>{COMPLAINT_REASON_LABELS[reason.reason as ComplaintReasonCode] || reason.reason}</span>
                      <span>{reason.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.13em] text-muted2">Staff Approvals</p>
                <div className="mt-2 space-y-2 text-sm">
                  {compensationReport.staff_approvals.length === 0 ? (
                    <p className="text-muted">No approvals yet.</p>
                  ) : compensationReport.staff_approvals.slice(0, 6).map((approval) => (
                    <div key={`${approval.staff_name}-${approval.role}`} className="flex items-center justify-between text-text">
                      <span>{approval.staff_name} ({approval.role})</span>
                      <span>{approval.approvals}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {toast ? (
        <GlassToast
          toast={toast}
          onClose={dismiss}
        />
      ) : null}
    </DashboardLayout>
  );
};

export default CashierPosPage;
