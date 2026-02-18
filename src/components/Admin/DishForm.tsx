import React, { useState } from 'react';
import {
  GlassInput,
  GlassSurface,
  GlassToggle,
  LiquidButton,
} from '../ui/liquid-glass';
import { cx, getModernMode, glassControl } from '../../theme/liquidGlass';

export interface DishFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  status: 'draft' | 'published';
  image_url: string;
  glb_file: File | null;
  usdz_file: File | null;
}

interface DishFormProps {
  onSubmit: (data: DishFormData) => Promise<void> | void;
  initialValues?: Partial<DishFormData>;
  requireModelUpload?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
}

const DishForm: React.FC<DishFormProps> = ({
  onSubmit,
  initialValues,
  requireModelUpload = true,
  submitLabel = 'Save Dish',
  submittingLabel = 'Saving...',
}) => {
  const modern = getModernMode();
  const [formData, setFormData] = useState<DishFormData>({
    name: initialValues?.name || '',
    description: initialValues?.description || '',
    price: initialValues?.price || '',
    category: initialValues?.category || '',
    status: initialValues?.status || 'published',
    image_url: initialValues?.image_url || '',
    glb_file: null,
    usdz_file: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-lg-text">
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
          modern={modern}
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-lg-text">
          Description
        </label>
        <div className={cx('rounded-[26px] border px-4 py-3', glassControl(modern), 'lg-lift-sm')}>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-xl bg-transparent text-lg-text placeholder:text-slate-700/70 focus:outline-none"
            placeholder="Classic pizza with tomato sauce, fresh mozzarella, and basil"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-lg-text">
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
            modern={modern}
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-lg-text">
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
            modern={modern}
          />
        </div>
      </div>

      <GlassSurface className="p-4" sheen={false} modern={modern}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-lg-text">Dish Status</p>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  formData.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {formData.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-xs text-slate-700/70">
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
            modern={modern}
          />
        </div>
      </GlassSurface>

      <div>
        <label htmlFor="image_url" className="mb-1 block text-sm font-medium text-lg-text">
          Preview Image URL (Optional)
        </label>
        <GlassInput
          type="url"
          id="image_url"
          name="image_url"
          value={formData.image_url}
          onChange={handleChange}
          placeholder="https://example.com/pizza.jpg"
          modern={modern}
        />
      </div>

      <div className="border-t border-white/30 pt-6">
        <h3 className="mb-2 text-lg font-medium text-lg-text">3D Assets</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="glb_file" className="mb-1 block text-sm font-medium text-lg-text">
              GLB File (Android/WebXR)
            </label>
            <GlassInput type="file" id="glb_file" name="glb_file" accept=".glb" onChange={handleFileChange} modern={modern} />
          </div>
          <div>
            <label htmlFor="usdz_file" className="mb-1 block text-sm font-medium text-lg-text">
              USDZ File (iOS AR)
            </label>
            <GlassInput type="file" id="usdz_file" name="usdz_file" accept=".usdz" onChange={handleFileChange} modern={modern} />
          </div>
          <p className="text-xs text-slate-700/70">
            {requireModelUpload
              ? 'Upload at least one file. Allowed extensions: .glb, .usdz'
              : 'Optional on update. Upload new model files only when needed.'}
          </p>
        </div>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-200/80 bg-red-100/60 p-3 text-sm text-red-700">
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
