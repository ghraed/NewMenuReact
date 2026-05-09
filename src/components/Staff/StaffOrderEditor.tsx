import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassChip, GlassInput, LiquidButton } from '../ui/liquid-glass';
import { cx, focusRing, glassControl, glassControlHover } from '../../theme/liquidGlass';
import type { OrderRecord, PublishedDishSummary, UpdatePendingOrderRequest } from '../../types';

type EditorAction = 'save' | 'saveConfirm' | null;

type DraftItem = {
  dish_id: number;
  dish_name: string;
  unit_price: number;
  quantity: number;
};

interface StaffOrderEditorProps {
  order: OrderRecord | null;
  dishes: PublishedDishSummary[];
  dishesLoading: boolean;
  dishesError: string | null;
  busyAction: EditorAction;
  onClose: () => void;
  onSave: (payload: UpdatePendingOrderRequest) => void;
  onSaveAndConfirm: (payload: UpdatePendingOrderRequest) => void;
}

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;
const normalizeSearchText = (value: string | null | undefined): string => (
  (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
);

const getOrderLabel = (order: OrderRecord): string => order.order_number || `Order #${order.id}`;

const normalizeDraftItems = (items: DraftItem[]) => JSON.stringify(
  items.map((item) => ({
    dish_id: item.dish_id,
    quantity: item.quantity,
  }))
);

const buildDraftItems = (order: OrderRecord | null): DraftItem[] => {
  if (!order) {
    return [];
  }

  return order.items
    .filter((item): item is OrderRecord['items'][number] & { dish_id: number } => item.dish_id !== null)
    .map((item) => ({
      dish_id: item.dish_id,
      dish_name: item.dish_name,
      unit_price: Number(item.unit_price),
      quantity: item.quantity,
    }));
};

const itemButtonClass = cx(
  'inline-flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold text-text',
  glassControl,
  glassControlHover,
  focusRing
);

const StaffOrderEditor: React.FC<StaffOrderEditorProps> = ({
  order,
  dishes,
  dishesLoading,
  dishesError,
  busyAction,
  onClose,
  onSave,
  onSaveAndConfirm,
}) => {
  const [draftItems, setDraftItems] = useState<DraftItem[]>(() => buildDraftItems(order));
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!order || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [order]);

  useEffect(() => {
    if (!isAddSectionOpen || typeof window === 'undefined') {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isAddSectionOpen]);

  const deferredSearch = useDeferredValue(search);
  const categories = useMemo(() => (
    ['All', ...Array.from(new Set(dishes.map((dish) => dish.category))).sort((left, right) => left.localeCompare(right))]
  ), [dishes]);

  const initialSignature = useMemo(() => (
    normalizeDraftItems(buildDraftItems(order))
  ), [order]);

  const isDirty = normalizeDraftItems(draftItems) !== initialSignature;

  const handleDismiss = useCallback(() => {
    if (busyAction) {
      return;
    }

    if (normalizeDraftItems(draftItems) !== initialSignature && typeof window !== 'undefined') {
      const confirmed = window.confirm('Discard unsaved order changes?');

      if (!confirmed) {
        return;
      }
    }

    onClose();
  }, [busyAction, draftItems, initialSignature, onClose]);

  useEffect(() => {
    if (!order || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDismiss, order]);

  const subtotal = useMemo(() => (
    draftItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
  ), [draftItems]);

  const totalQuantity = useMemo(() => (
    draftItems.reduce((sum, item) => sum + item.quantity, 0)
  ), [draftItems]);

  const filteredDishes = useMemo(() => {
    const normalizedSearch = normalizeSearchText(deferredSearch);

    return dishes.filter((dish) => {
      const categoryMatch = selectedCategory === 'All' || dish.category === selectedCategory;
      const haystack = [
        normalizeSearchText(dish.name),
        normalizeSearchText(dish.category),
      ].join(' ');
      const searchMatch = normalizedSearch === '' || haystack.includes(normalizedSearch);

      return categoryMatch && searchMatch;
    });
  }, [deferredSearch, dishes, selectedCategory]);

  if (!order) {
    return null;
  }

  const updateQuantity = (dishId: number, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setDraftItems((current) => current.filter((item) => item.dish_id !== dishId));
      return;
    }

    setDraftItems((current) => current.map((item) => (
      item.dish_id === dishId
        ? { ...item, quantity: nextQuantity }
        : item
    )));
  };

  const addDish = (dish: PublishedDishSummary) => {
    const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;
    if (isOutOfStock) {
      return;
    }

    setDraftItems((current) => {
      const existingItem = current.find((item) => item.dish_id === dish.id);

      if (existingItem) {
        return current.map((item) => (
          item.dish_id === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }

      return [
        ...current,
        {
          dish_id: dish.id,
          dish_name: dish.name,
          unit_price: Number(dish.price),
          quantity: 1,
        },
      ];
    });
  };

  const payload: UpdatePendingOrderRequest = {
    items: draftItems.map((item) => ({
      dish_id: item.dish_id,
      quantity: item.quantity,
    })),
  };

  const content = (
    <div className="fixed inset-0 z-[2147483646] overflow-y-auto bg-black/60 backdrop-blur-[2px]">
      <div className="flex min-h-full items-stretch justify-center sm:p-6">
        <div className="flex min-h-screen w-full flex-col bg-modalSurface text-text sm:h-full sm:min-h-0 sm:max-h-[calc(100vh-3rem)] sm:max-w-4xl sm:rounded-[32px] sm:border sm:border-modalStroke sm:shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
          <div className="z-20 border-b border-modalStroke bg-modalSurface px-4 py-4 sm:sticky sm:top-0 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Edit Order</p>
                <h2 className="mt-2 truncate text-2xl font-semibold text-text">{getOrderLabel(order)}</h2>
                <p className="mt-2 text-sm text-muted">
                  Table {order.table_reference}
                  {order.created_at ? ` • ${new Date(order.created_at).toLocaleString()}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className={cx(
                  'inline-flex h-11 w-11 items-center justify-center rounded-full border text-xl text-text',
                  glassControl,
                  glassControlHover,
                  focusRing
                )}
                aria-label="Close order editor"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-gold/20 bg-gold/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Items</p>
                <p className="mt-2 text-xl font-semibold text-text">{totalQuantity}</p>
              </div>
              <div className="rounded-[22px] border border-modalStroke bg-modalRow px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted2">Lines</p>
                <p className="mt-2 text-xl font-semibold text-text">{draftItems.length}</p>
              </div>
              <div className="rounded-[22px] border border-modalStroke bg-modalRow px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted2">Subtotal</p>
                <p className="mt-2 text-xl font-semibold text-text">{formatMoney(subtotal)}</p>
              </div>
            </div>

            {order.notes ? (
              <div className="mt-4 rounded-[22px] border border-modalStroke bg-modalRow px-4 py-3 text-sm text-muted">
                {order.notes}
              </div>
            ) : null}
          </div>

          <div className="px-4 py-4 sm:flex-1 sm:overflow-y-auto sm:px-6 sm:py-6">
            <div className="flex flex-col gap-6 sm:min-h-full">
            <section className="flex flex-col">
              <div>
                <p className="text-sm font-semibold text-text">Current Items</p>
                <p className="mt-1 text-sm text-muted">Use the large quantity controls to adjust the order quickly.</p>
              </div>

              <div className="mt-4 space-y-3">
                {draftItems.length === 0 ? (
                  <div className="rounded-[24px] border border-spicy/30 bg-spicy/10 px-4 py-4 text-sm text-spicy">
                    Add at least one dish before saving this order.
                  </div>
                ) : draftItems.map((item) => (
                  <div key={item.dish_id} className="rounded-[24px] border border-modalStroke bg-modalRow p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-text">{item.dish_name}</p>
                        <p className="mt-1 text-sm text-muted">{formatMoney(item.unit_price)} each</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted2">Line Total</p>
                        <p className="mt-1 text-lg font-semibold text-gold2">
                          {formatMoney(item.unit_price * item.quantity)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.dish_id, item.quantity - 1)}
                          className={itemButtonClass}
                          aria-label={`Decrease ${item.dish_name}`}
                        >
                          −
                        </button>
                        <div className="min-w-[68px] rounded-full border border-modalStroke bg-modalSurface px-4 py-2 text-center text-lg font-semibold text-text">
                          {item.quantity}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.dish_id, item.quantity + 1)}
                          className={itemButtonClass}
                          aria-label={`Increase ${item.dish_name}`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateQuantity(item.dish_id, 0)}
                        className="text-sm font-medium text-spicy transition hover:text-spicy/80"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">Add Dishes</p>
                  <p className="mt-1 text-sm text-muted">Tap a dish once to add it instantly or increase its quantity.</p>
                </div>

                <LiquidButton
                  tone="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setIsAddSectionOpen((current) => !current)}
                >
                  {isAddSectionOpen ? 'Hide Dish Picker' : 'Add Dish'}
                </LiquidButton>
              </div>

              {isAddSectionOpen ? (
                <div className="mt-4 rounded-[26px] border border-modalStroke bg-modalRow p-4">
                  <GlassInput
                    ref={searchInputRef}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search dishes or categories..."
                    leftSlot={<span>⌕</span>}
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <GlassChip
                        key={category}
                        type="button"
                        active={selectedCategory === category}
                        onClick={() => setSelectedCategory(category)}
                        className="px-4 py-2 text-sm"
                      >
                        {category}
                      </GlassChip>
                    ))}
                  </div>

                  {dishesLoading ? (
                    <div className="mt-4 rounded-[22px] border border-modalStroke bg-modalSurface px-4 py-4 text-sm text-muted">
                      Loading published dishes...
                    </div>
                  ) : null}

                  {dishesError ? (
                    <div className="mt-4 rounded-[22px] border border-spicy/30 bg-spicy/10 px-4 py-4 text-sm text-spicy">
                      {dishesError}
                    </div>
                  ) : null}

                  {!dishesLoading && !dishesError ? (
                    <div className="mt-4 space-y-3">
                      {filteredDishes.length === 0 ? (
                        <div className="rounded-[22px] border border-modalStroke bg-modalSurface px-4 py-4 text-sm text-muted">
                          No published dishes match this filter.
                        </div>
                      ) : filteredDishes.map((dish) => {
                        const existingItem = draftItems.find((item) => item.dish_id === dish.id);
                        const isOutOfStock = dish.is_orderable === false || dish.is_out_of_stock === true;

                        return (
                          <button
                            key={dish.id}
                            type="button"
                            onClick={() => addDish(dish)}
                            disabled={isOutOfStock}
                            className={cx(
                              'flex w-full items-center justify-between gap-3 rounded-[22px] border border-modalStroke bg-modalSurface px-4 py-4 text-left transition',
                              isOutOfStock ? 'cursor-not-allowed opacity-65' : 'hover:border-white/20 hover:bg-modalRow'
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text">{dish.name}</p>
                              <p className="mt-1 text-sm text-muted">
                                {dish.category}
                                {' • '}
                                {formatMoney(Number(dish.price))}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-gold2">
                                {isOutOfStock ? 'Out of stock' : (existingItem ? `In order: ${existingItem.quantity}` : 'Add')}
                              </p>
                              {isOutOfStock && (dish.alternative_dishes?.length ?? 0) > 0 ? (
                                <p className="mt-1 max-w-[220px] text-xs text-muted2">
                                  Try: {dish.alternative_dishes?.map((alternative) => alternative.name).join(', ')}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
            </div>
          </div>

          <div className="z-20 border-t border-modalStroke bg-modalSurface px-4 py-4 sm:sticky sm:bottom-0 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <LiquidButton
                tone="tertiary"
                onClick={handleDismiss}
                disabled={busyAction !== null}
                className="w-full"
              >
                Discard
              </LiquidButton>
              <LiquidButton
                tone="secondary"
                onClick={() => onSave(payload)}
                disabled={busyAction !== null || draftItems.length === 0 || !isDirty}
                className="w-full"
              >
                {busyAction === 'save' ? 'Saving...' : 'Save Changes'}
              </LiquidButton>
              <LiquidButton
                tone="primary"
                onClick={() => onSaveAndConfirm(payload)}
                disabled={busyAction !== null || draftItems.length === 0}
                className="w-full"
              >
                {busyAction === 'saveConfirm' ? 'Saving & Confirming...' : 'Save & Confirm'}
              </LiquidButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
};

export default StaffOrderEditor;
