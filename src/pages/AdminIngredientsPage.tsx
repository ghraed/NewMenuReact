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
import type { InventoryIngredient, IngredientStockUnit } from '../types';
import { translateIngredientLabel } from '../i18n/ingredients';

interface IngredientPayload {
  name: string;
  unit: IngredientStockUnit;
  current_quantity: string;
  low_stock_threshold: string;
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

const defaultIngredientPayload: IngredientPayload = {
  name: '',
  unit: 'piece',
  current_quantity: '0.000',
  low_stock_threshold: '0.000',
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

  const formatIngredientName = useCallback(
    (name?: string, nameArabic?: string | null) => translateIngredientLabel(name, i18n.resolvedLanguage, nameArabic),
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

  const handleOpenAction = (ingredientId: number, type: InventoryActionType) => {
    setActionState({
      ...defaultActionState(type),
      ingredientId,
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
        label: translateIngredientLabel(name, i18n.resolvedLanguage),
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

  return (
    <DashboardLayout title={t('inventoryIngredients.pageTitle')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('inventoryIngredients.inventoryEyebrow')}</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">{t('inventoryIngredients.heading')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t('inventoryIngredients.description')}</p>
        </div>

        <LiquidButton tone="tertiary" onClick={fetchIngredients} disabled={loading}>
          {loading ? t('common.loading') : t('inventoryIngredients.refresh')}
        </LiquidButton>
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

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminIngredientsPage;
