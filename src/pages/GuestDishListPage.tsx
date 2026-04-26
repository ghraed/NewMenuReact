import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import type { Dish, RestaurantSummary } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import DishCard from '../components/Guest/DishCard';
import DishTags from '../components/Guest/DishTags';
import DishAssetThumbnail from '../components/Common/DishAssetThumbnail';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import GuestPageShell from '../components/Guest/GuestPageShell';
import GuestTableAccessPanel from '../components/Guest/GuestTableAccessPanel';
import SectionHeading from '../components/Guest/SectionHeading';
import { useOrderCart } from '../contexts/useOrderCart';
import { fetchGuestTableDish, fetchGuestTableMenu } from '../services/orderService';
import { getGuestRestaurantCandidateSlugs, getPreferredGuestRestaurantSlug } from '../utils/guestRestaurant';
import { buildGuestDishPath } from '../utils/guestTableRoutes';
import { translateCategoryLabel } from '../i18n/dynamic';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';
import { formatPriceWithCurrency, normalizeCurrency, readGuestCurrencySettings } from '../utils/currency';

interface GuestListResponse {
  restaurant: RestaurantSummary;
  dishes: Dish[];
}

type IngredientFilterMode = 'show' | 'hide' | 'highlight';

const normalizeIngredientName = (value?: string | null) => (
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const getDishIngredients = (dish: Dish) => {
  const seen = new Set<string>();

  return (dish.dish_ingredients || [])
    .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
    .map((row) => row.ingredient)
    .filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient))
    .filter((ingredient) => {
      const normalized = normalizeIngredientName(ingredient.name);

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
};

const applyRestaurantCurrencyToDishes = (
  list: Dish[],
  restaurant: GuestListResponse['restaurant']
): Dish[] => {
  const storedSettings = readGuestCurrencySettings();
  const restaurantCurrency = normalizeCurrency(storedSettings?.currency || restaurant.currency);
  const restaurantDollarRate = typeof storedSettings?.dollar_rate === 'number'
    ? storedSettings.dollar_rate
    : (typeof restaurant.dollar_rate === 'number'
      ? restaurant.dollar_rate
      : (restaurantCurrency === 'USD' ? 1 : null));

  return list.map((dish) => {
    const dishCurrency = normalizeCurrency(dish.currency || restaurant.currency);
    const basePrice = Number(dish.price);

    return {
      ...dish,
      price: Number.isFinite(basePrice) ? basePrice : 0,
      currency: dishCurrency,
      original_currency: restaurantCurrency,
      price_is_usd_base: dishCurrency === 'USD',
      dollar_rate: typeof dish.dollar_rate === 'number'
        ? dish.dollar_rate
        : (restaurantDollarRate ?? null),
    };
  });
};

const sortByRecommendationPriority = (list: Dish[]): Dish[] => {
  const withIndex = list.map((dish, index) => ({ dish, index }));

  withIndex.sort((left, right) => {
    const leftScore = left.dish.is_profitable === true ? 1 : 0;
    const rightScore = right.dish.is_profitable === true ? 1 : 0;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.index - right.index;
  });

  return withIndex.map((entry) => entry.dish);
};

const GuestDishListPage: React.FC = () => {
  const { restaurant_slug, table_id } = useParams<{ restaurant_slug?: string; table_id?: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { addDish, draft, getDishQuantity, setGuestContext, updateDraft, clearGuestAccess } = useOrderCart();
  const ingredientFilterRef = useRef<HTMLDivElement | null>(null);
  const [restaurantName, setRestaurantName] = useState(t('menuList.menu'));
  const [restaurantSlug, setRestaurantSlug] = useState(restaurant_slug || '');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [aiRecommendationsEnabled, setAiRecommendationsEnabled] = useState(true);
  const [tableOrderingEnabled, setTableOrderingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientFilterOpen, setIngredientFilterOpen] = useState(false);
  const [ingredientFilterMode, setIngredientFilterMode] = useState<IngredientFilterMode>('show');
  const [relatedPopupDishId, setRelatedPopupDishId] = useState<number | null>(null);
  const [relatedPopupLoading, setRelatedPopupLoading] = useState(false);
  const [relatedPopupError, setRelatedPopupError] = useState<string | null>(null);
  const [relatedPopupDishes, setRelatedPopupDishes] = useState<Dish[]>([]);

  useEffect(() => {
    const fetchList = async (slug?: string): Promise<GuestListResponse> => {
      const endpoint = slug ? `/menu/${slug}/dishes` : '/menu/dishes';
      const response = await api.get<GuestListResponse>(endpoint);
      return response.data;
    };

    const fetchDishes = async () => {
      setLoading(true);
      setError(null);

      try {
        if (table_id) {
          const response = await fetchGuestTableMenu(table_id, draft.guestAccessToken);

          if (response.table_session) {
            setGuestContext({
              restaurant: response.restaurant,
              tableId: response.table.number,
              tableReference: response.table.name,
              tableSessionId: response.table_session.id,
              guestAccess: response.guest_access,
            });
          } else {
            clearGuestAccess();
            updateDraft({
              tableId: response.table.number,
              tableReference: response.table.name,
              tableSessionId: null,
            });
          }
          setRestaurantName(response.restaurant.name);
          setRestaurantSlug(response.restaurant.slug);
          setAiRecommendationsEnabled(response.restaurant.feature_flags?.ai_recommendations !== false);
          setTableOrderingEnabled(response.restaurant.feature_flags?.table_ordering !== false);
          setDishes(applyRestaurantCurrencyToDishes(response.dishes, response.restaurant));
          return;
        }

        let data: GuestListResponse | null = null;

        if (restaurant_slug) {
          const candidateSlugs = getGuestRestaurantCandidateSlugs(restaurant_slug);

          for (const candidateSlug of candidateSlugs) {
            try {
              const nextData = await fetchList(candidateSlug);

              if (nextData.dishes.length > 0 || candidateSlugs.length === 1 || candidateSlug === candidateSlugs[candidateSlugs.length - 1]) {
                data = nextData;
                break;
              }
            } catch (err) {
              if (candidateSlugs.length === 1) {
                throw err;
              }
            }
          }
        } else {
          data = await fetchList();
        }

        if (!data) {
          throw new Error(i18n.t('menuList.noRestaurantData'));
        }

        setRestaurantName(data.restaurant.name);
        setRestaurantSlug(data.restaurant.slug);
        setAiRecommendationsEnabled(data.restaurant.feature_flags?.ai_recommendations !== false);
        setTableOrderingEnabled(data.restaurant.feature_flags?.table_ordering !== false);
        setDishes(applyRestaurantCurrencyToDishes(data.dishes, data.restaurant));
      } catch (err) {
        console.error(err);
        setError(i18n.t('menuList.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    fetchDishes();
  }, [draft.guestAccessToken, restaurant_slug, table_id, i18n, setGuestContext, updateDraft, clearGuestAccess]);

  useEffect(() => {
    setCategory(t('menuList.allCategories'));
  }, [i18n.resolvedLanguage, t]);

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
    const values = Array.from(new Set(dishes.map((dish) => translateCategoryLabel(dish.category, dish.category_ar)).filter(Boolean)));
    return [t('menuList.allCategories'), ...values];
  }, [dishes, t]);

  const allIngredients = useMemo(() => {
    const values = new Map<string, string>();

    dishes.forEach((dish) => {
      getDishIngredients(dish).forEach((ingredient) => {
        const translatedIngredient = getIngredientDisplayName(ingredient, i18n.resolvedLanguage);
        const normalized = normalizeIngredientName(translatedIngredient);

        if (!normalized || values.has(normalized)) {
          return;
        }

        values.set(normalized, translatedIngredient);
      });
    });

    return Array.from(values.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [dishes, i18n.resolvedLanguage]);

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
      const dishIngredients = getDishIngredients(dish)
        .map((ingredient) => getIngredientDisplayName(ingredient, i18n.resolvedLanguage))
        .map((ingredient) => normalizeIngredientName(ingredient));
      const hasMatchingIngredient = selectedIngredients.some((ingredient) => dishIngredients.includes(ingredient));

      if (hasMatchingIngredient) {
        ids.add(dish.id);
      }
    });

    return ids;
  }, [dishes, selectedIngredients, i18n.resolvedLanguage]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const categoryMatch = category === t('menuList.allCategories') || translateCategoryLabel(dish.category, dish.category_ar) === category;
      const searchMatch =
        dish.name.toLowerCase().includes(search.toLowerCase()) ||
        dish.description.toLowerCase().includes(search.toLowerCase());
      const ingredientMatch = selectedIngredients.length === 0
        || (
          ingredientFilterMode === 'show'
            ? matchingDishIds.has(dish.id)
            : ingredientFilterMode === 'hide'
              ? !matchingDishIds.has(dish.id)
              : true
        );

      return categoryMatch && searchMatch && ingredientMatch;
    });
  }, [dishes, category, search, selectedIngredients, ingredientFilterMode, matchingDishIds, t]);

  const anchorDishes = useMemo(
    () => filteredDishes.filter((dish) => dish.is_anchor === true),
    [filteredDishes]
  );

  const regularDishes = useMemo(
    () => filteredDishes.filter((dish) => dish.is_anchor !== true),
    [filteredDishes]
  );

  const dishLookup = useMemo(() => {
    const map = new Map<number, Dish>();

    dishes.forEach((dish) => {
      map.set(dish.id, dish);

      (dish.related_dishes || []).forEach((candidate) => {
        if (!map.has(candidate.id)) {
          map.set(candidate.id, candidate);
        }
      });

      (dish.alternative_dishes || []).forEach((candidate) => {
        if (!map.has(candidate.id)) {
          map.set(candidate.id, candidate);
        }
      });
    });

    return map;
  }, [dishes]);

  const getOrderableRelatedDishes = useCallback((sourceDish: Dish, detailDish?: Dish | null) => {
    const seen = new Set<number>();
    const isOrderableCandidate = (candidate: Dish) => (
      candidate.id !== sourceDish.id
      && !seen.has(candidate.id)
      && candidate.is_orderable !== false
      && candidate.is_out_of_stock !== true
    );
    const takeOrderable = (candidates: Dish[]) => candidates
      .map((candidate) => dishLookup.get(candidate.id) || candidate)
      .filter((candidate) => {
        if (!isOrderableCandidate(candidate)) {
          return false;
        }

        seen.add(candidate.id);
        return true;
      });

    const relatedMatchesRaw = takeOrderable(detailDish?.related_dishes || sourceDish.related_dishes || []);
    const relatedMatches = aiRecommendationsEnabled
      ? sortByRecommendationPriority(relatedMatchesRaw)
      : relatedMatchesRaw;

    if (relatedMatches.length > 0) {
      return relatedMatches;
    }

    const sameCategoryFallback = dishes.filter((candidate) => {
      if (candidate.id === sourceDish.id || seen.has(candidate.id)) {
        return false;
      }

      const sameCategory = (
        candidate.category === sourceDish.category
        || (
          Boolean(sourceDish.category_ar)
          && Boolean(candidate.category_ar)
          && candidate.category_ar === sourceDish.category_ar
        )
      );

      if (!sameCategory) {
        return false;
      }

      if (candidate.is_orderable === false || candidate.is_out_of_stock === true) {
        return false;
      }

      seen.add(candidate.id);
      return true;
    });

    return aiRecommendationsEnabled
      ? sortByRecommendationPriority(sameCategoryFallback)
      : sameCategoryFallback;
  }, [dishLookup, dishes, aiRecommendationsEnabled]);

  const relatedPopupSourceDish = relatedPopupDishId ? dishes.find((dish) => dish.id === relatedPopupDishId) || null : null;

  useEffect(() => {
    let isCancelled = false;

    const loadPopupCandidates = async () => {
      if (!relatedPopupSourceDish || !relatedPopupDishId) {
        setRelatedPopupDishes([]);
        setRelatedPopupError(null);
        setRelatedPopupLoading(false);
        return;
      }

      setRelatedPopupLoading(true);
      setRelatedPopupError(null);

      try {
        let detailDish: Dish | null = null;

        if (table_id) {
          const response = await fetchGuestTableDish(table_id, relatedPopupDishId, draft.guestAccessToken);
          detailDish = response.dish;
        } else {
          const endpoint = restaurantSlug
            ? `/menu/${restaurantSlug}/dish/${relatedPopupDishId}`
            : `/menu/dish/${relatedPopupDishId}`;
          const response = await api.get<Dish>(endpoint);
          detailDish = response.data;
        }

        if (isCancelled) {
          return;
        }

        setRelatedPopupDishes(getOrderableRelatedDishes(relatedPopupSourceDish, detailDish));
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error(error);
        setRelatedPopupError(t('menuList.failedToLoad'));
        setRelatedPopupDishes(getOrderableRelatedDishes(relatedPopupSourceDish));
      } finally {
        if (!isCancelled) {
          setRelatedPopupLoading(false);
        }
      }
    };

    loadPopupCandidates();

    return () => {
      isCancelled = true;
    };
  }, [relatedPopupSourceDish, relatedPopupDishId, table_id, draft.guestAccessToken, restaurantSlug, t, getOrderableRelatedDishes]);

  const toggleIngredientFilter = (ingredientValue: string) => {
    setSelectedIngredients((current) =>
      current.includes(ingredientValue)
        ? current.filter((value) => value !== ingredientValue)
        : [...current, ingredientValue]
    );
  };

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        {table_id ? (
          <div className="mb-6">
            <GuestTableAccessPanel
              tableId={draft.tableId ?? Number(table_id)}
              tableLabel={draft.tableReference || undefined}
            />
          </div>
        ) : null}

        <section aria-labelledby="dish-gallery-heading">
          <SectionHeading
            titleId="dish-gallery-heading"
            eyebrow={t('menuList.dishGallery')}
            title={t('menuList.title')}
            aside={(
              <span
                className="inline-flex rounded-full border px-4 py-2 text-sm font-medium"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                {t('menuList.dishesCount', { count: filteredDishes.length })}
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('menuList.searchLabel')}</span>
                <div className="relative mt-3">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--guest-muted)]">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('menuList.searchPlaceholder')}
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
                  {t('menuList.ingredientFilter')}
                </span>
                <button
                  type="button"
                  onClick={() => setIngredientFilterOpen((current) => !current)}
                  className="mt-3 flex w-full items-center justify-between gap-3 rounded-[26px] border px-4 py-3 text-left transition"
                  style={{
                    backgroundColor: 'var(--guest-panel)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                    boxShadow: 'var(--guest-shadow-soft)',
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selectedIngredientOptions.length > 0
                        ? t('menuList.selectedIngredientsSummary', {
                          count: selectedIngredientOptions.length,
                          mode: ingredientFilterMode === 'show'
                            ? t('menuList.modeShown')
                            : ingredientFilterMode === 'hide'
                              ? t('menuList.modeHidden')
                              : t('menuList.modeFlagged'),
                        })
                        : t('menuList.chooseIngredients')}
                    </p>
                    <p className="truncate text-xs text-[var(--guest-muted)]">
                      {selectedIngredientOptions.length > 0
                        ? selectedIngredientOptions.map((ingredient) => ingredient.label).join(', ')
                        : t('menuList.ingredientSearchHelp')}
                    </p>
                  </div>
                  <span className="shrink-0 text-[var(--guest-muted)]">{ingredientFilterOpen ? '▴' : '▾'}</span>
                </button>

                {ingredientFilterOpen ? (
                  <div
                    className="absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-[28px] border p-3"
                    style={{
                      backgroundColor: 'var(--guest-panel-solid)',
                      borderColor: 'var(--guest-border)',
                      boxShadow: 'var(--guest-shadow)',
                    }}
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--guest-muted)]">⌕</span>
                      <input
                        value={ingredientSearch}
                        onChange={(event) => setIngredientSearch(event.target.value)}
                        placeholder={t('menuList.ingredientFilterPlaceholder')}
                        className="w-full rounded-full border py-3 pl-11 pr-4 text-sm outline-none transition"
                        style={{
                          backgroundColor: 'var(--guest-panel)',
                          borderColor: 'var(--guest-border)',
                          color: 'var(--guest-text)',
                        }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIngredientFilterMode('show')}
                        className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                        style={{
                          backgroundColor: ingredientFilterMode === 'show' ? 'var(--guest-accent-soft)' : 'var(--guest-panel)',
                          borderColor: 'var(--guest-border)',
                          color: ingredientFilterMode === 'show' ? 'var(--guest-accent)' : 'var(--guest-text)',
                        }}
                      >
                        {t('menuList.showDishes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngredientFilterMode('hide')}
                        className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                        style={{
                          backgroundColor: ingredientFilterMode === 'hide' ? 'var(--guest-accent-soft)' : 'var(--guest-panel)',
                          borderColor: 'var(--guest-border)',
                          color: ingredientFilterMode === 'hide' ? 'var(--guest-accent)' : 'var(--guest-text)',
                        }}
                      >
                        {t('menuList.hideDishes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngredientFilterMode('highlight')}
                        className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                        style={{
                          backgroundColor: ingredientFilterMode === 'highlight'
                            ? 'color-mix(in srgb, rgb(var(--color-spicy)) 16%, var(--guest-panel))'
                            : 'var(--guest-panel)',
                          borderColor: ingredientFilterMode === 'highlight'
                            ? 'color-mix(in srgb, rgb(var(--color-spicy)) 48%, var(--guest-border))'
                            : 'var(--guest-border)',
                          color: ingredientFilterMode === 'highlight' ? 'rgb(var(--color-spicy))' : 'var(--guest-text)',
                        }}
                      >
                        {t('menuList.markRed')}
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
                            backgroundColor: 'var(--guest-panel)',
                            borderColor: 'var(--guest-border)',
                            color: 'var(--guest-muted)',
                          }}
                        >
                          {t('menuList.noIngredientMatches')}
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
                                backgroundColor: isSelected ? 'var(--guest-accent-soft)' : 'var(--guest-panel)',
                                borderColor: 'var(--guest-border)',
                                color: isSelected ? 'var(--guest-accent)' : 'var(--guest-text)',
                              }}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{ingredient.label}</p>
                                <p className="truncate text-xs text-[var(--guest-muted)]">
                                  {isSelected
                                    ? ingredientFilterMode === 'show'
                                      ? t('menuList.ingredientOptionSelectedShow')
                                      : ingredientFilterMode === 'hide'
                                        ? t('menuList.ingredientOptionSelectedHide')
                                        : t('menuList.ingredientOptionSelectedHighlight')
                                    : ingredientFilterMode === 'show'
                                      ? t('menuList.ingredientOptionShow')
                                      : ingredientFilterMode === 'hide'
                                        ? t('menuList.ingredientOptionHide')
                                        : t('menuList.ingredientOptionHighlight')}
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
                <p className="mb-3 whitespace-nowrap text-xs font-medium uppercase tracking-[0.28em] text-[var(--guest-accent)]">{t('menuList.filterByCategory')}</p>
                <DishTags tags={categories} activeTag={category} onTagClick={setCategory} />
              </div>
            </div>

            {selectedIngredientOptions.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--guest-accent)]">
                  {ingredientFilterMode === 'show'
                    ? t('menuList.showing')
                    : ingredientFilterMode === 'hide'
                      ? t('menuList.hiding')
                      : t('menuList.flagging')}
                </span>
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
                    {ingredient.label} ×
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
              <LoadingSpinner inline text={t('menuList.loadingMenu')} />
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
              {t('menuList.noDishesForFilter')}
            </div>
          ) : null}

          {!loading && !error && anchorDishes.length > 0 ? (
            <div className="mt-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold2">
                  {t('menuList.featuredEyebrow')}
                </span>
                <span className="text-sm text-[var(--guest-muted)]">
                  {t('menuList.featuredCount', { count: anchorDishes.length })}
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {anchorDishes.map((dish) => (
                  <DishCard
                    key={`anchor-${dish.id}`}
                    dish={dish}
                    onAddToCart={draft.guestAccessVerified && tableOrderingEnabled ? () => addDish(dish, {
                      restaurant: {
                        name: restaurantName,
                        slug: restaurantSlug || getPreferredGuestRestaurantSlug(),
                      },
                    }) : undefined}
                    cartQuantity={getDishQuantity(dish.id)}
                    onShowRelatedOptions={() => setRelatedPopupDishId(dish.id)}
                    onOpen={() => navigate(
                      table_id
                        ? buildGuestDishPath(table_id, dish.id)
                        : restaurantSlug
                          ? `/menu/${restaurantSlug}/dish/${dish.id}`
                          : `/menu/dish/${dish.id}`
                    )}
                    isIngredientAlert={ingredientFilterMode === 'highlight' && matchingDishIds.has(dish.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {!loading && !error && regularDishes.length > 0 ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {regularDishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  onAddToCart={draft.guestAccessVerified && tableOrderingEnabled ? () => addDish(dish, {
                    restaurant: {
                      name: restaurantName,
                      slug: restaurantSlug || getPreferredGuestRestaurantSlug(),
                    },
                  }) : undefined}
                  cartQuantity={getDishQuantity(dish.id)}
                  onShowRelatedOptions={() => setRelatedPopupDishId(dish.id)}
                  onOpen={() => navigate(
                    table_id
                      ? buildGuestDishPath(table_id, dish.id)
                      : restaurantSlug
                        ? `/menu/${restaurantSlug}/dish/${dish.id}`
                        : `/menu/dish/${dish.id}`
                  )}
                  isIngredientAlert={ingredientFilterMode === 'highlight' && matchingDishIds.has(dish.id)}
                />
              ))}
            </div>
          ) : null}
        </section>

        {!loading ? <GuestInfoSection restaurantName={restaurantName} /> : null}
      </main>

      {relatedPopupSourceDish ? (
        <div
          className="fixed inset-0 z-[2147483647] flex items-start justify-center bg-black/55 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:items-center sm:p-6"
          onClick={() => setRelatedPopupDishId(null)}
        >
          <div
            className="flex max-h-[calc(100dvh-env(safe-area-inset-top,0px)-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border p-4 sm:max-h-[82vh] sm:p-6"
            style={{
              backgroundColor: 'var(--guest-panel-solid)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--guest-accent)]">
                  {t('dishCard.outOfStock')}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--guest-text)] sm:text-xl">
                  {t('dishCard.orderRelatedTitle', {
                    defaultValue: 'Order related dishes for {{name}}',
                    name: relatedPopupSourceDish.name,
                  })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRelatedPopupDishId(null)}
                className="rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-text)',
                }}
              >
                {t('common.close', { defaultValue: 'Close' })}
              </button>
            </div>

            {relatedPopupLoading ? (
              <div
                className="rounded-[22px] border p-4 text-sm"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                {t('menuList.loadingMenu')}
              </div>
            ) : relatedPopupError && relatedPopupDishes.length === 0 ? (
              <div
                className="rounded-[22px] border p-4 text-sm"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                {relatedPopupError}
              </div>
            ) : relatedPopupDishes.length === 0 ? (
              <div
                className="rounded-[22px] border p-4 text-sm"
                style={{
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-muted)',
                }}
              >
                {t('dishCard.noRelatedAvailable', { defaultValue: 'No related dishes are currently available.' })}
              </div>
            ) : (
              <div className="mt-1 flex-1 space-y-3 overflow-y-auto pr-1">
                {relatedPopupDishes.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border p-3"
                    style={{
                      backgroundColor: 'var(--guest-panel)',
                      borderColor: 'var(--guest-border)',
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <DishAssetThumbnail
                        dish={candidate}
                        fit="cover"
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border sm:h-14 sm:w-14"
                        imageClassName="h-full w-full object-cover"
                        overlayClassName="bg-black/5"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--guest-text)] sm:text-base">{candidate.name}</p>
                        <p className="mt-1 text-xs text-[var(--guest-muted)]">
                          {formatPriceWithCurrency(Number(candidate.price), candidate.currency)}
                        </p>
                        {getDishQuantity(candidate.id) > 0 ? (
                          <p className="mt-1 text-xs font-medium text-[var(--guest-accent)]">
                            {t('dishCard.inCartCount', {
                              defaultValue: 'In cart: {{count}}',
                              count: getDishQuantity(candidate.id),
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(
                          table_id
                            ? buildGuestDishPath(table_id, candidate.id)
                            : restaurantSlug
                              ? `/menu/${restaurantSlug}/dish/${candidate.id}`
                              : `/menu/dish/${candidate.id}`
                        )}
                        className="rounded-full border px-3 py-2 text-xs font-semibold sm:text-sm"
                        style={{
                          backgroundColor: 'var(--guest-panel-strong)',
                          borderColor: 'var(--guest-border)',
                          color: 'var(--guest-text)',
                        }}
                      >
                        {t('dishCard.viewDetails')}
                      </button>
                      {draft.guestAccessVerified && tableOrderingEnabled ? (
                        <button
                          type="button"
                          onClick={() => addDish(candidate, {
                            restaurant: {
                              name: restaurantName,
                              slug: restaurantSlug || getPreferredGuestRestaurantSlug(),
                            },
                          })}
                          className="rounded-full border px-3 py-2 text-xs font-semibold sm:text-sm"
                          style={{
                            backgroundColor: 'var(--guest-accent)',
                            borderColor: 'var(--guest-accent)',
                            color: 'var(--guest-accent-button-text)',
                          }}
                        >
                          {t('dishCard.addToCart')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </GuestPageShell>
  );
};

export default GuestDishListPage;
