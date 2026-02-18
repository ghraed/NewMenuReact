import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishViewer from '../components/Guest/DishViewer';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import type { Dish } from '../types';
import api from '../services/api';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';

const AdminDishPage: React.FC = () => {
  const { dish_id } = useParams<{ dish_id: string }>();
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDish = async () => {
      try {
        const response = await api.get(`/dishes/${dish_id}`);
        setDish(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load dish');
      } finally {
        setLoading(false);
      }
    };

    if (dish_id) fetchDish();
  }, [dish_id]);

  return (
    <DashboardLayout title="Dish Details">
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="py-10 text-center text-red-600">{error}</div>
      ) : !dish ? (
        <div className="py-10 text-center">Dish not found</div>
      ) : (
        <GlassCard className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-lg-text">{dish.name}</h2>
              <p className="mt-2 text-lg text-slate-700/70">{dish.category}</p>
            </div>
            <Link to="/admin/dashboard">
              <LiquidButton tone="tertiary">Back to Dashboard</LiquidButton>
            </Link>
          </div>

          <div>
            <p className="text-3xl font-bold text-lg-text">
              ${typeof dish.price === 'number' ? dish.price.toFixed(2) : parseFloat(dish.price).toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-base leading-relaxed text-slate-700/70">{dish.description}</p>
          </div>

          <div className="parent-mountRef">
            <DishViewer dish={dish} />
          </div>
        </GlassCard>
      )}
    </DashboardLayout>
  );
};

export default AdminDishPage;
