import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
import PageSkeleton from '../components/Common/PageSkeleton';
import api, { resolveAssetUrl } from '../services/api';
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
  readGuestCurrencySettings,
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

const movementBadgeTone = (movementType: string): 'restock' | 'consumption' | 'neutral' => {
  const normalized = (movementType || '').toLowerCase();
  if (normalized.includes('restock') || normalized.includes('in')) return 'restock';
  if (normalized.includes('consumption') || normalized.includes('order') || normalized.includes('out')) return 'consumption';
  return 'neutral';
};

const AdminStockHistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast();
  const storedGuestCurrency = readGuestCurrencySettings()?.currency;
  const baseCurrency = normalizeCurrency(storedGuestCurrency || user?.restaurant?.currency || 'USD');
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
  const [ingredientImageByName, setIngredientImageByName] = useState<Record<string, string>>({});

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
        const imageMap: Record<string, string> = {};
        rows.forEach((ingredient: { name?: string; unit?: string | null; image_url?: string | null; file_url?: string | null }) => {
          const key = normalizeIngredientName(ingredient?.name);
          if (!key) return;
          map[key] = inferQuantityUnit(undefined, ingredient?.unit);
          const imageUrl = resolveAssetUrl(ingredient?.image_url || ingredient?.file_url || '');
          if (imageUrl) imageMap[key] = imageUrl;
        });
        setIngredientUnitsByName(map);
        setIngredientImageByName(imageMap);
      } catch {
        setIngredientUnitsByName({});
        setIngredientImageByName({});
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
      <section className="rounded-[34px] border border-gold/20 bg-bg1/90 p-5 shadow-[0_24px_45px_-32px_rgba(20,18,12,0.35)] sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold2/80">{t('stockHistory.inventoryEyebrow')}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-gold/85 text-xl text-white shadow-sm">▣</span>
            <h2 className="text-4xl font-semibold leading-none text-text">{t('stockHistory.heading')}</h2>
          </div>
          <span className="mt-4 block h-[2px] w-20 rounded-full bg-gold/30" />
        </div>
        <p className="pt-3 text-lg font-medium leading-none text-text/80">
          {t('stockHistory.pagination.summary', {
            from: pagination.from ?? 0,
            to: pagination.to ?? 0,
            total: pagination.total,
          })}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-2xl border border-gold/30 bg-bg1/65 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('stockHistory.currency')}</p>
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
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('stockHistory.quantityUnit')}</p>
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
              {t('stockHistory.baseUnit')}
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
              {t('stockHistory.convertedUnit')}
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

      <GlassCard className="border-gold/20 bg-bg1/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-[#2f2a20]">{t('stockHistory.tableTitle')}</h3>
        </div>

        {loading ? (
          <PageSkeleton rows={6} columns={1} className="py-2" loadingText={t('stockHistory.loading')} />
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-muted">{t('stockHistory.empty')}</div>
        ) : (
          <div className="mt-5 space-y-3">
            {records.map((record) => {
              const movementTone = movementBadgeTone(record.movement_type);
              const movementBadgeClasses = movementTone === 'restock'
                ? 'border-[#b9d1b5] bg-[#edf6eb] text-[#4a6a45]'
                : movementTone === 'consumption'
                  ? 'border-[#e2c3c3] bg-[#fbefef] text-[#8d4d4d]'
                  : 'border-[#d9d1c3] bg-[#f6f1e8] text-[#6d6558]';
              const movementIcon = movementTone === 'restock' ? '↑' : movementTone === 'consumption' ? '↓' : '•';
              const ingredientImage = ingredientImageByName[normalizeIngredientName(record.ingredient_name)] || '';

              return (
                <article key={record.id} className="rounded-[26px] border border-stroke bg-bg1/85 p-0 shadow-[0_10px_25px_-24px_rgba(20,18,12,0.45)]">
                  <div className="grid gap-0 lg:grid-cols-[1fr_1fr_320px]">
                    <div className="flex gap-5 p-6 lg:border-r lg:border-stroke">
                      <div className="flex items-center gap-3">
                        {ingredientImage ? (
                          <img
                            src={ingredientImage}
                            alt={getIngredientDisplayName({ name: record.ingredient_name }, i18n.resolvedLanguage)}
                            className="h-[82px] w-[82px] rounded-full border border-gold/15 bg-bg1 object-cover"
                          />
                        ) : (
                          <span className="inline-flex h-[82px] w-[82px] items-center justify-center rounded-full border border-gold/15 bg-gold/5 text-2xl font-semibold text-gold2">
                            {getIngredientDisplayName({ name: record.ingredient_name }, i18n.resolvedLanguage).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.ingredientName')}</p>
                          <p className="text-[14px] leading-tight text-text">{getIngredientDisplayName({ name: record.ingredient_name }, i18n.resolvedLanguage)}</p>
                        </div>
                        <div>
                          <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.quantityBefore')}</p>
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded-xl border border-stroke bg-bg1/60 px-3 py-1.5 text-[14px] leading-none text-text">
                              {formatQuantityValue(record.quantity_before, resolveRecordUnit(record))}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.referenceId')}</p>
                          <p className="mt-0.5 text-[14px] leading-tight text-text">{formatNumericValue(record.reference_id)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-6 lg:border-r lg:border-stroke">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.movementType')}</p>
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-[14px] leading-none ${movementBadgeClasses}`}>
                            <span>{movementIcon}</span>
                            {t(`stockHistory.movementTypes.${record.movement_type}`)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.quantity')}</p>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-xl border border-stroke bg-bg1/60 px-3 py-1.5 text-[14px] leading-none text-text">
                            {formatQuantityValue(record.quantity, resolveRecordUnit(record))}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.linkedExpense')}</p>
                        <p className="mt-0.5 text-[14px] leading-tight text-text">
                          {record.linked_expense_id
                            ? `${formatNumericValue(record.linked_expense_id)} • ${linkedExpenseAmountById[record.linked_expense_id] !== undefined ? formatAmountInSelectedCurrency(linkedExpenseAmountById[record.linked_expense_id]) : '-'}`
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.dishName')}</p>
                        <p className="mt-0.5 text-[14px] leading-tight text-text">{record.dish_name || '-'}</p>
                      </div>
                    </div>

                    <div className="space-y-3 p-6">
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.referenceType')}</p>
                        <p className="mt-0.5 text-[14px] leading-tight text-text">{record.reference_type}</p>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.orderNumber')}</p>
                        <p className="mt-0.5 text-[14px] leading-tight text-text">{record.order_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.invoiceNumber')}</p>
                        {record.invoice_id && record.invoice_number ? (
                          <Link
                            to={`/admin/finance/invoices/${record.invoice_id}`}
                            className="mt-0.5 inline-flex text-[14px] leading-tight text-gold2 underline decoration-gold2/50 underline-offset-2 hover:text-gold"
                          >
                            {record.invoice_number}
                          </Link>
                        ) : (
                          <p className="mt-0.5 text-[14px] leading-tight text-text">{record.invoice_number || '-'}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.quantityAfter')}</p>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-xl border border-stroke bg-bg1/60 px-3 py-1.5 text-[14px] leading-none text-text">
                            {formatQuantityValue(record.quantity_after, resolveRecordUnit(record))}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium uppercase tracking-[0.14em] text-muted">{t('stockHistory.columns.createdAt')}</p>
                        <p className="mt-0.5 text-[14px] leading-tight text-text">{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gold/20 px-6 py-3">
                    <p className="inline-flex items-center gap-1 text-[15px] font-medium uppercase tracking-[0.14em] text-muted">
                      <span>🗒</span>
                      {t('stockHistory.columns.notes')}
                    </p>
                    <p className="mt-0.5 text-[14px] leading-tight text-text">{record.notes || '-'}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <div className="mr-auto flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.12em] text-muted2">{t('stockHistory.pagination.rows')}</label>
            <GlassSelect
              value={String(perPage)}
              options={[
                { value: '20', label: t('stockHistory.pagination.perPage', { count: 20 }) },
                { value: '50', label: t('stockHistory.pagination.perPage', { count: 50 }) },
                { value: '100', label: t('stockHistory.pagination.perPage', { count: 100 }) },
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
      </section>
    </DashboardLayout>
  );
};

export default AdminStockHistoryPage;
