import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOrderCart } from '../../contexts/useOrderCart';

const GuestCartShortcut: React.FC = () => {
  const location = useLocation();
  const { totalItems, subtotal } = useOrderCart();

  if (totalItems === 0 || location.pathname === '/order/review') {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
      <Link
        to="/order/review"
        className="pointer-events-auto inline-flex min-w-[220px] items-center justify-between gap-4 rounded-full border px-5 py-3 text-sm font-semibold transition duration-300 hover:-translate-y-0.5"
        style={{
          backgroundColor: 'var(--guest-text)',
          borderColor: 'var(--guest-text)',
          color: 'var(--guest-bg)',
          boxShadow: 'var(--guest-shadow)',
        }}
      >
        <span>{totalItems} item{totalItems === 1 ? '' : 's'} in cart</span>
        <span>${subtotal.toFixed(2)}</span>
      </Link>
    </div>
  );
};

export default GuestCartShortcut;
