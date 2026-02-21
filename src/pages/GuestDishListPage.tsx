import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { GlassInput, GlassPill, LiquidBackground } from '../components/ui/liquid-glass';
import DishCard from '../components/Guest/DishCard';

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

const GuestDishListPage: React.FC = () => {
  const navigate = useNavigate();
  const [restaurantName, setRestaurantName] = useState('Menu');
  const [restaurantSlug, setRestaurantSlug] = useState(configuredRestaurantSlug);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

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

  if (loading) return <LoadingSpinner fullPage text="Loading menu..." />;

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-10">
        <header className="rounded-xl2 border border-stroke bg-panel p-4 shadow-lux backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-gold2/90">Hotel Menu</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-text sm:text-4xl">{restaurantName}</h1>
              <p className="mt-2 text-sm text-muted">Select a dish to explore details and open it in AR.</p>
            </div>
            <span className="rounded-full border border-gold/30 bg-gold/12 px-3 py-1 text-xs font-semibold text-gold2">
              {filteredDishes.length} dishes
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <GlassInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dishes..."
              leftSlot={<span>🔎</span>}
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <GlassPill
                key={item}
                active={item === category}
                onClick={() => setCategory(item)}
                className="shrink-0"
              >
                {item}
              </GlassPill>
            ))}
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-sm text-spicy">{error}</div>
        )}

        {!error && filteredDishes.length === 0 && (
          <div className="mt-5 rounded-xl2 border border-stroke bg-panel p-6 text-center text-muted shadow-lux2 backdrop-blur-xl">
            No dishes found for your filter.
          </div>
        )}

        <section className="mt-5 space-y-3 sm:space-y-4">
          {filteredDishes.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              onOpen={() => navigate(`/menu/${restaurantSlug}/dish/${dish.id}`)}
            />
          ))}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg1/85 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 sm:px-6">
          <div className="grid grid-cols-2 gap-2 rounded-full border border-stroke bg-panel2 p-2 shadow-lux2">
            <button type="button" className="rounded-full border border-gold/70 bg-gold px-3 py-2 text-xs font-semibold text-bg0">
              Menu
            </button>
            <button type="button" className="rounded-full px-3 py-2 text-xs font-medium text-muted">
              Search
            </button>
          </div>
        </div>
      </nav>
    </LiquidBackground>
  );
};

export default GuestDishListPage;
