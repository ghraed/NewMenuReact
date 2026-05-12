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
import { fetchExpenses } from '../services/financeExpenseService';
import { useAuth } from '../contexts/useAuth';
import type { CurrencyCode, InventoryPagination, InventoryStockMovementRecord } from '../types';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';
import {
  CURRENCY_OPTIONS,
  convertPriceFromUsdToCurrency,
  convertPriceToUsd,
  formatDollarRate,
  formatPriceWithCurrency,
  normalizeCurrency,
} from '../utils/currency';

interface IngredientFilterItem {
  id: number;
  name: string;
  name_ar?: string | null;
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

const formatNumericValue = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

type QuantityViewMode = 'base' | 'converted';
type QuantityUnit = 'g' | 'ml' | 'piece' | 'kg' | 'l' | '-';

const normalizeIngredientName = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
);

const parseQuantityNumeric = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = value.trim();
  if (!normalized) return null;
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  const matched = normalized.match(/-?\d+(?:[.,]\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const inferQuantityUnit = (
  rawValue: number | string | null | undefined,
  explicitUnit?: string | null
): QuantityUnit => {
  const normalizedExplicit = (explicitUnit || '').trim().toLowerCase();
  if (normalizedExplicit === 'g' || normalizedExplicit === 'ml' || normalizedExplicit === 'piece' || normalizedExplicit === 'kg' || normalizedExplicit === 'l') {
    return normalizedExplicit;
  }
  if (typeof rawValue !== 'string') return '-';
  const normalized = rawValue.trim().toLowerCase();
  if (/\bkg\b/.test(normalized)) return 'kg';
  if (/\bg\b/.test(normalized)) return 'g';
  if (/\bl\b/.test(normalized)) return 'l';
  if (/\bml\b/.test(normalized)) return 'ml';
  return '-';
};

const convertQuantityByUnit = (value: number, unit?: string | null): { value: number; unit: string } => {
  const normalizedUnit = (unit || '').trim().toLowerCase();
  if (normalizedUnit === 'g') {
    return { value: value / 1000, unit: 'kg' };
  }
  if (normalizedUnit === 'ml') {
    return { value: value / 1000, unit: 'L' };
  }
  return { value, unit: unit || '-' };
};

const AdminStockHistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();
  const baseCurrency = normalizeCurrency(user?.restaurant?.currency ?? 'USD');
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [dollarRate] = useState<number>(() => {
    const parsed = Number(user?.restaurant?.dollar_rate ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

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
  const [perPage, setPerPage] = useState(20);
  const [linkedExpenseAmountById, setLinkedExpenseAmountById] = useState<Record<number, number>>({});
  const [quantityViewMode, setQuantityViewMode] = useState<QuantityViewMode>('base');
  const [ingredientUnitsByName, setIngredientUnitsByName] = useState<Record<string, QuantityUnit>>({});

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
        per_page: perPage,
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
  }, [dateFrom, dateTo, ingredientFilter, movementTypeFilter, perPage, showToast, t]);

  useEffect(() => {
    void fetchHistory(1);
  }, [fetchHistory]);

  useEffect(() => {
    setCurrency(baseCurrency);
  }, [baseCurrency]);

  const convertAmountToSelectedCurrency = useCallback((amount: number): number => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    if (currency === baseCurrency) {
      return safeAmount;
    }
    const usdValue = convertPriceToUsd(safeAmount, baseCurrency, dollarRate);
    return convertPriceFromUsdToCurrency(usdValue, currency, dollarRate);
  }, [baseCurrency, currency, dollarRate]);

  const formatAmountInSelectedCurrency = useCallback((amount: number): string => (
    formatPriceWithCurrency(convertAmountToSelectedCurrency(amount), currency)
  ), [convertAmountToSelectedCurrency, currency]);

  const formatQuantityValue = useCallback((value: number | string | null | undefined, unit?: string | null): string => {
    if (value === null || value === undefined || value === '') return '-';
    const parsed = parseQuantityNumeric(value);
    if (parsed === null) return String(value);
    const effectiveUnit = inferQuantityUnit(value, unit);

    if (quantityViewMode === 'converted') {
      const converted = convertQuantityByUnit(parsed, effectiveUnit);
      return `${converted.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${converted.unit}`;
    }

    return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${effectiveUnit}`;
  }, [quantityViewMode]);

  useEffect(() => {
    const loadLinkedExpenseAmounts = async () => {
      const linkedExpenseIds = Array.from(
        new Set(
          records
            .map((record) => record.linked_expense_id)
            .filter((id): id is number => typeof id === 'number' && id > 0)
        )
      );

      if (linkedExpenseIds.length === 0) {
        setLinkedExpenseAmountById({});
        return;
      }

      const amountMap: Record<number, number> = {};
      let page = 1;
      let lastPage = 1;
      const remaining = new Set(linkedExpenseIds);

      do {
        const response = await fetchExpenses({ page, per_page: 100 });
        response.expenses.forEach((expense) => {
          if (remaining.has(expense.id)) {
            amountMap[expense.id] = (expense.total_cents ?? 0) / 100;
            remaining.delete(expense.id);
          }
        });
        lastPage = Math.max(1, response.meta.last_page || 1);
        page += 1;
      } while (page <= lastPage && remaining.size > 0);

      setLinkedExpenseAmountById(amountMap);
    };

    void loadLinkedExpenseAmounts();
  }, [records]);

  useEffect(() => {
    const loadIngredientUnits = async () => {
      try {
        const response = await api.get('/inventory/ingredients');
        const rows = Array.isArray(response.data?.ingredients) ? response.data.ingredients : [];
        const map: Record<string, QuantityUnit> = {};
        rows.forEach((ingredient: { name?: string; unit?: string | null }) => {
          const key = normalizeIngredientName(ingredient?.name);
          if (!key) return;
          map[key] = inferQuantityUnit(undefined, ingredient?.unit);
        });
        setIngredientUnitsByName(map);
      } catch {
        setIngredientUnitsByName({});
      }
    };

    void loadIngredientUnits();
  }, []);

  const resolveRecordUnit = useCallback((record: InventoryStockMovementRecord): QuantityUnit => {
    const unitFromRecord = inferQuantityUnit(record.quantity, record.unit);
    if (unitFromRecord !== '-') {
      return unitFromRecord;
    }
    return ingredientUnitsByName[normalizeIngredientName(record.ingredient_name)] || '-';
  }, [ingredientUnitsByName]);

  const ingredientOptions = useMemo(
    () => [
      { value: '', label: t('stockHistory.filters.allIngredients') },
      ...ingredients.map((item) => ({
        value: String(item.id),
        label: getIngredientDisplayName(item, i18n.resolvedLanguage),
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
        <div className="rounded-2xl border border-gold/30 bg-bg1/65 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Currency</p>
          <GlassSelect
            value={currency}
            options={CURRENCY_OPTIONS.map((option) => ({
              value: option.value,
              label: `${option.symbol} ${option.value}`,
            }))}
            onChange={(event) => setCurrency(normalizeCurrency(event.target.value) as CurrencyCode)}
            className="mt-1 min-w-[150px]"
          />
          <p className="mt-1 text-[11px] text-muted2">{formatDollarRate(baseCurrency, dollarRate)}</p>
        </div>
        <div className="rounded-2xl border border-gold/30 bg-bg1/65 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">Quantity Unit</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setQuantityViewMode('base')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                quantityViewMode === 'base'
                  ? 'border-gold/70 bg-gold/20 text-text'
                  : 'border-stroke bg-bg1/60 text-muted hover:border-gold/35'
              }`}
            >
              g / ml
            </button>
            <button
              type="button"
              onClick={() => setQuantityViewMode('converted')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                quantityViewMode === 'converted'
                  ? 'border-gold/70 bg-gold/20 text-text'
                  : 'border-stroke bg-bg1/60 text-muted hover:border-gold/35'
              }`}
            >
              kg / L
            </button>
          </div>
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
              <article key={record.id} className="rounded-[24px] border border-white/12 bg-white/6 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <p className="text-sm font-semibold text-text">
                    Movement #{formatNumericValue(record.id)}
                  </p>
                  <span className="rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold2">
                    {t(`stockHistory.movementTypes.${record.movement_type}`)}
                  </span>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.ingredientName')}</p>
                    <p className="mt-1 text-sm text-text">{getIngredientDisplayName({ name: record.ingredient_name }, i18n.resolvedLanguage)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.referenceType')}</p>
                    <p className="mt-1 text-sm text-text">{record.reference_type}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.createdAt')}</p>
                    <p className="mt-1 text-sm text-text">{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.quantityBefore')}</p>
                    <p className="mt-1 text-sm text-text">{formatQuantityValue(record.quantity_before, resolveRecordUnit(record))}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.quantity')}</p>
                    <p className="mt-1 text-sm text-text">{formatQuantityValue(record.quantity, resolveRecordUnit(record))}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.quantityAfter')}</p>
                    <p className="mt-1 text-sm text-text">{formatQuantityValue(record.quantity_after, resolveRecordUnit(record))}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.referenceId')}</p>
                    <p className="mt-1 text-sm text-text">{formatNumericValue(record.reference_id)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">Linked Expense</p>
                    <p className="mt-1 text-sm text-text">
                      {record.linked_expense_id
                        ? `${formatNumericValue(record.linked_expense_id)} • ${linkedExpenseAmountById[record.linked_expense_id] !== undefined ? formatAmountInSelectedCurrency(linkedExpenseAmountById[record.linked_expense_id]) : '-'}`
                        : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg1/45 px-3 py-2 md:col-span-2 xl:col-span-1">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted2">{t('stockHistory.columns.notes')}</p>
                    <p className="mt-1 text-sm text-text">{record.notes || '-'}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <div className="mr-auto flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.12em] text-muted2">Rows</label>
            <GlassSelect
              value={String(perPage)}
              options={[
                { value: '20', label: '20 / page' },
                { value: '50', label: '50 / page' },
                { value: '100', label: '100 / page' },
              ]}
              onChange={(event) => {
                const nextPerPage = Number(event.target.value);
                setPerPage(Number.isFinite(nextPerPage) && nextPerPage > 0 ? nextPerPage : 20);
                void fetchHistory(1);
              }}
              disabled={loading}
              className="w-36"
            />
          </div>
          <LiquidButton
            tone="tertiary"
            onClick={() => void fetchHistory(Math.max(1, pagination.current_page - 1))}
            disabled={loading || pagination.current_page <= 1}
          >
            {t('stockHistory.pagination.previous')}
          </LiquidButton>
          {Array.from({ length: pagination.last_page }, (_, index) => index + 1)
            .filter((page) => (
              page === 1
              || page === pagination.last_page
              || Math.abs(page - pagination.current_page) <= 1
            ))
            .map((page, index, pages) => {
              const prev = pages[index - 1];
              const gap = prev && page - prev > 1;
              return (
                <React.Fragment key={`page-${page}`}>
                  {gap ? <span className="px-1 text-sm text-muted">…</span> : null}
                  <button
                    type="button"
                    onClick={() => void fetchHistory(page)}
                    disabled={loading}
                    className={`h-9 min-w-9 rounded-full border px-3 text-sm transition ${
                      page === pagination.current_page
                        ? 'border-gold/50 bg-gold/20 text-gold2'
                        : 'border-stroke bg-bg1/65 text-text hover:border-gold/35'
                    }`}
                  >
                    {page}
                  </button>
                </React.Fragment>
              );
            })}
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
