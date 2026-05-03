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
import api, { resolveAssetUrl } from '../services/api';
import type { GlobalIngredient, InventoryIngredient, IngredientStockUnit } from '../types';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';

interface IngredientPayload {
  name: string;
  unit: IngredientStockUnit;
  current_quantity: string;
  low_stock_threshold: string;
  target_quantity: string;
  is_active: boolean;
}

type InventoryActionType = 'restock' | 'adjust';

interface InventoryActionState {
  ingredientId: number | null;
  type: InventoryActionType;
  quantity: string;
  reference: string;
  notes: string;
}
interface RestockDraftRow {
  ingredientId: number;
  name: string;
  unit: IngredientStockUnit;
  quantity: string;
}

interface ImportGlobalIngredientsResponse {
  message?: string;
  created_count: number;
  linked_count: number;
  skipped_count: number;
  created_ids: number[];
  linked_ids: number[];
  skipped_global_ingredient_ids: number[];
}

type GlobalImportStatus = 'already_added' | 'will_link' | 'new';

const defaultIngredientPayload: IngredientPayload = {
  name: '',
  unit: 'piece',
  current_quantity: '0.000',
  low_stock_threshold: '0.000',
  target_quantity: '0.000',
  is_active: true,
};

const defaultActionState = (type: InventoryActionType): InventoryActionState => ({
  ingredientId: null,
  type,
  quantity: '',
  reference: '',
  notes: '',
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as {
      response?: {
        data?: {
          message?: string;
          errors?: Record<string, string[] | string>;
        };
      };
    }).response;

    const firstValidationError = response?.data?.errors
      ? Object.values(response.data.errors)[0]
      : null;

    if (Array.isArray(firstValidationError) && firstValidationError[0]) {
      return firstValidationError[0];
    }

    if (typeof firstValidationError === 'string') {
      return firstValidationError;
    }

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const normalizeIngredientName = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
);

const AdminIngredientsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast();

  const [ingredients, setIngredients] = useState<InventoryIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [formPayload, setFormPayload] = useState<IngredientPayload>(defaultIngredientPayload);
  const [savingIngredient, setSavingIngredient] = useState(false);

  const [actionState, setActionState] = useState<InventoryActionState>(defaultActionState('restock'));
  const [submittingAction, setSubmittingAction] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock'>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | IngredientStockUnit>('all');
  const [globalIngredients, setGlobalIngredients] = useState<GlobalIngredient[]>([]);
  const [globalIngredientsLoading, setGlobalIngredientsLoading] = useState(false);
  const [globalImportModalOpen, setGlobalImportModalOpen] = useState(false);
  const [globalImportSearch, setGlobalImportSearch] = useState('');
  const [hideAlreadyAddedGlobals, setHideAlreadyAddedGlobals] = useState(true);
  const [selectedGlobalIngredientIds, setSelectedGlobalIngredientIds] = useState<number[]>([]);
  const [importingGlobalIngredients, setImportingGlobalIngredients] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [restockDraftRows, setRestockDraftRows] = useState<RestockDraftRow[]>([]);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/inventory/ingredients');
      const nextIngredients = Array.isArray(response.data?.ingredients) ? response.data.ingredients : [];
      setIngredients(nextIngredients);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('inventoryIngredients.failedLoad')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchGlobalIngredients = useCallback(async () => {
    setGlobalIngredientsLoading(true);

    try {
      const response = await api.get<GlobalIngredient[]>('/global-ingredients');
      setGlobalIngredients(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, t('inventoryIngredients.importGlobal.failedLoad')), 'tertiary');
    } finally {
      setGlobalIngredientsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void fetchIngredients();
  }, [fetchIngredients]);

  const summary = useMemo(() => {
    const activeCount = ingredients.filter((ingredient) => ingredient.is_active).length;
    const lowStockCount = ingredients.filter((ingredient) => ingredient.is_low_stock).length;

    return {
      total: ingredients.length,
      active: activeCount,
      inactive: ingredients.length - activeCount,
      lowStock: lowStockCount,
    };
  }, [ingredients]);

  const lowStockIngredients = useMemo(
    () => ingredients.filter((ingredient) => ingredient.is_low_stock),
    [ingredients]
  );

  const reorderRows = useMemo(() => (
    ingredients
      .map((ingredient) => {
        const current = Number.parseFloat(ingredient.current_quantity || '0');
        const target = Number.parseFloat(
          ingredient.target_quantity
          ?? ingredient.low_stock_threshold
          ?? '0'
        );
        const missing = Math.max(target - current, 0);

        return {
          ingredient,
          current,
          target,
          missing,
        };
      })
      .filter((row) => row.missing > 0)
      .sort((a, b) => b.missing - a.missing)
  ), [ingredients]);

  const formatIngredientName = useCallback(
    (name?: string, nameArabic?: string | null) => getIngredientDisplayName(
      { name, name_ar: nameArabic },
      i18n.resolvedLanguage
    ),
    [i18n.resolvedLanguage]
  );

  const resetForm = () => {
    setEditingIngredientId(null);
    setFormPayload(defaultIngredientPayload);
  };

  const handleStartCreate = () => {
    resetForm();
  };

  const handleStartEdit = (ingredient: InventoryIngredient) => {
    setEditingIngredientId(ingredient.id);
    setFormPayload({
      name: ingredient.name,
      unit: ingredient.unit,
      current_quantity: ingredient.current_quantity,
      low_stock_threshold: ingredient.low_stock_threshold,
      target_quantity: ingredient.target_quantity ?? ingredient.low_stock_threshold ?? '0.000',
      is_active: ingredient.is_active,
    });
  };

  const handleSaveIngredient = async () => {
    const name = formPayload.name.trim();
    if (!name) {
      showToast(t('inventoryIngredients.nameRequired'), 'tertiary');
      return;
    }

    setSavingIngredient(true);
    setError(null);

    try {
      if (editingIngredientId) {
        const response = await api.patch(`/inventory/ingredients/${editingIngredientId}`, {
          name,
          unit: formPayload.unit,
          low_stock_threshold: formPayload.low_stock_threshold,
          target_quantity: formPayload.target_quantity,
          is_active: formPayload.is_active,
        });

        const updatedIngredient = response.data?.ingredient as InventoryIngredient;

        setIngredients((current) => current.map((ingredient) => (
          ingredient.id === updatedIngredient.id ? updatedIngredient : ingredient
        )));

        showToast(response.data?.message || t('inventoryIngredients.updated'), 'secondary');
      } else {
        const response = await api.post('/inventory/ingredients', {
          name,
          unit: formPayload.unit,
          current_quantity: formPayload.current_quantity,
          low_stock_threshold: formPayload.low_stock_threshold,
          target_quantity: formPayload.target_quantity,
          is_active: formPayload.is_active,
        });

        const createdIngredient = response.data?.ingredient as InventoryIngredient;
        setIngredients((current) => [createdIngredient, ...current]);
        showToast(response.data?.message || t('inventoryIngredients.created'), 'secondary');
      }

      resetForm();
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('inventoryIngredients.failedSave'));
      setError(message);
      showToast(message, 'tertiary');
    } finally {
      setSavingIngredient(false);
    }
  };

  const handleToggleActive = async (ingredient: InventoryIngredient) => {
    setError(null);

    try {
      const endpoint = ingredient.is_active ? 'deactivate' : 'activate';
      const response = await api.post(`/inventory/ingredients/${ingredient.id}/${endpoint}`);

      const updatedIngredient = response.data?.ingredient as InventoryIngredient;
      setIngredients((current) => current.map((item) => (
        item.id === updatedIngredient.id ? updatedIngredient : item
      )));

      showToast(response.data?.message || t('inventoryIngredients.statusUpdated'), 'secondary');
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('inventoryIngredients.failedStatusUpdate'));
      setError(message);
      showToast(message, 'tertiary');
    }
  };

  const handleOpenAction = (
    ingredientId: number,
    type: InventoryActionType,
    preset?: Partial<Pick<InventoryActionState, 'quantity' | 'reference' | 'notes'>>
  ) => {
    setActionState({
      ...defaultActionState(type),
      ingredientId,
      quantity: preset?.quantity ?? '',
      reference: preset?.reference ?? '',
      notes: preset?.notes ?? '',
    });
  };

  const handleCloseAction = () => {
    setActionState(defaultActionState('restock'));
  };

  const handleSubmitAction = async () => {
    if (!actionState.ingredientId) {
      return;
    }

    const quantity = actionState.quantity.trim();
    if (!quantity) {
      showToast(t('inventoryIngredients.quantityRequired'), 'tertiary');
      return;
    }

    setSubmittingAction(true);
    setError(null);

    try {
      const endpoint = actionState.type === 'restock' ? 'restock' : 'adjust';
      const payload = actionState.type === 'restock'
        ? {
            quantity,
            reference: actionState.reference || null,
            notes: actionState.notes || null,
          }
        : {
            quantity_delta: quantity,
            reference: actionState.reference || null,
            notes: actionState.notes || null,
          };

      const response = await api.post(`/inventory/ingredients/${actionState.ingredientId}/${endpoint}`, payload);
      const updatedIngredient = response.data?.ingredient as InventoryIngredient;

      setIngredients((current) => current.map((item) => (
        item.id === updatedIngredient.id ? updatedIngredient : item
      )));

      showToast(response.data?.message || t('inventoryIngredients.stockUpdated'), 'secondary');
      handleCloseAction();
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('inventoryIngredients.failedStockUpdate'));
      setError(message);
      showToast(message, 'tertiary');
    } finally {
      setSubmittingAction(false);
    }
  };

  const unitOptions = useMemo(
    () => [
      { value: 'piece', label: t('inventoryIngredients.units.piece') },
      { value: 'g', label: t('inventoryIngredients.units.g') },
      { value: 'ml', label: t('inventoryIngredients.units.ml') },
    ],
    [t]
  );

  const listStatusOptions = useMemo(
    () => [
      { value: 'all', label: t('inventoryIngredients.listFilters.allStatuses') },
      { value: 'active', label: t('inventoryIngredients.listFilters.activeOnly') },
      { value: 'inactive', label: t('inventoryIngredients.listFilters.inactiveOnly') },
      { value: 'low_stock', label: t('inventoryIngredients.listFilters.lowStockOnly') },
    ],
    [t]
  );

  const listUnitOptions = useMemo(
    () => [
      { value: 'all', label: t('inventoryIngredients.listFilters.allUnits') },
      ...unitOptions,
    ],
    [t, unitOptions]
  );

  const ingredientNameOptions = useMemo(
    () => Array.from(new Set(ingredients.map((ingredient) => ingredient.name)))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        value: name,
        label: getIngredientDisplayName({ name }, i18n.resolvedLanguage),
      })),
    [i18n.resolvedLanguage, ingredients]
  );

  const normalizedListSearch = listSearch.trim().toLowerCase();
  const filteredIngredients = useMemo(() => (
    ingredients.filter((ingredient) => {
      if (statusFilter === 'active' && !ingredient.is_active) {
        return false;
      }

      if (statusFilter === 'inactive' && ingredient.is_active) {
        return false;
      }

      if (statusFilter === 'low_stock' && !ingredient.is_low_stock) {
        return false;
      }

      if (unitFilter !== 'all' && ingredient.unit !== unitFilter) {
        return false;
      }

      if (!normalizedListSearch) {
        return true;
      }

      const translatedName = formatIngredientName(ingredient.name, ingredient.name_ar);
      const searchableText = `${ingredient.name} ${translatedName} ${ingredient.unit}`.toLowerCase();
      return searchableText.includes(normalizedListSearch);
    })
  ), [formatIngredientName, ingredients, normalizedListSearch, statusFilter, unitFilter]);

  const globalImportRows = useMemo(() => {
    const existingByGlobalId = new Set<number>(
      ingredients
        .map((ingredient) => ingredient.global_ingredient_id)
        .filter((globalIngredientId): globalIngredientId is number => typeof globalIngredientId === 'number')
    );

    const unlinkedByNormalizedName = new Map<string, number>();
    ingredients.forEach((ingredient) => {
      if (ingredient.global_ingredient_id) {
        return;
      }

      const normalizedName = normalizeIngredientName(ingredient.name);
      if (!normalizedName || unlinkedByNormalizedName.has(normalizedName)) {
        return;
      }

      unlinkedByNormalizedName.set(normalizedName, ingredient.id);
    });

    return globalIngredients.map((globalIngredient) => {
      const normalizedName = normalizeIngredientName(globalIngredient.normalized_name || globalIngredient.name);

      const status: GlobalImportStatus = existingByGlobalId.has(globalIngredient.id)
        ? 'already_added'
        : unlinkedByNormalizedName.has(normalizedName)
          ? 'will_link'
          : 'new';

      return {
        globalIngredient,
        status,
        isSelectable: status !== 'already_added',
      };
    });
  }, [globalIngredients, ingredients]);

  const filteredGlobalImportRows = useMemo(() => {
    const normalizedSearch = globalImportSearch.trim().toLowerCase();

    return globalImportRows.filter(({ globalIngredient, status }) => {
      if (hideAlreadyAddedGlobals && status === 'already_added') {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const localizedName = getIngredientDisplayName(globalIngredient, i18n.resolvedLanguage).toLowerCase();
      return (
        (globalIngredient.name || '').toLowerCase().includes(normalizedSearch)
        || (globalIngredient.name_ar || '').toLowerCase().includes(normalizedSearch)
        || localizedName.includes(normalizedSearch)
      );
    });
  }, [globalImportRows, globalImportSearch, hideAlreadyAddedGlobals, i18n.resolvedLanguage]);

  const selectedGlobalIngredientsCount = selectedGlobalIngredientIds.length;

  const handleOpenGlobalImportModal = async () => {
    setGlobalImportModalOpen(true);
    setSelectedGlobalIngredientIds([]);
    setGlobalImportSearch('');

    if (globalIngredients.length === 0 && !globalIngredientsLoading) {
      await fetchGlobalIngredients();
    }
  };

  const handleCloseGlobalImportModal = () => {
    if (importingGlobalIngredients) {
      return;
    }

    setGlobalImportModalOpen(false);
    setSelectedGlobalIngredientIds([]);
    setGlobalImportSearch('');
  };

  const handleToggleGlobalSelection = (globalIngredientId: number) => {
    setSelectedGlobalIngredientIds((current) => (
      current.includes(globalIngredientId)
        ? current.filter((id) => id !== globalIngredientId)
        : [...current, globalIngredientId]
    ));
  };

  const handleSelectVisibleGlobals = () => {
    const visibleSelectableIds = filteredGlobalImportRows
      .filter((row) => row.isSelectable)
      .map((row) => row.globalIngredient.id);

    setSelectedGlobalIngredientIds(visibleSelectableIds);
  };

  const handleClearGlobalSelection = () => {
    setSelectedGlobalIngredientIds([]);
  };

  const handleImportSelectedGlobals = async () => {
    if (selectedGlobalIngredientIds.length === 0) {
      showToast(t('inventoryIngredients.importGlobal.selectFirst'), 'tertiary');
      return;
    }

    setImportingGlobalIngredients(true);
    setError(null);

    try {
      const response = await api.post<ImportGlobalIngredientsResponse>('/inventory/ingredients/import-global', {
        global_ingredient_ids: selectedGlobalIngredientIds,
      });

      await fetchIngredients();
      setSelectedGlobalIngredientIds([]);

      showToast(
        t('inventoryIngredients.importGlobal.summary', {
          created: response.data.created_count ?? 0,
          linked: response.data.linked_count ?? 0,
          skipped: response.data.skipped_count ?? 0,
        }),
        'secondary'
      );
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('inventoryIngredients.importGlobal.failedImport'));
      setError(message);
      showToast(message, 'tertiary');
    } finally {
      setImportingGlobalIngredients(false);
    }
  };

  const handleCreateRestockDraft = () => {
    const nextDraftRows = reorderRows.map(({ ingredient, missing }) => ({
      ingredientId: ingredient.id,
      name: formatIngredientName(ingredient.name, ingredient.name_ar),
      unit: ingredient.unit,
      quantity: missing.toFixed(3),
    }));
    setRestockDraftRows(nextDraftRows);
  };

  const handleUseDraftRow = (row: RestockDraftRow) => {
    setReorderModalOpen(false);
    handleOpenAction(row.ingredientId, 'restock', {
      quantity: row.quantity,
      reference: 'AUTO_REORDER_DRAFT',
      notes: t('inventoryIngredients.reorder.autoDraftNote'),
    });
  };

  return (
    <DashboardLayout title={t('inventoryIngredients.pageTitle')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('inventoryIngredients.inventoryEyebrow')}</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">{t('inventoryIngredients.heading')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t('inventoryIngredients.description')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <LiquidButton tone="tertiary" onClick={fetchIngredients} disabled={loading}>
            {loading ? t('common.loading') : t('inventoryIngredients.refresh')}
          </LiquidButton>
          <LiquidButton tone="secondary" onClick={() => setReorderModalOpen(true)} disabled={loading || ingredients.length === 0}>
            {t('inventoryIngredients.reorder.showMissing')}
          </LiquidButton>
          <LiquidButton tone="primary" onClick={() => void handleOpenGlobalImportModal()} disabled={loading}>
            {t('inventoryIngredients.importGlobal.open')}
          </LiquidButton>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-sm text-spicy">
          {error}
        </div>
      )}

      {lowStockIngredients.length > 0 ? (
        <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4">
          <p className="text-sm font-semibold text-spicy">
            {t('inventoryIngredients.lowStockWarningTitle', { count: lowStockIngredients.length })}
          </p>
          <p className="mt-1 text-sm text-spicy/90">
            {t('inventoryIngredients.lowStockWarningDescription')}
          </p>
          <p className="mt-2 text-sm text-spicy/90">
            {lowStockIngredients
              .slice(0, 6)
              .map((ingredient) => `${formatIngredientName(ingredient.name)} (${ingredient.current_quantity} ${ingredient.unit})`)
              .join(' • ')}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-text">
              {editingIngredientId ? t('inventoryIngredients.editIngredient') : t('inventoryIngredients.addIngredient')}
            </h3>
            {editingIngredientId ? (
              <LiquidButton tone="tertiary" onClick={handleStartCreate}>
                {t('inventoryIngredients.createNew')}
              </LiquidButton>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            <label className="text-sm font-medium text-text">{t('inventoryIngredients.fields.name')}</label>
            <GlassSearchSelect
              value={formPayload.name}
              options={ingredientNameOptions}
              onChange={(nextValue) => setFormPayload((current) => ({ ...current, name: nextValue }))}
              placeholder={t('inventoryIngredients.chooseIngredientName')}
              searchPlaceholder={t('inventoryIngredients.searchNamesPlaceholder')}
              emptyText={t('inventoryIngredients.noNameMatches')}
              disabled={savingIngredient}
            />

            <label className="mt-2 text-sm font-medium text-text">{t('inventoryIngredients.fields.unit')}</label>
            <GlassSelect
              value={formPayload.unit}
              options={unitOptions}
              onChange={(event) => setFormPayload((current) => ({
                ...current,
                unit: event.target.value as IngredientStockUnit,
              }))}
              disabled={savingIngredient}
            />

            {!editingIngredientId ? (
              <>
                <label htmlFor="inventory-current-quantity" className="mt-2 text-sm font-medium text-text">
                  {t('inventoryIngredients.fields.currentQuantity')}
                </label>
                <GlassInput
                  id="inventory-current-quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  value={formPayload.current_quantity}
                  onChange={(event) => setFormPayload((current) => ({ ...current, current_quantity: event.target.value }))}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                  disabled={savingIngredient}
                />
              </>
            ) : null}

            <label htmlFor="inventory-low-stock-threshold" className="mt-2 text-sm font-medium text-text">
              {t('inventoryIngredients.fields.lowStockThreshold')}
            </label>
            <GlassInput
              id="inventory-low-stock-threshold"
              type="number"
              step="0.001"
              min="0"
              value={formPayload.low_stock_threshold}
              onChange={(event) => setFormPayload((current) => ({ ...current, low_stock_threshold: event.target.value }))}
              disabled={savingIngredient}
            />

            <label htmlFor="inventory-target-quantity" className="mt-2 text-sm font-medium text-text">
              {t('inventoryIngredients.fields.targetQuantity')}
            </label>
            <GlassInput
              id="inventory-target-quantity"
              type="number"
              step="0.001"
              min="0"
              value={formPayload.target_quantity}
              onChange={(event) => setFormPayload((current) => ({ ...current, target_quantity: event.target.value }))}
              disabled={savingIngredient}
            />

            <label className="mt-2 inline-flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={formPayload.is_active}
                onChange={(event) => setFormPayload((current) => ({ ...current, is_active: event.target.checked }))}
                disabled={savingIngredient}
              />
              {t('inventoryIngredients.fields.isActive')}
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <LiquidButton tone="primary" onClick={handleSaveIngredient} disabled={savingIngredient}>
                {savingIngredient ? t('inventoryIngredients.saving') : editingIngredientId ? t('inventoryIngredients.saveChanges') : t('inventoryIngredients.createIngredient')}
              </LiquidButton>
              {editingIngredientId ? (
                <LiquidButton tone="tertiary" onClick={resetForm} disabled={savingIngredient}>
                  {t('inventoryIngredients.cancelEdit')}
                </LiquidButton>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('inventoryIngredients.summary')}</p>
          <h3 className="mt-2 text-lg font-semibold text-text">{t('inventoryIngredients.currentOverview')}</h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/12 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted2">{t('inventoryIngredients.cards.total')}</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted2">{t('inventoryIngredients.cards.active')}</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary.active}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted2">{t('inventoryIngredients.cards.inactive')}</p>
              <p className="mt-2 text-2xl font-semibold text-text">{summary.inactive}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted2">{t('inventoryIngredients.cards.lowStock')}</p>
              <p className="mt-2 text-2xl font-semibold text-spicy">{summary.lowStock}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-text">{t('inventoryIngredients.listTitle')}</h3>
          <p className="text-sm text-muted">
            {t('inventoryIngredients.listFilters.resultsCount', {
              filtered: filteredIngredients.length,
              total: ingredients.length,
            })}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <GlassInput
            value={listSearch}
            onChange={(event) => setListSearch(event.target.value)}
            placeholder={t('inventoryIngredients.listFilters.searchPlaceholder')}
            leftSlot={<span>⌕</span>}
            disabled={loading}
          />
          <GlassSelect
            value={statusFilter}
            options={listStatusOptions}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive' | 'low_stock')}
            disabled={loading}
          />
          <GlassSelect
            value={unitFilter}
            options={listUnitOptions}
            onChange={(event) => setUnitFilter(event.target.value as 'all' | IngredientStockUnit)}
            disabled={loading}
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted">{t('inventoryIngredients.loading')}</div>
        ) : filteredIngredients.length === 0 ? (
          <div className="py-12 text-center text-muted">{t('inventoryIngredients.empty')}</div>
        ) : (
          <div className="mt-5 space-y-3">
            {filteredIngredients.map((ingredient) => {
              const isActionOpen = actionState.ingredientId === ingredient.id;

              return (
                <div key={ingredient.id} className="rounded-[24px] border border-white/12 bg-white/6 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-text">{formatIngredientName(ingredient.name)}</p>
                        <span className="rounded-full border border-white/12 bg-white/10 px-2 py-0.5 text-xs text-muted2">
                          {ingredient.unit}
                        </span>
                        {ingredient.is_active ? (
                          <span className="rounded-full border border-sage/35 bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage">
                            {t('inventoryIngredients.active')}
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/12 bg-white/10 px-2 py-0.5 text-xs font-medium text-muted2">
                            {t('inventoryIngredients.inactive')}
                          </span>
                        )}
                        {ingredient.is_low_stock ? (
                          <span className="rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy">
                            {t('inventoryIngredients.lowStockBadge')}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-muted">
                        {t('inventoryIngredients.stockLine', {
                          current: ingredient.current_quantity,
                          threshold: ingredient.low_stock_threshold,
                          unit: ingredient.unit,
                        })}
                      </p>
                      <p className="mt-1 text-sm text-muted2">
                        {t('inventoryIngredients.targetLine', {
                          target: ingredient.target_quantity ?? ingredient.low_stock_threshold,
                          unit: ingredient.unit,
                        })}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <LiquidButton tone="tertiary" onClick={() => handleStartEdit(ingredient)} className="px-3 py-1.5 text-xs">
                        {t('inventoryIngredients.edit')}
                      </LiquidButton>
                      <LiquidButton
                        tone={ingredient.is_active ? 'secondary' : 'primary'}
                        onClick={() => handleToggleActive(ingredient)}
                        className="px-3 py-1.5 text-xs"
                      >
                        {ingredient.is_active ? t('inventoryIngredients.deactivate') : t('inventoryIngredients.activate')}
                      </LiquidButton>
                      <LiquidButton tone="primary" onClick={() => handleOpenAction(ingredient.id, 'restock')} className="px-3 py-1.5 text-xs">
                        {t('inventoryIngredients.restock')}
                      </LiquidButton>
                      <LiquidButton tone="tertiary" onClick={() => handleOpenAction(ingredient.id, 'adjust')} className="px-3 py-1.5 text-xs">
                        {t('inventoryIngredients.adjust')}
                      </LiquidButton>
                    </div>
                  </div>

                  {isActionOpen ? (
                    <div className="mt-4 rounded-[20px] border border-white/10 bg-black/10 p-4">
                      <p className="text-sm font-semibold text-text">
                        {actionState.type === 'restock'
                          ? t('inventoryIngredients.restockIngredient', { name: formatIngredientName(ingredient.name) })
                          : t('inventoryIngredients.adjustIngredient', { name: formatIngredientName(ingredient.name) })}
                      </p>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">
                            {actionState.type === 'restock' ? t('inventoryIngredients.fields.quantityToAdd') : t('inventoryIngredients.fields.adjustmentDelta')}
                          </label>
                          <GlassInput
                            type="number"
                            step="0.001"
                            value={actionState.quantity}
                            onChange={(event) => setActionState((current) => ({ ...current, quantity: event.target.value }))}
                            disabled={submittingAction}
                            placeholder={actionState.type === 'restock' ? '10.000' : '-2.500 / +2.500'}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">
                            {t('inventoryIngredients.fields.reference')}
                          </label>
                          <GlassInput
                            value={actionState.reference}
                            onChange={(event) => setActionState((current) => ({ ...current, reference: event.target.value }))}
                            disabled={submittingAction}
                            placeholder={t('inventoryIngredients.referencePlaceholder')}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted2">
                            {t('inventoryIngredients.fields.notes')}
                          </label>
                          <GlassInput
                            value={actionState.notes}
                            onChange={(event) => setActionState((current) => ({ ...current, notes: event.target.value }))}
                            disabled={submittingAction}
                            placeholder={t('inventoryIngredients.notesPlaceholder')}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <LiquidButton tone="primary" onClick={handleSubmitAction} disabled={submittingAction}>
                          {submittingAction ? t('inventoryIngredients.processing') : t('inventoryIngredients.submitAction')}
                        </LiquidButton>
                        <LiquidButton tone="tertiary" onClick={handleCloseAction} disabled={submittingAction}>
                          {t('common.close')}
                        </LiquidButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {globalImportModalOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-[28px] border border-white/15 bg-bg1 p-5 shadow-lux2 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('inventoryIngredients.importGlobal.eyebrow')}</p>
                <h3 className="mt-2 text-xl font-semibold text-text">{t('inventoryIngredients.importGlobal.title')}</h3>
                <p className="mt-2 text-sm text-muted">{t('inventoryIngredients.importGlobal.description')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LiquidButton tone="tertiary" onClick={handleClearGlobalSelection} disabled={importingGlobalIngredients}>
                  {t('inventoryIngredients.importGlobal.clearSelection')}
                </LiquidButton>
                <LiquidButton tone="tertiary" onClick={handleCloseGlobalImportModal} disabled={importingGlobalIngredients}>
                  {t('common.close')}
                </LiquidButton>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <GlassInput
                value={globalImportSearch}
                onChange={(event) => setGlobalImportSearch(event.target.value)}
                placeholder={t('inventoryIngredients.importGlobal.searchPlaceholder')}
                leftSlot={<span>⌕</span>}
                disabled={globalIngredientsLoading || importingGlobalIngredients}
              />
              <label className="inline-flex items-center gap-2 rounded-[16px] border border-white/12 bg-white/6 px-3 py-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={hideAlreadyAddedGlobals}
                  onChange={(event) => setHideAlreadyAddedGlobals(event.target.checked)}
                  disabled={importingGlobalIngredients}
                />
                {t('inventoryIngredients.importGlobal.hideAdded')}
              </label>
              <LiquidButton
                tone="tertiary"
                onClick={handleSelectVisibleGlobals}
                disabled={importingGlobalIngredients || filteredGlobalImportRows.filter((row) => row.isSelectable).length === 0}
              >
                {t('inventoryIngredients.importGlobal.selectVisible')}
              </LiquidButton>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-muted">
              <p>{t('inventoryIngredients.importGlobal.selectedCount', { count: selectedGlobalIngredientsCount })}</p>
              <LiquidButton
                tone="primary"
                onClick={() => void handleImportSelectedGlobals()}
                disabled={importingGlobalIngredients || selectedGlobalIngredientsCount === 0}
              >
                {importingGlobalIngredients
                  ? t('inventoryIngredients.importGlobal.importing')
                  : t('inventoryIngredients.importGlobal.importSelected')}
              </LiquidButton>
            </div>

            {globalIngredientsLoading ? (
              <div className="mt-5 rounded-[20px] border border-white/12 bg-white/6 p-6 text-center text-sm text-muted">
                {t('inventoryIngredients.importGlobal.loading')}
              </div>
            ) : filteredGlobalImportRows.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-white/12 bg-white/6 p-6 text-center text-sm text-muted">
                {t('inventoryIngredients.importGlobal.empty')}
              </div>
            ) : (
              <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {filteredGlobalImportRows.map(({ globalIngredient, status, isSelectable }) => {
                  const isChecked = selectedGlobalIngredientIds.includes(globalIngredient.id);
                  const imageUrl = resolveAssetUrl(globalIngredient.image_url || globalIngredient.file_url || null);
                  const statusClasses = status === 'already_added'
                    ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700'
                    : status === 'will_link'
                      ? 'border-sky-300/70 bg-sky-50 text-sky-700'
                      : 'border-gold/40 bg-gold/12 text-gold2';

                  return (
                    <div key={globalIngredient.id} className="rounded-[20px] border border-white/12 bg-white/6 p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isSelectable || importingGlobalIngredients}
                          onChange={() => handleToggleGlobalSelection(globalIngredient.id)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                        />

                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-white/10">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={getIngredientDisplayName(globalIngredient, i18n.resolvedLanguage)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted2">
                              {t('inventoryIngredients.importGlobal.noImage')}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-text">
                              {getIngredientDisplayName(globalIngredient, i18n.resolvedLanguage)}
                            </p>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClasses}`}>
                              {t(`inventoryIngredients.importGlobal.status.${status}`)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted2">{globalIngredient.normalized_name}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {reorderModalOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/15 bg-bg1 p-5 shadow-lux2 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('inventoryIngredients.reorder.eyebrow')}</p>
                <h3 className="mt-2 text-xl font-semibold text-text">{t('inventoryIngredients.reorder.title')}</h3>
                <p className="mt-2 text-sm text-muted">{t('inventoryIngredients.reorder.description')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LiquidButton
                  tone="secondary"
                  onClick={handleCreateRestockDraft}
                  disabled={reorderRows.length === 0}
                >
                  {t('inventoryIngredients.reorder.createDraft')}
                </LiquidButton>
                <LiquidButton tone="tertiary" onClick={() => setReorderModalOpen(false)}>
                  {t('common.close')}
                </LiquidButton>
              </div>
            </div>

            {reorderRows.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-white/12 bg-white/6 p-6 text-center text-sm text-muted">
                {t('inventoryIngredients.reorder.noneMissing')}
              </div>
            ) : (
              <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {reorderRows.map(({ ingredient, missing, target, current }) => (
                  <div key={ingredient.id} className="rounded-[20px] border border-white/12 bg-white/6 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-text">{formatIngredientName(ingredient.name, ingredient.name_ar)}</p>
                      <span className="rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy">
                        {t('inventoryIngredients.reorder.missingAmount', { missing: missing.toFixed(3), unit: ingredient.unit })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted2">
                      {t('inventoryIngredients.reorder.detailLine', {
                        target: target.toFixed(3),
                        current: current.toFixed(3),
                        unit: ingredient.unit,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {restockDraftRows.length > 0 ? (
              <div className="mt-5 rounded-[20px] border border-gold/35 bg-gold/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text">{t('inventoryIngredients.reorder.draftTitle')}</p>
                  <p className="text-xs text-muted2">{t('inventoryIngredients.reorder.draftHint')}</p>
                </div>

                <div className="mt-3 space-y-2">
                  {restockDraftRows.map((row) => (
                    <div key={row.ingredientId} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-white/10 bg-black/10 px-3 py-2">
                      <p className="text-sm text-text">
                        {row.name} • {row.quantity} {row.unit}
                      </p>
                      <LiquidButton tone="primary" className="px-3 py-1.5 text-xs" onClick={() => handleUseDraftRow(row)}>
                        {t('inventoryIngredients.reorder.useDraft')}
                      </LiquidButton>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminIngredientsPage;
