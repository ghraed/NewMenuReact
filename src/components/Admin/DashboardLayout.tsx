import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import {
  GlassBoard,
  GlassIconButton,
  GlassPill,
  LiquidBackground,
  LiquidButton,
} from '../ui/liquid-glass';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [modern, setModern] = useState(document.body.classList.contains('modern'));

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/dishes/create', label: 'Create Dish', icon: '➕' },
    { path: '/liquid-glass-preview', label: 'Theme Preview', icon: '🫧' },
  ];

  const toggleModern = () => {
    document.body.classList.toggle('modern');
    setModern(document.body.classList.contains('modern'));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <LiquidBackground>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <GlassBoard className="mb-6 p-5 sm:p-6" modern={modern}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🍽️</div>
              <h1 className="text-2xl font-bold text-lg-text">AR Menu Admin</h1>
            </div>

            <div className="flex items-center gap-2">
              <GlassPill onClick={toggleModern} modern={modern} className="text-xs">
                {modern ? 'NEW' : 'OLD'}
              </GlassPill>
              <a href="/" target="_blank" rel="noreferrer">
                <GlassIconButton modern={modern} aria-label="Guest view">👁️</GlassIconButton>
              </a>
              <LiquidButton tone="tertiary" onClick={handleLogout} modern={modern} className="px-4 py-2 text-sm">
                Logout
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <GlassBoard className="p-4" modern={modern}>
              <h2 className="mb-4 px-1 text-sm font-semibold text-slate-700/70">Navigation</h2>
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <li key={item.path}>
                      <Link to={item.path} className="flex w-full items-center justify-between gap-2 rounded-[26px] px-2 py-1">
                        <span className="flex items-center gap-2 text-sm text-lg-text">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <GlassPill active={isActive} modern={modern} className="px-2.5 py-1 text-[11px]">
                          {isActive ? 'Active' : 'Open'}
                        </GlassPill>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </GlassBoard>
          </div>

          <div className="lg:col-span-3">
            <GlassBoard className="p-0" modern={modern}>
              <div className="border-b border-white/20 px-6 py-4">
                <h1 className="text-2xl font-bold text-lg-text">{title}</h1>
              </div>
              <div className="p-6">{children}</div>
            </GlassBoard>
          </div>
        </div>
      </div>
    </LiquidBackground>
  );
};

export default DashboardLayout;
