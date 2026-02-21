import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@google/model-viewer';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api, { resolveAssetUrl } from '../services/api';
import { GlassCard, GlassPill, LiquidButton } from '../components/ui/liquid-glass';

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
    return <img src={imageUrl} alt={dish.name} className="h-20 w-20 rounded-2xl border border-white/15 object-cover" />;
  }

  if (glbUrl) {
    return (
      <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-bg1/80">
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
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-bg1/80 text-lg text-muted">
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-text">Your Dishes</h2>
        <Link to="/admin/dishes/create">
          <LiquidButton tone="primary">
            <span>➕</span> Create New Dish
          </LiquidButton>
        </Link>
      </div>

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
            <GlassCard key={dish.id}>
              <div className="flex items-start gap-4">
                <DishModelThumbnail dish={dish} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-text">{dish.name}</h3>
                      <p className="text-sm text-muted">{dish.category}</p>
                    </div>
                    <div className="text-lg font-semibold text-gold2">${Number(dish.price).toFixed(2)}</div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <GlassPill className="px-3 py-1 text-xs" disabled>
                      {dish.status.charAt(0).toUpperCase() + dish.status.slice(1)}
                    </GlassPill>
                    {dish.deleted_at && <GlassPill className="px-3 py-1 text-xs" active>Deleted</GlassPill>}
                  </div>

                  <div className="mt-4 flex max-w-full flex-wrap items-center gap-2">
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
                        <Link to={`/admin/dishes/${dish.id}/edit`}>
                          <LiquidButton tone="tertiary" className="px-3 py-1.5 text-xs">Edit</LiquidButton>
                        </Link>
                        <LiquidButton tone="secondary" onClick={() => handleDelete(dish)} className="px-3 py-1.5 text-xs">
                          Delete
                        </LiquidButton>
                      </>
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
