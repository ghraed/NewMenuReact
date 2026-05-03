import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api from '../services/api';
import { GlassCard, GlassPill, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import DishAssetThumbnail from '../components/Common/DishAssetThumbnail';
import { translateCategoryLabel } from '../i18n/dynamic';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

type DishFilter = 'all' | 'active' | 'deleted';

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
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DishFilter>('all');
  const [openMenuDishId, setOpenMenuDishId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenMenuDishId(null);
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
      `Delete "${dish.name}"?\n\nThis is a soft delete. You can restore it later.\n\nIts 3D model files will be removed after 7 days if you do not restore the dish or permanently delete it.`
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}`);
      showToast(response?.data?.message || `Dish "${dish.name}" moved to deleted state.`, 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedDelete')));
    }
  };

  const handleRestore = async (dish: Dish) => {
    try {
      const response = await api.post(`/dishes/${dish.id}/restore`);
      showToast(response?.data?.message || `Dish "${dish.name}" restored.`, 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedRestore')));
    }
  };

  const handlePermanentDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      `Permanently delete "${dish.name}"?\n\nThis action cannot be undone. The dish and all related model files will be removed forever.`
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}/force`);
      showToast(response?.data?.message || `Dish "${dish.name}" permanently deleted.`, 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedPermanentDelete')));
    }
  };

  return (
    <DashboardLayout title={t('admin.dashboard')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-text">{t('adminDashboard.yourDishes')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/admin/profile">
            <LiquidButton tone="tertiary">
              <span>🏷️</span> {t('adminDashboard.profileTitle')}
            </LiquidButton>
          </Link>
          <Link to="/admin/accounting">
            <LiquidButton tone="tertiary">
              <span>💳</span> {t('admin.accounting')}
            </LiquidButton>
          </Link>
          <Link to="/admin/staff">
            <LiquidButton tone="secondary">
              <span>👥</span> {t('adminDashboard.manageStaff')}
            </LiquidButton>
          </Link>
          <Link to="/admin/dishes/create">
            <LiquidButton tone="primary">
              <span>➕</span> {t('createDish.pageTitle')}
            </LiquidButton>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <GlassPill active={filter === 'all'} onClick={() => setFilter('all')}>{t('menuList.allCategories')}</GlassPill>
        <GlassPill active={filter === 'active'} onClick={() => setFilter('active')}>{t('admin.active')}</GlassPill>
        <GlassPill active={filter === 'deleted'} onClick={() => setFilter('deleted')}>{t('adminDashboard.deleted')}</GlassPill>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted">{t('adminDashboard.loadingDishes')}</div>
      ) : error ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 py-12 text-center text-spicy">{error}</div>
      ) : dishes.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">📭</div>
          <h3 className="mb-2 text-xl font-medium text-text">{t('adminDashboard.noDishesYet')}</h3>
          <p className="mb-4 text-muted">{t('adminDashboard.noDishesDescription')}</p>
          <Link to="/admin/dishes/create">
            <LiquidButton tone="primary">{t('createDish.submit')}</LiquidButton>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {dishes.map((dish) => (
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
                            aria-label={`More actions for ${dish.name}`}
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
