import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import '@google/model-viewer';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import api, { resolveAssetUrl } from '../services/api';
import type { Dish, InventoryIngredient } from '../types';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';

const guestRestaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const getAssetFileName = (asset?: Dish['assets'][number]) => {
  if (!asset) return null;

  const metaFileName = asset.metadata?.file_name;
  if (typeof metaFileName === 'string' && metaFileName.trim()) {
    return metaFileName;
  }

  const rawUrl = asset.file_url;
  if (!rawUrl) return null;

  try {
    const pathname = new URL(rawUrl, window.location.origin).pathname;
    const fileName = pathname.split('/').filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : rawUrl;
  } catch {
    const fileName = rawUrl.split('/').filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : rawUrl;
  }
};

const extractDishOptions = (payload: unknown): Dish[] => {
  if (Array.isArray(payload)) {
    return payload as Dish[];
  }

  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const items = (payload as { data?: unknown }).data;
    if (Array.isArray(items)) {
      return items as Dish[];
    }

    if (typeof items === 'object' && items !== null && 'data' in items) {
      const nestedItems = (items as { data?: unknown }).data;
      return Array.isArray(nestedItems) ? (nestedItems as Dish[]) : [];
    }

    return [];
  }

  return [];
};

const EditDishPage: React.FC = () => {
  const { dish_id } = useParams<{ dish_id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [dish, setDish] = useState<Dish | null>(null);
  const [recipeIngredientOptions, setRecipeIngredientOptions] = useState<InventoryIngredient[]>([]);
  const [suggestedDishOptions, setSuggestedDishOptions] = useState<Dish[]>([]);
  const [relatedDishOptions, setRelatedDishOptions] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);

  useEffect(() => {
    const fetchDish = async () => {
      if (!dish_id) return;

      try {
        const [dishResult, inventoryIngredientsResult, suggestedOptionsResult] = await Promise.allSettled([
          api.get(`/dishes/${dish_id}`),
          api.get('/inventory/ingredients'),
          api.get('/dishes', {
            params: {
              include_deleted: '1',
              per_page: '200',
            },
          }),
        ]);

        if (dishResult.status === 'rejected') {
          throw dishResult.reason;
        }

        setDish(dishResult.value.data);

        if (inventoryIngredientsResult.status === 'fulfilled') {
          const payload = inventoryIngredientsResult.value.data;
          setRecipeIngredientOptions(Array.isArray(payload?.ingredients) ? payload.ingredients : []);
        } else {
          console.error(inventoryIngredientsResult.reason);
          setRecipeIngredientOptions([]);
        }

        if (suggestedOptionsResult.status === 'fulfilled') {
          const options = extractDishOptions(suggestedOptionsResult.value.data);
          setSuggestedDishOptions(options);
          setRelatedDishOptions(options);
        } else {
          console.error(suggestedOptionsResult.reason);
          setSuggestedDishOptions([]);
          setRelatedDishOptions([]);
        }
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
    if (!dish_id || !dish) return;

    setError(null);

    try {
        await api.patch(`/dishes/${dish_id}`, {
        name: data.name,
        price: parseFloat(data.price),
        calories: data.calories.trim() ? Number(data.calories) : null,
        category: data.category,
        status: data.status,
        is_anchor: data.is_anchor,
        suggested_dish_ids: data.suggested_dish_ids,
        related_dish_ids: data.related_dish_ids,
        recipe_ingredients: data.recipe_ingredients.map((recipeItem) => ({
          ingredient_id: recipeItem.ingredient_id,
          quantity_required: Number(recipeItem.quantity_required),
          order_index: recipeItem.order_index,
          show_in_animation: recipeItem.show_in_animation,
        })),
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

      if (data.preview_file) {
        const previewPayload = new FormData();
        previewPayload.append('file', data.preview_file);
        previewPayload.append('type', 'preview_image');
        await api.post(`/dishes/${dish_id}/assets`, previewPayload, {
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
      <DashboardLayout title={t('adminDish.editDish')}>
        <LoadingSpinner text="Loading dish..." />
      </DashboardLayout>
    );
  }

  if (!dish) {
    return (
      <DashboardLayout title={t('adminDish.editDish')}>
        <div className="py-10 text-center text-spicy">Dish not found</div>
      </DashboardLayout>
    );
  }

  const glbAsset = dish.assets.find((asset) => asset.asset_type === 'glb');
  const usdzAsset = dish.assets.find((asset) => asset.asset_type === 'usdz');
  const previewAsset = dish.assets.find((asset) => asset.asset_type === 'preview_image');
  const glbUrl = resolveAssetUrl(glbAsset?.file_url);
  const usdzUrl = resolveAssetUrl(usdzAsset?.file_url);
  const previewAssetUrl = resolveAssetUrl(previewAsset?.file_url);
  const previewFileName = getAssetFileName(previewAsset);
  const glbFileName = getAssetFileName(glbAsset);
  const usdzFileName = getAssetFileName(usdzAsset);
  const ModelViewer = 'model-viewer' as React.ElementType;

  return (
    <DashboardLayout title={t('adminDish.editDish')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">{dish.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {dish.deleted_at
              ? 'This dish is deleted. Restore it before editing.'
              : t('adminDish.updateDetailsOptionalModels')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/menu/${guestRestaurantSlug}/dish/${dish.id}`} target="_blank">
            <LiquidButton tone="tertiary" className="px-3 py-2 text-sm">{t('adminDish.openGuestView')}</LiquidButton>
          </Link>
          {dish.deleted_at ? (
            <>
              <LiquidButton onClick={handleRestore} disabled={restoring} tone="tertiary">
                {restoring ? 'Restoring...' : 'Restore Dish'}
              </LiquidButton>
              <LiquidButton onClick={handlePermanentDelete} disabled={forceDeleting} tone="secondary">
                {forceDeleting ? 'Deleting...' : 'Delete Permanently'}
              </LiquidButton>
            </>
          ) : (
            <LiquidButton onClick={handleDelete} disabled={deleting} tone="secondary">
              {deleting ? 'Deleting...' : t('adminDish.deleteDish')}
            </LiquidButton>
          )}
        </div>
      </div>

      {dish.deleted_at && (
        <div className="mb-6 rounded-xl2 border border-gold/35 bg-gold/10 p-4 text-gold2">
          This dish is currently deleted. If you do not restore it, model files are automatically removed after 7 days.
        </div>
      )}

      {dish.model_state === 'processing' && (
        <div className="mb-6 rounded-xl2 border border-sky-400/35 bg-sky-400/10 p-4 text-sky-200">
          This dish was created, but its 3D model is still processing. It stays out of the guest menu until the GLB is ready.
        </div>
      )}

      {dish.model_state === 'error' && (
        <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">
          Model generation failed for this dish. You can upload replacement assets here or rescan it from mobile.
        </div>
      )}

      <GlassCard className="mb-6 p-4">
        <h3 className="mb-3 text-lg font-semibold text-text">{t('adminDish.currentModelPreview')}</h3>
        {glbUrl ? (
          <ModelViewer
            src={glbUrl}
            ios-src={usdzUrl}
            camera-controls
            camera-target="auto auto auto"
            camera-orbit="0deg 75deg auto"
            min-camera-orbit="auto auto auto"
            max-camera-orbit="auto auto auto"
            field-of-view="26deg"
            bounds="tight"
            shadow-intensity="0"
            environment-image="neutral"
            style={{ width: '100%', height: '340px', backgroundColor: '#0f1424', borderRadius: '0.75rem' }}
          />
        ) : (
          <div className="rounded-xl2 border border-gold/35 bg-gold/10 p-4 text-gold2">
            {dish.model_state === 'processing'
              ? 'No GLB model is attached yet because processing is still in progress.'
              : 'No GLB model is attached to this dish yet.'}
          </div>
        )}

        {glbUrl && !usdzUrl && (
          <div className="mt-3 rounded-xl2 border border-gold/35 bg-gold/10 p-4 text-sm text-gold2">
            Android/WebXR is available, but iPhone/iPad AR is not. Upload a USDZ file to enable Quick Look on iOS.
          </div>
        )}

        {!glbUrl && usdzUrl && (
          <div className="mt-3 rounded-xl2 border border-gold/35 bg-gold/10 p-4 text-sm text-gold2">
            iPhone/iPad AR is available, but Android/WebXR is not. Upload a GLB file to enable Scene Viewer and the web
            viewer.
          </div>
        )}

        <div className="mt-3 text-xs text-muted">
          {glbUrl && <div>GLB: {glbUrl}</div>}
          {usdzUrl && <div>USDZ: {usdzUrl}</div>}
        </div>
      </GlassCard>

      {error && <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>}

      {!dish.deleted_at && (
        <DishForm
          key={dish.id}
          onSubmit={handleUpdate}
          initialValues={{
            name: dish.name,
            category: dish.category,
            status: dish.status,
            is_anchor: dish.is_anchor === true,
            price: String(dish.price),
            calories: dish.calories !== null && dish.calories !== undefined ? String(dish.calories) : '',
            suggested_dish_ids: (dish.suggested_dishes || []).map((suggestedDish) => suggestedDish.id),
            related_dish_ids: (dish.related_dishes || []).map((relatedDish) => relatedDish.id),
            recipe_ingredients: (dish.dish_ingredients || []).map((dishIngredient) => ({
              ingredient_id: dishIngredient.ingredient_id,
              quantity_required: String(dishIngredient.quantity),
              order_index: typeof dishIngredient.order_index === 'number' ? dishIngredient.order_index : 0,
              show_in_animation: dishIngredient.show_in_animation !== false,
            })),
          }}
          existingFiles={{
            glb: glbFileName,
            usdz: usdzFileName,
            previewImage: previewFileName,
            previewImageUrl: previewAssetUrl || null,
            imageUrl: dish.image_url || null,
          }}
          recipeIngredientOptions={recipeIngredientOptions}
          suggestedDishOptions={suggestedDishOptions}
          relatedDishOptions={relatedDishOptions}
          requireModelUpload={false}
          submitLabel={t('adminDish.updateDish')}
          submittingLabel="Updating..."
        />
      )}
    </DashboardLayout>
  );
};

export default EditDishPage;
