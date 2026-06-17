import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  GlassInput,
  GlassSearchSelect,
  GlassSelect,
  GlassSurface,
  GlassToggle,
  LiquidButton,
} from '../ui/liquid-glass';
import { translateCategoryLabel, translateStatusLabel } from '../../i18n/dynamic';
import { MENU_CATEGORIES } from '../../i18n/categories';
import { dishDictionaryOptions, translateDishLabel } from '../../i18n/dishes';
import type { CurrencyCode, InventoryIngredient, MenuItemType } from '../../types';
import { cx, focusRing, glassControl } from '../../theme/liquidGlass';
import { getIngredientDisplayName } from '../../utils/ingredientDisplay';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import { generateDishDescription } from '../../services/dishDescriptionService';
import { useAuth } from '../../contexts/useAuth';

const createClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `ingredient-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface DishFormData {
  item_type: MenuItemType;
  name: string;
  description: string;
  description_ar: string;
  price: string;
  currency: CurrencyCode;
  calories: string;
  category: string;
  status: 'draft' | 'published';
  is_anchor: boolean;
  is_profitable: boolean;
  preview_file: File | null;
  glb_file: File | null;
  usdz_file: File | null;
  suggested_dish_ids: number[];
  related_dish_ids: number[];
  recipe_ingredients: DishRecipeIngredientInput[];
  direct_stock_ingredient_id: number | null;
  direct_stock_quantity_per_sale: string;
  brand: string;
  barcode: string;
  size_label: string;
  packaged_unit: string;
  cost_price: string;
  supplier: string;
  packaged_stock_quantity: string;
  serving_temperature: 'cold' | 'room' | '';
}

export interface DishRecipeIngredientInput {
  ingredient_id: number;
  quantity_required: string;
  order_index: number;
  show_in_animation: boolean;
}

interface DishRecipeIngredientRow {
  client_id: string;
  ingredient_id: number | null;
  quantity_required: string;
  order_index: number;
  show_in_animation: boolean;
}

interface DishFormState extends Omit<DishFormData, 'recipe_ingredients'> {
  recipe_ingredients: DishRecipeIngredientRow[];
}

const createRecipeIngredientRow = (
  initial?: Partial<DishRecipeIngredientInput>
): DishRecipeIngredientRow => ({
  client_id: createClientId(),
  ingredient_id: initial?.ingredient_id ?? null,
  quantity_required: initial?.quantity_required ?? '',
  order_index: initial?.order_index ?? 0,
  show_in_animation: initial?.show_in_animation ?? true,
});

interface DishFormProps {
  onSubmit: (data: DishFormData) => Promise<void> | void;
  initialValues?: Partial<DishFormData>;
  itemType?: MenuItemType;
  requireModelUpload?: boolean;
  requirePreviewUpload?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  allowDishNameSelection?: boolean;
  existingFiles?: {
    glb?: string | null;
    usdz?: string | null;
    previewImage?: string | null;
    previewImageUrl?: string | null;
    imageUrl?: string | null;
  };
  recipeIngredientOptions?: InventoryIngredient[];
  suggestedDishOptions?: Array<{
    id: number;
    name: string;
    category: string;
    status: 'draft' | 'published';
  }>;
  relatedDishOptions?: Array<{
    id: number;
    name: string;
    category: string;
    status: 'draft' | 'published';
  }>;
}

const DishForm: React.FC<DishFormProps> = ({
  onSubmit,
  initialValues,
  itemType = 'prepared_dish',
  requireModelUpload = true,
  requirePreviewUpload = false,
  submitLabel = 'Save Dish',
  submittingLabel = 'Saving...',
  allowDishNameSelection = false,
  existingFiles,
  recipeIngredientOptions = [],
  suggestedDishOptions = [],
  relatedDishOptions = [],
}) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isPreparedDish = itemType === 'prepared_dish' || itemType === 'prepared_drink';
  const isPackagedDrink = itemType === 'packaged_drink';
  const [formData, setFormData] = useState<DishFormState>(() => ({
    item_type: initialValues?.item_type || itemType,
    name: initialValues?.name || '',
    description: initialValues?.description || '',
    description_ar: initialValues?.description_ar || '',
    price: initialValues?.price || '',
    currency: initialValues?.currency || 'USD',
    calories: initialValues?.calories || '',
    category: initialValues?.category || '',
    status: initialValues?.status || 'published',
    is_anchor: initialValues?.is_anchor === true,
    is_profitable: initialValues?.is_profitable === true,
    preview_file: null,
    glb_file: null,
    usdz_file: null,
    suggested_dish_ids: initialValues?.suggested_dish_ids || [],
    related_dish_ids: initialValues?.related_dish_ids || [],
    direct_stock_ingredient_id: initialValues?.direct_stock_ingredient_id ?? null,
    direct_stock_quantity_per_sale: String(initialValues?.direct_stock_quantity_per_sale ?? '1'),
    brand: initialValues?.brand || '',
    barcode: initialValues?.barcode || '',
    size_label: initialValues?.size_label || '',
    packaged_unit: initialValues?.packaged_unit || '',
    cost_price: String(initialValues?.cost_price ?? ''),
    supplier: initialValues?.supplier || '',
    packaged_stock_quantity: String(initialValues?.packaged_stock_quantity ?? ''),
    serving_temperature: initialValues?.serving_temperature || '',
    recipe_ingredients: (initialValues?.recipe_ingredients ?? []).map((recipeItem) =>
      createRecipeIngredientRow({
        ingredient_id: recipeItem.ingredient_id,
        quantity_required: recipeItem.quantity_required,
        order_index: recipeItem.order_index,
        show_in_animation: recipeItem.show_in_animation,
      })
    ),
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDishDictionaryName, setSelectedDishDictionaryName] = useState('');
  const [dishNamePickerOpen, setDishNamePickerOpen] = useState(false);
  const [dishNameSearch, setDishNameSearch] = useState('');
  const [suggestedDishesPickerOpen, setSuggestedDishesPickerOpen] = useState(false);
  const [suggestedDishesSearch, setSuggestedDishesSearch] = useState('');
  const [relatedDishesPickerOpen, setRelatedDishesPickerOpen] = useState(false);
  const [relatedDishesSearch, setRelatedDishesSearch] = useState('');
  const [recipeIngredientsOpen, setRecipeIngredientsOpen] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [descriptionGenerationError, setDescriptionGenerationError] = useState<string | null>(null);
  const [descriptionGenerationSuccess, setDescriptionGenerationSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSuggestedDishesSearch('');
  }, [suggestedDishesPickerOpen]);

  useEffect(() => {
    setRelatedDishesSearch('');
  }, [relatedDishesPickerOpen]);

  useEffect(() => {
    setDishNameSearch('');
  }, [dishNamePickerOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('[data-admin-overlay-root="true"]')) {
        return;
      }

      setSuggestedDishesPickerOpen(false);
      setRelatedDishesPickerOpen(false);
      setDishNamePickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'name' && value.trim().length > 0) {
      setSelectedDishDictionaryName('');
    }
    if (name === 'currency') {
      setFormData((prev) => ({ ...prev, currency: value as CurrencyCode }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDishDictionarySelect = (dishName: string) => {
    setSelectedDishDictionaryName(dishName);
    setFormData((prev) => ({
      ...prev,
      name: '',
    }));
    setDishNamePickerOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    const file = files && files.length > 0 ? files[0] : null;

    setFormData((prev) => ({ ...prev, [name]: file }));
  };

  const hasValidExtension = (file: File | null, ext: string) => {
    if (!file) return true;
    return file.name.toLowerCase().endsWith(ext);
  };

  const toggleSuggestedDish = (dishId: number) => {
    setFormData((prev) => ({
      ...prev,
      suggested_dish_ids: prev.suggested_dish_ids.includes(dishId)
        ? prev.suggested_dish_ids.filter((id) => id !== dishId)
        : [...prev.suggested_dish_ids, dishId],
    }));
  };

  const toggleRelatedDish = (dishId: number) => {
    setFormData((prev) => ({
      ...prev,
      related_dish_ids: prev.related_dish_ids.includes(dishId)
        ? prev.related_dish_ids.filter((id) => id !== dishId)
        : [...prev.related_dish_ids, dishId],
    }));
  };

  const addRecipeIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: [
        ...prev.recipe_ingredients,
        createRecipeIngredientRow({ order_index: prev.recipe_ingredients.length, show_in_animation: true }),
      ],
    }));
  };

  const removeRecipeIngredient = (clientId: string) => {
    setFormData((prev) => {
      const nextItems = prev.recipe_ingredients
        .filter((recipeItem) => recipeItem.client_id !== clientId)
        .map((recipeItem, index) => ({ ...recipeItem, order_index: index }));

      return {
        ...prev,
        recipe_ingredients: nextItems,
      };
    });
  };

  const handleRecipeIngredientChange = (clientId: string, ingredientIdValue: string) => {
    const ingredientId = ingredientIdValue ? Number(ingredientIdValue) : null;

    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: prev.recipe_ingredients.map((recipeItem) => (
        recipeItem.client_id === clientId
          ? { ...recipeItem, ingredient_id: ingredientId }
          : recipeItem
      )),
    }));
  };

  const handleRecipeQuantityChange = (clientId: string, quantity: string) => {
    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: prev.recipe_ingredients.map((recipeItem) => (
        recipeItem.client_id === clientId
          ? { ...recipeItem, quantity_required: quantity }
          : recipeItem
      )),
    }));
  };

  const handleRecipeAnimationToggle = (clientId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: prev.recipe_ingredients.map((recipeItem) => (
        recipeItem.client_id === clientId
          ? { ...recipeItem, show_in_animation: checked }
          : recipeItem
      )),
    }));
  };

  const moveRecipeIngredient = (clientId: string, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const currentIndex = prev.recipe_ingredients.findIndex((recipeItem) => recipeItem.client_id === clientId);

      if (currentIndex === -1) {
        return prev;
      }

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= prev.recipe_ingredients.length) {
        return prev;
      }

      const nextItems = [...prev.recipe_ingredients];
      const [movedItem] = nextItems.splice(currentIndex, 1);
      nextItems.splice(nextIndex, 0, movedItem);

      return {
        ...prev,
        recipe_ingredients: nextItems.map((recipeItem, index) => ({ ...recipeItem, order_index: index })),
      };
    });
  };

  const recipeIngredientSelectOptions = recipeIngredientOptions.map((ingredient) => ({
    value: String(ingredient.id),
    label: ingredient.is_active
      ? `${getIngredientDisplayName(ingredient, i18n.resolvedLanguage)} (${ingredient.unit})`
      : `${getIngredientDisplayName(ingredient, i18n.resolvedLanguage)} (${ingredient.unit}) • inactive`,
  }));

  const normalizedSuggestedDishesSearch = suggestedDishesSearch.trim().toLowerCase();
  const filteredSuggestedDishOptions = suggestedDishOptions.filter((dish) => {
    if (!normalizedSuggestedDishesSearch) {
      return true;
    }

    const translatedDishName = translateDishLabel(dish.name, i18n.language);
    const searchableText = `${dish.name} ${translatedDishName} ${dish.category} ${dish.status}`.toLowerCase();
    return searchableText.includes(normalizedSuggestedDishesSearch);
  });
  const selectedSuggestedDishOptions = formData.suggested_dish_ids
    .map((dishId) => suggestedDishOptions.find((dish) => dish.id === dishId))
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
  const normalizedRelatedDishesSearch = relatedDishesSearch.trim().toLowerCase();
  const filteredRelatedDishOptions = relatedDishOptions.filter((dish) => {
    if (!normalizedRelatedDishesSearch) {
      return true;
    }

    const translatedDishName = translateDishLabel(dish.name, i18n.language);
    const searchableText = `${dish.name} ${translatedDishName} ${dish.category} ${dish.status}`.toLowerCase();
    return searchableText.includes(normalizedRelatedDishesSearch);
  });
  const selectedRelatedDishOptions = formData.related_dish_ids
    .map((dishId) => relatedDishOptions.find((dish) => dish.id === dishId))
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
  const allowedRestaurantCategories = (user?.restaurant?.menu_categories ?? []).filter((value) => value.trim() !== '');
  const categoryOptions = MENU_CATEGORIES
    .filter((category) => (
      allowedRestaurantCategories.length === 0
      || allowedRestaurantCategories.includes(category.value)
      || category.value === formData.category
    ))
    .map((category) => ({
      value: category.value,
      label: translateCategoryLabel(category.value, category.arabic),
    }));
  const hasDishName = formData.name.trim().length > 0 || selectedDishDictionaryName.trim().length > 0;
  const hasDescription = formData.description.trim().length > 0;
  const hasDirectStockIngredient = formData.direct_stock_ingredient_id !== null;
  const validRecipeIngredientsForGeneration = formData.recipe_ingredients
    .map((recipeItem) => {
      if (recipeItem.ingredient_id === null) {
        return null;
      }

      const quantityRequired = Number(recipeItem.quantity_required);
      if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) {
        return null;
      }

      const ingredient = recipeIngredientOptions.find((candidate) => candidate.id === recipeItem.ingredient_id);
      if (!ingredient) {
        return null;
      }

      return {
        ingredient_id: recipeItem.ingredient_id,
        ingredient_name: getIngredientDisplayName(ingredient, i18n.resolvedLanguage).trim() || ingredient.name,
        quantity_required: quantityRequired,
        unit: ingredient.unit,
        order_index: recipeItem.order_index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const canGenerateDescription = isPreparedDish
    && validRecipeIngredientsForGeneration.length > 0
    && !isGeneratingDescription
    && !isSubmitting;
  const normalizedDishNameSearch = dishNameSearch.trim().toLowerCase();
  const filteredDishNameDictionaryOptions = dishDictionaryOptions.filter((dish) => {
    if (!normalizedDishNameSearch) {
      return true;
    }

    const translated = translateDishLabel(dish.value, i18n.language, dish.arabic);
    const searchableText = `${dish.value} ${translated}`.toLowerCase();
    return searchableText.includes(normalizedDishNameSearch);
  });

  const handleGenerateDescription = async () => {
    if (!canGenerateDescription) {
      return;
    }

    const dishName = formData.name.trim() || selectedDishDictionaryName.trim();
    if (!dishName || !formData.category.trim()) {
      setDescriptionGenerationError(t('dishForm.generateDescriptionNeedsBasics'));
      setDescriptionGenerationSuccess(null);
      return;
    }

    setDescriptionGenerationError(null);
    setDescriptionGenerationSuccess(null);
    setIsGeneratingDescription(true);

    try {
      const calories = Number(formData.calories);
      const generated = await generateDishDescription({
        name: dishName,
        category: formData.category.trim(),
        calories: formData.calories.trim() && Number.isFinite(calories) ? calories : undefined,
        recipe_ingredients: validRecipeIngredientsForGeneration,
        target_languages: ['en', 'ar'],
      });

      setFormData((prev) => ({
        ...prev,
        description: generated.description || prev.description,
        description_ar: generated.description_ar || prev.description_ar,
      }));
      setDescriptionGenerationSuccess(t('dishForm.generateDescriptionSuccess'));
    } catch {
      setDescriptionGenerationError(t('dishForm.generateDescriptionFailed'));
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const dishName = formData.name.trim() || selectedDishDictionaryName.trim();

    if (!dishName) {
      setFormError('Please enter a dish name or choose one from the dropdown.');
      return;
    }
    if (isPreparedDish && !formData.description.trim()) {
      setFormError(t('dishForm.descriptionRequired'));
      return;
    }

    const hasGlb = !!formData.glb_file;
    const hasUsdz = !!formData.usdz_file;

    if (requirePreviewUpload && !formData.preview_file && !existingFiles?.previewImage) {
      setFormError('Please upload a preview image.');
      return;
    }

    if (formData.preview_file) {
      const previewMimeIsImage = formData.preview_file.type.startsWith('image/');
      const previewHasImageExtension = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(formData.preview_file.name);
      const maxPreviewBytes = 10 * 1024 * 1024;

      if (!previewMimeIsImage && !previewHasImageExtension) {
        setFormError('Preview image must be a valid image file (png, jpg, webp, gif, avif, bmp, or svg).');
        return;
      }

      if (formData.preview_file.size > maxPreviewBytes) {
        setFormError('Preview image must be 10MB or smaller.');
        return;
      }
    }

    if (requireModelUpload && !hasGlb && !hasUsdz) {
      setFormError('Please upload at least one model file (.glb or .usdz).');
      return;
    }

    if (!hasValidExtension(formData.glb_file, '.glb')) {
      setFormError('GLB file must end with .glb');
      return;
    }

    if (!hasValidExtension(formData.usdz_file, '.usdz')) {
      setFormError('USDZ file must end with .usdz');
      return;
    }

    const normalizedRecipeIngredients = formData.recipe_ingredients
      .map((recipeItem) => ({
        ...recipeItem,
        quantity_required: recipeItem.quantity_required.trim(),
      }))
      .filter((recipeItem) => recipeItem.ingredient_id !== null || recipeItem.quantity_required.length > 0);
    const selectedRecipeIngredientIds = new Set<number>();

    if (isPreparedDish) {
      for (const [index, recipeItem] of normalizedRecipeIngredients.entries()) {
        const row = index + 1;

        if (recipeItem.ingredient_id === null) {
          setFormError(t('dishForm.recipeMissingIngredient', { row }));
          return;
        }

        const quantityValue = Number(recipeItem.quantity_required);
        if (!recipeItem.quantity_required || Number.isNaN(quantityValue) || quantityValue <= 0) {
          setFormError(t('dishForm.recipeInvalidQuantity', { row }));
          return;
        }

        if (selectedRecipeIngredientIds.has(recipeItem.ingredient_id)) {
          setFormError(t('dishForm.recipeDuplicateIngredient'));
          return;
        }

        selectedRecipeIngredientIds.add(recipeItem.ingredient_id);
      }
    } else {
      const directQty = Number(formData.direct_stock_quantity_per_sale || '1');
      if (formData.direct_stock_ingredient_id === null) {
        setFormError('Please select a stock ingredient for direct inventory deduction.');
        return;
      }
      if (!Number.isFinite(directQty) || directQty <= 0) {
        setFormError('Direct stock quantity per sale must be greater than zero.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const submitPayload: DishFormData = {
        item_type: itemType,
        name: dishName,
        description: formData.description.trim(),
        description_ar: formData.description_ar.trim(),
        price: formData.price,
        currency: formData.currency,
        calories: formData.calories,
        category: formData.category,
        status: formData.status,
        is_anchor: formData.is_anchor,
        is_profitable: formData.is_profitable,
        preview_file: formData.preview_file,
        glb_file: formData.glb_file,
        usdz_file: formData.usdz_file,
        suggested_dish_ids: formData.suggested_dish_ids,
        related_dish_ids: formData.related_dish_ids,
        recipe_ingredients: isPreparedDish ? normalizedRecipeIngredients.map((recipeItem) => ({
          ingredient_id: recipeItem.ingredient_id as number,
          quantity_required: recipeItem.quantity_required,
          order_index: recipeItem.order_index,
          show_in_animation: recipeItem.show_in_animation,
        })) : [],
        direct_stock_ingredient_id: formData.direct_stock_ingredient_id,
        direct_stock_quantity_per_sale: formData.direct_stock_quantity_per_sale,
        brand: formData.brand,
        barcode: formData.barcode,
        size_label: formData.size_label,
        packaged_unit: formData.packaged_unit,
        cost_price: formData.cost_price,
        supplier: formData.supplier,
        packaged_stock_quantity: formData.packaged_stock_quantity,
        serving_temperature: formData.serving_temperature,
      };

      await onSubmit(submitPayload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={allowDishNameSelection && isPreparedDish ? 'relative' : undefined} data-admin-overlay-root={allowDishNameSelection && isPreparedDish ? 'true' : undefined}>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-text">
          {t('dishForm.nameEn')}
        </label>
        <GlassInput
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required={!allowDishNameSelection || !selectedDishDictionaryName}
          placeholder={t('dishForm.nameEnPlaceholder')}
        />
        {allowDishNameSelection && isPreparedDish ? (
          <>
            <label htmlFor="dish-name-dictionary" className="mb-1 mt-3 block text-sm font-medium text-text">
              {t('dishForm.chooseFromDishDictionary')}
            </label>
            <button
              type="button"
              onClick={() => setDishNamePickerOpen((current) => !current)}
              className={cx(
                'flex w-full items-center justify-between gap-3 rounded-[26px] border px-4 py-3 text-left',
                glassControl,
                focusRing
              )}
              aria-expanded={dishNamePickerOpen}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">
                  {selectedDishDictionaryName
                    ? translateDishLabel(selectedDishDictionaryName, i18n.language)
                    : t('dishForm.chooseDishFromDictionary')}
                </p>
                <p className="truncate text-xs text-muted">
                  {selectedDishDictionaryName ? t('dishForm.dictionarySelectionActive') : t('dishForm.searchChooseSharedDishLabel')}
                </p>
              </div>
              <span className="shrink-0 text-muted2">{dishNamePickerOpen ? '▴' : '▾'}</span>
            </button>

            {dishNamePickerOpen ? (
              <div className="absolute left-0 right-0 top-full z-40 mt-3 overflow-hidden rounded-[24px] border border-stroke bg-bg1 shadow-lux2 backdrop-blur-xl supports-[backdrop-filter]:bg-bg1/95">
                <div className="space-y-3 p-3">
                  <GlassInput
                    type="text"
                    value={dishNameSearch}
                    onChange={(event) => setDishNameSearch(event.target.value)}
                    placeholder={t('dishForm.searchDishesPlaceholder')}
                    leftSlot={<span>⌕</span>}
                  />

                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {filteredDishNameDictionaryOptions.length === 0 ? (
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted">
                        {t('dishForm.noDishesMatchSearch')}
                      </div>
                    ) : (
                      filteredDishNameDictionaryOptions.map((dish) => {
                        const isSelected = selectedDishDictionaryName === dish.value;

                        return (
                          <button
                            key={dish.value}
                            type="button"
                            onClick={() => handleDishDictionarySelect(dish.value)}
                            className={cx(
                              'flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-left transition',
                              isSelected ? 'border-gold/25 bg-gold/10' : 'border-white/10 bg-white/[0.03]'
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text">
                                {translateDishLabel(dish.value, i18n.language, dish.arabic)}
                              </p>
                              <p className="truncate text-xs text-muted">{dish.value}</p>
                            </div>
                            <span className={cx('shrink-0 text-sm', isSelected ? 'text-gold2' : 'text-muted2')}>
                              {isSelected ? '✓' : '+'}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              {t('dishForm.dropdownClearsTypedNameHint')}
            </p>
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-text">
            {t('dishForm.descriptionEn')} {isPreparedDish ? '*' : '(Optional)'}
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required={isPreparedDish}
            rows={4}
            placeholder={t('dishForm.descriptionEnPlaceholder')}
            className={cx(
              'w-full rounded-[24px] border bg-transparent px-4 py-3 text-sm text-text placeholder:text-muted2 focus:outline-none',
              glassControl,
              focusRing
            )}
          />
        </div>

        <div>
          <label htmlFor="description_ar" className="mb-1 block text-sm font-medium text-text">
            {t('dishForm.descriptionAr')}
          </label>
          <textarea
            id="description_ar"
            name="description_ar"
            value={formData.description_ar}
            onChange={handleChange}
            rows={4}
            placeholder={t('dishForm.descriptionArPlaceholder')}
            className={cx(
              'w-full rounded-[24px] border bg-transparent px-4 py-3 text-sm text-text placeholder:text-muted2 focus:outline-none',
              glassControl,
              focusRing
            )}
          />
        </div>

        {isPreparedDish ? (
        <div className="flex flex-wrap items-center gap-3">
          <LiquidButton
            type="button"
            tone="tertiary"
            onClick={handleGenerateDescription}
            disabled={!canGenerateDescription}
          >
            {isGeneratingDescription
              ? t('dishForm.generateDescriptionLoading')
              : t('dishForm.generateDescriptionButton')}
          </LiquidButton>
          <p className="text-xs text-muted">{t('dishForm.generateDescriptionHint')}</p>
        </div>
        ) : null}
        {descriptionGenerationError ? (
          <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
            {descriptionGenerationError}
          </div>
        ) : null}
        {descriptionGenerationSuccess ? (
          <div className="rounded-xl2 border border-sage/35 bg-sage/10 p-3 text-sm text-sage">
            {descriptionGenerationSuccess}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {isPreparedDish ? (
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-text">
            {t('dishForm.priceLabel')}
          </label>
          <GlassInput
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            required
            step="0.01"
            min="0"
            placeholder={t('dishForm.pricePlaceholder')}
          />
        </div>
        ) : null}

        <div>
          <label htmlFor="currency" className="mb-1 block text-sm font-medium text-text">
            Currency
          </label>
          <GlassSelect
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            required
            options={CURRENCY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </div>

        <div>
          <label htmlFor="calories" className="mb-1 block text-sm font-medium text-text">
            {t('dishForm.caloriesLabel')}
          </label>
          <GlassInput
            type="number"
            id="calories"
            name="calories"
            value={formData.calories}
            onChange={handleChange}
            min="0"
            step="1"
            placeholder={t('dishForm.caloriesPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-text">
            {t('dishForm.categoryLabel')}
          </label>
          <GlassSelect
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            options={categoryOptions}
            placeholder={t('dishForm.chooseCategoryPlaceholder')}
          />
          <p className="mt-2 text-xs text-muted">
            {t('dishForm.categoryDictionaryHint')}
          </p>
        </div>
      </div>

      {isPreparedDish && suggestedDishOptions.length > 0 ? (
        <div className="relative" data-admin-overlay-root="true">
          <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.restaurantSuggests')}</label>
          <button
            type="button"
            onClick={() => {
              setSuggestedDishesPickerOpen((current) => {
                const next = !current;
                if (next) {
                  setRelatedDishesPickerOpen(false);
                }
                return next;
              });
            }}
            className={cx(
              'flex w-full items-center justify-between gap-3 rounded-[26px] border px-4 py-3 text-left',
              glassControl,
              focusRing
            )}
            aria-expanded={suggestedDishesPickerOpen}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">
                {selectedSuggestedDishOptions.length > 0
                  ? `${selectedSuggestedDishOptions.length} suggested dish${selectedSuggestedDishOptions.length > 1 ? 'es' : ''}`
                  : t('dishForm.chooseSuggestedDishes')}
              </p>
              <p className="truncate text-xs text-muted">
                {selectedSuggestedDishOptions.length > 0
                  ? selectedSuggestedDishOptions.map((dish) => translateDishLabel(dish.name, i18n.language)).join(', ')
                  : t('dishForm.pickSuggestedDishesHint')}
              </p>
            </div>
            <span className="shrink-0 text-muted2">{suggestedDishesPickerOpen ? '▴' : '▾'}</span>
          </button>

          {selectedSuggestedDishOptions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSuggestedDishOptions.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => toggleSuggestedDish(dish.id)}
                  className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold2 transition"
                >
                  {translateDishLabel(dish.name, i18n.language)} ×
                </button>
              ))}
            </div>
          ) : null}

          {suggestedDishesPickerOpen ? (
            <div className="absolute left-0 right-0 top-full z-40 mt-3 overflow-hidden rounded-[24px] border border-stroke bg-bg1 shadow-lux2 backdrop-blur-xl supports-[backdrop-filter]:bg-bg1/95">
              <div className="space-y-3 p-3">
                <GlassInput
                  type="text"
                  value={suggestedDishesSearch}
                  onChange={(event) => setSuggestedDishesSearch(event.target.value)}
                  placeholder={t('dishForm.searchDishesPlaceholder')}
                  leftSlot={<span>⌕</span>}
                />

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredSuggestedDishOptions.length === 0 ? (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted">
                      {t('dishForm.noDishesMatchSearch')}
                    </div>
                  ) : (
                    filteredSuggestedDishOptions.map((dish) => {
                      const isSelected = formData.suggested_dish_ids.includes(dish.id);

                      return (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => toggleSuggestedDish(dish.id)}
                          className={cx(
                            'flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-left transition',
                            isSelected
                              ? 'border-gold/25 bg-gold/10'
                              : 'border-white/10 bg-white/[0.03]'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text">
                              {translateDishLabel(dish.name, i18n.language)}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {translateCategoryLabel(dish.category)} · {translateStatusLabel(dish.status)}
                            </p>
                          </div>
                          <span className={cx('shrink-0 text-sm', isSelected ? 'text-gold2' : 'text-muted2')}>
                            {isSelected ? '✓' : '+'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-2 text-xs text-muted">
            {t('dishForm.suggestedDishesFootnote')}
          </p>
        </div>
      ) : null}

      {isPreparedDish && relatedDishOptions.length > 0 ? (
        <div className="relative" data-admin-overlay-root="true">
          <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.relatedDishes')}</label>
          <button
            type="button"
            onClick={() => {
              setRelatedDishesPickerOpen((current) => {
                const next = !current;
                if (next) {
                  setSuggestedDishesPickerOpen(false);
                }
                return next;
              });
            }}
            className={cx(
              'flex w-full items-center justify-between gap-3 rounded-[26px] border px-4 py-3 text-left',
              glassControl,
              focusRing
            )}
            aria-expanded={relatedDishesPickerOpen}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">
                {selectedRelatedDishOptions.length > 0
                  ? `${selectedRelatedDishOptions.length} related dish${selectedRelatedDishOptions.length > 1 ? 'es' : ''}`
                  : t('dishForm.chooseRelatedDishes')}
              </p>
              <p className="truncate text-xs text-muted">
                {selectedRelatedDishOptions.length > 0
                  ? selectedRelatedDishOptions.map((dish) => translateDishLabel(dish.name, i18n.language)).join(', ')
                  : t('dishForm.pickRelatedDishesHint')}
              </p>
            </div>
            <span className="shrink-0 text-muted2">{relatedDishesPickerOpen ? '▴' : '▾'}</span>
          </button>

          {selectedRelatedDishOptions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedRelatedDishOptions.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => toggleRelatedDish(dish.id)}
                  className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition"
                >
                  {translateDishLabel(dish.name, i18n.language)} ×
                </button>
              ))}
            </div>
          ) : null}

          {relatedDishesPickerOpen ? (
            <div className="absolute left-0 right-0 top-full z-40 mt-3 overflow-hidden rounded-[24px] border border-stroke bg-bg1 shadow-lux2 backdrop-blur-xl supports-[backdrop-filter]:bg-bg1/95">
              <div className="space-y-3 p-3">
                <GlassInput
                  type="text"
                  value={relatedDishesSearch}
                  onChange={(event) => setRelatedDishesSearch(event.target.value)}
                  placeholder={t('dishForm.searchDishesPlaceholder')}
                  leftSlot={<span>⌕</span>}
                />

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredRelatedDishOptions.length === 0 ? (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted">
                      {t('dishForm.noDishesMatchSearch')}
                    </div>
                  ) : (
                    filteredRelatedDishOptions.map((dish) => {
                      const isSelected = formData.related_dish_ids.includes(dish.id);

                      return (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => toggleRelatedDish(dish.id)}
                          className={cx(
                            'flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-left transition',
                            isSelected
                              ? 'border-sky-400/30 bg-sky-400/10'
                              : 'border-white/10 bg-white/[0.03]'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text">
                              {translateDishLabel(dish.name, i18n.language)}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {translateCategoryLabel(dish.category)} · {translateStatusLabel(dish.status)}
                            </p>
                          </div>
                          <span className={cx('shrink-0 text-sm', isSelected ? 'text-sky-200' : 'text-muted2')}>
                            {isSelected ? '✓' : '+'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-2 text-xs text-muted">
            {t('dishForm.relatedDishesFootnote')}
          </p>
        </div>
      ) : null}

      <GlassSurface className="p-4" sheen={false}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-text">{t('dishForm.dishStatus')}</p>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  formData.status === 'published'
                    ? 'border-sage/35 bg-sage/10 text-sage'
                    : 'border-gold/35 bg-gold/10 text-gold2'
                }`}
              >
                {translateStatusLabel(formData.status)}
              </span>
            </div>
            <p className="text-xs text-muted">
              {formData.status === 'published'
                ? t('dishForm.publishedVisibleToGuests')
                : 'Draft: hidden from guest pages'}
            </p>
          </div>

          <GlassToggle
            checked={formData.status === 'published'}
            onChange={(checked) => {
              setFormData((prev) => ({
                ...prev,
                status: checked ? 'published' : 'draft',
              }));
            }}
            label=""
          />
        </div>
      </GlassSurface>

      {isPreparedDish ? (
      <GlassSurface className="p-4" sheen={false}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-text">{t('dishForm.profitableItem')}</p>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  formData.is_profitable
                    ? 'border-gold/35 bg-gold/10 text-gold2'
                    : 'border-white/15 bg-white/5 text-muted2'
                }`}
              >
                {formData.is_profitable ? t('dishForm.profitableEnabled') : t('dishForm.profitableDisabled')}
              </span>
            </div>
            <p className="text-xs text-muted">{t('dishForm.profitableDescription')}</p>
          </div>

          <GlassToggle
            checked={formData.is_profitable}
            onChange={(checked) => {
              setFormData((prev) => ({
                ...prev,
                is_profitable: checked,
              }));
            }}
            label=""
          />
        </div>
      </GlassSurface>
      ) : null}

      {isPreparedDish ? (
      <GlassSurface className="p-4" sheen={false}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-text">{t('dishForm.anchorItem')}</p>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  formData.is_anchor
                    ? 'border-sky-400/35 bg-sky-400/10 text-sky-200'
                    : 'border-white/15 bg-white/5 text-muted2'
                }`}
              >
                {formData.is_anchor ? t('dishForm.anchorEnabled') : t('dishForm.anchorDisabled')}
              </span>
            </div>
            <p className="text-xs text-muted">{t('dishForm.anchorDescription')}</p>
          </div>

          <GlassToggle
            checked={formData.is_anchor}
            onChange={(checked) => {
              setFormData((prev) => ({
                ...prev,
                is_anchor: checked,
              }));
            }}
            label=""
          />
        </div>
      </GlassSurface>
      ) : null}

      <div>
        <label htmlFor="preview_file" className="mb-1 block text-sm font-medium text-text">
          {requirePreviewUpload ? `${t('dishForm.previewImageUploadOptional')} *` : t('dishForm.previewImageUploadOptional')}
        </label>
        <GlassInput
          type="file"
          id="preview_file"
          name="preview_file"
          accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.bmp,.svg,image/*"
          onChange={handleFileChange}
          required={requirePreviewUpload && !existingFiles?.previewImage}
        />
        {formData.preview_file ? (
          <p className="mt-2 text-xs text-muted">Selected preview: {formData.preview_file.name}</p>
        ) : (
          existingFiles?.previewImage && (
            <p className="mt-2 text-xs text-muted">Current preview file: {existingFiles.previewImage}</p>
          )
        )}
        <p className="mt-2 text-xs text-muted">
          {t('dishForm.previewUploadHint')}
        </p>
      </div>

      {isPreparedDish ? (
      <GlassSurface className="relative overflow-visible space-y-5 p-5" sheen={false}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-text">{t('dishForm.recipeIngredientsTitle')}</h3>
            <p className="mt-1 text-sm text-muted">
              {t('dishForm.recipeIngredientsDescription')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRecipeIngredientsOpen((current) => !current)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted2 transition hover:border-white/25 hover:text-text"
            >
              {recipeIngredientsOpen ? 'Collapse' : 'Expand'}
            </button>
            {recipeIngredientOptions.length > 0 && recipeIngredientsOpen ? (
              <LiquidButton type="button" tone="tertiary" onClick={addRecipeIngredient}>
                {t('dishForm.addRecipeIngredient')}
              </LiquidButton>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted">
          {formData.recipe_ingredients.length > 0
            ? `${formData.recipe_ingredients.length} ingredient${formData.recipe_ingredients.length > 1 ? 's' : ''} configured`
            : t('dishForm.noRecipeIngredients')}
        </p>

        {recipeIngredientsOpen ? (
          recipeIngredientOptions.length === 0 ? (
          <div className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-5 text-sm text-gold2">
            {t('dishForm.recipeIngredientsMissingInventory')}
            <div className="mt-3">
              <Link to="/admin/inventory/ingredients">
                <LiquidButton type="button" tone="tertiary" className="px-4 py-2 text-sm">
                  {t('dishForm.openInventoryIngredients')}
                </LiquidButton>
              </Link>
            </div>
          </div>
          ) : formData.recipe_ingredients.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-muted">
            {t('dishForm.noRecipeIngredients')}
          </div>
          ) : (
          <div className="space-y-4">
            {formData.recipe_ingredients.map((recipeItem, index) => {
              const selectedIngredient = recipeIngredientOptions.find(
                (ingredient) => ingredient.id === recipeItem.ingredient_id
              ) || null;

              return (
                <div
                  key={recipeItem.client_id}
                  className="min-w-0 rounded-[26px] border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">
                        {t('dishForm.recipeIngredientRow', { index: index + 1 })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LiquidButton
                        type="button"
                        tone="tertiary"
                        onClick={() => moveRecipeIngredient(recipeItem.client_id, 'up')}
                        disabled={index === 0}
                        className="px-3 py-2 text-xs"
                      >
                        ↑ Up
                      </LiquidButton>
                      <LiquidButton
                        type="button"
                        tone="tertiary"
                        onClick={() => moveRecipeIngredient(recipeItem.client_id, 'down')}
                        disabled={index === formData.recipe_ingredients.length - 1}
                        className="px-3 py-2 text-xs"
                      >
                        ↓ Down
                      </LiquidButton>
                      <LiquidButton
                        type="button"
                        tone="secondary"
                        onClick={() => removeRecipeIngredient(recipeItem.client_id)}
                      >
                        {t('dishForm.removeRecipeIngredient')}
                      </LiquidButton>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">
                        {t('dishForm.recipeIngredientLabel')}
                      </label>
                      <GlassSearchSelect
                        value={recipeItem.ingredient_id !== null ? String(recipeItem.ingredient_id) : ''}
                        onChange={(nextValue) => handleRecipeIngredientChange(recipeItem.client_id, nextValue)}
                        options={recipeIngredientSelectOptions}
                        placeholder={t('dishForm.chooseRecipeIngredient')}
                        searchPlaceholder={t('inventoryIngredients.listFilters.searchPlaceholder')}
                        emptyText={t('inventoryIngredients.noNameMatches')}
                      />
                      {selectedIngredient ? (
                        <p className="mt-2 text-xs text-muted">
                          {t('dishForm.recipeSelectedUnit', { unit: selectedIngredient.unit })}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted">
                          {t('dishForm.recipeSelectIngredientHint')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">
                        {t('dishForm.quantityRequiredLabel')}
                      </label>
                      <GlassInput
                        type="number"
                        min="0"
                        step="0.001"
                        value={recipeItem.quantity_required}
                        onChange={(event) => handleRecipeQuantityChange(recipeItem.client_id, event.target.value)}
                        placeholder={t('dishForm.quantityRequiredPlaceholder')}
                      />
                      <p className="mt-2 text-xs text-muted">
                        {selectedIngredient
                          ? t('dishForm.quantityRequiredHintWithUnit', { unit: selectedIngredient.unit })
                          : t('dishForm.quantityRequiredHint')}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">
                        {t('dishForm.showInAnimationLabel')}
                      </label>
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                        <GlassToggle
                          checked={recipeItem.show_in_animation}
                          onChange={(checked) => handleRecipeAnimationToggle(recipeItem.client_id, checked)}
                          label={recipeItem.show_in_animation
                            ? t('dishForm.showInAnimationOn')
                            : t('dishForm.showInAnimationOff')}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {t('dishForm.showInAnimationHint')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )
        ) : null}
      </GlassSurface>
      ) : null}

      {!isPreparedDish ? (
        <GlassSurface className="space-y-4 p-5" sheen={false}>
          <h3 className="text-lg font-semibold text-text">
            {isPackagedDrink ? 'Packaged Drink Details' : 'Product Details'}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isPackagedDrink ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Brand</label>
                <GlassInput name="brand" value={formData.brand} onChange={handleChange} placeholder="Pepsi / Coca-Cola" />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Size</label>
              <GlassInput name="size_label" value={formData.size_label} onChange={handleChange} placeholder="330ml / 500ml / 1.25L" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Unit Type</label>
              <GlassInput name="packaged_unit" value={formData.packaged_unit} onChange={handleChange} placeholder="can / bottle / pack / piece" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Barcode (Optional)</label>
              <GlassInput name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Barcode" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Cost Price</label>
              <GlassInput type="number" min="0" step="0.01" name="cost_price" value={formData.cost_price} onChange={handleChange} placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Stock Quantity</label>
              <GlassInput type="number" min="0" step="0.001" name="packaged_stock_quantity" value={formData.packaged_stock_quantity} onChange={handleChange} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Supplier (Optional)</label>
              <GlassInput name="supplier" value={formData.supplier} onChange={handleChange} placeholder="Supplier name" />
            </div>
            {isPackagedDrink ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Serving Temperature</label>
                <GlassSelect
                  name="serving_temperature"
                  value={formData.serving_temperature}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Not set' },
                    { value: 'cold', label: 'Cold' },
                    { value: 'room', label: 'Room Temperature' },
                  ]}
                />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Direct Stock Ingredient</label>
              <GlassSearchSelect
                value={formData.direct_stock_ingredient_id !== null ? String(formData.direct_stock_ingredient_id) : ''}
                onChange={(value) => setFormData((prev) => ({ ...prev, direct_stock_ingredient_id: value ? Number(value) : null }))}
                options={recipeIngredientSelectOptions}
                placeholder="Select inventory ingredient"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Stock Deduction Per Sale</label>
              <GlassInput
                type="number"
                min="0.001"
                step="0.001"
                name="direct_stock_quantity_per_sale"
                value={formData.direct_stock_quantity_per_sale}
                onChange={handleChange}
                placeholder="1"
              />
            </div>
          </div>
        </GlassSurface>
      ) : null}

      <div className="border-t border-stroke pt-6">
        <h3 className="mb-2 text-lg font-medium text-text">{t('dishForm.assets3dTitle')}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="glb_file" className="mb-1 block text-sm font-medium text-text">
              {t('dishForm.glbFileLabel')}
            </label>
            <GlassInput type="file" id="glb_file" name="glb_file" accept=".glb" onChange={handleFileChange} />
            {formData.glb_file ? (
              <p className="mt-2 text-xs text-muted">Selected file: {formData.glb_file.name}</p>
            ) : (
              existingFiles?.glb && <p className="mt-2 text-xs text-muted">Uploaded file found: {existingFiles.glb}</p>
            )}
          </div>
          <div>
            <label htmlFor="usdz_file" className="mb-1 block text-sm font-medium text-text">
              {t('dishForm.usdzFileLabel')}
            </label>
            <GlassInput type="file" id="usdz_file" name="usdz_file" accept=".usdz" onChange={handleFileChange} />
            {formData.usdz_file ? (
              <p className="mt-2 text-xs text-muted">Selected file: {formData.usdz_file.name}</p>
            ) : (
              existingFiles?.usdz && <p className="mt-2 text-xs text-muted">Uploaded file found: {existingFiles.usdz}</p>
            )}
          </div>
          <p className="text-xs text-muted">
            {requireModelUpload
              ? t('dishForm.uploadAtLeastOneHint')
              : t('dishForm.optionalUpdateUploadHint')}
          </p>
          <p className="text-xs text-muted">
            {t('dishForm.uploadBothFilesHint')}
          </p>
        </div>
      </div>

      {formError && (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {formError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <LiquidButton type="button" tone="tertiary" className="flex-1" onClick={() => window.history.back()}>
          {t('dishForm.cancel')}
        </LiquidButton>
        <LiquidButton
          type="submit"
          className="flex-1"
          disabled={
            isSubmitting
            || !hasDishName
            || (isPreparedDish && !hasDescription)
            || !formData.price
            || !formData.category
            || (!isPreparedDish && !hasDirectStockIngredient)
          }
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </LiquidButton>
      </div>
    </form>
  );
};

export default DishForm;
