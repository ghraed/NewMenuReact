import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import '@google/model-viewer';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import api, { resolveAssetUrl } from '../services/api';
import type { Dish } from '../types';
import { GlassSurface, LiquidButton } from '../components/ui/liquid-glass';

const guestRestaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const EditDishPage: React.FC = () => {
  const { dish_id } = useParams<{ dish_id: string }>();
  const navigate = useNavigate();

  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);

  useEffect(() => {
    const fetchDish = async () => {
      if (!dish_id) return;

      try {
        const response = await api.get(`/dishes/${dish_id}`);
        setDish(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load dish');
      } finally {
        setLoading(false);
      }
    };

    fetchDish();
  }, [dish_id]);

  const handleUpdate = async (data: DishFormData) => {
    if (!dish_id) return;

    setError(null);

    try {
      await api.patch(`/dishes/${dish_id}`, {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        category: data.category,
        status: data.status,
        image_url: data.image_url || null,
      });

      if (data.glb_file) {
        const glbPayload = new FormData();
        glbPayload.append('file', data.glb_file);
        glbPayload.append('type', 'glb');
        await api.post(`/dishes/${dish_id}/assets`, glbPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (data.usdz_file) {
        const usdzPayload = new FormData();
        usdzPayload.append('file', data.usdz_file);
        usdzPayload.append('type', 'usdz');
        await api.post(`/dishes/${dish_id}/assets`, usdzPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update dish'));
    }
  };

  const handleDelete = async () => {
    if (!dish_id || !dish) return;
    const confirmed = window.confirm(
      `Delete "${dish.name}"?\n\nThis is a soft delete. You can restore it from the dashboard.\n\nModel files are automatically removed after 7 days if the dish stays deleted.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/dishes/${dish_id}`);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete dish'));
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!dish_id || !dish) return;
    setRestoring(true);
    setError(null);

    try {
      await api.post(`/dishes/${dish_id}/restore`);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to restore dish'));
    } finally {
      setRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!dish_id || !dish) return;
    const confirmed = window.confirm(
      `Permanently delete "${dish.name}"?\n\nThis cannot be undone and all related model files are removed forever.`
    );
    if (!confirmed) return;

    setForceDeleting(true);
    setError(null);

    try {
      await api.delete(`/dishes/${dish_id}/force`);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to permanently delete dish'));
    } finally {
      setForceDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Edit Dish">
        <LoadingSpinner />
      </DashboardLayout>
    );
  }

  if (!dish) {
    return (
      <DashboardLayout title="Edit Dish">
        <div className="text-center py-10 text-red-600">Dish not found</div>
      </DashboardLayout>
    );
  }

  const glbAsset = dish.assets.find((asset) => asset.asset_type === 'glb');
  const usdzAsset = dish.assets.find((asset) => asset.asset_type === 'usdz');
  const glbUrl = resolveAssetUrl(glbAsset?.file_url);
  const usdzUrl = resolveAssetUrl(usdzAsset?.file_url);
  const ModelViewer = 'model-viewer' as React.ElementType;

  return (
    <DashboardLayout title="Edit Dish">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-lg-text">{dish.name}</h2>
          <p className="mt-1 text-sm text-lg-muted">
            {dish.deleted_at
              ? 'This dish is deleted. Restore it before editing.'
              : 'Update details and optionally upload new model files.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/menu/${guestRestaurantSlug}/dish/${dish.id}`}
            target="_blank"
            className="rounded-xl border border-white/45 bg-white/30 px-3 py-2 text-sm text-lg-text backdrop-blur-xl transition hover:bg-white/55"
          >
            Open Guest View
          </Link>
          {dish.deleted_at ? (
            <>
              <LiquidButton
                onClick={handleRestore}
                disabled={restoring}
                tone="tertiary"
              >
                {restoring ? 'Restoring...' : 'Restore Dish'}
              </LiquidButton>
              <LiquidButton
                onClick={handlePermanentDelete}
                disabled={forceDeleting}
                tone="secondary"
              >
                {forceDeleting ? 'Deleting...' : 'Delete Permanently'}
              </LiquidButton>
            </>
          ) : (
            <LiquidButton
              onClick={handleDelete}
              disabled={deleting}
              tone="secondary"
            >
              {deleting ? 'Deleting...' : 'Delete Dish'}
            </LiquidButton>
          )}
        </div>
      </div>

      {dish.deleted_at && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          This dish is currently deleted. If you do not restore it, model files are automatically removed after 7 days.
        </div>
      )}

      <GlassSurface className="mb-6 p-4">
        <h3 className="mb-3 text-lg font-semibold text-lg-text">Current Model Preview</h3>
        {glbUrl ? (
          <ModelViewer
            src={glbUrl}
            ios-src={usdzUrl}
            camera-controls
            shadow-intensity="1"
            environment-image="neutral"
            style={{ width: '100%', height: '340px', backgroundColor: '#f3f4f6', borderRadius: '0.75rem' }}
          />
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
            No GLB model is attached to this dish yet.
          </div>
        )}

        <div className="mt-3 text-xs text-lg-muted">
          {glbUrl && <div>GLB: {glbUrl}</div>}
          {usdzUrl && <div>USDZ: {usdzUrl}</div>}
        </div>
      </GlassSurface>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!dish.deleted_at && (
        <DishForm
          key={dish.id}
          onSubmit={handleUpdate}
          initialValues={{
            name: dish.name,
            description: dish.description,
            category: dish.category,
            status: dish.status,
            image_url: dish.image_url || '',
            price: String(dish.price),
          }}
          requireModelUpload={false}
          submitLabel="Update Dish"
          submittingLabel="Updating..."
        />
      )}
    </DashboardLayout>
  );
};

export default EditDishPage;
