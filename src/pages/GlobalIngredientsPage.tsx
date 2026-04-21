import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassInput, LiquidButton } from '../components/ui/liquid-glass';
import api, { resolveAssetUrl } from '../services/api';
import type { GlobalIngredient } from '../types';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const GlobalIngredientsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const [ingredients, setIngredients] = useState<GlobalIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<GlobalIngredient[]>('/global-ingredients');
      setIngredients(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load global ingredients.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((item) => (
      item.name.toLowerCase().includes(q)
      || (item.name_ar || '').toLowerCase().includes(q)
      || getIngredientDisplayName(item, i18n.resolvedLanguage).toLowerCase().includes(q)
    ));
  }, [ingredients, search, i18n.resolvedLanguage]);

  const withImageCount = useMemo(
    () => filtered.filter((item) => Boolean(item.file_url || item.image_url)).length,
    [filtered]
  );

  return (
    <DashboardLayout title="Global Ingredients">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          Total: <span className="font-semibold text-text">{filtered.length}</span>
          {' '}| With images: <span className="font-semibold text-text">{withImageCount}</span>
        </div>
        <div className="flex gap-2">
          <GlassInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search global ingredients..."
          />
          <LiquidButton tone="tertiary" onClick={() => void fetchAll()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </LiquidButton>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl2 border border-spicy/35 bg-spicy/10 p-3 text-sm text-spicy">
          {error}
        </div>
      )}

      {loading ? (
        <GlassCard className="p-6 text-center text-muted">Loading global ingredients...</GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const imageUrl = resolveAssetUrl(item.image_url || item.file_url || null);
            return (
              <GlassCard key={item.id} className="p-3">
                <div className="aspect-square overflow-hidden rounded-xl border border-stroke bg-white">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white text-xs text-muted">
                      No image
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <div className="line-clamp-1 text-sm font-semibold text-text">
                    {getIngredientDisplayName(item, i18n.resolvedLanguage)}
                  </div>
                  <div className="line-clamp-1 text-xs text-muted">{item.normalized_name}</div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default GlobalIngredientsPage;

