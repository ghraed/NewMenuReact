import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import ProductItemForm from '../components/Admin/ProductItemForm';
import api from '../services/api';
import type { Dish, InventoryIngredient, MenuItemType } from '../types';
import { GlassCard, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';

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
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [recipeIngredientOptions, setRecipeIngredientOptions] = useState<InventoryIngredient[]>([]);
  const [suggestedDishOptions, setSuggestedDishOptions] = useState<Dish[]>([]);
  const [relatedDishOptions, setRelatedDishOptions] = useState<Dish[]>([]);
  const [selectedType, setSelectedType] = useState<MenuItemType | null>(null);
  const isPreparedLikeSelection = selectedType === 'prepared_dish' || selectedType === 'prepared_drink';
  const isPackagedLikeSelection = selectedType === 'packaged_drink' || selectedType === 'other_product';

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

  useEffect(() => {
    if (error) {
      showToast(error, 'tertiary', 4800);
    }
  }, [error, showToast]);

  const handleSubmit = async (dishData: DishFormData) => {
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', dishData.name);
      formData.append('item_type', dishData.item_type);
      formData.append('description', dishData.description.trim());
      if (dishData.description_ar.trim()) {
        formData.append('description_ar', dishData.description_ar.trim());
      }
      formData.append('price', dishData.price);
      formData.append('currency', dishData.currency);
      if (dishData.calories.trim()) formData.append('calories', dishData.calories.trim());
      formData.append('category', dishData.category);
      formData.append('status', dishData.status);
      formData.append('is_anchor', dishData.is_anchor ? '1' : '0');
      formData.append('is_profitable', dishData.is_profitable ? '1' : '0');
      if (dishData.item_type === 'prepared_dish' || dishData.item_type === 'prepared_drink') {
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
      } else {
        if (dishData.direct_stock_ingredient_id !== null) {
          formData.append('direct_stock_ingredient_id', String(dishData.direct_stock_ingredient_id));
          formData.append('direct_stock_quantity_per_sale', dishData.direct_stock_quantity_per_sale || '1');
        }
        if (dishData.brand) formData.append('brand', dishData.brand);
        if (dishData.barcode) formData.append('barcode', dishData.barcode);
        if (dishData.size_label) formData.append('size_label', dishData.size_label);
        if (dishData.packaged_unit) formData.append('packaged_unit', dishData.packaged_unit);
        if (dishData.cost_price) formData.append('cost_price', dishData.cost_price);
        if (dishData.supplier) formData.append('supplier', dishData.supplier);
        if (dishData.packaged_stock_quantity) formData.append('packaged_stock_quantity', dishData.packaged_stock_quantity);
        if (dishData.serving_temperature) formData.append('serving_temperature', dishData.serving_temperature);
      }

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
    <DashboardLayout title={t('createDish.createMenuItemTitle')}>
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold text-text">{t('createDish.createMenuItemTitle')}</h2>
        <p className="text-muted">{t('createDish.chooseMenuItemType')}</p>
      </div>

      {error && <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>}

      {!selectedType ? (
        <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              key: 'prepared_dish' as const,
              title: t('createDish.itemTypes.preparedDish.title'),
              description: t('createDish.itemTypes.preparedDish.description'),
            },
            {
              key: 'prepared_drink' as const,
              title: t('createDish.itemTypes.preparedDrink.title'),
              description: t('createDish.itemTypes.preparedDrink.description'),
            },
            {
              key: 'packaged_drink' as const,
              title: t('createDish.itemTypes.packagedDrink.title'),
              description: t('createDish.itemTypes.packagedDrink.description'),
            },
            {
              key: 'other_product' as const,
              title: t('createDish.itemTypes.otherProduct.title'),
              description: t('createDish.itemTypes.otherProduct.description'),
            },
          ].map((item) => (
            <GlassCard key={item.key} className="p-5">
              <h3 className="text-lg font-semibold text-text">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.description}</p>
              <LiquidButton className="mt-4 w-full" onClick={() => setSelectedType(item.key)}>
                {item.key === 'prepared_drink'
                  ? t('createDish.itemTypes.preparedDrink.select')
                  : item.key === 'packaged_drink'
                    ? t('createDish.itemTypes.packagedDrink.select')
                    : item.key === 'other_product'
                      ? t('createDish.itemTypes.otherProduct.select')
                      : t('createDish.itemTypes.preparedDish.select')}
              </LiquidButton>
            </GlassCard>
          ))}
        </div>
        </>
      ) : isPreparedLikeSelection ? (
        <DishForm
          key={selectedType}
          onSubmit={handleSubmit}
          allowDishNameSelection
          itemType={selectedType}
          initialValues={selectedType === 'prepared_drink' ? { category: 'Drinks' } : undefined}
          recipeIngredientOptions={recipeIngredientOptions}
          suggestedDishOptions={suggestedDishOptions}
          relatedDishOptions={relatedDishOptions}
          requireModelUpload={false}
          requirePreviewUpload
          submitLabel={t('createDish.createMenuItemTitle')}
          submittingLabel={t('createDish.creatingMenuItem')}
        />
      ) : isPackagedLikeSelection ? (
        <ProductItemForm
          key={selectedType}
          itemType={selectedType}
          onSubmit={handleSubmit}
          onCancel={() => setSelectedType(null)}
          requirePreviewUpload
          submitLabel={t('createDish.createMenuItemTitle')}
          submittingLabel={t('createDish.creatingMenuItem')}
        />
      ) : null}
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default CreateDishPage;
