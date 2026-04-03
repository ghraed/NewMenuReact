import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api from '../services/api';
import { GlassCard, GlassInput, GlassPill, LiquidButton } from '../components/ui/liquid-glass';
import DishAssetThumbnail from '../components/Common/DishAssetThumbnail';
import { useAuth } from '../contexts/useAuth';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

type DishFilter = 'all' | 'active' | 'deleted';

const AdminDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<DishFilter>('all');
  const [restaurantName, setRestaurantName] = useState(user?.restaurant?.name ?? '');
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [savingRestaurantName, setSavingRestaurantName] = useState(false);
  const [openMenuDishId, setOpenMenuDishId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRestaurantName(user?.restaurant?.name ?? '');
  }, [user?.restaurant?.name]);

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
      const params =
        filter === 'active'
          ? { include_deleted: '0' }
          : filter === 'deleted'
            ? { only_deleted: '1' }
            : { include_deleted: '1' };

      const response = await api.get('/dishes', { params });
      const payload = response.data;
      const items = Array.isArray(payload?.data) ? payload.data : payload;
      setDishes(items || []);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to load dishes'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
      alert(getErrorMessage(err, `Failed to ${action} dish`));
    }
  };

  const handleDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      `Delete "${dish.name}"?\n\nThis is a soft delete. You can restore it later.\n\nIts 3D model files will be removed after 7 days if you do not restore the dish or permanently delete it.`
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}`);
      setNotice(response?.data?.message || `Dish "${dish.name}" moved to deleted state.`);
      setOpenMenuDishId(null);
      fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to delete dish'));
    }
  };

  const handleRestore = async (dish: Dish) => {
    try {
      const response = await api.post(`/dishes/${dish.id}/restore`);
      setNotice(response?.data?.message || `Dish "${dish.name}" restored.`);
      setOpenMenuDishId(null);
      fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to restore dish'));
    }
  };

  const handlePermanentDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      `Permanently delete "${dish.name}"?\n\nThis action cannot be undone. The dish and all related model files will be removed forever.`
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}/force`);
      setNotice(response?.data?.message || `Dish "${dish.name}" permanently deleted.`);
      setOpenMenuDishId(null);
      fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to permanently delete dish'));
    }
  };

  const handleRestaurantNameUpdate = async () => {
    setRestaurantError(null);
    const nextName = restaurantName.trim();
    const currentName = user?.restaurant?.name?.trim() ?? '';

    if (!nextName) {
      setRestaurantError('Restaurant name is required.');
      return;
    }

    if (nextName === currentName) {
      setRestaurantError('No changes to save.');
      return;
    }

    const confirmed = window.confirm(`Change restaurant name from "${currentName}" to "${nextName}"?`);
    if (!confirmed) return;

    setSavingRestaurantName(true);
    try {
      const response = await api.patch('/restaurant/name', { name: nextName });
      setRestaurantName(response.data?.restaurant?.name ?? nextName);
      setNotice(response.data?.message || 'Restaurant name updated.');
      await refreshUser();
    } catch (err: unknown) {
      setRestaurantError(getErrorMessage(err, 'Failed to update restaurant name'));
    } finally {
      setSavingRestaurantName(false);
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-text">Your Dishes 123</h2>
        <Link to="/admin/dishes/create">
          <LiquidButton tone="primary">
            <span>➕</span> Create New Dish
          </LiquidButton>
        </Link>
      </div>

      <GlassCard className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted2">Restaurant Name</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <GlassInput
            value={restaurantName}
            onChange={(event) => setRestaurantName(event.target.value)}
            placeholder="Restaurant name"
            disabled={savingRestaurantName}
          />
          <LiquidButton
            tone="primary"
            onClick={handleRestaurantNameUpdate}
            disabled={savingRestaurantName}
            className="w-full sm:w-auto"
          >
            {savingRestaurantName ? 'Saving...' : 'Save Name'}
          </LiquidButton>
        </div>
        {restaurantError && <p className="mt-2 text-sm text-spicy">{restaurantError}</p>}
      </GlassCard>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <GlassPill active={filter === 'all'} onClick={() => setFilter('all')}>All</GlassPill>
        <GlassPill active={filter === 'active'} onClick={() => setFilter('active')}>Active</GlassPill>
        <GlassPill active={filter === 'deleted'} onClick={() => setFilter('deleted')}>Deleted</GlassPill>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl2 border border-sage/40 bg-sage/10 p-3 text-sm text-sage">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted">Loading dishes...</div>
      ) : error ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 py-12 text-center text-spicy">{error}</div>
      ) : dishes.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">📭</div>
          <h3 className="mb-2 text-xl font-medium text-text">No dishes yet</h3>
          <p className="mb-4 text-muted">Create your first dish to get started</p>
          <Link to="/admin/dishes/create">
            <LiquidButton tone="primary">Create Dish</LiquidButton>
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
                        <span>{dish.category}</span>
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
                            Model Processing
                          </span>
                        )}
                        {dish.model_state === 'error' && (
                          <span className="inline-flex items-center rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy">
                            Model Error
                          </span>
                        )}
                        {dish.deleted_at && (
                          <span className="inline-flex items-center rounded-full border border-gold/35 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold2">
                            Deleted
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
                          Restore
                        </LiquidButton>
                        <LiquidButton tone="secondary" onClick={() => handlePermanentDelete(dish)} className="w-full px-3 py-1.5 text-xs">
                          Delete Permanently
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
                            Publish
                          </LiquidButton>
                        )}
                        <div className="relative" ref={openMenuDishId === dish.id ? actionMenuRef : null}>
                          <button
                            type="button"
                            aria-label={`More actions for ${dish.name}`}
                            aria-expanded={openMenuDishId === dish.id}
                            onClick={() => setOpenMenuDishId((current) => (current === dish.id ? null : dish.id))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-text transition hover:border-gold/40 hover:bg-white/10"
                          >
                            ⋯
                          </button>
                          {openMenuDishId === dish.id && (
                            <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-2xl border border-white/10 bg-panel/95 p-1 shadow-2xl backdrop-blur-xl">
                              {dish.status === 'published' && (
                                <button
                                  type="button"
                                  onClick={() => handlePublishToggle(dish)}
                                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-text transition hover:bg-white/10"
                                >
                                  Unpublish
                                </button>
                              )}
                              <Link
                                to={`/admin/dishes/${dish.id}/edit`}
                                className="block rounded-xl px-3 py-2 text-sm text-text transition hover:bg-white/10"
                                onClick={() => setOpenMenuDishId(null)}
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(dish)}
                                className="w-full rounded-xl px-3 py-2 text-left text-sm text-spicy transition hover:bg-spicy/10"
                              >
                                Delete
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
    </DashboardLayout>
  );
};

export default AdminDashboard;
