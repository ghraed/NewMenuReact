import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassInput,
  GlassSelect,
  GlassToast,
  useGlassToast,
} from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import { fetchAccountingOrders, fetchKitchenOrders, fetchPendingOrders } from '../services/orderService';
import { fetchInvoiceById, fetchInvoices } from '../services/invoiceService';
import type { InventoryIngredient, InventoryStockMovementRecord, OrderRecord } from '../types';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';

interface StockHistoryResponse {
  movements: InventoryStockMovementRecord[];
  pagination: {
    current_page: number;
    last_page: number;
  };
}

interface InvoiceItemMatch {
  invoiceNumber: string;
  invoiceDate: string;
  waiterName: string;
  tableReference: string;
  dishName: string;
}

interface IngredientTrackerRow {
  movementId: number;
  orderItemId: number | null;
  dishName: string;
  orderId: number;
  orderNumber: string;
  invoiceNumber: string;
  waiterName: string;
  chefName: string;
  orderedAt: string | null;
  tableReference: string;
}

const normalize = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
);

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const asPositiveNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const AdminIngredientTrackerPage: React.FC = () => {
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();
  const [ingredients, setIngredients] = useState<InventoryIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IngredientTrackerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedIngredient = useMemo(
    () => ingredients.find((ingredient) => String(ingredient.id) === selectedIngredientId) ?? null,
    [ingredients, selectedIngredientId]
  );

  const loadIngredients = useCallback(async () => {
    const response = await api.get('/inventory/ingredients');
    const list = Array.isArray(response.data?.ingredients) ? response.data.ingredients as InventoryIngredient[] : [];
    setIngredients(list);
    if (!selectedIngredientId && list.length > 0) {
      setSelectedIngredientId(String(list[0].id));
    }
  }, [selectedIngredientId]);

  const loadAllStockMovements = useCallback(async (ingredientId: number): Promise<InventoryStockMovementRecord[]> => {
    const firstPageResponse = await api.get<StockHistoryResponse>('/inventory/stock-history', {
      params: {
        ingredient_id: ingredientId,
        page: 1,
        per_page: 100,
      },
    });

    let allMovements: InventoryStockMovementRecord[] = Array.isArray(firstPageResponse.data?.movements)
      ? firstPageResponse.data.movements
      : [];
    const lastPage = Number(firstPageResponse.data?.pagination?.last_page || 1);

    if (lastPage > 1) {
      const pageRequests: Array<Promise<{ data: StockHistoryResponse }>> = [];
      for (let page = 2; page <= lastPage; page += 1) {
        pageRequests.push(api.get<StockHistoryResponse>('/inventory/stock-history', {
          params: {
            ingredient_id: ingredientId,
            page,
            per_page: 100,
          },
        }));
      }

      const restPages = await Promise.all(pageRequests);
      restPages.forEach((pageResponse) => {
        if (Array.isArray(pageResponse.data?.movements)) {
          allMovements = allMovements.concat(pageResponse.data.movements);
        }
      });
    }

    return allMovements;
  }, []);

  const loadAccessibleOrdersById = useCallback(async (): Promise<Map<number, OrderRecord>> => {
    const role = user?.role;
    const orderSourceTasks: Array<Promise<OrderRecord[]>> = [];

    if (role === 'admin' || role === 'accountant') {
      orderSourceTasks.push(fetchAccountingOrders());
    }
    if (role === 'admin' || role === 'staff') {
      orderSourceTasks.push(fetchPendingOrders());
    }
    if (role === 'chef') {
      orderSourceTasks.push(fetchKitchenOrders('all') as Promise<OrderRecord[]>);
    }

    const ordersById = new Map<number, OrderRecord>();
    const knownOrdersResults = await Promise.allSettled(orderSourceTasks);
    knownOrdersResults.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      result.value.forEach((order) => {
        if (!ordersById.has(order.id)) {
          ordersById.set(order.id, order as OrderRecord);
        }
      });
    });

    return ordersById;
  }, [user?.role]);

  const loadInvoiceMatchByOrderItemId = useCallback(async (orderItemIds: number[]): Promise<Map<number, InvoiceItemMatch>> => {
    const invoiceItemMap = new Map<number, InvoiceItemMatch>();
    if (orderItemIds.length === 0) return invoiceItemMap;

    try {
      const firstPage = await fetchInvoices({ per_page: 200, page: 1 });
      let invoices = firstPage.invoices || [];
      const lastPage = Number(firstPage.meta?.last_page || 1);

      if (lastPage > 1) {
        const morePages = await Promise.all(
          Array.from({ length: lastPage - 1 }, (_, index) => fetchInvoices({ per_page: 200, page: index + 2 }))
        );
        morePages.forEach((pagePayload) => {
          invoices = invoices.concat(pagePayload.invoices || []);
        });
      }

      const candidateInvoices = invoices.filter((invoice) => (
        (invoice.items || []).some((item) => item.order_item_id && orderItemIds.includes(item.order_item_id))
      ));

      const detailedInvoices = await Promise.all(
        candidateInvoices.map(async (invoice) => {
          try {
            return await fetchInvoiceById(invoice.id);
          } catch {
            return null;
          }
        })
      );

      detailedInvoices.forEach((invoice) => {
        if (!invoice) return;
        (invoice.items || []).forEach((item) => {
          if (!item.order_item_id || !orderItemIds.includes(item.order_item_id)) return;

          invoiceItemMap.set(item.order_item_id, {
            invoiceNumber: invoice.invoice_number || '-',
            invoiceDate: invoice.invoice_date || '',
            waiterName: invoice.waiter_name || invoice.waiter?.name || '-',
            tableReference: invoice.table_reference || '-',
            dishName: item.name || '',
          });
        });
      });
    } catch {
      // Best-effort enrichment only.
    }

    return invoiceItemMap;
  }, []);

  const loadIngredientUsage = useCallback(async () => {
    if (!selectedIngredient) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allMovements = await loadAllStockMovements(selectedIngredient.id);

      const dedupeMap = new Map<string, InventoryStockMovementRecord>();
      allMovements.forEach((movement) => {
        const orderItemId = asPositiveNumber(movement.order_item_id);
        const key = orderItemId ? `order-item:${orderItemId}` : `movement:${movement.id}`;
        const existing = dedupeMap.get(key);
        if (!existing) {
          dedupeMap.set(key, movement);
          return;
        }

        const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
        const candidateTime = movement.created_at ? new Date(movement.created_at).getTime() : 0;
        if (candidateTime >= existingTime) {
          dedupeMap.set(key, movement);
        }
      });

      const finalMovements = Array.from(dedupeMap.values());
      const ordersById = await loadAccessibleOrdersById();
      const orderItemIds = finalMovements
        .map((movement) => asPositiveNumber(movement.order_item_id))
        .filter((value): value is number => value !== null);
      const invoiceByOrderItemId = await loadInvoiceMatchByOrderItemId(Array.from(new Set(orderItemIds)));

      const usageRows: IngredientTrackerRow[] = finalMovements.map((movement) => {
        const orderItemId = asPositiveNumber(movement.order_item_id);
        const orderId = asPositiveNumber(movement.order_id)
          || (normalize(movement.reference_type).includes('order') ? asPositiveNumber(movement.reference_id) : null)
          || 0;
        const order = orderId > 0 ? ordersById.get(orderId) : undefined;
        const invoiceMatch = orderItemId ? invoiceByOrderItemId.get(orderItemId) : undefined;
        const orderItemDishName = orderItemId
          ? (order?.items || []).find((item) => item.id === orderItemId)?.dish_name
          : null;
        const resolvedDishName = (
          (movement.dish_name || '').trim()
          || (invoiceMatch?.dishName || '').trim()
          || (orderItemDishName || '').trim()
        );

        if (!resolvedDishName) {
          return null;
        }

        return {
          movementId: movement.id,
          orderItemId,
          dishName: resolvedDishName,
          orderId,
          orderNumber: order?.order_number || (orderId > 0 ? `#${orderId}` : '-'),
          invoiceNumber: invoiceMatch?.invoiceNumber || order?.invoice_number || '-',
          waiterName: invoiceMatch?.waiterName || order?.confirmed_by?.name || '-',
          chefName: 'Not provided',
          orderedAt: order?.confirmed_at || order?.created_at || invoiceMatch?.invoiceDate || movement.created_at || null,
          tableReference: invoiceMatch?.tableReference || order?.table_reference || '-',
        };
      }).filter((row): row is IngredientTrackerRow => row !== null);

      usageRows.sort((a, b) => {
        const left = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
        const right = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
        return right - left;
      });

      setRows(usageRows);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to load ingredient tracker data.');
      setError(message);
      showToast(message, 'tertiary');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    selectedIngredient,
    loadAllStockMovements,
    loadAccessibleOrdersById,
    loadInvoiceMatchByOrderItemId,
    showToast,
  ]);

  useEffect(() => {
    void loadIngredients()
      .catch((err: unknown) => {
        const message = getErrorMessage(err, 'Failed to load ingredients.');
        setError(message);
      });
  }, [loadIngredients]);

  useEffect(() => {
    if (!selectedIngredient) return;
    void loadIngredientUsage();
  }, [selectedIngredient, loadIngredientUsage]);

  const filteredRows = useMemo(() => {
    const query = normalize(search);
    if (!query) return rows;

    return rows.filter((row) => (
      normalize(row.dishName).includes(query)
      || normalize(row.orderNumber).includes(query)
      || normalize(row.invoiceNumber).includes(query)
      || normalize(row.waiterName).includes(query)
      || normalize(row.tableReference).includes(query)
    ));
  }, [rows, search]);

  return (
    <DashboardLayout title="Ingredient Tracker">
      <div className="space-y-4">
        <GlassCard className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Ingredient usage history</h2>
          <p className="text-sm text-muted">
            Shows ordered dish items that consumed the selected ingredient.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <GlassSelect
              value={selectedIngredientId}
              onChange={(event) => setSelectedIngredientId(event.target.value)}
              placeholder="Select ingredient"
              options={ingredients.map((ingredient) => ({
                value: String(ingredient.id),
                label: getIngredientDisplayName(ingredient),
              }))}
            />

            <GlassInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by dish / order / invoice / waiter / table..."
            />
          </div>
        </GlassCard>

        <GlassCard className="overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-muted">Loading tracker data...</div>
          ) : error ? (
            <div className="rounded-xl border border-spicy/40 bg-spicy/12 px-4 py-4 text-sm text-spicy">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 text-center text-muted">
              No resolved ordered dish items found for this ingredient.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-3 py-2">Dish</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Date & Time</th>
                  <th className="px-3 py-2">Waiter</th>
                  <th className="px-3 py-2">Chef</th>
                  <th className="px-3 py-2">Table</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.orderItemId ?? row.movementId}-${row.orderId}-${row.dishName}`} className="border-t border-stroke/40 text-text/95">
                    <td className="px-3 py-2">{row.dishName}</td>
                    <td className="px-3 py-2">{row.orderNumber}</td>
                    <td className="px-3 py-2">{row.invoiceNumber}</td>
                    <td className="px-3 py-2">{formatDateTime(row.orderedAt)}</td>
                    <td className="px-3 py-2">{row.waiterName}</td>
                    <td className="px-3 py-2">{row.chefName}</td>
                    <td className="px-3 py-2">{row.tableReference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminIngredientTrackerPage;
