import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';

interface GuestListResponse {
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  dishes: Dish[];
}

const restaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';

const GuestDishListPage: React.FC = () => {
  const [restaurantName, setRestaurantName] = useState('Menu');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDishes = async () => {
      try {
        const response = await api.get<GuestListResponse>(`/menu/${restaurantSlug}/dishes`);
        setRestaurantName(response.data.restaurant.name);
        setDishes(response.data.dishes);
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-gray-900">{restaurantName}</h1>
        <p className="text-gray-600 mt-2">Select a dish to view details and AR model.</p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!error && dishes.length === 0 && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-gray-600">
            No published dishes yet.
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dishes.map((dish) => (
            <Link
              key={dish.id}
              to={`/menu/${restaurantSlug}/dish/${dish.id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              <div className="text-sm text-gray-500">{dish.category}</div>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">{dish.name}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{dish.description}</p>
              <div className="mt-3 text-lg font-bold text-green-600">${Number(dish.price).toFixed(2)}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuestDishListPage;
