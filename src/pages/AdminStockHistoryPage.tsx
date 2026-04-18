import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassInput,
  GlassSearchSelect,
  GlassSelect,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';
import api from '../services/api';
import type { InventoryPagination, InventoryStockMovementRecord } from '../types';
import { translateIngredientLabel } from '../i18n/ingredients';

interface IngredientFilterItem {
  id: number;
  name: string;
}

interface StockHistoryResponse {
  movements: InventoryStockMovementRecord[];
  pagination: InventoryPagination;
  filters: {
    movement_types: string[];
    ingredients: IngredientFilterItem[];
  };
}

const defaultPagination: InventoryPagination = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 0,
  from: null,
  to: null,
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as {
      response?: {
        data?: {
          message?: string;
        };
      };
    }).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const AdminStockHistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast();

  const [records, setRecords] = useState<InventoryStockMovementRecord[]>([]);
  const [ingredients, setIngredients] = useState<IngredientFilterItem[]>([]);
  const [movementTypes, setMovementTypes] = useState<string[]>([]);
  const [pagination, setPagination] = useState<InventoryPagination>(defaultPagination);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ingredientFilter, setIngredientFilter] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchHistory = useCallback(async (
    page = 1,
    options?: {
      ingredientFilter?: string;
      movementTypeFilter?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {
        page,
        per_page: 20,
      };

      const effectiveIngredientFilter = options?.ingredientFilter ?? ingredientFilter;
      const effectiveMovementTypeFilter = options?.movementTypeFilter ?? movementTypeFilter;
      const effectiveDateFrom = options?.dateFrom ?? dateFrom;
      const effectiveDateTo = options?.dateTo ?? dateTo;

      if (effectiveIngredientFilter) params.ingredient_id = effectiveIngredientFilter;
      if (effectiveMovementTypeFilter) params.movement_type = effectiveMovementTypeFilter;
      if (effectiveDateFrom) params.date_from = effectiveDateFrom;
      if (effectiveDateTo) params.date_to = effectiveDateTo;

      const response = await api.get<StockHistoryResponse>('/inventory/stock-history', { params });
      const payload = response.data;

      setRecords(Array.isArray(payload.movements) ? payload.movements : []);
      setPagination(payload.pagination || defaultPagination);
      setIngredients(Array.isArray(payload.filters?.ingredients) ? payload.filters.ingredients : []);
      setMovementTypes(Array.isArray(payload.filters?.movement_types) ? payload.filters.movement_types : []);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('stockHistory.failedLoad'));
      setError(message);
      showToast(message, 'tertiary');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, ingredientFilter, movementTypeFilter, showToast, t]);

  useEffect(() => {
    void fetchHistory(1);
  }, [fetchHistory]);

  const ingredientOptions = useMemo(
    () => [
      { value: '', label: t('stockHistory.filters.allIngredients') },
      ...ingredients.map((item) => ({
        value: String(item.id),
        label: translateIngredientLabel(item.name, i18n.resolvedLanguage),
      })),
    ],
    [i18n.resolvedLanguage, ingredients, t]
  );

  const movementTypeOptions = useMemo(
    () => [
      { value: '', label: t('stockHistory.filters.allMovementTypes') },
      ...movementTypes.map((type) => ({ value: type, label: t(`stockHistory.movementTypes.${type}`) })),
    ],
    [movementTypes, t]
  );

  const handleApplyFilters = async () => {
    await fetchHistory(1);
  };

  const handleClearFilters = async () => {
    setIngredientFilter('');
    setMovementTypeFilter('');
    setDateFrom('');
    setDateTo('');
    await fetchHistory(1, {
      ingredientFilter: '',
      movementTypeFilter: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
    <DashboardLayout title={t('stockHistory.pageTitle')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('stockHistory.inventoryEyebrow')}</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">{t('stockHistory.heading')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t('stockHistory.description')}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-sm text-spicy">
          {error}
        </div>
      )}

      <GlassCard className="mb-6 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-text">{t('stockHistory.filters.title')}</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">{t('stockHistory.filters.ingredient')}</label>
            <GlassSearchSelect
              value={ingredientFilter}
              options={ingredientOptions}
              onChange={(nextValue) => setIngredientFilter(nextValue)}
              placeholder={t('stockHistory.filters.allIngredients')}
              searchPlaceholder={t('inventoryIngredients.listFilters.searchPlaceholder')}
              emptyText={t('inventoryIngredients.noNameMatches')}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">{t('stockHistory.filters.movementType')}</label>
            <GlassSelect
              value={movementTypeFilter}
              options={movementTypeOptions}
              onChange={(event) => setMovementTypeFilter(event.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">{t('stockHistory.filters.dateFrom')}</label>
            <GlassInput type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} disabled={loading} />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">{t('stockHistory.filters.dateTo')}</label>
            <GlassInput type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} disabled={loading} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <LiquidButton tone="primary" onClick={handleApplyFilters} disabled={loading}>
            {loading ? t('common.loading') : t('stockHistory.filters.apply')}
          </LiquidButton>
          <LiquidButton tone="tertiary" onClick={handleClearFilters} disabled={loading}>
            {t('stockHistory.filters.clear')}
          </LiquidButton>
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-text">{t('stockHistory.tableTitle')}</h3>
          <p className="text-sm text-muted">
            {t('stockHistory.pagination.summary', {
              from: pagination.from ?? 0,
              to: pagination.to ?? 0,
              total: pagination.total,
            })}
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted">{t('stockHistory.loading')}</div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-muted">{t('stockHistory.empty')}</div>
        ) : (
          <div className="mt-5 space-y-3">
            {records.map((record) => (
              <div key={record.id} className="rounded-[24px] border border-white/12 bg-white/6 p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.ingredientName')}: </span>{translateIngredientLabel(record.ingredient_name, i18n.resolvedLanguage)}</p>
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.movementType')}: </span>{t(`stockHistory.movementTypes.${record.movement_type}`)}</p>
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.quantity')}: </span>{record.quantity}</p>
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.quantityBefore')}: </span>{record.quantity_before ?? '-'}</p>
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.quantityAfter')}: </span>{record.quantity_after ?? '-'}</p>
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.referenceType')}: </span>{record.reference_type}</p>
                  <p className="text-sm text-text"><span className="text-muted2">{t('stockHistory.columns.referenceId')}: </span>{record.reference_id ?? '-'}</p>
                  <p className="text-sm text-text md:col-span-2 xl:col-span-1"><span className="text-muted2">{t('stockHistory.columns.createdAt')}: </span>{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</p>
                  <p className="text-sm text-text md:col-span-2 xl:col-span-3"><span className="text-muted2">{t('stockHistory.columns.notes')}: </span>{record.notes || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <LiquidButton
            tone="tertiary"
            onClick={() => void fetchHistory(Math.max(1, pagination.current_page - 1))}
            disabled={loading || pagination.current_page <= 1}
          >
            {t('stockHistory.pagination.previous')}
          </LiquidButton>
          <span className="text-sm text-muted">
            {t('stockHistory.pagination.page', {
              current: pagination.current_page,
              total: pagination.last_page,
            })}
          </span>
          <LiquidButton
            tone="tertiary"
            onClick={() => void fetchHistory(Math.min(pagination.last_page, pagination.current_page + 1))}
            disabled={loading || pagination.current_page >= pagination.last_page}
          >
            {t('stockHistory.pagination.next')}
          </LiquidButton>
        </div>
      </GlassCard>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminStockHistoryPage;
