import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import api from '../services/api';
import type { Dish } from '../types';

const guestRestaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const EditDishPage: React.FC = () => {
  const { dish_id } = useParams<{ dish_id: string }>();
  const navigate = useNavigate();

  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchDish = async () => {
      if (!dish_id) return;

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

    fetchDish();
  }, [dish_id]);

  const handleUpdate = async (data: DishFormData) => {
    if (!dish_id) return;

    setError(null);

    try {
      await api.patch(`/dishes/${dish_id}`, {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        category: data.category,
        status: data.status,
        image_url: data.image_url || null,
      });

      if (data.glb_file) {
        const glbPayload = new FormData();
        glbPayload.append('file', data.glb_file);
        glbPayload.append('type', 'glb');
        await api.post(`/dishes/${dish_id}/assets`, glbPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (data.usdz_file) {
        const usdzPayload = new FormData();
        usdzPayload.append('file', data.usdz_file);
        usdzPayload.append('type', 'usdz');
        await api.post(`/dishes/${dish_id}/assets`, usdzPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update dish'));
    }
  };

  const handleDelete = async () => {
    if (!dish_id || !dish) return;
    const confirmed = window.confirm(`Delete "${dish.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/dishes/${dish_id}`);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete dish'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Edit Dish">
        <LoadingSpinner />
      </DashboardLayout>
    );
  }

  if (!dish) {
    return (
      <DashboardLayout title="Edit Dish">
        <div className="text-center py-10 text-red-600">Dish not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Edit Dish">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{dish.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Update details and optionally upload new model files.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/menu/${guestRestaurantSlug}/dish/${dish.id}`}
            target="_blank"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Open Guest View
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`px-3 py-2 rounded-lg text-white ${deleting ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {deleting ? 'Deleting...' : 'Delete Dish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <DishForm
        key={dish.id}
        onSubmit={handleUpdate}
        initialValues={{
          name: dish.name,
          description: dish.description,
          category: dish.category,
          status: dish.status,
          image_url: dish.image_url || '',
          price: String(dish.price),
        }}
        requireModelUpload={false}
        submitLabel="Update Dish"
        submittingLabel="Updating..."
      />
    </DashboardLayout>
  );
};

export default EditDishPage;
