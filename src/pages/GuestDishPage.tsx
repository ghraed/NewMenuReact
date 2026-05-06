import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import type { Dish } from '../types';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import DishDetailView from '../components/Guest/DishDetailView';
import GuestInfoSection from '../components/Guest/GuestInfoSection';
import GuestPageShell from '../components/Guest/GuestPageShell';
import GuestTableAccessPanel from '../components/Guest/GuestTableAccessPanel';
import RestaurantBrandMark from '../components/Common/RestaurantBrandMark';
import { useOrderCart } from '../contexts/useOrderCart';
import { fetchGuestTableDish } from '../services/orderService';
import {
  formatRestaurantLabel,
  getGuestRestaurantCandidateSlugs,
  getPreferredGuestRestaurantSlug,
} from '../utils/guestRestaurant';

const GuestDishPage: React.FC = () => {
  const { restaurant_slug, table_id, dish_id } = useParams<{ restaurant_slug?: string; table_id?: string; dish_id: string }>();
  const { t } = useTranslation();
  const { addDish, draft, restaurant, getDishQuantity, setGuestContext, updateDraft, clearGuestAccess } = useOrderCart();
  const [dish, setDish] = useState<Dish | null>(null);
  const [resolvedRestaurantSlug, setResolvedRestaurantSlug] = useState<string | undefined>(restaurant_slug);
  const [restaurantName, setRestaurantName] = useState<string>(restaurant?.name || formatRestaurantLabel(restaurant_slug));
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState<string | null>(restaurant?.logo_url ?? null);
  const [restaurantShortDescription, setRestaurantShortDescription] = useState<string>('');
  const [resolvedTableId, setResolvedTableId] = useState<number | undefined>(
    table_id ? Number(table_id) : undefined
  );
  const [aiRecommendationsEnabled, setAiRecommendationsEnabled] = useState(true);
  const [tableOrderingEnabled, setTableOrderingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDish = async () => {
      if (!dish_id) {
        if (!cancelled) {
          setError(t('dishPage.notFound'));
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        if (table_id) {
          const response = await fetchGuestTableDish(table_id, dish_id, draft.guestAccessToken);
          if (cancelled) {
            return;
          }

          setDish(response.dish);
          setResolvedRestaurantSlug(response.restaurant.slug);
          setRestaurantName(response.restaurant.name || formatRestaurantLabel(response.restaurant.slug));
          setRestaurantLogoUrl(response.restaurant.logo_url ?? null);
          setRestaurantShortDescription((response.restaurant.profile?.short_description || '').trim());
          setResolvedTableId(response.table.id);
          setAiRecommendationsEnabled(response.restaurant.feature_flags?.ai_recommendations !== false);
          setTableOrderingEnabled(response.restaurant.feature_flags?.table_ordering !== false);
          if (response.table_session) {
            setGuestContext({
              restaurant: response.restaurant,
              tableId: response.table.id,
              tableReference: response.table.name,
              tableSessionId: response.table_session.id,
              guestAccess: response.guest_access,
            });
          } else {
            const hasVerifiedAccessForSameTable = (
              draft.guestAccessVerified
              && Boolean(draft.guestAccessToken)
              && draft.tableId === response.table.id
            );

            if (!hasVerifiedAccessForSameTable) {
              clearGuestAccess();
            }

            updateDraft({
              tableId: response.table.id,
              tableReference: response.table.name,
              tableSessionId: null,
            });
          }
          return;
        }

        const candidateSlugs = getGuestRestaurantCandidateSlugs(restaurant_slug);
        let loaded = false;

        if (restaurant_slug) {
          for (const candidateSlug of candidateSlugs) {
            try {
              const response = await api.get(`/menu/${candidateSlug}/dish/${dish_id}`, {
                headers: {
                  'ngrok-skip-browser-warning': 'true',
                },
              });
              if (cancelled) {
                return;
              }

              setDish(response.data);
              setResolvedRestaurantSlug(response.data?.restaurant?.slug || candidateSlug);
              setRestaurantName(
                response.data?.restaurant?.name
                || formatRestaurantLabel(response.data?.restaurant?.slug || candidateSlug)
              );
              setRestaurantLogoUrl(response.data?.restaurant?.logo_url ?? null);
              setRestaurantShortDescription((response.data?.restaurant?.profile?.short_description || '').trim());
              setAiRecommendationsEnabled(response.data?.restaurant?.feature_flags?.ai_recommendations !== false);
              setTableOrderingEnabled(response.data?.restaurant?.feature_flags?.table_ordering !== false);
              loaded = true;
              break;
            } catch (err) {
              if (candidateSlug === candidateSlugs[candidateSlugs.length - 1]) {
                throw err;
              }
            }
          }
        } else {
          const response = await api.get(`/menu/dish/${dish_id}`, {
            headers: {
              'ngrok-skip-browser-warning': 'true',
            },
          });
          if (cancelled) {
            return;
          }

          setDish(response.data);
          setResolvedRestaurantSlug(response.data?.restaurant?.slug);
          setRestaurantName(
            response.data?.restaurant?.name
            || formatRestaurantLabel(response.data?.restaurant?.slug || undefined)
          );
          setRestaurantLogoUrl(response.data?.restaurant?.logo_url ?? null);
          setRestaurantShortDescription((response.data?.restaurant?.profile?.short_description || '').trim());
          setAiRecommendationsEnabled(response.data?.restaurant?.feature_flags?.ai_recommendations !== false);
          setTableOrderingEnabled(response.data?.restaurant?.feature_flags?.table_ordering !== false);
          loaded = true;
        }

        if (!loaded) {
          throw new Error(t('dishPage.failedToLoad'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(t('dishPage.failedToLoad'));
          console.error(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchDish();

    return () => {
      cancelled = true;
    };
  }, [
    draft.guestAccessToken,
    draft.guestAccessVerified,
    draft.tableId,
    restaurant_slug,
    table_id,
    dish_id,
    t,
    setGuestContext,
    updateDraft,
    clearGuestAccess,
  ]);

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        <section
          className="mb-6 flex flex-wrap items-center gap-4 rounded-[28px] border px-4 py-4 sm:px-5"
          style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow-soft)',
          }}
        >
          <RestaurantBrandMark
            name={restaurantName}
            logoUrl={restaurantLogoUrl}
            className="h-14 w-14 sm:h-16 sm:w-16"
            fallbackClassName="text-lg sm:text-xl"
          />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-[var(--guest-text)] sm:text-2xl">{restaurantName}</h2>
            {restaurantShortDescription ? (
              <p className="truncate text-xs text-[var(--guest-muted)] sm:text-sm">{restaurantShortDescription}</p>
            ) : null}
          </div>
        </section>

        {table_id ? (
          <div className="mb-6">
            <GuestTableAccessPanel
              tableId={draft.tableId ?? (table_id ? Number(table_id) : null)}
              tableLabel={draft.tableReference || undefined}
              compact
            />
          </div>
        ) : null}

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
              tableId={resolvedTableId}
              restaurantSlug={resolvedRestaurantSlug}
              aiRecommendationsEnabled={aiRecommendationsEnabled}
              onAddToCart={draft.guestAccessVerified && tableOrderingEnabled ? () => addDish(dish, {
                restaurant: {
                  name: formatRestaurantLabel(resolvedRestaurantSlug || getPreferredGuestRestaurantSlug()),
                  slug: resolvedRestaurantSlug || getPreferredGuestRestaurantSlug(),
                },
              }) : undefined}
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
