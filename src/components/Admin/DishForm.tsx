import React, { useEffect, useRef, useState } from 'react';
import {
  GlassInput,
  GlassSurface,
  GlassToggle,
  LiquidButton,
} from '../ui/liquid-glass';
import { cx, focusRing, glassControl } from '../../theme/liquidGlass';
import DishIngredientAnimationPreview, {
  type DishIngredientAnimationItem,
} from './DishIngredientAnimationPreview';

const createClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `ingredient-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface DishIngredientLayerData {
  client_id: string;
  asset_id?: number;
  name: string;
  quantity: string;
  image_file: File | null;
  image_url: string | null;
  existing_image_url: string | null;
  file_name?: string | null;
}

export interface ExistingDishIngredientLayer {
  asset_id: number;
  name: string;
  quantity?: string | null;
  image_url: string | null;
  file_name?: string | null;
  order_index?: number;
}

const createIngredientLayer = (
  initial?: Partial<DishIngredientLayerData>
): DishIngredientLayerData => ({
  client_id: createClientId(),
  asset_id: initial?.asset_id,
  name: initial?.name || '',
  quantity: initial?.quantity || '',
  image_file: null,
  image_url: initial?.image_url || initial?.existing_image_url || null,
  existing_image_url: initial?.existing_image_url || initial?.image_url || null,
  file_name: initial?.file_name || null,
});

export interface DishFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  status: 'draft' | 'published';
  image_url: string;
  preview_file: File | null;
  glb_file: File | null;
  usdz_file: File | null;
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
}

const DishForm: React.FC<DishFormProps> = ({
  onSubmit,
  initialValues,
  requireModelUpload = true,
  submitLabel = 'Save Dish',
  submittingLabel = 'Saving...',
  existingFiles,
}) => {
  const [formData, setFormData] = useState<DishFormData>(() => ({
    name: initialValues?.name || '',
    description: initialValues?.description || '',
    price: initialValues?.price || '',
    category: initialValues?.category || '',
    status: initialValues?.status || 'published',
    image_url: initialValues?.image_url || '',
    preview_file: null,
    glb_file: null,
    usdz_file: null,
    ingredient_layers: [...(existingFiles?.ingredients ?? [])]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((ingredient) =>
        createIngredientLayer({
          asset_id: ingredient.asset_id,
          name: ingredient.name,
          quantity: ingredient.quantity || '',
          image_url: ingredient.image_url,
          existing_image_url: ingredient.image_url,
          file_name: ingredient.file_name,
        })
      ),
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const ingredientBlobUrlsRef = useRef<Set<string>>(new Set());
  const previewBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
      }

      ingredientBlobUrlsRef.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    const file = files && files.length > 0 ? files[0] : null;

    if (name === 'preview_file') {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
      }

      const nextBlobUrl = file ? URL.createObjectURL(file) : null;
      previewBlobUrlRef.current = nextBlobUrl;
      setPreviewBlobUrl(nextBlobUrl);
    }

    setFormData((prev) => ({ ...prev, [name]: file }));
  };

  const hasValidExtension = (file: File | null, ext: string) => {
    if (!file) return true;
    return file.name.toLowerCase().endsWith(ext);
  };

  const handleIngredientChange = (
    clientId: string,
    field: 'name' | 'quantity',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      ingredient_layers: prev.ingredient_layers.map((layer) =>
        layer.client_id === clientId ? { ...layer, [field]: value } : layer
      ),
    }));
  };

  const handleIngredientFileChange = (
    clientId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;

    setFormData((prev) => ({
      ...prev,
      ingredient_layers: prev.ingredient_layers.map((layer) => {
        if (layer.client_id !== clientId) {
          return layer;
        }

        if (layer.image_url?.startsWith('blob:')) {
          URL.revokeObjectURL(layer.image_url);
          ingredientBlobUrlsRef.current.delete(layer.image_url);
        }

        const nextBlobUrl = file ? URL.createObjectURL(file) : null;
        if (nextBlobUrl) {
          ingredientBlobUrlsRef.current.add(nextBlobUrl);
        }

        return {
          ...layer,
          image_file: file,
          image_url: nextBlobUrl ?? layer.existing_image_url,
          file_name: file?.name ?? layer.file_name,
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

  const removeIngredientLayer = (clientId: string) => {
    setFormData((prev) => {
      const target = prev.ingredient_layers.find((layer) => layer.client_id === clientId);
      if (target?.image_url?.startsWith('blob:')) {
        URL.revokeObjectURL(target.image_url);
        ingredientBlobUrlsRef.current.delete(target.image_url);
      }

      return {
        ...prev,
        ingredient_layers: prev.ingredient_layers.filter((layer) => layer.client_id !== clientId),
      };
    });
  };

  const imageUrlLooksSet = formData.image_url.trim().length > 0;
  const centeredDishImageUrl = previewBlobUrl || existingFiles?.previewImageUrl || formData.image_url.trim() || null;
  const animationIngredients: DishIngredientAnimationItem[] = formData.ingredient_layers
    .filter((layer) => layer.image_url || layer.name.trim() || layer.quantity.trim())
    .map((layer) => ({
      id: layer.client_id,
      name: layer.name.trim() || 'Ingredient',
      quantity: layer.quantity.trim() || undefined,
      imageUrl: layer.image_url,
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
        quantity: layer.quantity.trim(),
      }))
      .filter(
        (layer) =>
          layer.name.length > 0 ||
          layer.quantity.length > 0 ||
          !!layer.image_file ||
          !!layer.existing_image_url
      );

    for (const [index, layer] of normalizedIngredientLayers.entries()) {
      if (!layer.name) {
        setFormError(`Ingredient ${index + 1} needs a label.`);
        return;
      }

      if (!layer.image_file && !layer.existing_image_url) {
        setFormError(`Ingredient ${index + 1} needs an image.`);
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
          Dish Name *
        </label>
        <GlassInput
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Margherita Pizza"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-text">
          Description
        </label>
        <div className={cx('rounded-[26px] border px-4 py-3', glassControl, focusRing)}>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-xl bg-transparent text-text placeholder:text-muted2 focus:outline-none"
            placeholder="Classic pizza with tomato sauce, fresh mozzarella, and basil"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-text">
            Category *
          </label>
          <GlassInput
            type="text"
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            placeholder="Pizza, Appetizers, Desserts"
          />
        </div>
      </div>

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

      <div>
        <label htmlFor="image_url" className="mb-1 block text-sm font-medium text-text">
          Preview Image URL (Optional)
        </label>
        <GlassInput
          type="url"
          id="image_url"
          name="image_url"
          value={formData.image_url}
          onChange={handleChange}
          placeholder="https://example.com/pizza.jpg"
        />
        {imageUrlLooksSet && (
          <p className="mt-2 text-xs text-muted">
            Image found: {formData.image_url}
          </p>
        )}
      </div>

      <GlassSurface className="space-y-5 p-5" sheen={false}>
        <DishIngredientAnimationPreview
          dishName={formData.name}
          dishImageUrl={centeredDishImageUrl}
          ingredients={animationIngredients}
        />

        <div className="border-t border-white/10 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium text-text">Animated Ingredient Layers</h3>
              <p className="mt-1 text-sm text-muted">
                Upload dish-related ingredient images, then add the label and optional quantity shown during the final stage.
              </p>
            </div>
            <LiquidButton type="button" tone="tertiary" onClick={addIngredientLayer}>
              Add Ingredient
            </LiquidButton>
          </div>

          {formData.ingredient_layers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-muted">
              No ingredient layers yet. Add one or more images to power the animated stack.
            </div>
          ) : (
            <div className="space-y-4">
              {formData.ingredient_layers.map((layer, index) => (
                <div
                  key={layer.client_id}
                  className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">Ingredient {index + 1}</p>
                      <p className="mt-1 text-xs text-muted">
                        The image should visually match the dish so the expansion feels natural.
                      </p>
                    </div>
                    <LiquidButton
                      type="button"
                      tone="secondary"
                      onClick={() => removeIngredientLayer(layer.client_id)}
                    >
                      Remove
                    </LiquidButton>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45">
                      {layer.image_url ? (
                        <img
                          src={layer.image_url}
                          alt={layer.name || `Ingredient ${index + 1}`}
                          className="h-36 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-36 items-center justify-center px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                          Upload Image
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text">Ingredient Label *</label>
                          <GlassInput
                            type="text"
                            value={layer.name}
                            onChange={(event) =>
                              handleIngredientChange(layer.client_id, 'name', event.target.value)
                            }
                            placeholder="Fresh Basil"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text">Quantity (Optional)</label>
                          <GlassInput
                            type="text"
                            value={layer.quantity}
                            onChange={(event) =>
                              handleIngredientChange(layer.client_id, 'quantity', event.target.value)
                            }
                            placeholder="6 leaves"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-text">Ingredient Image *</label>
                        <GlassInput
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleIngredientFileChange(layer.client_id, event)}
                        />
                        <p className="mt-2 text-xs text-muted">
                          {layer.image_file
                            ? `Selected image: ${layer.image_file.name}`
                            : layer.file_name
                              ? `Current image: ${layer.file_name}`
                              : 'Use a transparent PNG or a tightly cropped ingredient photo for the cleanest result.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
              ? 'Upload at least one file. Allowed extensions: .glb, .usdz'
              : 'Optional on update. Upload new model files only when needed.'}
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
