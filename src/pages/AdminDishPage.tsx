import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import DishViewer from '../components/Guest/DishViewer';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import type { Dish } from '../types';
import api from '../services/api';

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
                <div className="text-center text-red-600 py-10">{error}</div>
            ) : !dish ? (
                <div className="text-center py-10">Dish not found</div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">{dish.name}</h2>
                            <p className="text-gray-600 text-lg mt-2">{dish.category}</p>
                        </div>
                        <Link
                            to="/dashboard"
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Back to Dashboard
                        </Link>
                    </div>

                    <div>
                        <p className="text-3xl font-bold text-green-600">
                            ${typeof dish.price === 'number'
                                ? dish.price.toFixed(2)
                                : parseFloat(dish.price).toFixed(2)}
                        </p>
                    </div>

                    <div>
                        <p className="text-gray-700 text-base leading-relaxed">{dish.description}</p>
                    </div>

                    <div className="parent-mountRef">
                        <DishViewer dish={dish} />
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AdminDishPage;
