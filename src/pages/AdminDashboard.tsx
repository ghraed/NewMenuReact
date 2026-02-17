import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api from '../services/api';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const AdminDashboard: React.FC = () => {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDishes = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/dishes');
      const payload = response.data;
      const items = Array.isArray(payload?.data) ? payload.data : payload;
      setDishes(items || []);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to load dishes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDishes();
  }, []);

  const handlePublishToggle = async (dish: Dish) => {
    const action = dish.status === 'published' ? 'unpublish' : 'publish';
    try {
      const response = await api.patch(`/dishes/${dish.id}/${action}`);
      const updated = response.data as Dish;
      setDishes((prev) => prev.map((item) => (item.id === dish.id ? updated : item)));
    } catch (err: unknown) {
      alert(getErrorMessage(err, `Failed to ${action} dish`));
    }
  };

  const handleDelete = async (dish: Dish) => {
    const confirmed = window.confirm(`Delete "${dish.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.delete(`/dishes/${dish.id}`);
      setDishes((prev) => prev.filter((item) => item.id !== dish.id));
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to delete dish'));
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Your Dishes</h2>
        <Link
          to="/admin/dishes/create"
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>➕</span> Create New Dish
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">Loading dishes...</div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 rounded-lg text-red-700">{error}</div>
      ) : dishes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">No dishes yet</h3>
          <p className="text-gray-500 mb-4">Create your first dish to get started</p>
          <Link
            to="/admin/dishes/create"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Dish
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dish</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dishes.map((dish) => (
                <tr key={dish.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/admin/dishes/${dish.id}/edit`}
                      className="flex items-center hover:opacity-80"
                    >
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center">🍽️</div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{dish.name}</div>
                        <div className="text-sm text-gray-500">{dish.category}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${Number(dish.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${dish.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {dish.status.charAt(0).toUpperCase() + dish.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handlePublishToggle(dish)}
                      className={`px-3 py-1 rounded ${dish.status === 'published'
                        ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                    >
                      {dish.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <Link
                      to={`/admin/dishes/${dish.id}/edit`}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 inline-block"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(dish)}
                      className="px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
