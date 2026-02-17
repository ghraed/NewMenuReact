import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm, { type DishFormData } from '../components/Admin/DishForm';
import api from '../services/api';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

const CreateDishPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (dishData: DishFormData) => {
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', dishData.name);
      formData.append('description', dishData.description);
      formData.append('price', dishData.price);
      formData.append('category', dishData.category);
      formData.append('status', dishData.status);

      if (dishData.image_url) formData.append('image_url', dishData.image_url);
      if (dishData.glb_file) formData.append('glb_file', dishData.glb_file);
      if (dishData.usdz_file) formData.append('usdz_file', dishData.usdz_file);

      await api.post('/dishes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create dish'));
    }
  };

  return (
    <DashboardLayout title="Create New Dish">
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold text-lg-text">Add a new menu item</h2>
        <p className="text-lg-muted">
          Create a dish with at least one 3D model (.glb or .usdz).
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200/80 bg-red-100/60 p-4 text-red-700">
          {error}
        </div>
      )}

      <DishForm
        onSubmit={handleSubmit}
        requireModelUpload
        submitLabel="Create Dish"
        submittingLabel="Creating..."
      />
    </DashboardLayout>
  );
};

export default CreateDishPage;
