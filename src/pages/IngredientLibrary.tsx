import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassInput,
  GlassSelect,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';
import { resolveAssetUrl } from '../services/api';
import {
  createIngredientLibraryItem,
  deleteIngredientLibraryItem,
  generateIngredientImage,
  generateMissingIngredientImages,
  listIngredientLibrary,
  type IngredientLibraryRecord,
  type IngredientImageStatus,
  updateIngredientLibraryItem,
} from '../services/ingredientLibraryService';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';

const PAGE_SIZE = 24;

const statusClassByKey: Record<IngredientImageStatus, string> = {
  exists: 'border-emerald-300/70 bg-emerald-50 text-emerald-700',
  generating: 'border-sky-300/70 bg-sky-50 text-sky-700',
  missing: 'border-amber-300/70 bg-amber-50 text-amber-700',
  failed: 'border-rose-300/70 bg-rose-50 text-rose-700',
};

const statusLabelByKey: Record<IngredientImageStatus, string> = {
  exists: 'Exists',
  generating: 'Generating',
  missing: 'Missing',
  failed: 'Failed',
};

const getStatus = (item: IngredientLibraryRecord): IngredientImageStatus => (
  item.image_status ?? (item.image_url || item.file_url ? 'exists' : 'missing')
);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const IngredientLibrary: React.FC = () => {
  const { i18n } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast();
  const [ingredients, setIngredients] = useState<IngredientLibraryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [submitting, setSubmitting] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  React.useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await listIngredientLibrary();
        setIngredients(list);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load ingredients library.'));
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((item) => {
      const category = (item.category || '').trim();
      if (category) set.add(category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return ingredients.filter((item) => {
      const displayName = getIngredientDisplayName(item, i18n.resolvedLanguage).toLowerCase();
      const nameOk = normalizedSearch === ''
        || item.name.toLowerCase().includes(normalizedSearch)
        || displayName.includes(normalizedSearch);
      const category = (item.category || '').trim();
      const categoryOk = categoryFilter === 'all'
        || (categoryFilter === '__uncategorized__'
          ? category === ''
          : category === categoryFilter);
      return nameOk && categoryOk;
    });
  }, [ingredients, search, categoryFilter, i18n.resolvedLanguage]);

  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const hasMore = visibleItems.length < filtered.length;

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setCategoryInput('');
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setNameInput('');
    setCategoryInput('');
    setFormOpen(true);
  };

  const openEdit = (item: IngredientLibraryRecord) => {
    setEditingId(item.id);
    setNameInput(item.name);
    setCategoryInput(item.category || '');
    setFormOpen(true);
  };

  const reloadList = async () => {
    const list = await listIngredientLibrary();
    setIngredients(list);
  };

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) {
      showToast('Ingredient name is required.', 'tertiary');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId === null) {
        const created = await createIngredientLibraryItem({
          name,
          category: categoryInput.trim() || null,
        });
        setIngredients((prev) => [created, ...prev]);
        showToast('Ingredient created.', 'secondary');
      } else {
        const updated = await updateIngredientLibraryItem(editingId, {
          name,
          category: categoryInput.trim() || null,
        });
        setIngredients((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
        showToast('Ingredient updated.', 'secondary');
      }

      resetForm();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save ingredient.'), 'tertiary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: IngredientLibraryRecord) => {
    const confirmed = window.confirm(`Delete "${getIngredientDisplayName(item, i18n.resolvedLanguage)}"?`);
    if (!confirmed) return;

    try {
      await deleteIngredientLibraryItem(item.id);
      setIngredients((prev) => prev.filter((entry) => entry.id !== item.id));
      showToast('Ingredient deleted.', 'secondary');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete ingredient.'), 'tertiary');
    }
  };

  const handleGenerate = async (item: IngredientLibraryRecord) => {
    try {
      setIngredients((prev) => prev.map((entry) => (
        entry.id === item.id ? { ...entry, image_status: 'generating' } : entry
      )));

      const updated = await generateIngredientImage(item.id);
      setIngredients((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
      showToast(`Image generated for ${getIngredientDisplayName(item, i18n.resolvedLanguage)}.`, 'secondary');
    } catch (err) {
      setIngredients((prev) => prev.map((entry) => (
        entry.id === item.id ? { ...entry, image_status: 'failed' } : entry
      )));
      showToast(getErrorMessage(err, 'Failed to generate image.'), 'tertiary');
    }
  };

  const handleGenerateMissing = async () => {
    setBulkGenerating(true);
    try {
      await generateMissingIngredientImages();
      await reloadList();
      showToast('Missing images generation started/completed.', 'secondary');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to generate missing images.'), 'tertiary');
    } finally {
      setBulkGenerating(false);
    }
  };

  return (
    <DashboardLayout title="Ingredient Library">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Ingredient Library</h2>
          <p className="mt-1 text-sm text-muted">
            Manage ingredients and AI-generated transparent images optimized for mobile usage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LiquidButton tone="tertiary" onClick={() => void reloadList()} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </LiquidButton>
          <LiquidButton tone="primary" onClick={handleGenerateMissing} disabled={bulkGenerating || isLoading}>
            {bulkGenerating ? 'Generating...' : 'Generate Missing Images'}
          </LiquidButton>
          <LiquidButton tone="secondary" onClick={openCreate}>Add Ingredient</LiquidButton>
        </div>
      </div>

      <GlassCard className="mb-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <GlassInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search ingredients by name..."
          />
          <GlassSelect
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            options={[
              { value: 'all', label: 'All categories' },
              { value: '__uncategorized__', label: 'Uncategorized' },
              ...categories.map((category) => ({ value: category, label: category })),
            ]}
          />
        </div>
      </GlassCard>

      {error ? (
        <div className="mb-5 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-sm text-spicy">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <GlassCard className="p-10 text-center text-muted">Loading ingredient library...</GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="text-lg font-semibold text-text">No ingredients found</p>
          <p className="mt-2 text-sm text-muted">Try another search/category filter or add a new ingredient.</p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visibleItems.map((item) => {
              const status = getStatus(item);
              const imageUrl = resolveAssetUrl(item.image_url ?? item.file_url);

              return (
                <GlassCard key={item.id} className="overflow-hidden p-0">
                  <div className="aspect-[4/3] bg-slate-100">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={getIngredientDisplayName(item, i18n.resolvedLanguage)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <p className="line-clamp-1 text-base font-semibold text-text">{getIngredientDisplayName(item, i18n.resolvedLanguage)}</p>
                      <p className="mt-1 line-clamp-1 text-xs uppercase tracking-[0.14em] text-muted2">
                        {item.category || 'Uncategorized'}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassByKey[status]}`}
                    >
                      {statusLabelByKey[status]}
                    </span>

                    <div className="flex flex-wrap gap-2">
                      <LiquidButton tone="tertiary" className="px-3 py-2 text-xs" onClick={() => openEdit(item)}>
                        Edit
                      </LiquidButton>
                      <LiquidButton tone="secondary" className="px-3 py-2 text-xs" onClick={() => void handleDelete(item)}>
                        Delete
                      </LiquidButton>
                      <LiquidButton
                        tone="primary"
                        className="px-3 py-2 text-xs"
                        disabled={status === 'generating'}
                        onClick={() => void handleGenerate(item)}
                      >
                        {status === 'generating' ? 'Generating...' : 'Generate Image'}
                      </LiquidButton>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <LiquidButton tone="tertiary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Load More
              </LiquidButton>
            </div>
          ) : null}
        </>
      )}

      {formOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[2147483647] overflow-y-auto bg-black/45 p-4">
          <div className="mx-auto my-4 w-full max-w-md rounded-[28px] border border-modalStroke bg-modalSurface p-5 shadow-lux2 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-text">{editingId === null ? 'Add Ingredient' : 'Edit Ingredient'}</h3>
            <div className="mt-4 space-y-3">
              <GlassInput
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="Ingredient name"
              />
              <GlassInput
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                placeholder="Category (optional)"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <LiquidButton tone="tertiary" onClick={resetForm} disabled={submitting}>
                Cancel
              </LiquidButton>
              <LiquidButton tone="primary" onClick={() => void handleSave()} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </LiquidButton>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default IngredientLibrary;
