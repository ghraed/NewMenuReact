import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import api from '../services/api';
import type { Dish, InventoryIngredient } from '../types';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
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

const CreateDishPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [recipeIngredientOptions, setRecipeIngredientOptions] = useState<InventoryIngredient[]>([]);
  const [suggestedDishOptions, setSuggestedDishOptions] = useState<Dish[]>([]);
  const [relatedDishOptions, setRelatedDishOptions] = useState<Dish[]>([]);

  useEffect(() => {
    const fetchFormOptions = async () => {
      try {
        const [inventoryIngredientsResult, dishOptionsResult] = await Promise.allSettled([
          api.get('/inventory/ingredients'),
          api.get('/dishes', {
            params: {
              include_deleted: '1',
              per_page: '200',
            },
          }),
        ]);

        if (inventoryIngredientsResult.status === 'fulfilled') {
          const payload = inventoryIngredientsResult.value.data;
          setRecipeIngredientOptions(Array.isArray(payload?.ingredients) ? payload.ingredients : []);
        } else {
          console.error(inventoryIngredientsResult.reason);
          setRecipeIngredientOptions([]);
        }

        if (dishOptionsResult.status === 'fulfilled') {
          const options = extractDishOptions(dishOptionsResult.value.data);
          setSuggestedDishOptions(options);
          setRelatedDishOptions(options);
        } else {
          console.error(dishOptionsResult.reason);
          setSuggestedDishOptions([]);
          setRelatedDishOptions([]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchFormOptions();
  }, []);

  const handleSubmit = async (dishData: DishFormData) => {
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', dishData.name);
      formData.append('price', dishData.price);
      formData.append('currency', dishData.currency);
      if (dishData.calories.trim()) formData.append('calories', dishData.calories.trim());
      formData.append('category', dishData.category);
      formData.append('status', dishData.status);
      formData.append('is_anchor', dishData.is_anchor ? '1' : '0');
      dishData.suggested_dish_ids.forEach((dishId) => {
        formData.append('suggested_dish_ids[]', String(dishId));
      });
      dishData.related_dish_ids.forEach((dishId) => {
        formData.append('related_dish_ids[]', String(dishId));
      });
      dishData.recipe_ingredients.forEach((recipeItem, index) => {
        formData.append(`recipe_ingredients[${index}][ingredient_id]`, String(recipeItem.ingredient_id));
        formData.append(`recipe_ingredients[${index}][quantity_required]`, recipeItem.quantity_required);
        formData.append(`recipe_ingredients[${index}][order_index]`, String(recipeItem.order_index));
        formData.append(`recipe_ingredients[${index}][show_in_animation]`, recipeItem.show_in_animation ? '1' : '0');
      });

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
        allowDishNameSelection
        recipeIngredientOptions={recipeIngredientOptions}
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
