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
import { accountConfirmedOrder, fetchAccountingOrders, fetchGuestTables, fetchPendingWaves, finalizeGuestTableSession } from '../services/orderService';
import { cx, focusRing, glassControl, glassControlHover } from '../theme/liquidGlass';
import { savePrintableInvoice } from '../utils/printableInvoice';
import type { AccountOrderRequest, DiscountType, OrderRecord, RestaurantTableSummary } from '../types';

const ACCOUNTING_POLL_INTERVAL_MS = 5000;

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [tableDrafts, setTableDrafts] = useState<TableDraftState>({});
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [invoiceTable, setInvoiceTable] = useState('');
  const [visibleInvoiceTable, setVisibleInvoiceTable] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [processingTarget, setProcessingTarget] = useState<string | null>(null);
  const tableMenuRef = useRef<HTMLDivElement | null>(null);
  const tableSearchInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoadedOrdersRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<number>>(new Set());
  const knownBillRequestIdsRef = useRef<Set<number>>(new Set());
  const refreshInFlightRef = useRef(false);

  const discountOptions = useMemo(() => ([
    { value: '', label: t('accountingPage.noDiscount') },
    { value: 'fixed', label: t('accountingPage.fixedAmount') },
    { value: 'percentage', label: t('accountingPage.percentage') },
  ] satisfies Array<{ value: '' | DiscountType; label: string }>), [t]);

  const getOrderLabel = useCallback((order: OrderRecord): string => (
    order.order_number || t('accountingPage.orderNumberLabel', { id: order.id })
  ), [t]);

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
      const [nextOrders, pendingWaves] = await Promise.all([
        fetchAccountingOrders(),
        fetchPendingWaves(),
      ]);
      const previousKnownOrderIds = knownOrderIdsRef.current;
      const newOrders = hasLoadedOrdersRef.current
        ? nextOrders.filter((order) => !previousKnownOrderIds.has(order.id))
        : [];
      const nextBillRequests = pendingWaves.filter((wave) => wave.request_type === 'request_bill');
      const previousKnownBillRequestIds = knownBillRequestIdsRef.current;
      const newBillRequests = hasLoadedOrdersRef.current
        ? nextBillRequests.filter((wave) => !previousKnownBillRequestIds.has(wave.id))
        : [];

      setOrders(nextOrders);
      setError(null);
      knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
      knownBillRequestIdsRef.current = new Set(nextBillRequests.map((wave) => wave.id));
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

      if (newBillRequests.length === 1) {
        showToast(
          t('accountingPage.billRequested', { table: newBillRequests[0].table_reference }),
          'secondary',
          4200
        );
      } else if (newBillRequests.length > 1) {
        showToast(
          t('accountingPage.billRequestsArrived', { count: newBillRequests.length }),
          'secondary',
          4200
        );
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

    const runSilentRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      void loadOrders({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadOrders({ silent: true });
      }
    };

    const intervalId = window.setInterval(runSilentRefresh, ACCOUNTING_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadOrders]);

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

    const total = filteredOrders.reduce((sum, order) => sum + Number(order.invoice.subtotal || 0), 0);

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

  const isViewingSelectedInvoice = selectedTable !== '' && invoiceTable === selectedTable;
  const isShowingSelectedInvoicePreview = isViewingSelectedInvoice && visibleInvoiceTable === selectedTable;

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
    setError(null);

    try {
      await Promise.all(selectedTableOrders.map((order) => accountConfirmedOrder(order.id, payload)));
      const uniqueSessionIds = Array.from(new Set(
        selectedTableOrders
          .map((order) => order.table_session_id)
          .filter((sessionId): sessionId is number => typeof sessionId === 'number')
      ));
      await Promise.all(uniqueSessionIds.map((sessionId) => finalizeGuestTableSession(sessionId)));
      const finalizedOrderIds = new Set(selectedTableOrders.map((order) => order.id));
      setOrders((current) => current.filter((order) => !finalizedOrderIds.has(order.id)));
      showToast(
        t('accountingPage.finalizedOrders', { count: selectedTableOrders.length, table: selectedTable }),
        'secondary',
        4200
      );
      setInvoiceTable('');
      setVisibleInvoiceTable('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('accountingPage.failedFinalize', { table: selectedTable })));
    } finally {
      setProcessingTarget(null);
    }
  };

  const handlePrintInvoice = () => {
    if (typeof window === 'undefined' || !isShowingSelectedInvoicePreview || !selectedTablePreview) {
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
        quantity: item.quantity,
        unitPrice: `$${item.unit_price}`,
        lineSubtotal: formatMoney(Number(item.line_subtotal)),
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
                    setInvoiceTable('');
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
                          if (invoiceTable !== table.name) {
                            setInvoiceTable('');
                          }
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
              <LiquidButton
                tone="primary"
                onClick={() => {
                  setInvoiceTable(selectedTable);
                  if (visibleInvoiceTable !== selectedTable) {
                    setVisibleInvoiceTable('');
                  }
                }}
                disabled={selectedTableStats.orderCount === 0}
              >
                {isViewingSelectedInvoice ? t('accountingPage.invoiceReady') : t('accountingPage.createInvoice')}
              </LiquidButton>
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

      {!loading && selectedTable && filteredOrders.length > 0 && !isViewingSelectedInvoice ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">🧾</div>
          <h3 className="mb-2 text-xl font-medium text-text">{t('accountingPage.readyToCreateInvoice', { table: selectedTable })}</h3>
          <p className="text-muted">
            {t('accountingPage.readyToCreateInvoiceHint')}
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
              <p className="text-sm font-semibold text-text">{t('accountingPage.itemsAcrossTable')}</p>
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
                      <span className="font-medium text-text">- {formatMoney(selectedTablePreview.discountAmount)}</span>
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
                  disabled={!isShowingSelectedInvoicePreview || processingTarget === `table:${selectedTable}`}
                >
                  {t('accountingPage.printInvoice')}
                </LiquidButton>

                <LiquidButton
                  tone="primary"
                  onClick={handleFinalizeSelectedTable}
                  disabled={processingTarget === `table:${selectedTable}`}
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
                    {selectedTableLineItems.map((item) => (
                      <div
                        key={`invoice-${item.key}`}
                        className="grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 px-4 py-4 text-sm text-text"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.dish_name}</p>
                          <p className="mt-1 text-xs text-muted">{t('common.eachPrice', { price: item.unit_price })}</p>
                        </div>
                        <span className="text-right text-muted">{item.quantity}</span>
                        <span className="text-right font-medium">{formatMoney(Number(item.line_subtotal))}</span>
                      </div>
                    ))}
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
                      <span className="font-medium text-text">- {formatMoney(selectedTablePreview.discountAmount)}</span>
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
