import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import DishViewer from '../components/Guest/DishViewer';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import axios from 'axios';
import {
  GlassBoard,
  GlassIconButton,
  GlassPill,
  LiquidBackground,
  LiquidButton,
} from '../components/ui/liquid-glass';

const GuestDishPage: React.FC = () => {
  const { restaurant_slug, dish_id } = useParams<{ restaurant_slug: string; dish_id: string }>();
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modern, setModern] = useState(document.body.classList.contains('modern'));

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

  const toggleModern = () => {
    document.body.classList.toggle('modern');
    setModern(document.body.classList.contains('modern'));
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;
  if (!dish) return <div className="py-10 text-center">Dish not found</div>;

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <GlassBoard modern={modern}>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold text-lg-text">{dish.name}</h1>
              <p className="mt-2 text-lg text-slate-700/70">{dish.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <GlassPill onClick={toggleModern} modern={modern} className="text-xs">
                {modern ? 'NEW' : 'OLD'}
              </GlassPill>
              <GlassIconButton modern={modern}>🛒</GlassIconButton>
              <GlassIconButton modern={modern}>↩</GlassIconButton>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-3xl font-bold text-lg-text">
              ${typeof dish.price === 'number' ? dish.price.toFixed(2) : parseFloat(dish.price).toFixed(2)}
            </p>
          </div>

          <div className="mb-8">
            <p className="text-base leading-relaxed text-slate-700/70">{dish.description}</p>
          </div>

          <div className="mb-8 parent-mountRef">
            {loading ? <LoadingSpinner /> : dish && dish.assets ? <DishViewer dish={dish} /> : <div>Failed to load dish</div>}
          </div>

          <div className="flex justify-center">
            <LiquidButton tone="secondary" modern={modern} onClick={() => testFetchModel(1)}>
              Powered by AR Menu Platform
            </LiquidButton>
          </div>
        </GlassBoard>
      </div>
    </LiquidBackground>
  );
};

export default GuestDishPage;
