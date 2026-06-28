import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassInput, GlassSelect, GlassSurface, LiquidButton } from '../ui/liquid-glass';
import { MENU_CATEGORIES } from '../../i18n/categories';
import { translateCategoryLabel } from '../../i18n/dynamic';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import type { MenuItemType } from '../../types';
import type { DishFormData } from './DishForm';
import { useAuth } from '../../contexts/useAuth';

interface ProductItemFormProps {
  itemType: Extract<MenuItemType, 'packaged_drink' | 'other_product'>;
  onSubmit: (data: DishFormData) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  submittingLabel?: string;
  requirePreviewUpload?: boolean;
}

const PACKAGED_UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'L' },
  { value: 'can', label: 'Can' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'piece', label: 'Piece' },
  { value: 'pack', label: 'Pack' },
];

const ProductItemForm: React.FC<ProductItemFormProps> = ({
  itemType,
  onSubmit,
  onCancel,
  submitLabel = 'Create Menu Item',
  submittingLabel = 'Creating...',
  requirePreviewUpload = false,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPackagedDrink = itemType === 'packaged_drink';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: '',
    currency: 'USD',
    status: 'published' as 'draft' | 'published',
    brand: '',
    sizeValue: '',
    packagedUnit: '',
    price: '',
    costPrice: '',
    packagedStockQuantity: '',
    barcode: '',
    supplier: '',
    servingTemperature: '' as '' | 'cold' | 'room',
    previewFile: null as File | null,
  });

  const categoryOptions = useMemo(
    () => {
      const allowedRestaurantCategories = (user?.restaurant?.menu_categories ?? []).filter((value) => value.trim() !== '');

      return MENU_CATEGORIES
        .filter((category) => (
          allowedRestaurantCategories.length === 0
          || allowedRestaurantCategories.includes(category.value)
          || category.value === form.category
        ))
        .map((category) => ({
          value: category.value,
          label: translateCategoryLabel(category.value, category.arabic),
        }));
    },
    [form.category, user?.restaurant?.menu_categories]
  );

  const deriveName = (): string => {
    const unitText = form.packagedUnit ? ` ${form.packagedUnit}` : '';
    const sizeText = form.sizeValue.trim() ? ` ${form.sizeValue.trim()}${unitText}` : '';

    if (isPackagedDrink) {
      const base = form.brand.trim() || t('dishForm.packagedDrinkFallbackName');
      return `${base}${sizeText}`.trim();
    }

    const base = form.brand.trim() || t('dishForm.otherProductFallbackName');
    return `${base}${sizeText}`.trim();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!form.category) {
      setFormError(t('dishForm.productErrors.chooseCategory'));
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setFormError(t('dishForm.productErrors.validSellingPrice'));
      return;
    }
    if (requirePreviewUpload && !form.previewFile) {
      setFormError(t('dishForm.productErrors.uploadPreviewImage'));
      return;
    }

    const payload: DishFormData = {
      item_type: itemType,
      name: deriveName(),
      description: '',
      description_ar: '',
      price: form.price,
      currency: form.currency as DishFormData['currency'],
      calories: '',
      category: form.category,
      status: form.status,
      is_anchor: false,
      is_profitable: false,
      preview_file: form.previewFile,
      glb_file: null,
      usdz_file: null,
      suggested_dish_ids: [],
      related_dish_ids: [],
      recipe_ingredients: [],
      direct_stock_ingredient_id: null,
      direct_stock_quantity_per_sale: '',
      brand: form.brand.trim(),
      barcode: form.barcode.trim(),
      size_label: form.sizeValue.trim(),
      packaged_unit: form.packagedUnit.trim(),
      cost_price: form.costPrice.trim(),
      supplier: form.supplier.trim(),
      packaged_stock_quantity: form.packagedStockQuantity.trim(),
      serving_temperature: isPackagedDrink ? form.servingTemperature : '',
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <GlassSurface className="space-y-4 p-5" sheen={false}>
        <h3 className="text-lg font-semibold text-text">
          {isPackagedDrink ? t('dishForm.packagedDrinkDetails') : t('dishForm.productDetails')}
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.categoryLabel')}</label>
            <GlassSelect
              name="category"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              options={categoryOptions}
              placeholder={t('dishForm.chooseCategoryPlaceholder')}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.currencyLabel')}</label>
            <GlassSelect
              name="currency"
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              options={CURRENCY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.priceLabel')}</label>
            <GlassInput
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              placeholder={t('dishForm.pricePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.dishStatus')}</label>
            <GlassSelect
              name="status"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as 'draft' | 'published' }))}
              options={[
                { value: 'published', label: t('dynamic.status.published') },
                { value: 'draft', label: t('dynamic.status.draft') },
              ]}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.brandLabel')}</label>
            <GlassInput
              value={form.brand}
              onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
              placeholder={isPackagedDrink ? t('dishForm.brandPlaceholderDrink') : t('dishForm.brandPlaceholderProduct')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.sizeLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              <GlassInput
                value={form.sizeValue}
                onChange={(event) => setForm((prev) => ({ ...prev, sizeValue: event.target.value }))}
                placeholder={t('dishForm.sizePlaceholder')}
              />
              <GlassSelect
                value={form.packagedUnit}
                onChange={(event) => setForm((prev) => ({ ...prev, packagedUnit: event.target.value }))}
                options={PACKAGED_UNITS}
                placeholder={t('dishForm.unitPlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.costPriceLabel')}</label>
            <GlassInput
              type="number"
              min="0"
              step="0.01"
              value={form.costPrice}
              onChange={(event) => setForm((prev) => ({ ...prev, costPrice: event.target.value }))}
              placeholder={t('dishForm.costPricePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.stockQuantityLabel')}</label>
            <GlassInput
              type="number"
              min="0"
              step="0.001"
              value={form.packagedStockQuantity}
              onChange={(event) => setForm((prev) => ({ ...prev, packagedStockQuantity: event.target.value }))}
              placeholder={t('dishForm.stockQuantityPlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.barcodeOptional')}</label>
            <GlassInput
              value={form.barcode}
              onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
              placeholder={t('dishForm.barcodePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.supplierOptional')}</label>
            <GlassInput
              value={form.supplier}
              onChange={(event) => setForm((prev) => ({ ...prev, supplier: event.target.value }))}
              placeholder={t('dishForm.supplierPlaceholder')}
            />
          </div>

          {isPackagedDrink ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-text">{t('dishForm.servingTemperatureLabel')}</label>
              <GlassSelect
                value={form.servingTemperature}
                onChange={(event) => setForm((prev) => ({ ...prev, servingTemperature: event.target.value as '' | 'cold' | 'room' }))}
                options={[
                  { value: '', label: t('dishForm.servingTemperatureOptions.notSet') },
                  { value: 'cold', label: t('dishForm.servingTemperatureOptions.cold') },
                  { value: 'room', label: t('dishForm.servingTemperatureOptions.room') },
                ]}
              />
            </div>
          ) : null}
        </div>
      </GlassSurface>

      <GlassSurface className="space-y-3 p-5" sheen={false}>
        <label htmlFor="preview_file" className="block text-sm font-medium text-text">
          {requirePreviewUpload ? `${t('dishForm.previewImageUploadOptional')} *` : t('dishForm.previewImageUploadOptional')}
        </label>
        <GlassInput
          type="file"
          id="preview_file"
          name="preview_file"
          accept="image/*"
          onChange={(event) => setForm((prev) => ({ ...prev, previewFile: event.target.files?.[0] || null }))}
          required={requirePreviewUpload}
        />
        {form.previewFile ? (
          <p className="text-xs text-muted">{t('dishForm.selectedPreview', { name: form.previewFile.name })}</p>
        ) : null}
      </GlassSurface>

      {formError ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {formError}
        </div>
      ) : null}

      <div className="flex gap-3 pt-2">
        <LiquidButton type="button" tone="tertiary" className="flex-1" onClick={onCancel}>
          {t('dishForm.cancel')}
        </LiquidButton>
        <LiquidButton type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </LiquidButton>
      </div>
    </form>
  );
};

export default ProductItemForm;
