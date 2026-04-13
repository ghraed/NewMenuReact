import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  GlassInput,
  GlassSelect,
  GlassSurface,
  GlassToggle,
  LiquidButton,
} from '../ui/liquid-glass';
import { translateCategoryLabel, translateStatusLabel } from '../../i18n/dynamic';
import { MENU_CATEGORIES } from '../../i18n/categories';
import { translateIngredientLabel } from '../../i18n/ingredients';
import type { IngredientLibraryItem } from '../../types';
import { resolveAssetUrl } from '../../services/api';
import { cx, focusRing, glassControl } from '../../theme/liquidGlass';

const createClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `ingredient-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeIngredientLookupValue = (value?: string | null): string => (
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

export interface DishIngredientLayerData {
  client_id: string;
  asset_id?: number;
  name: string;
  image_url: string | null;
  existing_image_url: string | null;
  existing_file_name?: string | null;
  library_image_url?: string | null;
  library_ingredient_id: number | null;
  initial_library_ingredient_id: number | null;
  file_name?: string | null;
}

export interface ExistingDishIngredientLayer {
  asset_id: number;
  name: string;
  quantity?: string | null;
  image_url: string | null;
  library_ingredient_id?: number | null;
  file_name?: string | null;
  order_index?: number;
}

const createIngredientLayer = (
  initial?: Partial<DishIngredientLayerData>
): DishIngredientLayerData => ({
  client_id: createClientId(),
  asset_id: initial?.asset_id,
  name: initial?.name || '',
  image_url: initial?.image_url || initial?.existing_image_url || null,
  existing_image_url: initial?.existing_image_url || initial?.image_url || null,
  existing_file_name: initial?.existing_file_name || initial?.file_name || null,
  library_image_url: initial?.library_image_url || null,
  library_ingredient_id: initial?.library_ingredient_id ?? null,
  initial_library_ingredient_id: initial?.initial_library_ingredient_id ?? initial?.library_ingredient_id ?? null,
  file_name: initial?.file_name || null,
});

const findMatchingLibraryIngredient = (
  layer: Pick<DishIngredientLayerData, 'name' | 'existing_file_name' | 'file_name' | 'library_ingredient_id'>,
  ingredientLibrary: IngredientLibraryItem[]
): IngredientLibraryItem | null => {
  if (layer.library_ingredient_id !== null) {
    const byId = ingredientLibrary.find((ingredient) => ingredient.id === layer.library_ingredient_id);
    if (byId) {
      return byId;
    }
  }

  const normalizedLabel = normalizeIngredientLookupValue(layer.name);
  if (normalizedLabel) {
    const byName = ingredientLibrary.find(
      (ingredient) => normalizeIngredientLookupValue(ingredient.name) === normalizedLabel
    );
    if (byName) {
      return byName;
    }
  }

  const normalizedFileName = normalizeIngredientLookupValue(layer.existing_file_name || layer.file_name);
  if (normalizedFileName) {
    const byFileName = ingredientLibrary.find(
      (ingredient) => normalizeIngredientLookupValue(ingredient.source_file_name) === normalizedFileName
    );
    if (byFileName) {
      return byFileName;
    }
  }

  return null;
};

export interface DishFormData {
  name: string;
  price: string;
  calories: string;
  category: string;
  status: 'draft' | 'published';
  preview_file: File | null;
  glb_file: File | null;
  usdz_file: File | null;
  suggested_dish_ids: number[];
  related_dish_ids: number[];
  ingredient_layers: DishIngredientLayerData[];
}

interface DishFormProps {
  onSubmit: (data: DishFormData) => Promise<void> | void;
  initialValues?: Partial<DishFormData>;
  requireModelUpload?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  existingFiles?: {
    glb?: string | null;
    usdz?: string | null;
    previewImage?: string | null;
    previewImageUrl?: string | null;
    imageUrl?: string | null;
    ingredients?: ExistingDishIngredientLayer[];
  };
  ingredientLibrary?: IngredientLibraryItem[];
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
  requireModelUpload = true,
  submitLabel = 'Save Dish',
  submittingLabel = 'Saving...',
  existingFiles,
  ingredientLibrary = [],
  suggestedDishOptions = [],
  relatedDishOptions = [],
}) => {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState<DishFormData>(() => ({
    name: initialValues?.name || '',
    price: initialValues?.price || '',
    calories: initialValues?.calories || '',
    category: initialValues?.category || '',
    status: initialValues?.status || 'published',
    preview_file: null,
    glb_file: null,
    usdz_file: null,
    suggested_dish_ids: initialValues?.suggested_dish_ids || [],
    related_dish_ids: initialValues?.related_dish_ids || [],
    ingredient_layers: [...(existingFiles?.ingredients ?? [])]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((ingredient) => {
        const matchedIngredient = findMatchingLibraryIngredient({
          name: ingredient.name,
          existing_file_name: ingredient.file_name,
          library_ingredient_id: ingredient.library_ingredient_id ?? null,
          file_name: ingredient.file_name,
        }, ingredientLibrary);

        return createIngredientLayer({
          asset_id: ingredient.asset_id,
          name: ingredient.name,
          image_url: ingredient.image_url,
          existing_image_url: ingredient.image_url,
          existing_file_name: ingredient.file_name,
          library_ingredient_id: matchedIngredient?.id ?? ingredient.library_ingredient_id ?? null,
          file_name: ingredient.file_name,
        });
      }),
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openIngredientPickerId, setOpenIngredientPickerId] = useState<string | null>(null);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [suggestedDishesPickerOpen, setSuggestedDishesPickerOpen] = useState(false);
  const [suggestedDishesSearch, setSuggestedDishesSearch] = useState('');
  const [relatedDishesPickerOpen, setRelatedDishesPickerOpen] = useState(false);
  const [relatedDishesSearch, setRelatedDishesSearch] = useState('');

  useEffect(() => {
    setIngredientSearchQuery('');
  }, [openIngredientPickerId]);

  useEffect(() => {
    setSuggestedDishesSearch('');
  }, [suggestedDishesPickerOpen]);

  useEffect(() => {
    setRelatedDishesSearch('');
  }, [relatedDishesPickerOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('[data-admin-overlay-root="true"]')) {
        return;
      }

      setOpenIngredientPickerId(null);
      setSuggestedDishesPickerOpen(false);
      setRelatedDishesPickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (ingredientLibrary.length === 0) {
      return;
    }

    setFormData((prev) => {
      let hasChanges = false;

      const nextLayers = prev.ingredient_layers.map((layer) => {
        const matchedIngredient = findMatchingLibraryIngredient(layer, ingredientLibrary);

        if (!matchedIngredient || layer.library_ingredient_id === matchedIngredient.id) {
          return layer;
        }

        hasChanges = true;

        return {
          ...layer,
          library_ingredient_id: matchedIngredient.id,
          initial_library_ingredient_id: layer.initial_library_ingredient_id ?? matchedIngredient.id,
          file_name: layer.file_name || matchedIngredient.source_file_name || null,
        };
      });

      if (!hasChanges) {
        return prev;
      }

      return {
        ...prev,
        ingredient_layers: nextLayers,
      };
    });
  }, [ingredientLibrary]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const handleIngredientChange = (clientId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      ingredient_layers: prev.ingredient_layers.map((layer) =>
        layer.client_id === clientId ? { ...layer, name: value } : layer
      ),
    }));
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

  const handleIngredientLibraryChange = (
    clientId: string,
    ingredientIdValue: string
  ) => {
    const selectedIngredientId = ingredientIdValue ? Number(ingredientIdValue) : null;
    const selectedIngredient = ingredientLibrary.find((ingredient) => ingredient.id === selectedIngredientId);

    setFormData((prev) => ({
      ...prev,
      ingredient_layers: prev.ingredient_layers.map((layer) => {
        if (layer.client_id !== clientId) {
          return layer;
        }

        if (!selectedIngredient) {
          return {
            ...layer,
            image_url: layer.existing_image_url,
            library_image_url: null,
            library_ingredient_id: null,
            file_name: layer.existing_file_name,
          };
        }

        return {
          ...layer,
          name: selectedIngredient.name,
          image_url: resolveAssetUrl(selectedIngredient.file_url) || layer.image_url,
          library_image_url: resolveAssetUrl(selectedIngredient.file_url) || null,
          library_ingredient_id: selectedIngredient.id,
          file_name: selectedIngredient.source_file_name || layer.file_name,
        };
      }),
    }));
  };

  const addIngredientLayer = () => {
    setFormData((prev) => ({
      ...prev,
      ingredient_layers: [...prev.ingredient_layers, createIngredientLayer()],
    }));
  };

  const moveIngredientLayer = (clientId: string, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const currentIndex = prev.ingredient_layers.findIndex((layer) => layer.client_id === clientId);

      if (currentIndex === -1) {
        return prev;
      }

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= prev.ingredient_layers.length) {
        return prev;
      }

      const nextLayers = [...prev.ingredient_layers];
      const [movedLayer] = nextLayers.splice(currentIndex, 1);
      nextLayers.splice(nextIndex, 0, movedLayer);

      return {
        ...prev,
        ingredient_layers: nextLayers,
      };
    });
  };

  const removeIngredientLayer = (clientId: string) => {
    setFormData((prev) => {
      setOpenIngredientPickerId((current) => (current === clientId ? null : current));

      return {
        ...prev,
        ingredient_layers: prev.ingredient_layers.filter((layer) => layer.client_id !== clientId),
      };
    });
  };

  const normalizedSuggestedDishesSearch = suggestedDishesSearch.trim().toLowerCase();
  const filteredSuggestedDishOptions = suggestedDishOptions.filter((dish) => {
    if (!normalizedSuggestedDishesSearch) {
      return true;
    }

    const searchableText = `${dish.name} ${dish.category} ${dish.status}`.toLowerCase();
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

    const searchableText = `${dish.name} ${dish.category} ${dish.status}`.toLowerCase();
    return searchableText.includes(normalizedRelatedDishesSearch);
  });
  const selectedRelatedDishOptions = formData.related_dish_ids
    .map((dishId) => relatedDishOptions.find((dish) => dish.id === dishId))
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
  const categoryOptions = MENU_CATEGORIES.map((category) => ({
    value: category.value,
    label: translateCategoryLabel(category.value, category.arabic),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const hasGlb = !!formData.glb_file;
    const hasUsdz = !!formData.usdz_file;

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

    const normalizedIngredientLayers = formData.ingredient_layers
      .map((layer) => ({
        ...layer,
        name: layer.name.trim(),
      }))
      .filter(
        (layer) =>
          layer.name.length > 0 ||
          !!layer.existing_image_url ||
          !!layer.library_ingredient_id
      );

    for (const [index, layer] of normalizedIngredientLayers.entries()) {
      if (!layer.name) {
        setFormError(`Ingredient ${index + 1} needs a label.`);
        return;
      }

      if (!layer.library_ingredient_id) {
        setFormError(`Ingredient ${index + 1} must be selected from the ingredient library.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        ingredient_layers: normalizedIngredientLayers,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-text">
          {t('dishForm.nameEn')}
        </label>
        <GlassInput
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder={t('dishForm.nameEnPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-text">
            Price ($) *
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
            placeholder="12.99"
          />
        </div>

        <div>
          <label htmlFor="calories" className="mb-1 block text-sm font-medium text-text">
            Calories
          </label>
          <GlassInput
            type="number"
            id="calories"
            name="calories"
            value={formData.calories}
            onChange={handleChange}
            min="0"
            step="1"
            placeholder="420"
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-text">
            Category *
          </label>
          <GlassSelect
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            options={categoryOptions}
            placeholder="Choose a category"
          />
          <p className="mt-2 text-xs text-muted">
            Category labels use the shared global dictionary across the app.
          </p>
        </div>
      </div>

      {suggestedDishOptions.length > 0 ? (
        <div className="relative" data-admin-overlay-root="true">
          <label className="mb-1 block text-sm font-medium text-text">Restaurant Suggests With This Dish</label>
          <button
            type="button"
            onClick={() => setSuggestedDishesPickerOpen((current) => !current)}
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
                  : 'Choose suggested dishes'}
              </p>
              <p className="truncate text-xs text-muted">
                {selectedSuggestedDishOptions.length > 0
                  ? selectedSuggestedDishOptions.map((dish) => dish.name).join(', ')
                  : 'Pick dishes the restaurant recommends alongside this one'}
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
                  {dish.name} ×
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
                  placeholder="Search dishes..."
                  leftSlot={<span>⌕</span>}
                />

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredSuggestedDishOptions.length === 0 ? (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted">
                      No dishes match your search.
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
                            <p className="truncate text-sm font-medium text-text">{dish.name}</p>
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
            These dishes will appear on the public dish detail page as restaurant suggestions.
          </p>
        </div>
      ) : null}

      {relatedDishOptions.length > 0 ? (
        <div className="relative" data-admin-overlay-root="true">
          <label className="mb-1 block text-sm font-medium text-text">Related Dishes</label>
          <button
            type="button"
            onClick={() => setRelatedDishesPickerOpen((current) => !current)}
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
                  : 'Choose related dishes'}
              </p>
              <p className="truncate text-xs text-muted">
                {selectedRelatedDishOptions.length > 0
                  ? selectedRelatedDishOptions.map((dish) => dish.name).join(', ')
                  : 'Pick dishes that should appear as related on this dish page'}
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
                  {dish.name} ×
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
                  placeholder="Search dishes..."
                  leftSlot={<span>⌕</span>}
                />

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredRelatedDishOptions.length === 0 ? (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted">
                      No dishes match your search.
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
                            <p className="truncate text-sm font-medium text-text">{dish.name}</p>
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
            These dishes will appear on the public dish detail page as related dishes.
          </p>
        </div>
      ) : null}

      <GlassSurface className="p-4" sheen={false}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-text">Dish Status</p>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  formData.status === 'published'
                    ? 'border-sage/35 bg-sage/10 text-sage'
                    : 'border-gold/35 bg-gold/10 text-gold2'
                }`}
              >
                {formData.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-xs text-muted">
              {formData.status === 'published'
                ? 'Published: visible to guests'
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

      <div>
        <label htmlFor="preview_file" className="mb-1 block text-sm font-medium text-text">
          Preview Image Upload (Optional)
        </label>
        <GlassInput
          type="file"
          id="preview_file"
          name="preview_file"
          accept="image/*"
          onChange={handleFileChange}
        />
        {formData.preview_file ? (
          <p className="mt-2 text-xs text-muted">Selected preview: {formData.preview_file.name}</p>
        ) : (
          existingFiles?.previewImage && (
            <p className="mt-2 text-xs text-muted">Current preview file: {existingFiles.previewImage}</p>
          )
        )}
        <p className="mt-2 text-xs text-muted">
          Uploading a new preview image replaces the current dish preview.
        </p>
      </div>

      <GlassSurface className="overflow-visible space-y-5 p-5" sheen={false}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-text">Ingredient Layers for Menu Animation</h3>
            <p className="mt-1 text-sm text-muted">
              Select ingredients from your saved library, then adjust the label if you want different guest-facing wording.
            </p>
            {ingredientLibrary.length > 0 && (
              <p className="mt-2 text-xs text-gold2/85">
                Saved ingredient selections drive the image preview, Arabic fallback, and story ordering for this dish.
              </p>
            )}
          </div>
          {ingredientLibrary.length > 0 ? (
            <LiquidButton type="button" tone="tertiary" onClick={addIngredientLayer}>
              Add Ingredient
            </LiquidButton>
          ) : null}
        </div>

        {ingredientLibrary.length === 0 ? (
          <div className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-5 text-sm text-gold2">
            Build your ingredient library first, then come back to select dish ingredients here.
            <div className="mt-3">
              <Link to="/admin/ingredients/library">
                <LiquidButton type="button" tone="tertiary" className="px-4 py-2 text-sm">
                  Open Ingredient Library
                </LiquidButton>
              </Link>
            </div>
          </div>
        ) : formData.ingredient_layers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-muted">
            No ingredient layers yet. Add one or more saved ingredients to power the ingredient story page.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.ingredient_layers.map((layer, index) => (
              (() => {
                const selectedLibraryIngredient = ingredientLibrary.find(
                  (ingredient) => ingredient.id === layer.library_ingredient_id
                ) ?? null;
                const selectedLibraryThumbnail = selectedLibraryIngredient
                  ? resolveAssetUrl(selectedLibraryIngredient.file_url)
                  : null;
                const ingredientPickerOpen = openIngredientPickerId === layer.client_id;
                const normalizedSearchQuery = ingredientSearchQuery.trim().toLowerCase();
                const filteredIngredientLibrary = ingredientLibrary.filter((ingredient) => {
                  if (!normalizedSearchQuery) {
                    return true;
                  }

                  const searchableText = `${ingredient.name} ${ingredient.name_ar || ''} ${ingredient.source_file_name || ''}`.toLowerCase();
                  return searchableText.includes(normalizedSearchQuery);
                });
                const visibleIngredients = selectedLibraryIngredient
                  ? [
                    selectedLibraryIngredient,
                    ...filteredIngredientLibrary.filter((ingredient) => ingredient.id !== selectedLibraryIngredient.id),
                  ]
                  : filteredIngredientLibrary;

                return (
                  <div
                    key={layer.client_id}
                    className="min-w-0 rounded-[26px] border border-white/10 bg-white/[0.035] p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">Ingredient {index + 1}</p>
                        <p className="mt-1 text-xs text-muted">
                          Pick a saved ingredient and keep the order aligned with the story you want guests to see.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <LiquidButton
                          type="button"
                          tone="tertiary"
                          onClick={() => moveIngredientLayer(layer.client_id, 'up')}
                          disabled={index === 0}
                          className="px-3 py-2 text-xs"
                        >
                          ↑ Up
                        </LiquidButton>
                        <LiquidButton
                          type="button"
                          tone="tertiary"
                          onClick={() => moveIngredientLayer(layer.client_id, 'down')}
                          disabled={index === formData.ingredient_layers.length - 1}
                          className="px-3 py-2 text-xs"
                        >
                          ↓ Down
                        </LiquidButton>
                        <LiquidButton
                          type="button"
                          tone="secondary"
                          onClick={() => removeIngredientLayer(layer.client_id)}
                        >
                          Remove
                        </LiquidButton>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45">
                        {layer.image_url ? (
                          <img
                            src={layer.image_url}
                            alt={layer.name || `Ingredient ${index + 1}`}
                            className="h-36 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                            Pick Ingredient
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          {ingredientLibrary.length > 0 && (
                            <div className="relative z-20 min-w-0 md:col-span-2" data-admin-overlay-root="true">
                              <label className="mb-1 block text-sm font-medium text-text">Choose Ingredient</label>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenIngredientPickerId((current) =>
                                    current === layer.client_id ? null : layer.client_id
                                  )
                                }
                                className={cx(
                                  'flex w-full min-w-0 items-center justify-between gap-3 rounded-[24px] border px-4 py-3 text-left',
                                  glassControl,
                                  focusRing
                                )}
                                aria-expanded={ingredientPickerOpen}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[18px] border border-white/12 bg-black/20">
                                    {selectedLibraryThumbnail ? (
                                      <img
                                        src={selectedLibraryThumbnail}
                                        alt={selectedLibraryIngredient?.name || 'Ingredient thumbnail'}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                                        Pick
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-text">
                                      {selectedLibraryIngredient?.name || 'Choose ingredient'}
                                    </p>
                                    <p className="truncate text-xs text-muted">
                                      {selectedLibraryIngredient
                                        ? 'Saved ingredient selected'
                                        : 'Pick from your ingredient library'}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 text-muted2">{ingredientPickerOpen ? '▴' : '▾'}</span>
                              </button>

                              {ingredientPickerOpen && (
                                <div
                                  className={cx(
                                    'absolute left-0 right-0 top-full z-40 mt-3 max-w-full overflow-hidden rounded-[24px] border border-stroke bg-bg1 shadow-lux2 backdrop-blur-xl',
                                    'supports-[backdrop-filter]:bg-bg1/95'
                                  )}
                                >
                                  <div className="mb-2">
                                    <GlassInput
                                      type="text"
                                      value={ingredientSearchQuery}
                                      onChange={(event) => setIngredientSearchQuery(event.target.value)}
                                      placeholder="Search ingredients"
                                      leftSlot={<span>🔎</span>}
                                      className="min-w-0"
                                    />
                                  </div>

                                  {layer.library_ingredient_id !== null && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleIngredientLibraryChange(layer.client_id, '');
                                        setOpenIngredientPickerId(null);
                                      }}
                                      className="mb-2 flex w-full items-center justify-center rounded-[18px] border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gold2 transition"
                                    >
                                      Clear saved ingredient
                                    </button>
                                  )}

                                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                                    {selectedLibraryIngredient && (
                                      <div className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold2/80">
                                        Selected
                                      </div>
                                    )}

                                    {visibleIngredients.length === 0 && (
                                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted">
                                        No ingredients match your search.
                                      </div>
                                    )}

                                    {visibleIngredients.map((ingredient, visibleIndex) => {
                                      const optionThumbnail = resolveAssetUrl(ingredient.file_url);
                                      const isActive = ingredient.id === layer.library_ingredient_id;
                                      const shouldShowResultsLabel = selectedLibraryIngredient !== null
                                        && visibleIndex === 0
                                        && ingredient.id !== selectedLibraryIngredient.id;

                                      return (
                                        <React.Fragment key={ingredient.id}>
                                          {shouldShowResultsLabel && (
                                            <div className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted2">
                                              Results
                                            </div>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleIngredientLibraryChange(layer.client_id, String(ingredient.id));
                                              setOpenIngredientPickerId(null);
                                            }}
                                            className={cx(
                                              'flex w-full min-w-0 items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition',
                                              isActive
                                                ? 'border-gold/35 bg-gold/12'
                                                : 'border-white/10 bg-white/[0.03]'
                                            )}
                                          >
                                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-black/20">
                                              {optionThumbnail ? (
                                                <img
                                                  src={optionThumbnail}
                                                  alt={translateIngredientLabel(ingredient.name, i18n.resolvedLanguage, ingredient.name_ar)}
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                                                  Img
                                                </div>
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-sm font-medium text-text">
                                                {translateIngredientLabel(ingredient.name, i18n.resolvedLanguage, ingredient.name_ar)}
                                              </p>
                                              <p className="truncate text-xs text-muted">
                                                {ingredient.source_file_name || 'Saved ingredient'}
                                              </p>
                                            </div>
                                          </button>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <p className="mt-2 text-xs text-muted">
                                {layer.library_ingredient_id
                                  ? 'This layer uses the saved ingredient image and Arabic fallback from your library entry.'
                                  : 'Choose a saved ingredient to populate this layer.'}
                              </p>
                              <p className="mt-1 text-xs text-muted2">
                                Order here controls the animation stack from top to bottom.
                              </p>
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-sm font-medium text-text">Ingredient Label *</label>
                            <GlassInput
                              type="text"
                              value={layer.name}
                              onChange={(event) => handleIngredientChange(layer.client_id, event.target.value)}
                              placeholder="Fresh Basil"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </GlassSurface>

      <div className="border-t border-stroke pt-6">
        <h3 className="mb-2 text-lg font-medium text-text">3D Assets</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="glb_file" className="mb-1 block text-sm font-medium text-text">
              GLB File (Android/WebXR)
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
              USDZ File (iOS AR)
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
              ? 'Upload at least one file. GLB powers Android/WebXR, and USDZ powers iPhone/iPad AR.'
              : 'Optional on update. Upload new model files only when needed. GLB powers Android/WebXR, and USDZ powers iPhone/iPad AR.'}
          </p>
          <p className="text-xs text-muted">
            Upload both files if you want the dish to support AR on both platforms.
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
          Cancel
        </LiquidButton>
        <LiquidButton
          type="submit"
          className="flex-1"
          disabled={isSubmitting || !formData.name || !formData.price || !formData.category}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </LiquidButton>
      </div>
    </form>
  );
};

export default DishForm;
