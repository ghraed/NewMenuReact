// src/pages/GuestDishPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import DishViewer from '../components/Guest/DishViewer';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import axios from 'axios';
import { GlassSurface, LiquidBackground } from '../components/ui/liquid-glass';

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

  const testFetchModel = async (dishId: number) => {
    try {
      const response = await axios.get(`/api/test/${dishId}`, {
        responseType: 'arraybuffer',
      });

      const blob = new Blob([response.data], { type: 'model/gltf-binary' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dish_${dishId}.glb`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error('Download failed:', downloadError);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;
  if (!dish) return <div className="py-10 text-center">Dish not found</div>;

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <GlassSurface className="p-6" iridescent>
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-lg-text">{dish.name}</h1>
            <p className="mt-2 text-lg text-lg-muted">{dish.category}</p>
          </div>

          <div className="mb-6">
            <p className="text-3xl font-bold text-lg-text">
              ${typeof dish.price === 'number' ? dish.price.toFixed(2) : parseFloat(dish.price).toFixed(2)}
            </p>
          </div>

          <div className="mb-8">
            <p className="text-base leading-relaxed text-lg-muted">{dish.description}</p>
          </div>

          <div className="mb-8 parent-mountRef">
            {loading ? <LoadingSpinner /> : dish && dish.assets ? <DishViewer dish={dish} /> : <div>Failed to load dish</div>}
          </div>

          <div className="text-center text-xs text-lg-muted">
            <p onClick={() => testFetchModel(1)}>Powered by AR Menu Platform</p>
          </div>
        </GlassSurface>
      </div>
    </LiquidBackground>
  );
};

export default GuestDishPage;
