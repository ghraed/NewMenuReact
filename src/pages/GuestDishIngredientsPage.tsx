import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import GuestPageShell from '../components/Guest/GuestPageShell';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import SectionHeading from '../components/Guest/SectionHeading';
import DishIngredientStory, { type DishIngredientStoryItem } from '../components/Guest/DishIngredientStory';
import api, { resolveAssetUrl } from '../services/api';
import type { Dish } from '../types';

const formatRestaurantLabel = (value?: string) =>
  value?.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Menu';

const getIngredientOrder = (metadata: Dish['assets'][number]['metadata']) => {
  const order = metadata?.order_index;
  return typeof order === 'number' ? order : 0;
};

const getIngredientLabel = (metadata: Dish['assets'][number]['metadata']) => {
  const label = metadata?.label;
  return typeof label === 'string' && label.trim() ? label : 'Ingredient';
};

const getIngredientQuantity = (metadata: Dish['assets'][number]['metadata']) => {
  const quantity = metadata?.quantity;
  return typeof quantity === 'string' && quantity.trim() ? quantity : undefined;
};

const GuestDishIngredientsPage: React.FC = () => {
  const { restaurant_slug, dish_id } = useParams<{ restaurant_slug: string; dish_id: string }>();
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDish = async () => {
      try {
        const response = await api.get(`/menu/${restaurant_slug}/dish/${dish_id}`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        setDish(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load ingredient story');
      } finally {
        setLoading(false);
      }
    };

    fetchDish();
  }, [restaurant_slug, dish_id]);

  const previewImageUrl = useMemo(() => {
    if (!dish) return undefined;

    return resolveAssetUrl(
      dish.assets.find((asset) => asset.asset_type === 'preview_image')?.file_url || dish.image_url,
    );
  }, [dish]);

  const ingredientItems = useMemo<DishIngredientStoryItem[]>(() => {
    if (!dish) return [];

    return dish.assets
      .filter((asset) => asset.asset_type === 'ingredient_image')
      .sort((left, right) => getIngredientOrder(left.metadata) - getIngredientOrder(right.metadata))
      .map((asset) => ({
        id: asset.id,
        name: getIngredientLabel(asset.metadata),
        quantity: getIngredientQuantity(asset.metadata),
        imageUrl: resolveAssetUrl(asset.file_url),
      }));
  }, [dish]);

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-18 sm:px-6 sm:pb-14 sm:pt-22 lg:px-8">
        <div className="mb-8">
          <Link
            to={restaurant_slug && dish_id ? `/menu/${restaurant_slug}/dish/${dish_id}` : '/'}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--guest-muted)] transition"
          >
            <span aria-hidden="true">←</span>
            Back to dish
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
            <LoadingSpinner inline text="Loading ingredient story..." />
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
            Ingredient story not found
          </div>
        ) : null}

        {!loading && !error && dish ? (
          <div className="space-y-8">
            <SectionHeading
              eyebrow={formatRestaurantLabel(restaurant_slug)}
              title={`${dish.name} Ingredient Story`}
              description="A guided ingredient breakdown that starts with the finished dish, then opens into a more editorial stacked composition."
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
