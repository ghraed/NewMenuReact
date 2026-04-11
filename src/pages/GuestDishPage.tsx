import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import DishDetailView from '../components/Guest/DishDetailView';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import GuestPageShell from '../components/Guest/GuestPageShell';
import { useOrderCart } from '../contexts/useOrderCart';
import {
  formatRestaurantLabel,
  getGuestRestaurantCandidateSlugs,
  getPreferredGuestRestaurantSlug,
} from '../utils/guestRestaurant';

const GuestDishPage: React.FC = () => {
  const { restaurant_slug, dish_id } = useParams<{ restaurant_slug?: string; dish_id: string }>();
  const { t } = useTranslation();
  const { addDish, getDishQuantity } = useOrderCart();
  const [dish, setDish] = useState<Dish | null>(null);
  const [resolvedRestaurantSlug, setResolvedRestaurantSlug] = useState<string | undefined>(restaurant_slug);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDish = async () => {
      setLoading(true);
      setError(null);

      try {
        const candidateSlugs = getGuestRestaurantCandidateSlugs(restaurant_slug);
        let loaded = false;

        for (const candidateSlug of candidateSlugs) {
          try {
            const response = await api.get(`/menu/${candidateSlug}/dish/${dish_id}`, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
              },
            });

            setDish(response.data);
            setResolvedRestaurantSlug(candidateSlug);
            loaded = true;
            break;
          } catch (err) {
            if (candidateSlug === candidateSlugs[candidateSlugs.length - 1]) {
              throw err;
            }
          }
        }

        if (!loaded) {
          throw new Error(t('dishPage.failedToLoad'));
        }
      } catch (err) {
        setError(t('dishPage.failedToLoad'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDish();
  }, [restaurant_slug, dish_id]);

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        {loading ? (
          <div
            className="rounded-[32px] border px-6 py-12 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              boxShadow: 'var(--guest-shadow)',
            }}
          >
            <LoadingSpinner inline text={t('dishPage.loadingDish')} />
          </div>
        ) : null}

        {!loading && error ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
            }}
          >
            {error}
          </div>
        ) : null}

        {!loading && !error && !dish ? (
          <div
            className="rounded-[32px] border p-6 text-center"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-muted)',
            }}
          >
            {t('dishPage.notFound')}
          </div>
        ) : null}

        {!loading && !error && dish ? (
          <>
            <DishDetailView
              dish={dish}
              restaurantSlug={resolvedRestaurantSlug}
              onAddToCart={() => addDish(dish, {
                restaurant: {
                  name: formatRestaurantLabel(resolvedRestaurantSlug || getPreferredGuestRestaurantSlug()),
                  slug: resolvedRestaurantSlug || getPreferredGuestRestaurantSlug(),
                },
              })}
              cartQuantity={getDishQuantity(dish.id)}
            />
            <GuestInfoSection restaurantName={formatRestaurantLabel(resolvedRestaurantSlug)} />
          </>
        ) : null}
      </main>
    </GuestPageShell>
  );
};

export default GuestDishPage;
