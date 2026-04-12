import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import api from '../services/api';
import type { Dish } from '../types';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const uploadIngredientLayers = async (dishId: number, ingredientLayers: DishFormData['ingredient_layers']) => {
  for (const [index, ingredient] of ingredientLayers.entries()) {
    if (!ingredient.image_file) continue;

    const payload = new FormData();
    payload.append('type', 'ingredient_image');
    payload.append('file', ingredient.image_file);
    payload.append('label', ingredient.name);
    payload.append('order_index', String(index));

    if (ingredient.quantity) {
      payload.append('quantity', ingredient.quantity);
    }

    await api.post(`/dishes/${dishId}/assets`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
};

const extractDishOptions = (payload: unknown): Dish[] => {
  if (Array.isArray(payload)) {
    return payload as Dish[];
  }

  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const items = (payload as { data?: unknown }).data;
    return Array.isArray(items) ? (items as Dish[]) : [];
  }

  return [];
};

const CreateDishPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [suggestedDishOptions, setSuggestedDishOptions] = useState<Dish[]>([]);
  const [relatedDishOptions, setRelatedDishOptions] = useState<Dish[]>([]);

  useEffect(() => {
    const fetchSuggestedDishOptions = async () => {
      try {
        const response = await api.get('/dishes', {
          params: {
            include_deleted: '0',
            per_page: '200',
          },
        });

        const options = extractDishOptions(response.data);
        setSuggestedDishOptions(options);
        setRelatedDishOptions(options);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSuggestedDishOptions();
  }, []);

  const handleSubmit = async (dishData: DishFormData) => {
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', dishData.name);
      formData.append('name_ar', dishData.name_ar);
      formData.append('description', dishData.description);
      formData.append('description_ar', dishData.description_ar);
      formData.append('price', dishData.price);
      if (dishData.calories.trim()) formData.append('calories', dishData.calories.trim());
      formData.append('category', dishData.category);
      formData.append('category_ar', dishData.category_ar);
      formData.append('status', dishData.status);
      dishData.suggested_dish_ids.forEach((dishId) => {
        formData.append('suggested_dish_ids[]', String(dishId));
      });
      dishData.related_dish_ids.forEach((dishId) => {
        formData.append('related_dish_ids[]', String(dishId));
      });

      if (dishData.image_url) formData.append('image_url', dishData.image_url);
      if (dishData.glb_file) formData.append('glb_file', dishData.glb_file);
      if (dishData.usdz_file) formData.append('usdz_file', dishData.usdz_file);

      const response = await api.post('/dishes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (dishData.preview_file) {
        const previewFormData = new FormData();
        previewFormData.append('type', 'preview_image');
        previewFormData.append('file', dishData.preview_file);

        await api.post(`/dishes/${response.data.id}/assets`, previewFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await uploadIngredientLayers(response.data.id, dishData.ingredient_layers);

      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('createDish.failed')));
    }
  };

  return (
    <DashboardLayout title={t('createDish.pageTitle')}>
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold text-text">{t('createDish.heading')}</h2>
        <p className="text-muted">{t('createDish.description')}</p>
      </div>

      {error && <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>}

      <DishForm
        onSubmit={handleSubmit}
        suggestedDishOptions={suggestedDishOptions}
        relatedDishOptions={relatedDishOptions}
        requireModelUpload
        submitLabel={t('createDish.submit')}
        submittingLabel={t('createDish.submitting')}
      />
    </DashboardLayout>
  );
};

export default CreateDishPage;
