import React from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();

    const handleTestLogin = () => {
        // SKIP AUTH: Set dummy token for API interceptor
        localStorage.setItem('auth_token', 'DUMMY_TEST_TOKEN_SKIP_AUTH');
        navigate('/dashboard', { replace: true });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
                        <span className="text-4xl">🍽️</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">AR Menu Admin</h1>
                    <p className="text-gray-500 mt-2">Test login (no validation)</p>
                </div>

                <button
                    onClick={handleTestLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg shadow-md"
                >
                    <span>🚀</span> Login as Test Restaurant Owner
                </button>

                <div className="mt-6 text-center text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="font-medium">⚠️ TESTING MODE</p>
                    <p className="mt-1">No real authentication. All features work with mock data.</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;