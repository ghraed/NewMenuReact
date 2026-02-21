import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import DishViewer from '../components/Guest/DishViewer';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { GlassBoard, GlassIconButton, LiquidBackground } from '../components/ui/liquid-glass';

const GuestDishPage: React.FC = () => {
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
        setError('Failed to load dish');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDish();
  }, [restaurant_slug, dish_id]);

  if (loading) return <LoadingSpinner fullPage text="Loading dish..." />;
  if (error) return <div className="py-10 text-center text-spicy">{error}</div>;
  if (!dish) return <div className="py-10 text-center text-muted">Dish not found</div>;

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        <GlassBoard>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/90">Dish Details</p>
              <h1 className="mt-2 text-3xl font-semibold text-text sm:text-4xl">{dish.name}</h1>
              <p className="mt-2 text-sm text-muted">{dish.category}</p>
            </div>

            <Link to="/" aria-label="Back to menu">
              <GlassIconButton>←</GlassIconButton>
            </Link>
          </div>

          <div className="mb-6 inline-flex rounded-full border border-gold/35 bg-gold/12 px-4 py-2 text-lg font-semibold text-gold2">
            ${typeof dish.price === 'number' ? dish.price.toFixed(2) : parseFloat(dish.price).toFixed(2)}
          </div>

          <div className="mb-8">
            <p className="text-base leading-relaxed text-muted">{dish.description}</p>
          </div>

          <div className="mb-2 parent-mountRef">
            <DishViewer dish={dish} />
          </div>
        </GlassBoard>
      </div>
    </LiquidBackground>
  );
};

export default GuestDishPage;
