import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrderCart } from '../../contexts/useOrderCart';
import { buildGuestOrderReviewPath } from '../../utils/guestTableRoutes';

const GuestCartShortcut: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { restaurant, totalItems, subtotal, draft } = useOrderCart();

  if (
    totalItems === 0
    || !draft.tableId
    || !draft.guestAccessVerified
    || restaurant?.feature_flags?.table_ordering === false
    || location.pathname.endsWith('/review')
    || location.pathname === '/order/review'
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
      <Link
        to={buildGuestOrderReviewPath(draft.tableId)}
        className="pointer-events-auto inline-flex min-w-[220px] items-center justify-between gap-4 rounded-full border px-5 py-3 text-sm font-semibold transition duration-300"
        style={{
          backgroundColor: 'var(--guest-text)',
          borderColor: 'var(--guest-text)',
          color: 'var(--guest-bg)',
          boxShadow: 'var(--guest-shadow)',
        }}
      >
        <span>{t('cart.itemsInCart', { count: totalItems })}</span>
        <span>${subtotal.toFixed(2)}</span>
      </Link>
    </div>
  );
};

export default GuestCartShortcut;
