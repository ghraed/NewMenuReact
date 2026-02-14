import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
	children: React.ReactNode;
	title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
	const location = useLocation();

	const navItems = [
		{ path: '/dashboard', label: 'Dashboard', icon: '📊' },
		{ path: '/dishes/create', label: 'Create Dish', icon: '➕' },
		{ path: '/menu/pizza-palace/dish/10', label: 'Guest View', icon: '📱', target: '_blank' },
	];

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
					<div className="flex items-center gap-3">
						<div className="text-2xl">🍽️</div>
						<h1 className="text-2xl font-bold text-gray-800">AR Menu Admin</h1>
					</div>
					<Link
						to="/login"
						className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
					>
						Logout (Test)
					</Link>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					{/* Sidebar Navigation */}
					<div className="lg:col-span-1">
						<nav className="bg-white rounded-xl shadow p-4">
							<h2 className="font-semibold text-gray-700 mb-4 px-2">Navigation</h2>
							<ul className="space-y-2">
								{navItems.map((item) => (
									<li key={item.path}>
										<Link
											to={item.path}
											target={item.target || '_self'}
											className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === item.path
												? 'bg-blue-50 text-blue-700 font-medium'
												: 'text-gray-700 hover:bg-gray-50'
												}`}
										>
											<span className="text-xl">{item.icon}</span>
											<span>{item.label}</span>
										</Link>
									</li>
								))}
							</ul>
						</nav>
					</div>

					{/* Main Content */}
					<div className="lg:col-span-3">
						<div className="bg-white rounded-xl shadow overflow-hidden">
							<div className="px-6 py-4 border-b border-gray-200">
								<h1 className="text-2xl font-bold text-gray-800">{title}</h1>
							</div>
							<div className="p-6">
								{children}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DashboardLayout;