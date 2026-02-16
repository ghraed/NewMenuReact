import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishForm from '../components/Admin/DishForm';
import api from '../services/api'; // Import your API service

const CreateDishPage: React.FC = () => {
    const navigate = useNavigate();

    // REAL API CALL: Send dish data to Laravel backend
    const handleMockSubmit = async (dishData: {
        name: string;
        description: string;
        price: number;
        category: string;
        image_url: string;
        glb_file: File | null;
        usdz_file: File | null;
    }) => {
        try {
            console.log('Submitting dish data to API:', dishData);

            const formData = new FormData();
            formData.append('name', dishData.name);
            formData.append('description', dishData.description);
            formData.append('price', String(dishData.price));
            formData.append('category', dishData.category);
            if (dishData.image_url) formData.append('image_url', dishData.image_url);
            if (dishData.glb_file) formData.append('glb_file', dishData.glb_file);
            if (dishData.usdz_file) formData.append('usdz_file', dishData.usdz_file);

            // Send multipart request to Laravel backend
            const response = await api.post('/dishes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            console.log('Dish created successfully:', response.data);

            alert(`✅ Dish created successfully!\n\nID: ${response.data.id}\nName: ${response.data.name}\nStatus: ${response.data.status}`);

            // Redirect to dashboard after successful creation
            navigate('/dashboard');

        } catch (error: any) {
            console.error('Error creating dish:', error);

            // Handle different error types
            if (error.response) {
                // Server responded with error status
                const errorMessage = error.response.data.message || error.response.data.error || 'Failed to create dish';
                alert(`❌ Error: ${errorMessage}\n\nStatus: ${error.response.status}`);
            } else if (error.request) {
                // Request was made but no response received
                alert('❌ No response from server. Please check if your Laravel backend is running.');
            } else {
                // Something else happened
                alert(`❌ Error: ${error.message}`);
            }
        }
    };

    return (
        <DashboardLayout title="Create New Dish">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Add a new menu item</h2>
                <p className="text-gray-500">
                    Create a dish with 3D model for AR viewing. Start with basic details below.
                </p>
            </div>

            <DishForm onSubmit={handleMockSubmit} />
        </DashboardLayout>
    );
};

export default CreateDishPage;
