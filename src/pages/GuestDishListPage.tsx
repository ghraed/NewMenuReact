import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import DishCard from '../components/Guest/DishCard';
import DishTags from '../components/Guest/DishTags';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import GuestPageShell from '../components/Guest/GuestPageShell';
import SectionHeading from '../components/Guest/SectionHeading';

interface GuestListResponse {
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  dishes: Dish[];
}

type IngredientFilterMode = 'hide' | 'highlight';

const configuredRestaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';
const fallbackRestaurantSlug = 'admin-restaurant';

const normalizeIngredientName = (value?: string | null) => (
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const getIngredientLabel = (dish: Dish, asset: Dish['assets'][number]) => {
  const metadataLabel = asset.metadata?.label;
  if (typeof metadataLabel === 'string' && metadataLabel.trim()) {
    return metadataLabel.trim();
  }

  const fileName = asset.metadata?.file_name;
  if (typeof fileName === 'string' && fileName.trim()) {
    return fileName.replace(/\.[^.]+$/, '').replace(/-/g, ' ').trim();
  }

  return `${dish.name} ingredient`;
};

const getDishIngredients = (dish: Dish) => {
  const seen = new Set<string>();

  return dish.assets
    .filter((asset) => asset.asset_type === 'ingredient_image')
    .map((asset) => getIngredientLabel(dish, asset))
    .filter((label) => {
      const normalized = normalizeIngredientName(label);

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
};

const GuestDishListPage: React.FC = () => {
  const navigate = useNavigate();
  const ingredientFilterRef = useRef<HTMLDivElement | null>(null);
  const [restaurantName, setRestaurantName] = useState('Menu');
  const [restaurantSlug, setRestaurantSlug] = useState(configuredRestaurantSlug);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientFilterOpen, setIngredientFilterOpen] = useState(false);
  const [ingredientFilterMode, setIngredientFilterMode] = useState<IngredientFilterMode>('hide');

  useEffect(() => {
    const fetchList = async (slug: string): Promise<GuestListResponse> => {
      const response = await api.get<GuestListResponse>(`/menu/${slug}/dishes`);
      return response.data;
    };

    const fetchDishes = async () => {
      try {
        let data = await fetchList(configuredRestaurantSlug);

        if (data.dishes.length === 0 && configuredRestaurantSlug !== fallbackRestaurantSlug) {
          data = await fetchList(fallbackRestaurantSlug);
        }

        setRestaurantName(data.restaurant.name);
        setRestaurantSlug(data.restaurant.slug);
        setDishes(data.dishes);
      } catch (err) {
        console.error(err);
        setError('Failed to load dishes');
      } finally {
        setLoading(false);
      }
    };

    fetchDishes();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (ingredientFilterRef.current?.contains(target)) {
        return;
      }

      setIngredientFilterOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(new Set(dishes.map((dish) => dish.category).filter(Boolean)));
    return ['All', ...values];
  }, [dishes]);

  const allIngredients = useMemo(() => {
    const values = new Map<string, string>();

    dishes.forEach((dish) => {
      getDishIngredients(dish).forEach((ingredient) => {
        const normalized = normalizeIngredientName(ingredient);

        if (!normalized || values.has(normalized)) {
          return;
        }

        values.set(normalized, ingredient);
      });
    });

    return Array.from(values.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [dishes]);

  const filteredIngredientOptions = useMemo(() => {
    const normalizedSearch = normalizeIngredientName(ingredientSearch);

    if (!normalizedSearch) {
      return allIngredients;
    }

    return allIngredients.filter((ingredient) =>
      ingredient.value.includes(normalizedSearch) || ingredient.label.toLowerCase().includes(normalizedSearch)
    );
  }, [allIngredients, ingredientSearch]);

  const selectedIngredientOptions = useMemo(() => {
    const optionMap = new Map(allIngredients.map((ingredient) => [ingredient.value, ingredient]));

    return selectedIngredients
      .map((value) => optionMap.get(value))
      .filter((ingredient): ingredient is { value: string; label: string } => Boolean(ingredient));
  }, [allIngredients, selectedIngredients]);

  const matchingDishIds = useMemo(() => {
    const ids = new Set<number>();

    if (selectedIngredients.length === 0) {
      return ids;
    }

    dishes.forEach((dish) => {
      const dishIngredients = getDishIngredients(dish).map((ingredient) => normalizeIngredientName(ingredient));
      const hasMatchingIngredient = selectedIngredients.some((ingredient) => dishIngredients.includes(ingredient));

      if (hasMatchingIngredient) {
        ids.add(dish.id);
      }
    });

    return ids;
  }, [dishes, selectedIngredients]);

  const normalizedSearch = search.trim().toLowerCase();
  const hasActiveFilters = normalizedSearch.length > 0 || category !== 'All' || selectedIngredients.length > 0;

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const categoryMatch = category === 'All' || dish.category === category;
      const ingredientLabels = getDishIngredients(dish).join(' ').toLowerCase();
      const searchableText = `${dish.name} ${dish.description} ${dish.category} ${ingredientLabels}`.toLowerCase();
      const searchMatch =
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);
      const ingredientMatch =
        ingredientFilterMode === 'highlight' ||
        selectedIngredients.length === 0 ||
        !matchingDishIds.has(dish.id);

      return categoryMatch && searchMatch && ingredientMatch;
    });
  }, [dishes, category, normalizedSearch, selectedIngredients, ingredientFilterMode, matchingDishIds]);

  const toggleIngredientFilter = (ingredientValue: string) => {
    setSelectedIngredients((current) =>
      current.includes(ingredientValue)
        ? current.filter((value) => value !== ingredientValue)
        : [...current, ingredientValue]
    );
  };

  const clearAllFilters = () => {
    setSearch('');
    setCategory('All');
    setSelectedIngredients([]);
    setIngredientSearch('');
    setIngredientFilterMode('hide');
    setIngredientFilterOpen(false);
  };

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        <section aria-labelledby="dish-gallery-heading">
          <SectionHeading
            titleId="dish-gallery-heading"
            eyebrow="Dish Gallery"
            title="Explore every dish with its own details page"
            aside={(
              <span
                className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                {filteredDishes.length} dishes
              </span>
            )}
          />

          <div
            className="mt-8 rounded-[32px] border p-4 sm:p-6"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Advanced Search</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--guest-muted)]">
                  Search by dish name, category, description, or ingredient. You can also choose one or more
                  ingredients to filter the menu more precisely.
                </p>
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                >
                  Clear All
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
                  Search by name or ingredient
                </span>
                <div className="relative mt-3">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--guest-muted)]">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Try dish names, categories, or ingredients..."
                    className="w-full rounded-full border py-3 pl-11 pr-4 text-sm outline-none transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                  />
                </div>
              </label>

              <div ref={ingredientFilterRef} className="relative min-w-0">
                <span className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">
                  Filter by ingredients
                </span>
                <button
                  type="button"
                  onClick={() => setIngredientFilterOpen((current) => !current)}
                  className="mt-3 flex w-full items-center justify-between gap-3 rounded-[26px] border px-4 py-3 text-left transition"
                  style={{
                    backgroundColor: 'var(--guest-panel-strong)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selectedIngredientOptions.length > 0
                        ? `${selectedIngredientOptions.length} ingredient${selectedIngredientOptions.length > 1 ? 's' : ''} ${ingredientFilterMode === 'hide' ? 'hidden' : 'flagged'}`
                        : 'Choose ingredients'}
                    </p>
                    <p className="truncate text-xs text-[var(--guest-muted)]">
                      {selectedIngredientOptions.length > 0
                        ? selectedIngredientOptions.map((ingredient) => ingredient.label).join(', ')
                        : 'Pick one or more ingredients to hide or highlight matching dishes'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[var(--guest-muted)]">{ingredientFilterOpen ? '▴' : '▾'}</span>
                </button>

                {ingredientFilterOpen ? (
                  <div
                    className="absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-[28px] border p-3"
                    style={{
                      backgroundColor: 'var(--guest-panel)',
                      borderColor: 'var(--guest-border)',
                      boxShadow: 'var(--guest-shadow)',
                    }}
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--guest-muted)]">⌕</span>
                      <input
                        value={ingredientSearch}
                        onChange={(event) => setIngredientSearch(event.target.value)}
                        placeholder="Search ingredients..."
                        className="w-full rounded-full border py-3 pl-11 pr-4 text-sm outline-none transition"
                        style={{
                          backgroundColor: 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                          color: 'var(--guest-text)',
                        }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIngredientFilterMode('hide')}
                        className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                        style={{
                          backgroundColor: ingredientFilterMode === 'hide' ? 'var(--guest-accent-soft)' : 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                          color: ingredientFilterMode === 'hide' ? 'var(--guest-accent)' : 'var(--guest-text)',
                        }}
                      >
                        Hide Dishes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngredientFilterMode('highlight')}
                        className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                        style={{
                          backgroundColor: ingredientFilterMode === 'highlight'
                            ? 'color-mix(in srgb, rgb(var(--color-spicy)) 16%, var(--guest-panel-strong))'
                            : 'var(--guest-panel-strong)',
                          borderColor: ingredientFilterMode === 'highlight'
                            ? 'color-mix(in srgb, rgb(var(--color-spicy)) 48%, var(--guest-border))'
                            : 'var(--guest-border)',
                          color: ingredientFilterMode === 'highlight' ? 'rgb(var(--color-spicy))' : 'var(--guest-text)',
                        }}
                      >
                        Mark Red
                      </button>
                    </div>

                    {selectedIngredientOptions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedIngredientOptions.map((ingredient) => (
                          <button
                            key={ingredient.value}
                            type="button"
                            onClick={() => toggleIngredientFilter(ingredient.value)}
                            className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                            style={{
                              backgroundColor: 'var(--guest-accent-soft)',
                              borderColor: 'var(--guest-border)',
                              color: 'var(--guest-accent)',
                            }}
                          >
                            {ingredient.label} ×
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                      {filteredIngredientOptions.length === 0 ? (
                        <div
                          className="rounded-[22px] border px-4 py-5 text-center text-sm"
                          style={{
                            backgroundColor: 'var(--guest-panel-strong)',
                            borderColor: 'var(--guest-border)',
                            color: 'var(--guest-muted)',
                          }}
                        >
                          No ingredients match your search.
                        </div>
                      ) : (
                        filteredIngredientOptions.map((ingredient) => {
                          const isSelected = selectedIngredients.includes(ingredient.value);

                          return (
                            <button
                              key={ingredient.value}
                              type="button"
                              onClick={() => toggleIngredientFilter(ingredient.value)}
                              className="flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-left transition"
                              style={{
                                backgroundColor: isSelected ? 'var(--guest-accent-soft)' : 'var(--guest-panel-strong)',
                                borderColor: 'var(--guest-border)',
                                color: isSelected ? 'var(--guest-accent)' : 'var(--guest-text)',
                              }}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{ingredient.label}</p>
                                <p className="truncate text-xs text-[var(--guest-muted)]">
                                  {isSelected
                                    ? ingredientFilterMode === 'hide'
                                      ? 'Currently hidden from results'
                                      : 'Currently highlighted in red'
                                    : ingredientFilterMode === 'hide'
                                      ? 'Hide dishes containing this ingredient'
                                      : 'Highlight dishes containing this ingredient'}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm">{isSelected ? '✓' : '+'}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <p className="mb-3 whitespace-nowrap text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">Category</p>
                <DishTags tags={categories} activeTag={category} onTagClick={setCategory} />
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--guest-accent)]">
                  Active Filters
                </span>
                {normalizedSearch ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                  >
                    Search: {search} ×
                  </button>
                ) : null}
                {category !== 'All' ? (
                  <button
                    type="button"
                    onClick={() => setCategory('All')}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                  >
                    Category: {category} ×
                  </button>
                ) : null}
                {selectedIngredientOptions.map((ingredient) => (
                  <button
                    key={ingredient.value}
                    type="button"
                    onClick={() => toggleIngredientFilter(ingredient.value)}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    style={{
                      backgroundColor: 'var(--guest-panel-strong)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                  >
                    {ingredientFilterMode === 'hide' ? 'Hide' : 'Mark'}: {ingredient.label} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div
              className="mt-6 rounded-[28px] border px-6 py-10 text-center"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                boxShadow: 'var(--guest-shadow-soft)',
              }}
            >
              <LoadingSpinner inline text="Loading menu..." />
            </div>
          ) : null}

          {error ? (
            <div
              className="mt-6 rounded-[28px] border p-4 text-sm"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-text)',
              }}
            >
              {error}
            </div>
          ) : null}

          {!loading && !error && filteredDishes.length === 0 ? (
            <div
              className="mt-6 rounded-[28px] border p-6 text-center text-sm"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-muted)',
              }}
            >
              No dishes found for your current search.
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredDishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  onOpen={() => navigate(`/menu/${restaurantSlug}/dish/${dish.id}`)}
                  isIngredientAlert={ingredientFilterMode === 'highlight' && matchingDishIds.has(dish.id)}
                />
              ))}
            </div>
          ) : null}
        </section>

        {!loading ? <GuestInfoSection restaurantName={restaurantName} /> : null}
      </main>
    </GuestPageShell>
  );
};

export default GuestDishListPage;
