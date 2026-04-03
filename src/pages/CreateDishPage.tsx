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

const uploadIngredientLayers = async (dishId: number, ingredientLayers: DishFormData['ingredient_layers']) => {
  for (const [index, ingredient] of ingredientLayers.entries()) {
    if (!ingredient.image_file) continue;

    const payload = new FormData();
    payload.append('type', 'ingredient_image');
    payload.append('file', ingredient.image_file);
    payload.append('label', ingredient.name);
    payload.append('order_index', String(index));

    if (ingredient.quantity) {
      payload.append('quantity', ingredient.quantity);
    }

    await api.post(`/dishes/${dishId}/assets`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
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

      const response = await api.post('/dishes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (dishData.preview_file) {
        const previewFormData = new FormData();
        previewFormData.append('type', 'preview_image');
        previewFormData.append('file', dishData.preview_file);

        await api.post(`/dishes/${response.data.id}/assets`, previewFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await uploadIngredientLayers(response.data.id, dishData.ingredient_layers);

      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create dish'));
    }
  };

  return (
    <DashboardLayout title="Create New Dish">
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold text-text">Add a new menu item</h2>
        <p className="text-muted">Create a dish with at least one 3D model (.glb or .usdz).</p>
      </div>

      {error && <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-spicy">{error}</div>}

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
