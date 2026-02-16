import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api from '../services/api';

// MOCK DATA - NO API CALLS YET
const MOCK_DISHES: Dish[] = [
    {
        id: 1,
        uuid: 'dish-1',
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, fresh mozzarella, basil',
        price: 12.99,
        category: 'Pizza',
        status: 'published',
        assets: [
            { id: 1, uuid: 'asset-1', asset_type: 'glb', file_url: '#', file_size: 2000000, mime_type: 'model/gltf-binary', metadata: {} },
            { id: 2, uuid: 'asset-2', asset_type: 'usdz', file_url: '#', file_size: 3000000, mime_type: 'model/vnd.usdz+zip', metadata: {} }
        ],
        created_at: '2026-01-15T10:30:00Z',
        updated_at: '2026-01-30T14:22:00Z'
    },
    {
        id: 2,
        uuid: 'dish-2',
        name: 'Truffle Fries',
        description: 'Hand-cut fries with truffle oil and parmesan',
        price: 8.50,
        category: 'Sides',
        status: 'draft',
        assets: [],
        created_at: '2026-01-20T09:15:00Z',
        updated_at: '2026-01-20T09:15:00Z'
    }
];

const AdminDashboard: React.FC = () => {
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedDish, setSelectedDish] = useState<Dish | null>(null);

    useEffect(() => {
        const fetchDishes = async () => {
            try {
                const response = await api.get('/dishes');
                const payload = response.data;
                const items = Array.isArray(payload?.data) ? payload.data : payload;
                setDishes(items);
            } catch (err) {
                console.error(err);
                setError('Failed to load dishes');
                setDishes(MOCK_DISHES);
            } finally {
                setLoading(false);
            }
        };

        fetchDishes();
    }, []);

    // MOCK: Publish dish toggle
    const handlePublishToggle = (dishId: number) => {
        setDishes(prev => prev.map(dish =>
            dish.id === dishId
                ? { ...dish, status: dish.status === 'published' ? 'draft' : 'published' }
                : dish
        ));
        alert(`Dish ${dishId} status updated! (MOCK)`);
    };

    // MOCK: Show QR code
    const handleShowQR = (dish: Dish) => {
        setSelectedDish(dish);
        setShowQRModal(true);
    };

    return (
        <DashboardLayout title="Dashboard">
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Your Dishes</h2>
                <a
                    href="/dishes/create"
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                    <span>➕</span> Create New Dish
                </a>
            </div>

            {loading ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-gray-500">Loading dishes...</div>
                </div>
            ) : error ? (
                <div className="text-center py-12 bg-red-50 rounded-lg text-red-700">
                    {error}
                </div>
            ) : dishes.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-5xl mb-4">📭</div>
                    <h3 className="text-xl font-medium text-gray-700 mb-2">No dishes yet</h3>
                    <p className="text-gray-500 mb-4">Create your first dish to get started</p>
                    <a
                        href="/dishes/create"
                        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Create Dish
                    </a>
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
                                            to={`/dashboard/dishes/${dish.id}`}
                                            className="flex items-center hover:opacity-80"
                                        >
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center">
                                                🍕
                                            </div>
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
                                            onClick={() => handlePublishToggle(dish.id)}
                                            className={`px-3 py-1 rounded ${dish.status === 'published'
                                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                                                }`}
                                        >
                                            {dish.status === 'published' ? 'Unpublish' : 'Publish'}
                                        </button>
                                        <button
                                            onClick={() => handleShowQR(dish)}
                                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                        >
                                            📱 QR Code
                                        </button>
                                        <Link
                                            to={`/dashboard/dishes/${dish.id}`}
                                            className="px-3 py-1 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 inline-block"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MOCK QR MODAL */}
            {showQRModal && selectedDish && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">QR Code for "{selectedDish.name}"</h3>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="bg-gray-100 border-2 border-dashed rounded-xl w-full h-64 flex items-center justify-center mb-4">
                            <div className="text-center">
                                <div className="text-6xl mb-2">🔲</div>
                                <p className="text-gray-500">QR Code Preview (MOCK)</p>
                                <p className="text-xs text-gray-400 mt-1">Real QR would link to:<br />
                                    <span className="font-mono text-blue-600 break-all">
                                        /menu/pizza-palace/dish/{selectedDish.id}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Download QR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AdminDashboard;
