// src/pages/GuestDishPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import type { Dish } from '../types';
import DishViewer from '../components/Guest/DishViewer';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const GuestDishPage: React.FC = () => {
    const { restaurant_slug, dish_id } = useParams<{ restaurant_slug: string; dish_id: string }>();
    const [dish, setDish] = useState<Dish | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
    }, [dish]);
    useEffect(() => {
        const fetchDish = async () => {
            try {
                const response = await api.get(
                    `/menu/${restaurant_slug}/dish/${dish_id}`
                );
                setDish(response.data);
                // alert(`/menu/${restaurant_slug}/dish/${dish_id}`)
            } catch (err) {
                setError('Failed to load dish');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDish();
    }, [restaurant_slug, dish_id]);

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="text-center text-red-600 py-10">{error}</div>;
    if (!dish) return <div className="text-center py-10">Dish not found</div>;

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-4xl font-bold text-gray-900">{dish.name}</h1>
                    <p className="text-gray-600 text-lg mt-2">{dish.category}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                    <p className="text-3xl font-bold text-green-600">
                        ${typeof dish.price === 'number'
                            ? dish.price.toFixed(2)
                            : parseFloat(dish.price).toFixed(2)}
                    </p>
                </div>

                {/* Description */}
                <div className="mb-8">
                    <p className="text-gray-700 text-base leading-relaxed">{dish.description}</p>
                </div>

                {/* 3D Viewer */}
                <div className="mb-8 parent-mountRef">
                    {/* <DishViewer dish={dish} /> */}
                    {loading ? (
                        <LoadingSpinner />
                    ) : dish && dish.assets ? (
                        <DishViewer dish={dish} />
                    ) : (
                        <div>Failed to load dish</div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center text-gray-500 text-sm">
                    <p>Powered by AR Menu Platform</p>
                </div>
            </div>
        </div>
    );
};

export default GuestDishPage;