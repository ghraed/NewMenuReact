import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@google/model-viewer';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api, { resolveAssetUrl } from '../services/api';
import { GlassChip, GlassSurface, LiquidButton } from '../components/ui/liquid-glass';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

type DishFilter = 'all' | 'active' | 'deleted';

const DishModelThumbnail: React.FC<{ dish: Dish }> = ({ dish }) => {
  const glbAsset = dish.assets.find((asset) => asset.asset_type === 'glb');
  const glbUrl = resolveAssetUrl(glbAsset?.file_url);
  const imageUrl = dish.image_url || undefined;
  const ModelViewer = 'model-viewer' as React.ElementType;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={dish.name}
        className="h-12 w-12 rounded-lg border border-white/45 object-cover"
      />
    );
  }

  if (glbUrl) {
    return (
      <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/45 bg-white/35">
        <ModelViewer
          src={glbUrl}
          interaction-prompt="none"
          disable-zoom
          camera-orbit="0deg 75deg 1.7m"
          min-camera-orbit="auto auto 1.7m"
          max-camera-orbit="auto auto 1.7m"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/45 bg-white/35">
      🍽️
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<DishFilter>('all');

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
      fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to delete dish'));
    }
  };

  const handleRestore = async (dish: Dish) => {
    try {
      const response = await api.post(`/dishes/${dish.id}/restore`);
      setNotice(response?.data?.message || `Dish "${dish.name}" restored.`);
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
      fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to permanently delete dish'));
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-lg-text">Your Dishes</h2>
        <Link
          to="/admin/dishes/create"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/55 bg-white/40 px-5 py-2.5 font-semibold text-lg-text shadow-glass-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-glow-primary"
        >
          <span>➕</span> Create New Dish
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <GlassChip active={filter === 'all'} onClick={() => setFilter('all')}>All</GlassChip>
        <GlassChip active={filter === 'active'} onClick={() => setFilter('active')}>Active</GlassChip>
        <GlassChip active={filter === 'deleted'} onClick={() => setFilter('deleted')}>Deleted</GlassChip>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-blue-200/80 bg-blue-100/55 p-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      {loading ? (
        <GlassSurface className="py-12 text-center text-lg-muted">Loading dishes...</GlassSurface>
      ) : error ? (
        <div className="rounded-xl border border-red-200/80 bg-red-100/60 py-12 text-center text-red-700">{error}</div>
      ) : dishes.length === 0 ? (
        <GlassSurface className="py-12 text-center">
          <div className="mb-4 text-5xl">📭</div>
          <h3 className="mb-2 text-xl font-medium text-lg-text">No dishes yet</h3>
          <p className="mb-4 text-lg-muted">Create your first dish to get started</p>
          <Link
            to="/admin/dishes/create"
            className="inline-flex items-center rounded-2xl border border-white/55 bg-white/40 px-5 py-2.5 font-semibold text-lg-text shadow-glass-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-glow-primary"
          >
            Create Dish
          </Link>
        </GlassSurface>
      ) : (
        <GlassSurface className="overflow-x-auto" sheen={false}>
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/50 bg-white/25 text-left text-xs uppercase tracking-wide text-lg-muted">
              <tr>
                <th className="px-6 py-3">Dish</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => (
                <tr key={dish.id} className="border-b border-white/35 text-lg-text last:border-b-0 hover:bg-white/30">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link to={`/admin/dishes/${dish.id}/edit`} className="flex items-center hover:opacity-85">
                      <div className="flex-shrink-0">
                        <DishModelThumbnail dish={dish} />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-lg-text">{dish.name}</div>
                        <div className="text-xs text-lg-muted">{dish.category}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-semibold">${Number(dish.price).toFixed(2)}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dish.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {dish.status.charAt(0).toUpperCase() + dish.status.slice(1)}
                    </span>
                    {dish.deleted_at && (
                      <span className="ml-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Deleted</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {dish.deleted_at ? (
                        <>
                          <LiquidButton tone="tertiary" onClick={() => handleRestore(dish)} className="px-3 py-1.5 text-xs">
                            Restore
                          </LiquidButton>
                          <LiquidButton tone="secondary" onClick={() => handlePermanentDelete(dish)} className="px-3 py-1.5 text-xs">
                            Delete Permanently
                          </LiquidButton>
                        </>
                      ) : (
                        <>
                          <LiquidButton
                            tone={dish.status === 'published' ? 'secondary' : 'tertiary'}
                            onClick={() => handlePublishToggle(dish)}
                            className="px-3 py-1.5 text-xs"
                          >
                            {dish.status === 'published' ? 'Unpublish' : 'Publish'}
                          </LiquidButton>
                          <Link
                            to={`/admin/dishes/${dish.id}/edit`}
                            className="inline-flex items-center rounded-xl border border-white/50 bg-white/35 px-3 py-1.5 text-xs font-semibold text-lg-text shadow-glass-soft backdrop-blur-xl transition hover:bg-white/55"
                          >
                            Edit
                          </Link>
                          <LiquidButton tone="secondary" onClick={() => handleDelete(dish)} className="px-3 py-1.5 text-xs">
                            Delete
                          </LiquidButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassSurface>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
