import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api from '../services/api';
import { GlassCard, GlassInput, GlassPill, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import DishAssetThumbnail from '../components/Common/DishAssetThumbnail';
import { translateCategoryLabel } from '../i18n/dynamic';
import { MENU_CATEGORIES } from '../i18n/categories';
import { useAuth } from '../contexts/useAuth';
import { fetchRestaurantProfile, updateRestaurantMenuCategories } from '../services/restaurantProfileService';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

type DishFilter = 'all' | 'active' | 'deleted';
type ItemTypeFilter = 'all' | 'prepared_dish' | 'packaged_drink' | 'other_product';

interface DishListPayload {
  data?: unknown;
  current_page?: number;
  last_page?: number;
}

const parseDishListPage = (payload: unknown): { items: Dish[]; currentPage: number; lastPage: number } => {
  if (Array.isArray(payload)) {
    return { items: payload as Dish[], currentPage: 1, lastPage: 1 };
  }

  if (typeof payload !== 'object' || payload === null) {
    return { items: [], currentPage: 1, lastPage: 1 };
  }

  const pagePayload = payload as DishListPayload;
  const items = Array.isArray(pagePayload.data) ? (pagePayload.data as Dish[]) : [];
  const currentPage = Number.isFinite(pagePayload.current_page) ? Number(pagePayload.current_page) : 1;
  const lastPage = Number.isFinite(pagePayload.last_page) ? Number(pagePayload.last_page) : 1;

  return { items, currentPage, lastPage };
};

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DishFilter>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
  const [openMenuDishId, setOpenMenuDishId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const [menuCategories, setMenuCategories] = useState<string[]>(user?.restaurant?.menu_categories ?? []);
  const [savedMenuCategories, setSavedMenuCategories] = useState<string[]>(user?.restaurant?.menu_categories ?? []);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [savingCategories, setSavingCategories] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenMenuDishId(null);
      }
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setCategoryPickerOpen(false);
        setCategoryQuery('');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuDishId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setMenuCategories(user?.restaurant?.menu_categories ?? []);
    setSavedMenuCategories(user?.restaurant?.menu_categories ?? []);
  }, [user?.restaurant?.menu_categories]);

  useEffect(() => {
    let cancelled = false;

    void fetchRestaurantProfile()
      .then((response) => {
        const categories = response.restaurant?.menu_categories;
        if (!cancelled && Array.isArray(categories)) {
          setMenuCategories(categories);
          setSavedMenuCategories(categories);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDishes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseParams =
        filter === 'active'
          ? { include_deleted: '0' }
          : filter === 'deleted'
            ? { only_deleted: '1' }
            : { include_deleted: '1' };

      const perPage = 200;
      let currentPage = 1;
      let lastPage = 1;
      const allDishes: Dish[] = [];

      do {
        const response = await api.get('/dishes', {
          params: {
            ...baseParams,
            page: String(currentPage),
            per_page: String(perPage),
          },
        });

        const parsed = parseDishListPage(response.data);
        allDishes.push(...parsed.items);
        currentPage += 1;
        lastPage = parsed.lastPage;
      } while (currentPage <= lastPage);

      setDishes(allDishes);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, t('menuList.failedToLoad')));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  const visibleDishes = dishes.filter((dish) => {
    if (itemTypeFilter === 'all') return true;
    if (itemTypeFilter === 'prepared_dish') {
      return (dish.item_type || 'prepared_dish') === 'prepared_dish' || (dish.item_type || 'prepared_dish') === 'prepared_drink';
    }
    return (dish.item_type || 'prepared_dish') === itemTypeFilter;
  });

  const filteredCategoryOptions = MENU_CATEGORIES.filter((category) => {
    const query = categoryQuery.trim().toLowerCase();
    return query === ''
      || category.value.toLowerCase().includes(query)
      || category.arabic.includes(query);
  });

  const toggleMenuCategory = (category: string) => {
    setMenuCategories((current) => (
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category]
    ));
  };

  const saveMenuCategories = async () => {
    if (menuCategories.length === 0) {
      showToast('Select at least one menu category.', 'tertiary');
      return;
    }

    setSavingCategories(true);
    try {
      const response = await updateRestaurantMenuCategories(menuCategories);
      const saved = response.restaurant?.menu_categories ?? menuCategories;
      setMenuCategories(saved);
      setSavedMenuCategories(saved);
      showToast(response.message || 'Menu categories saved.', 'secondary');
      await refreshUser();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to save menu categories.'), 'tertiary');
    } finally {
      setSavingCategories(false);
    }
  };

  const handlePublishToggle = async (dish: Dish) => {
    const action = dish.status === 'published' ? 'unpublish' : 'publish';
    try {
      const response = await api.patch(`/dishes/${dish.id}/${action}`);
      const updated = response.data as Dish;
      setDishes((prev) => prev.map((item) => (item.id === dish.id ? updated : item)));
      setOpenMenuDishId(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err, t(`adminDashboard.failed${action === 'publish' ? 'Publish' : 'Unpublish'}`)));
    }
  };

  const handleDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      t('adminDashboard.confirmDelete', { dishName: dish.name })
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}`);
      showToast(response?.data?.message || t('adminDashboard.deletedToast', { dishName: dish.name }), 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedDelete')));
    }
  };

  const handleRestore = async (dish: Dish) => {
    try {
      const response = await api.post(`/dishes/${dish.id}/restore`);
      showToast(response?.data?.message || t('adminDashboard.restoredToast', { dishName: dish.name }), 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedRestore')));
    }
  };

  const handlePermanentDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      t('adminDashboard.confirmPermanentDelete', { dishName: dish.name })
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}/force`);
      showToast(response?.data?.message || t('adminDashboard.permanentlyDeletedToast', { dishName: dish.name }), 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedPermanentDelete')));
    }
  };

  return (
    <DashboardLayout title={t('admin.dashboard')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-text">{t('adminDashboard.yourMenuItems')}</h2>
      </div>

      <GlassCard className={`mb-6 overflow-visible ${categoryPickerOpen ? 'z-[100]' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text">Menu Categories</h3>
            <p className="mt-1 text-sm text-muted">Choose the categories available for this restaurant. Save them separately from the rest of the dashboard.</p>
          </div>
          <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-xs font-medium text-gold2">{menuCategories.length} selected</span>
        </div>

        <div className="mt-4 flex min-h-11 flex-wrap gap-2 rounded-xl2 border border-stroke bg-bg1/45 p-2">
          {menuCategories.length === 0 ? (
            <span className="px-2 py-1 text-sm text-muted">No categories selected.</span>
          ) : menuCategories.map((category) => {
            const definition = MENU_CATEGORIES.find((entry) => entry.value === category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleMenuCategory(category)}
                className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1.5 text-xs font-medium text-text transition hover:border-spicy/45"
              >
                {category}{definition ? ` • ${definition.arabic}` : ''}<span className="text-muted2">×</span>
              </button>
            );
          })}
        </div>

        <div ref={categoryMenuRef} className="relative mt-3">
          <button
            type="button"
            onClick={() => setCategoryPickerOpen((current) => !current)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl2 border border-stroke bg-bg1/65 px-4 py-2.5 text-left text-sm text-text transition hover:border-gold/35"
            aria-expanded={categoryPickerOpen}
          >
            <span>Search and select categories</span>
            <span className="text-muted2">{categoryPickerOpen ? '▴' : '▾'}</span>
          </button>

          {categoryPickerOpen ? (
            <div className="absolute z-[1200] mt-2 w-full overflow-hidden rounded-2xl border border-stroke bg-bg1 p-3 shadow-lux2">
              <GlassInput value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Search categories..." leftSlot={<span>⌕</span>} autoFocus />
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
                {filteredCategoryOptions.map((category) => {
                  const selected = menuCategories.includes(category.value);
                  return (
                    <button key={category.value} type="button" onClick={() => toggleMenuCategory(category.value)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${selected ? 'border-gold/35 bg-gold/12 text-text' : 'border-stroke bg-bg1/70 text-text hover:border-gold/25'}`}>
                      <span>{category.value}<span className="text-muted2"> • {category.arabic}</span></span>
                      <span className={selected ? 'text-gold2' : 'text-muted2'}>{selected ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <LiquidButton tone="tertiary" onClick={() => setMenuCategories(savedMenuCategories)} disabled={savingCategories}>Reset</LiquidButton>
          <LiquidButton tone="primary" onClick={() => void saveMenuCategories()} disabled={savingCategories || JSON.stringify(menuCategories) === JSON.stringify(savedMenuCategories)}>
            {savingCategories ? 'Saving categories...' : 'Save categories'}
          </LiquidButton>
        </div>
      </GlassCard>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <GlassPill active={filter === 'all'} onClick={() => setFilter('all')}>{t('menuList.allCategories')}</GlassPill>
        <GlassPill active={filter === 'active'} onClick={() => setFilter('active')}>{t('admin.active')}</GlassPill>
        <GlassPill active={filter === 'deleted'} onClick={() => setFilter('deleted')}>{t('adminDashboard.deleted')}</GlassPill>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <GlassPill active={itemTypeFilter === 'all'} onClick={() => setItemTypeFilter('all')}>{t('adminDashboard.itemTypes.all')}</GlassPill>
        <GlassPill active={itemTypeFilter === 'prepared_dish'} onClick={() => setItemTypeFilter('prepared_dish')}>{t('adminDashboard.itemTypes.preparedDishPlural')}</GlassPill>
        <GlassPill active={itemTypeFilter === 'packaged_drink'} onClick={() => setItemTypeFilter('packaged_drink')}>{t('adminDashboard.itemTypes.packagedDrinkPlural')}</GlassPill>
        <GlassPill active={itemTypeFilter === 'other_product'} onClick={() => setItemTypeFilter('other_product')}>{t('adminDashboard.itemTypes.otherProductPlural')}</GlassPill>
      </div>

      {loading ? (
        <div className="space-y-4 py-2" aria-live="polite" aria-busy="true" aria-label={t('adminDashboard.loadingDishes')}>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <GlassCard key={`admin-dish-skeleton-${index + 1}`} className="overflow-visible">
                <div className="animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 rounded-2xl border border-stroke bg-black/10 dark:bg-gold/30" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="h-5 w-2/3 rounded-full bg-black/12 dark:bg-gold/30" />
                          <div className="mt-2 h-3 w-1/2 rounded-full bg-black/12 dark:bg-gold/30" />
                        </div>
                        <div className="h-5 w-16 rounded-full bg-black/12 dark:bg-gold/30" />
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        <div className="h-8 w-24 rounded-full bg-black/12 dark:bg-gold/30" />
                        <div className="h-8 w-24 rounded-full bg-black/12 dark:bg-gold/30" />
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-text/80">{t('adminDashboard.loadingDishes')}</p>
        </div>
      ) : error ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 py-12 text-center text-spicy">{error}</div>
      ) : visibleDishes.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">📭</div>
          <h3 className="mb-2 text-xl font-medium text-text">{t('adminDashboard.noDishesYet')}</h3>
          <p className="mb-4 text-muted">{t('adminDashboard.noDishesDescription')}</p>
          <Link to="/admin/dishes/create">
            <LiquidButton tone="primary">{t('adminDashboard.createMenuItem')}</LiquidButton>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleDishes.map((dish) => (
            <GlassCard
              key={dish.id}
              className={openMenuDishId === dish.id ? 'z-50 overflow-visible' : 'overflow-visible'}
            >
              <div className="flex items-start gap-4">
                <DishAssetThumbnail dish={dish} className="h-20 w-20" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-text">{dish.name}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                        <span>{translateCategoryLabel(dish.category, dish.category_ar)}</span>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium text-muted2">
                          {(dish.item_type || 'prepared_dish') === 'packaged_drink'
                            ? t('adminDashboard.itemTypes.packagedDrink')
                            : (dish.item_type || 'prepared_dish') === 'other_product'
                              ? t('adminDashboard.itemTypes.otherProduct')
                              : (dish.item_type || 'prepared_dish') === 'prepared_drink'
                                ? t('adminDashboard.itemTypes.preparedDrink')
                                : t('adminDashboard.itemTypes.preparedDish')}
                        </span>
                        <span
                          className={
                            dish.status === 'published'
                              ? 'inline-flex items-center gap-1 rounded-full border border-sage/35 bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage'
                              : 'inline-flex items-center gap-1 rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy'
                          }
                        >
                          {dish.status === 'published' ? '✓' : '✕'}
                        </span>
                        {dish.model_state === 'processing' && (
                          <span className="inline-flex items-center rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-sky-200">
                            {t('adminDashboard.modelProcessing')}
                          </span>
                        )}
                        {dish.model_state === 'error' && (
                          <span className="inline-flex items-center rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy">
                            {t('adminDashboard.modelError')}
                          </span>
                        )}
                        {dish.deleted_at && (
                          <span className="inline-flex items-center rounded-full border border-gold/35 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold2">
                            {t('adminDashboard.deleted')}
                          </span>
                        )}
                        {(dish.item_type === 'packaged_drink' || dish.item_type === 'other_product') && (
                          <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-sky-200">
                            {t('adminDashboard.directStock', { quantity: dish.packaged_stock_quantity ?? '-' })}
                          </span>
                        )}
                        {((dish.item_type || 'prepared_dish') === 'prepared_dish' || (dish.item_type || 'prepared_dish') === 'prepared_drink') && (
                          <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold2">
                            {t('adminDashboard.recipeInventory')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-gold2">${Number(dish.price).toFixed(2)}</div>
                  </div>

                  <div className="mt-4">
                    {dish.deleted_at ? (
                      <div className="grid grid-cols-2 gap-2">
                        <LiquidButton tone="tertiary" onClick={() => handleRestore(dish)} className="w-full px-3 py-1.5 text-xs">
                          {t('adminDashboard.restore')}
                        </LiquidButton>
                        <LiquidButton tone="secondary" onClick={() => handlePermanentDelete(dish)} className="w-full px-3 py-1.5 text-xs">
                          {t('adminDashboard.deletePermanently')}
                        </LiquidButton>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {dish.status !== 'published' && (
                          <LiquidButton
                            tone="primary"
                            onClick={() => handlePublishToggle(dish)}
                            className="flex-1 px-3 py-1.5 text-xs"
                          >
                            {t('adminDashboard.publish')}
                          </LiquidButton>
                        )}
                        <div className="relative" ref={openMenuDishId === dish.id ? actionMenuRef : null}>
                          <button
                            type="button"
                            aria-label={t('adminDashboard.moreActions', { dishName: dish.name })}
                            aria-expanded={openMenuDishId === dish.id}
                            onClick={() => setOpenMenuDishId((current) => (current === dish.id ? null : dish.id))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-text transition hover:border-gold/30 hover:bg-white/10 hover:text-white"
                          >
                            ⋯
                          </button>
                          {openMenuDishId === dish.id && (
                            <div
                              className="absolute right-0 top-12 z-50 isolate w-44 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-2xl"
                              style={{ backgroundColor: 'rgb(var(--color-bg1))' }}
                            >
                              {dish.status === 'published' && (
                                <button
                                  type="button"
                                  onClick={() => handlePublishToggle(dish)}
                                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-text transition hover:bg-white/10"
                                >
                                  {t('adminDashboard.unpublish')}
                                </button>
                              )}
                              <Link
                                to={`/admin/dishes/${dish.id}/edit`}
                                className="block rounded-xl px-3 py-2 text-sm text-text transition hover:bg-white/10"
                                onClick={() => setOpenMenuDishId(null)}
                              >
                                {t('adminDashboard.edit')}
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(dish)}
                                className="w-full rounded-xl px-3 py-2 text-left text-sm text-spicy transition hover:bg-spicy/10"
                              >
                                {t('adminDashboard.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminDashboard;
