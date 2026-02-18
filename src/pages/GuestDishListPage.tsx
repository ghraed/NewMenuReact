import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '@google/model-viewer';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import {
  GlassBoard,
  GlassCard,
  GlassIconButton,
  GlassInput,
  GlassPill,
  LiquidBackground,
  LiquidButton,
} from '../components/ui/liquid-glass';
import { resolveAssetUrl } from '../services/api';
import { cx, primaryGradient } from '../theme/liquidGlass';

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
      <img src={imageUrl} alt={dish.name} className="h-44 w-full rounded-2xl object-cover" />
    );
  }

  if (glbUrl) {
    return (
      <div className="h-44 w-full overflow-hidden rounded-2xl bg-white/35">
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
    <div className={cx('relative h-44 w-full overflow-hidden rounded-2xl bg-gradient-to-br', primaryGradient)}>
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
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [modern, setModern] = useState(document.body.classList.contains('modern'));

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

  const toggleModern = () => {
    document.body.classList.toggle('modern');
    setModern(document.body.classList.contains('modern'));
  };

  const categories = useMemo(() => {
    const values = Array.from(new Set(dishes.map((dish) => dish.category).filter(Boolean)));
    return ['All', ...values];
  }, [dishes]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const categoryMatch = category === 'All' || dish.category === category;
      const searchMatch =
        dish.name.toLowerCase().includes(search.toLowerCase()) ||
        dish.description.toLowerCase().includes(search.toLowerCase());
      return categoryMatch && searchMatch;
    });
  }, [dishes, category, search]);

  if (loading) return <LoadingSpinner />;

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <GlassBoard modern={modern}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold text-lg-text">{restaurantName}</h1>
              <p className="mt-2 text-slate-700/70">Select a dish to view details and AR model.</p>
            </div>
            <div className="flex items-center gap-2">
              <GlassPill onClick={toggleModern} modern={modern} className="text-xs">
                {modern ? 'NEW' : 'OLD'}
              </GlassPill>
              <GlassIconButton modern={modern} aria-label="Cart">🛒</GlassIconButton>
              <GlassIconButton modern={modern} aria-label="Profile">👤</GlassIconButton>
              <GlassIconButton modern={modern} aria-label="Settings">⚙️</GlassIconButton>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <GlassInput
              modern={modern}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes..."
              leftSlot={<span>🔎</span>}
            />
            <Link to="/liquid-glass-preview">
              <LiquidButton tone="tertiary" modern={modern} className="w-full sm:w-auto">Theme Preview</LiquidButton>
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((item) => (
              <GlassPill
                key={item}
                modern={modern}
                active={item === category}
                onClick={() => setCategory(item)}
              >
                {item}
              </GlassPill>
            ))}
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200/80 bg-red-100/60 p-4 text-red-700">
              {error}
            </div>
          )}

          {!error && filteredDishes.length === 0 && (
            <div className="mt-6 rounded-xl border border-white/30 bg-white/20 p-6 text-slate-700/70 backdrop-blur">
              No dishes available yet.
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDishes.map((dish) => (
              <Link key={dish.id} to={`/menu/${restaurantSlug}/dish/${dish.id}`}>
                <GlassCard modern={modern} className="h-full">
                  <DishCardMedia dish={dish} />

                  <div className="mt-4 flex items-center justify-between">
                    <GlassPill modern={modern} className="px-2.5 py-1 text-[11px] uppercase tracking-wide" disabled>
                      {dish.category}
                    </GlassPill>
                    <div className="text-lg font-bold text-lg-text">${Number(dish.price).toFixed(2)}</div>
                  </div>

                  <h2 className="mt-2 text-xl font-semibold text-lg-text">{dish.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700/70">{dish.description}</p>

                  <div className="mt-4">
                    <LiquidButton tone="primary" modern={modern} className="w-full">Add</LiquidButton>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </GlassBoard>
      </div>
    </LiquidBackground>
  );
};

export default GuestDishListPage;
