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
  const [templates, setTemplates] = useState<Array<{
    key: string;
    name: string;
    category: string;
    item_type: MenuItemType;
  }>>([]);
  const [templateFilter, setTemplateFilter] = useState<'all' | MenuItemType>('all');
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
    api.get('/admin/menu-item-templates')
      .then((response) => {
        setTemplates(Array.isArray(response.data?.templates) ? response.data.templates : []);
      })
      .catch(() => {
        setTemplates([]);
      });
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
        }
        formData.append('direct_stock_quantity_per_sale', dishData.direct_stock_quantity_per_sale || '1');
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

  const handleActivateTemplate = async (templateKey: string, type: MenuItemType) => {
    const ingredientId = window.prompt('Enter inventory ingredient ID to link direct stock:');
    if (!ingredientId) return;

    try {
      await api.post('/admin/menu-item-templates/activate', {
        template_key: templateKey,
        direct_stock_ingredient_id: Number(ingredientId),
      });
      showToast('Predefined menu item activated.', 'secondary');
      setSelectedType(type);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to activate predefined item.'));
    }
  };

  return (
    <DashboardLayout title="Create Menu Item">
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold text-text">Create Menu Item</h2>
        <p className="text-muted">Choose what kind of menu item you want to create.</p>
      </div>

      {error && <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>}

      {!selectedType ? (
        <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              key: 'prepared_dish' as const,
              title: 'Prepared Dish',
              description: 'Food prepared by the kitchen. Uses ingredients, recipe costing, preparation, and optional 3D model.',
            },
            {
              key: 'prepared_drink' as const,
              title: 'Prepared Drink',
              description: 'Fresh juices and kitchen-prepared drinks. Uses ingredients, recipe costing, preparation, and optional 3D model.',
            },
            {
              key: 'packaged_drink' as const,
              title: 'Packaged Drink',
              description: 'Pepsi, water, juice, Red Bull and bottled/canned items. Uses direct stock quantity, not recipes.',
            },
            {
              key: 'other_product' as const,
              title: 'Other Product',
              description: 'Any sellable non-recipe item like chips, packaged dessert, cake slice, and similar products.',
            },
          ].map((item) => (
            <GlassCard key={item.key} className="p-5">
              <h3 className="text-lg font-semibold text-text">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.description}</p>
              <LiquidButton className="mt-4 w-full" onClick={() => setSelectedType(item.key)}>
                {item.key === 'prepared_drink'
                  ? 'Select Prepared Drink'
                  : item.key === 'packaged_drink'
                    ? 'Select Packaged Drink'
                    : item.key === 'other_product'
                      ? 'Select Other Product'
                      : 'Select Prepared Dish'}
              </LiquidButton>
            </GlassCard>
          ))}
        </div>
        <GlassCard className="mt-6 p-5">
          <h3 className="text-lg font-semibold text-text">Predefined Catalog</h3>
          <p className="mt-1 text-sm text-muted">Activate predefined dishes, drinks, or products and then customize price, availability, stock, image, and name.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LiquidButton tone={templateFilter === 'all' ? 'primary' : 'tertiary'} onClick={() => setTemplateFilter('all')}>All</LiquidButton>
            <LiquidButton tone={templateFilter === 'prepared_dish' ? 'primary' : 'tertiary'} onClick={() => setTemplateFilter('prepared_dish')}>Prepared Dishes</LiquidButton>
            <LiquidButton tone={templateFilter === 'packaged_drink' ? 'primary' : 'tertiary'} onClick={() => setTemplateFilter('packaged_drink')}>Packaged Drinks</LiquidButton>
            <LiquidButton tone={templateFilter === 'other_product' ? 'primary' : 'tertiary'} onClick={() => setTemplateFilter('other_product')}>Other Products</LiquidButton>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {templates
              .filter((template) => templateFilter === 'all' || template.item_type === templateFilter)
              .map((template) => (
                <div key={template.key} className="rounded-2xl border border-stroke bg-bg2 p-4">
                  <p className="font-semibold text-text">{template.name}</p>
                  <p className="text-xs text-muted">{template.category}</p>
                  <p className="mt-1 text-xs text-muted">
                    {template.item_type === 'packaged_drink' ? 'Packaged Drink' : template.item_type === 'other_product' ? 'Other Product' : template.item_type === 'prepared_drink' ? 'Prepared Drink' : 'Prepared Dish'}
                  </p>
                  <LiquidButton className="mt-3 w-full" onClick={() => handleActivateTemplate(template.key, template.item_type)}>
                    Activate
                  </LiquidButton>
                </div>
              ))}
          </div>
        </GlassCard>
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
          submitLabel="Create Menu Item"
          submittingLabel="Creating..."
        />
      ) : isPackagedLikeSelection ? (
        <ProductItemForm
          key={selectedType}
          itemType={selectedType}
          onSubmit={handleSubmit}
          onCancel={() => setSelectedType(null)}
          requirePreviewUpload
          recipeIngredientOptions={recipeIngredientOptions}
          submitLabel="Create Menu Item"
          submittingLabel="Creating..."
        />
      ) : null}
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default CreateDishPage;
