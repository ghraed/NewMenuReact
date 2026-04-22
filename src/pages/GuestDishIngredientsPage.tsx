import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import SectionHeading from '../components/Guest/SectionHeading';
import DishIngredientStory, { type DishIngredientStoryItem } from '../components/Guest/DishIngredientStory';
import api, { resolveAssetUrl } from '../services/api';
import { fetchGuestTableDish } from '../services/orderService';
import type { Dish } from '../types';
import { formatRestaurantLabel } from '../utils/guestRestaurant';
import { buildGuestDishPath } from '../utils/guestTableRoutes';

const formatIngredientQuantity = (quantity?: string, unit?: string) => {
  if (!quantity) return undefined;
  return unit ? `${quantity} ${unit}` : quantity;
};

const GuestDishIngredientsPage: React.FC = () => {
  const { restaurant_slug, table_id, dish_id } = useParams<{ restaurant_slug?: string; table_id?: string; dish_id: string }>();
  const { t } = useTranslation();
  const [dish, setDish] = useState<Dish | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | undefined>(restaurant_slug);
  const [resolvedTableId, setResolvedTableId] = useState<number | undefined>(
    table_id ? Number(table_id) : undefined
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDish = async () => {
      if (!dish_id) {
        setError(t('ingredientStory.notFound'));
        setLoading(false);
        return;
      }

      try {
        if (table_id) {
          const response = await fetchGuestTableDish(table_id, dish_id);
          setDish(response.dish);
          setRestaurantSlug(response.restaurant.slug);
          setResolvedTableId(response.table.number);
          return;
        }

        const endpoint = restaurant_slug
          ? `/menu/${restaurant_slug}/dish/${dish_id}`
          : `/menu/dish/${dish_id}`;
        const response = await api.get(endpoint, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        setDish(response.data);
        setRestaurantSlug(response.data?.restaurant?.slug || restaurant_slug);
      } catch (err) {
        console.error(err);
        setError(t('ingredientStory.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    fetchDish();
  }, [restaurant_slug, table_id, dish_id, t]);

  const previewImageUrl = useMemo(() => {
    if (!dish) return undefined;

    return resolveAssetUrl(
      dish.assets.find((asset) => asset.asset_type === 'preview_image')?.file_url || dish.image_url,
    );
  }, [dish]);

  const ingredientItems = useMemo<DishIngredientStoryItem[]>(() => {
    if (!dish) return [];

    return (dish.dish_ingredients || [])
      .filter((row) => row.show_in_animation !== false)
      .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
      .map((row) => ({
        id: row.id,
        name: row.ingredient?.name || '',
        nameAr: row.ingredient?.name_ar || null,
        quantity: formatIngredientQuantity(row.quantity, row.unit),
        imageUrl: resolveAssetUrl(row.ingredient?.file_url),
      }));
  }, [dish]);

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-18 sm:px-6 sm:pb-14 sm:pt-22 lg:px-8">
        <div className="mb-8">
          <Link
            to={resolvedTableId
              ? buildGuestDishPath(resolvedTableId, dish_id ?? '')
              : restaurantSlug && dish_id
                ? `/menu/${restaurantSlug}/dish/${dish_id}`
                : dish_id
                  ? `/menu/dish/${dish_id}`
                  : '/menu'}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--guest-muted)] transition hover:text-[var(--guest-text)]"
          >
            <span aria-hidden="true">←</span>
            {t('ingredientStory.backToDish')}
          </Link>
        </div>

        {loading ? (
          <div
            className="rounded-[32px] border px-6 py-12 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
          >
            <LoadingSpinner inline text={t('ingredientStory.loading')} />
          </div>
        ) : null}

        {!loading && error ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
            }}
          >
            {error}
          </div>
        ) : null}

        {!loading && !error && !dish ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-muted)',
            }}
          >
            {t('ingredientStory.notFound')}
          </div>
        ) : null}

        {!loading && !error && dish ? (
          <div className="space-y-8">
            <SectionHeading
              eyebrow={formatRestaurantLabel(restaurantSlug)}
              title={t('ingredientStory.title', { dishName: dish.name })}
              description={t('ingredientStory.description')}
            />

            <DishIngredientStory
              dishName={dish.name}
              dishImageUrl={previewImageUrl}
              ingredients={ingredientItems}
            />
          </div>
        ) : null}
      </main>
    </GuestPageShell>
  );
};

export default GuestDishIngredientsPage;
