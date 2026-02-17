import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '@google/model-viewer';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { GlassSurface, LiquidBackground } from '../components/ui/liquid-glass';
import { resolveAssetUrl } from '../services/api';

interface GuestListResponse {
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  dishes: Dish[];
}

const configuredRestaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';
const fallbackRestaurantSlug = 'admin-restaurant';

const DishCardMedia: React.FC<{ dish: Dish }> = ({ dish }) => {
  const imageUrl = dish.image_url || '';
  const glbAsset = dish.assets.find((asset) => asset.asset_type === 'glb');
  const glbUrl = resolveAssetUrl(glbAsset?.file_url);
  const ModelViewer = 'model-viewer' as React.ElementType;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={dish.name}
        className="h-40 w-full rounded-2xl object-cover"
      />
    );
  }

  if (glbUrl) {
    return (
      <div className="h-40 w-full overflow-hidden rounded-2xl bg-white/40">
        <ModelViewer
          src={glbUrl}
          interaction-prompt="none"
          disable-zoom
          camera-orbit="0deg 75deg 1.8m"
          min-camera-orbit="auto auto 1.8m"
          max-camera-orbit="auto auto 1.8m"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-lg-primary/35 via-lg-secondary/25 to-lg-tertiary/30">
      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm" />
      <div className="relative z-10 flex h-full items-center justify-center text-5xl">🍽️</div>
    </div>
  );
};

const GuestDishListPage: React.FC = () => {
  const [restaurantName, setRestaurantName] = useState('Menu');
  const [restaurantSlug, setRestaurantSlug] = useState(configuredRestaurantSlug);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchList = async (slug: string): Promise<GuestListResponse> => {
      const response = await api.get<GuestListResponse>(`/menu/${slug}/dishes`);
      return response.data;
    };

    const fetchDishes = async () => {
      try {
        let data = await fetchList(configuredRestaurantSlug);

        if (
          data.dishes.length === 0 &&
          configuredRestaurantSlug !== fallbackRestaurantSlug
        ) {
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

  if (loading) return <LoadingSpinner />;

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <GlassSurface className="p-7" iridescent>
          <h1 className="text-4xl font-bold text-lg-text">{restaurantName}</h1>
          <p className="mt-2 text-lg-muted">Select a dish to view details and AR model.</p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200/80 bg-red-100/60 p-4 text-red-700">
              {error}
            </div>
          )}

          {!error && dishes.length === 0 && (
            <div className="mt-6 rounded-xl border border-white/45 bg-white/35 p-6 text-lg-muted backdrop-blur-xl">
              No dishes available yet.
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dishes.map((dish) => (
              <Link
                key={dish.id}
                to={`/menu/${restaurantSlug}/dish/${dish.id}`}
                className="group relative overflow-hidden rounded-3xl border border-white/55 bg-white/38 p-4 shadow-glass-soft backdrop-blur-xl transition duration-300 ease-fluid hover:-translate-y-1.5 hover:shadow-glass-strong"
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-lg-primary/30 blur-2xl transition duration-500 group-hover:bg-lg-secondary/35" />
                <div className="pointer-events-none absolute -left-16 -bottom-16 h-32 w-32 rounded-full bg-lg-tertiary/30 blur-2xl" />

                <div className="relative z-10">
                  <DishCardMedia dish={dish} />

                  <div className="mt-4 flex items-center justify-between">
                    <div className="rounded-full border border-white/55 bg-white/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-lg-muted">
                      {dish.category}
                    </div>
                    <div className="text-lg font-bold text-lg-text">${Number(dish.price).toFixed(2)}</div>
                  </div>

                  <h2 className="mt-2 text-xl font-semibold text-lg-text">{dish.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-lg-muted">{dish.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </GlassSurface>
      </div>
    </LiquidBackground>
  );
};

export default GuestDishListPage;
