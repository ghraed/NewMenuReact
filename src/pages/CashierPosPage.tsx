import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchGuestTables, fetchPublishedDishes, quickPosCheckout } from '../services/orderService';
import { calculateCashSettlement, calculateInvoicePreview, parseFiniteNumber } from '../utils/financeMath';
import type { PosPaymentMethod, PublishedDishSummary } from '../types';

interface PosCartItem {
  dish: PublishedDishSummary;
  quantity: number;
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
  amountReceived: string;
  items: PosCartItem[];
}

const QUICK_TABLE_OPTIONS = ['POS-WALK-IN', 'PICKUP', 'DELIVERY'];

const toMoney = (value: number): string => `$${value.toFixed(2)}`;

const CashierPosPage: React.FC = () => {
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
  const [amountReceived, setAmountReceived] = useState('');
  const [heldOrders, setHeldOrders] = useState<HeldPosOrder[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const loadPosData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextDishes = await fetchPublishedDishes();
      setDishes(nextDishes.filter((dish) => dish.is_orderable !== false));

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

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.dish.price * item.quantity), 0),
    [cartItems]
  );

  const invoicePreview = useMemo(() => calculateInvoicePreview({
    subtotal,
    discountType,
    discountValue,
    vatRate,
  }), [subtotal, discountType, discountValue, vatRate]);

  const { discountAmount, vatAmount, total } = invoicePreview;

  const settlement = useMemo(
    () => calculateCashSettlement(total, amountReceived, paymentMethod),
    [total, amountReceived, paymentMethod]
  );
  const { receivedAmount, changeDue, remainingDue } = settlement;

  const addDish = (dish: PublishedDishSummary): void => {
    setCartItems((current) => {
      const existing = current.find((item) => item.dish.id === dish.id);
      if (existing) {
        return current.map((item) => (
          item.dish.id === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
      return [...current, { dish, quantity: 1 }];
    });
  };

  const setDishQuantity = (dishId: number, quantity: number): void => {
    setCartItems((current) => {
      if (quantity <= 0) {
        return current.filter((item) => item.dish.id !== dishId);
      }
      return current.map((item) => (
        item.dish.id === dishId ? { ...item, quantity } : item
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
    setAmountReceived('');
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
      amountReceived,
      items: cartItems.map((item) => ({ dish: item.dish, quantity: item.quantity })),
    };

    setHeldOrders((current) => [heldOrder, ...current].slice(0, 25));
    clearOrder();
    showToast(`Order ${heldOrder.id} moved to hold list.`, 'secondary');
  }, [amountReceived, cartItems, clearOrder, discountType, discountValue, orderNote, paymentMethod, showToast, tableReference, vatRate]);

  const resumeHeldOrder = (heldOrder: HeldPosOrder): void => {
    setCartItems(heldOrder.items);
    setTableReference(heldOrder.tableReference);
    setOrderNote(heldOrder.note);
    setDiscountType(heldOrder.discountType);
    setDiscountValue(heldOrder.discountValue);
    setVatRate(heldOrder.vatRate);
    setPaymentMethod(heldOrder.paymentMethod);
    setAmountReceived(heldOrder.amountReceived);
    setHeldOrders((current) => current.filter((item) => item.id !== heldOrder.id));
    showToast(`Resumed ${heldOrder.id}.`, 'secondary');
  };

  const checkout = useCallback(async () => {
    if (!cartItems.length) {
      showToast('Add at least one dish before checkout.', 'secondary');
      return;
    }

    if (paymentMethod === 'cash' && remainingDue > 0) {
      showToast('Cash received is lower than total.', 'secondary');
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
        })),
        vat_rate: parseFiniteNumber(vatRate),
        discount_type: discountType || undefined,
        discount_value: parseFiniteNumber(discountValue),
        payment_method: paymentMethod,
        amount_received: paymentMethod === 'cash' ? receivedAmount : undefined,
      });

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
    cartItems,
    clearOrder,
    discountType,
    discountValue,
    orderNote,
    paymentMethod,
    receivedAmount,
    remainingDue,
    showToast,
    tableReference,
    vatRate,
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

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
    <DashboardLayout title="Cashier POS">
      {loading ? (
        <div className="py-12 text-center text-muted">Loading POS...</div>
      ) : error ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="space-y-4">
            <GlassCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text">Product Catalog</h2>
                  <p className="text-xs text-muted">Shortcut: / search, F4 hold order</p>
                </div>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search dishes..."
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
              {visibleDishes.map((dish) => (
                <GlassCard key={dish.id}>
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted">{dish.category}</p>
                      <h3 className="mt-1 text-base font-semibold text-text">{dish.name}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gold2">{toMoney(dish.price)}</span>
                      <LiquidButton onClick={() => addDish(dish)} className="px-3 py-1.5 text-xs">
                        Add
                      </LiquidButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            <GlassCard>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted2">Held Orders</h3>
                <span className="rounded-full border border-gold/35 bg-gold/10 px-2 py-1 text-xs text-gold2">
                  {heldOrders.length}
                </span>
              </div>
              {heldOrders.length === 0 ? (
                <p className="text-sm text-muted">No held POS orders.</p>
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
                          Resume
                        </LiquidButton>
                        <LiquidButton
                          tone="secondary"
                          onClick={() => setHeldOrders((current) => current.filter((item) => item.id !== heldOrder.id))}
                          className="px-3 py-1.5 text-xs"
                        >
                          Remove
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
                <h2 className="text-lg font-semibold text-text">Current Sale</h2>
                <LiquidButton tone="tertiary" onClick={clearOrder} className="px-3 py-1.5 text-xs">
                  Clear (F2)
                </LiquidButton>
              </div>

              {cartItems.length === 0 ? (
                <p className="text-sm text-muted">No items selected.</p>
              ) : (
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div key={item.dish.id} className="rounded-2xl border border-stroke bg-bg1/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text">{item.dish.name}</p>
                          <p className="text-xs text-muted">{toMoney(item.dish.price)} each</p>
                        </div>
                        <p className="text-sm font-semibold text-gold2">{toMoney(item.dish.price * item.quantity)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border border-stroke bg-bg1 text-text"
                          onClick={() => setDishQuantity(item.dish.id, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold text-text">{item.quantity}</span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full border border-stroke bg-bg1 text-text"
                          onClick={() => setDishQuantity(item.dish.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
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
                      onChange={(event) => setDiscountType(event.target.value as '' | 'fixed' | 'percentage')}
                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
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
                      onChange={(event) => setDiscountValue(event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">VAT %</span>
                  <input
                    value={vatRate}
                    onChange={(event) => setVatRate(event.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
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

                {paymentMethod === 'cash' ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted2">Amount Received</span>
                    <input
                      value={amountReceived}
                      onChange={(event) => setAmountReceived(event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-full border border-stroke bg-bg1 px-4 py-2.5 text-sm text-text outline-none focus:border-gold/45"
                    />
                  </label>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between text-muted">
                  <span>Subtotal</span>
                  <span>{toMoney(subtotal)}</span>
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
                {paymentMethod === 'cash' ? (
                  <>
                    <div className="flex items-center justify-between text-muted">
                      <span>Remaining</span>
                      <span>{toMoney(remainingDue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Change</span>
                      <span>{toMoney(changeDue)}</span>
                    </div>
                  </>
                ) : null}
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
