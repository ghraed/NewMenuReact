import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassChip,
  GlassInput,
  LiquidButton,
} from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { accountConfirmedOrder, fetchAccountingOrders, fetchGuestTables } from '../services/orderService';
import { cx, focusRing, glassControl } from '../theme/liquidGlass';
import type { AccountOrderRequest, DiscountType, OrderRecord, RestaurantTableSummary } from '../types';

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

const discountOptions = [
  { value: '', label: 'No discount' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percentage', label: 'Percentage' },
] satisfies Array<{ value: '' | DiscountType; label: string }>;

type InvoicePreview = {
  subtotal: number;
  discountType: '' | DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableSubtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
};

const parseDraftNumber = (value: string): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const toCents = (value: number | string): number => Math.round(Number(value || 0) * 100);

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;

const calculateInvoicePreview = (
  subtotalSource: number | string,
  draft: { vatRate: string; discountType: '' | DiscountType; discountValue: string }
): InvoicePreview => {
  const subtotalCents = toCents(subtotalSource);
  const vatRate = Math.max(parseDraftNumber(draft.vatRate), 0);
  const rawDiscountValue = Math.max(parseDraftNumber(draft.discountValue), 0);
  const discountValue = draft.discountType === 'percentage'
    ? Math.min(rawDiscountValue, 100)
    : rawDiscountValue;

  let discountAmountCents = 0;

  if (draft.discountType === 'percentage' && discountValue > 0) {
    discountAmountCents = Math.round(subtotalCents * discountValue / 100);
  }

  if (draft.discountType === 'fixed' && discountValue > 0) {
    discountAmountCents = toCents(discountValue);
  }

  discountAmountCents = Math.min(discountAmountCents, subtotalCents);

  const taxableSubtotalCents = Math.max(subtotalCents - discountAmountCents, 0);
  const vatAmountCents = Math.round(taxableSubtotalCents * vatRate / 100);
  const totalCents = taxableSubtotalCents + vatAmountCents;

  return {
    subtotal: subtotalCents / 100,
    discountType: draft.discountType,
    discountValue,
    discountAmount: discountAmountCents / 100,
    taxableSubtotal: taxableSubtotalCents / 100,
    vatRate,
    vatAmount: vatAmountCents / 100,
    total: totalCents / 100,
  };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const AccountingOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [tableDrafts, setTableDrafts] = useState<TableDraftState>({});
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingTarget, setProcessingTarget] = useState<string | null>(null);
  const tableMenuRef = useRef<HTMLDivElement | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextOrders = await fetchAccountingOrders();
      setOrders(nextOrders);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load accounting orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!user?.restaurant?.slug) {
      setTables([]);
      return;
    }

    const loadTables = async () => {
      setTablesLoading(true);
      setTablesError(null);

      try {
        const response = await fetchGuestTables(user.restaurant!.slug);
        setTables(response.tables);
      } catch (err: unknown) {
        setTablesError(getErrorMessage(err, 'Failed to load restaurant tables.'));
      } finally {
        setTablesLoading(false);
      }
    };

    loadTables();
  }, [user?.restaurant?.slug]);

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

    const total = filteredOrders.reduce((sum, order) => sum + Number(order.invoice.subtotal || 0), 0);

    return {
      orderCount: filteredOrders.length,
      subtotal: total,
    };
  }, [filteredOrders, selectedTable]);

  const orderCountLabel = useMemo(() => (
    `${filteredOrders.length} staff-confirmed order${filteredOrders.length === 1 ? '' : 's'} waiting for accounting`
  ), [filteredOrders.length]);

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
      ? orders.filter((order) => order.table?.name === selectedTable || order.table_reference === selectedTable)
      : []
  ), [orders, selectedTable]);

  const selectedTableDraft = useMemo(() => (
    selectedTable
      ? tableDrafts[selectedTable] || emptyAccountingDraft
      : emptyAccountingDraft
  ), [selectedTable, tableDrafts]);

  const selectedTableInvoiceSubtotal = useMemo(() => (
    selectedTableOrders.reduce((sum, order) => sum + Number(order.invoice.subtotal || 0), 0)
  ), [selectedTableOrders]);

  const selectedTablePreview = useMemo(() => (
    selectedTable
      ? calculateInvoicePreview(selectedTableInvoiceSubtotal, selectedTableDraft)
      : null
  ), [selectedTable, selectedTableDraft, selectedTableInvoiceSubtotal]);

  const selectedTableLineItems = useMemo(() => {
    if (!selectedTable) {
      return [];
    }

    const grouped = new Map<string, {
      key: string;
      dish_name: string;
      quantity: number;
      unit_price: string;
      line_subtotal: string;
    }>();

    selectedTableOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${item.dish_id ?? item.dish_name}-${item.unit_price}`;
        const existing = grouped.get(key);
        const quantity = (existing?.quantity || 0) + item.quantity;
        const lineSubtotal = (Number(existing?.line_subtotal || 0) + Number(item.line_subtotal || 0)).toFixed(2);

        grouped.set(key, {
          key,
          dish_name: item.dish_name,
          quantity,
          unit_price: item.unit_price,
          line_subtotal: lineSubtotal,
        });
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.dish_name.localeCompare(b.dish_name));
  }, [selectedTable, selectedTableOrders]);

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

  const handleFinalizeSelectedTable = async () => {
    if (!selectedTable || selectedTableOrders.length === 0 || !selectedTablePreview) {
      return;
    }

    const payload: AccountOrderRequest = {
      vat_rate: selectedTablePreview.vatRate,
    };

    if (selectedTablePreview.discountType) {
      payload.discount_type = selectedTablePreview.discountType;
      payload.discount_value = selectedTablePreview.discountValue;
    }

    setProcessingTarget(`table:${selectedTable}`);
    setNotice(null);
    setError(null);

    try {
      await Promise.all(selectedTableOrders.map((order) => accountConfirmedOrder(order.id, payload)));
      const finalizedOrderIds = new Set(selectedTableOrders.map((order) => order.id));
      setOrders((current) => current.filter((order) => !finalizedOrderIds.has(order.id)));
      setNotice(`Finalized ${selectedTableOrders.length} accounting order${selectedTableOrders.length === 1 ? '' : 's'} for ${selectedTable}.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to finalize accounting for ${selectedTable}.`));
    } finally {
      setProcessingTarget(null);
    }
  };

  return (
    <DashboardLayout title="Accounting">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Confirmed orders waiting for accounting</h2>
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
                focusRing,
                tablesLoading && 'cursor-not-allowed opacity-60'
              )}
            >
              <span className="truncate">{tablesLoading ? 'Loading tables...' : selectedTable || 'All tables'}</span>
              <span className={cx('text-xs text-muted2 transition-transform', isTableMenuOpen && 'rotate-180')}>▾</span>
            </button>

            {isTableMenuOpen ? (
              <div
                role="listbox"
                className="absolute right-0 z-30 mt-2 w-full min-w-[220px] rounded-[28px] border border-stroke bg-bg1 p-2 shadow-lux2"
              >
                <div className="px-1 pb-2">
                  <GlassInput
                    type="search"
                    value={tableSearchQuery}
                    onChange={(event) => setTableSearchQuery(event.target.value)}
                    placeholder="Search tables..."
                    leftSlot={<span>⌕</span>}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable('');
                    setTableSearchQuery('');
                    setIsTableMenuOpen(false);
                  }}
                  className={cx(
                    'flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-sm transition',
                    !selectedTable ? 'bg-gold/15 text-text' : 'text-muted hover:bg-white/5 hover:text-text'
                  )}
                >
                  <span>All tables</span>
                  {!selectedTable ? <span className="text-gold2">Selected</span> : null}
                </button>

                <div className="my-2 h-px bg-white/10" />

                <div className="max-h-72 overflow-y-auto">
                  {filteredTableOptions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted">
                      No tables match "{tableSearchQuery.trim()}".
                    </div>
                  ) : filteredTableOptions.map((table) => {
                    const isActive = selectedTable === table.name;

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => {
                          setSelectedTable(table.name);
                          setTableSearchQuery('');
                          setIsTableMenuOpen(false);
                        }}
                        className={cx(
                          'flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-sm transition',
                          isActive ? 'bg-gold/15 text-text' : 'text-muted hover:bg-white/5 hover:text-text'
                        )}
                      >
                        <span>{table.name}</span>
                        {isActive ? <span className="text-gold2">Selected</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <LiquidButton tone="tertiary" onClick={loadOrders} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </LiquidButton>
        </div>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl2 border border-sage/40 bg-sage/10 p-3 text-sm text-sage">
          {notice}
        </div>
      ) : null}

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
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Selected Table</p>
              <h3 className="mt-2 text-2xl font-semibold text-text">{selectedTable}</h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">{selectedTableStats.orderCount} order{selectedTableStats.orderCount === 1 ? '' : 's'} in queue</p>
              <p className="mt-1 text-lg font-semibold text-text">${selectedTableStats.subtotal.toFixed(2)}</p>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-muted">Loading accounting queue...</div>
      ) : null}

      {!loading && !selectedTable ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">🧾</div>
          <h3 className="mb-2 text-xl font-medium text-text">Select a table to open its invoice</h3>
          <p className="text-muted">
            Choose a table from the dropdown above to load one combined invoice for that table.
          </p>
        </div>
      ) : null}

      {!loading && selectedTable && filteredOrders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">💳</div>
          <h3 className="mb-2 text-xl font-medium text-text">
            {`No accounting orders for ${selectedTable}`}
          </h3>
          <p className="text-muted">
            Try another table from the dropdown, or wait for staff-confirmed orders to reach accounting.
          </p>
        </div>
      ) : null}

      {!loading && selectedTable && selectedTableOrders.length > 0 && selectedTablePreview ? (
        <GlassCard className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Table Invoice</p>
              <h3 className="mt-2 text-2xl font-semibold text-text">{selectedTable}</h3>
              <p className="mt-2 text-sm text-muted">
                {selectedTableOrders.length} confirmed order{selectedTableOrders.length === 1 ? '' : 's'} included
                {selectedTableActors.length > 0 ? ` • Confirmed by ${selectedTableActors.join(', ')}` : ''}
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
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Combined Subtotal</p>
              <p className="mt-2 text-2xl font-semibold text-text">{formatMoney(selectedTablePreview.subtotal)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-text">Items Across This Table</p>
              <div className="mt-3 space-y-3">
                {selectedTableLineItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-black/10 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{item.dish_name}</p>
                      <p className="text-sm text-muted">
                        {item.quantity} × ${item.unit_price}
                      </p>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-gold2">${item.line_subtotal}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted2">Included Orders</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTableOrders.map((order) => (
                    <span
                      key={order.id}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted"
                    >
                      {order.order_number || `Order #${order.id}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-text">Invoice Settings</p>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">VAT %</label>
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
                  <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted2">Discount Type</label>
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
                    {selectedTableDraft.discountType === 'percentage' ? 'Discount %' : 'Discount Value'}
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
                  <p className="text-xs uppercase tracking-[0.18em] text-muted2">Live Table Invoice Preview</p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>Subtotal</span>
                      <span className="font-medium text-text">{formatMoney(selectedTablePreview.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        Discount
                        {selectedTablePreview.discountType === 'percentage' ? ` (${selectedTablePreview.discountValue.toFixed(2)}%)` : ''}
                      </span>
                      <span className="font-medium text-text">- {formatMoney(selectedTablePreview.discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Taxable subtotal</span>
                      <span className="font-medium text-text">{formatMoney(selectedTablePreview.taxableSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>VAT ({selectedTablePreview.vatRate.toFixed(2)}%)</span>
                      <span className="font-medium text-text">+ {formatMoney(selectedTablePreview.vatAmount)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-base">
                      <span className="font-semibold text-text">Final total</span>
                      <span className="text-lg font-semibold text-gold2">{formatMoney(selectedTablePreview.total)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted2">
                    Finalizing from this view applies the same VAT and discount settings to every confirmed order on {selectedTable}.
                  </p>
                </div>

                <LiquidButton
                  tone="primary"
                  onClick={handleFinalizeSelectedTable}
                  disabled={processingTarget === `table:${selectedTable}`}
                >
                  {processingTarget === `table:${selectedTable}` ? 'Finalizing...' : `Finalize ${selectedTable} Invoice`}
                </LiquidButton>
              </div>
            </div>
          </div>
        </GlassCard>
      ) : null}

      
    </DashboardLayout>
  );
};

export default AccountingOrdersPage;
