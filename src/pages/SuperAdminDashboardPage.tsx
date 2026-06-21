import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminAuth } from '../contexts/useSuperAdminAuth';
import {
  bulkUpdateRestaurantFeatures,
  fetchSuperAdminFeatures,
  fetchSuperAdminRestaurants,
  fetchRestaurantFeatures,
  updateRestaurantFeature,
  type SuperAdminFeatureFlag,
  type SuperAdminGroupedFeatures,
  type SuperAdminRestaurantWithFeatures,
} from '../services/superAdminFeatureFlagsService';
import {
  GlassBoard,
  GlassCard,
  GlassInput,
  GlassToast,
  GlassToggle,
  LiquidBackground,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

const CATEGORY_ORDER = [
  'Menu',
  'Orders',
  'Service',
  'Inventory',
  'Finance',
  'AI',
  'AR/3D',
  'Notifications',
  'Analytics',
  'Localization',
  'Domain',
];

const normalizeCategory = (value?: string | null): string => {
  const normalized = (value ?? '').trim();
  return normalized === '' ? 'General' : normalized;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const SuperAdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useSuperAdminAuth();
  const { toast, showToast, dismiss } = useGlassToast();

  const [restaurants, setRestaurants] = useState<SuperAdminRestaurantWithFeatures[]>([]);
  const [groupedCatalog, setGroupedCatalog] = useState<SuperAdminGroupedFeatures[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [restaurantFeatures, setRestaurantFeatures] = useState<SuperAdminFeatureFlag[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [savingFeatureKeys, setSavingFeatureKeys] = useState<Record<string, boolean>>({});
  const [bulkSavingCategory, setBulkSavingCategory] = useState<string | null>(null);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const filteredRestaurants = useMemo(() => {
    const query = restaurantSearch.trim().toLowerCase();
    if (!query) return restaurants;

    return restaurants.filter((restaurant) => (
      restaurant.name.toLowerCase().includes(query)
      || restaurant.slug.toLowerCase().includes(query)
    ));
  }, [restaurants, restaurantSearch]);

  const orderedCategories = useMemo(() => {
    const categories = new Set<string>();

    CATEGORY_ORDER.forEach((category) => categories.add(category));
    groupedCatalog.forEach((group) => categories.add(normalizeCategory(group.category)));
    restaurantFeatures.forEach((feature) => categories.add(normalizeCategory(feature.category)));

    return Array.from(categories);
  }, [groupedCatalog, restaurantFeatures]);

  const groupedRestaurantFeatures = useMemo(() => {
    return orderedCategories
      .map((category) => ({
        category,
        features: restaurantFeatures
          .filter((feature) => normalizeCategory(feature.category) === category)
          .sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .filter((group) => group.features.length > 0);
  }, [orderedCategories, restaurantFeatures]);

  const loadSuperAdminDashboard = useCallback(async () => {
    setRestaurantsLoading(true);
    setPageError(null);

    try {
      const [restaurantsResponse, featuresResponse] = await Promise.all([
        fetchSuperAdminRestaurants(),
        fetchSuperAdminFeatures(),
      ]);

      setRestaurants(restaurantsResponse);
      setGroupedCatalog(featuresResponse.grouped ?? []);

      if (restaurantsResponse.length > 0) {
        setSelectedRestaurantId((previous) => {
          if (previous && restaurantsResponse.some((restaurant) => restaurant.id === previous)) {
            return previous;
          }
          return restaurantsResponse[0].id;
        });
      } else {
        setSelectedRestaurantId(null);
        setRestaurantFeatures([]);
      }
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load Super Admin dashboard data.'));
    } finally {
      setRestaurantsLoading(false);
    }
  }, []);

  const loadRestaurantFeatures = useCallback(async (restaurantId: number) => {
    setFeaturesLoading(true);
    setPageError(null);

    try {
      const response = await fetchRestaurantFeatures(restaurantId);
      setRestaurantFeatures(response.features ?? []);
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load restaurant feature flags.'));
      setRestaurantFeatures([]);
    } finally {
      setFeaturesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuperAdminDashboard();
  }, [loadSuperAdminDashboard]);

  useEffect(() => {
    if (selectedRestaurantId === null) {
      setRestaurantFeatures([]);
      return;
    }

    loadRestaurantFeatures(selectedRestaurantId);
  }, [loadRestaurantFeatures, selectedRestaurantId]);

  const setFeatureSaving = (featureKey: string, saving: boolean) => {
    setSavingFeatureKeys((previous) => {
      if (saving) {
        return { ...previous, [featureKey]: true };
      }

      const next = { ...previous };
      delete next[featureKey];
      return next;
    });
  };

  const handleFeatureToggle = async (feature: SuperAdminFeatureFlag, enabled: boolean) => {
    if (!selectedRestaurantId) return;

    const snapshot = restaurantFeatures;
    setFeatureSaving(feature.key, true);
    setPageError(null);
    setRestaurantFeatures((previous) => previous.map((item) => (
      item.id === feature.id ? { ...item, enabled, source: 'override' } : item
    )));

    try {
      await updateRestaurantFeature(selectedRestaurantId, feature.id, enabled);
      showToast(`${feature.name} ${enabled ? 'enabled' : 'disabled'} for ${selectedRestaurant?.name ?? 'restaurant'}.`, 'primary');
    } catch (error: unknown) {
      setRestaurantFeatures(snapshot);
      setPageError(getErrorMessage(error, `Failed to update feature "${feature.name}".`));
    } finally {
      setFeatureSaving(feature.key, false);
    }
  };

  const handleBulkCategory = async (category: string, enabled: boolean) => {
    if (!selectedRestaurantId) return;

    const categoryFeatures = restaurantFeatures.filter(
      (feature) => normalizeCategory(feature.category) === category
    );

    if (categoryFeatures.length === 0) {
      return;
    }

    const actionLabel = enabled ? 'enable' : 'disable';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} all "${category}" features for ${selectedRestaurant?.name ?? 'this restaurant'}?`
    );
    if (!confirmed) {
      return;
    }

    const snapshot = restaurantFeatures;
    setBulkSavingCategory(category);
    setPageError(null);
    setRestaurantFeatures((previous) => previous.map((feature) => (
      normalizeCategory(feature.category) === category
        ? { ...feature, enabled, source: 'override' }
        : feature
    )));

    try {
      await bulkUpdateRestaurantFeatures(
        selectedRestaurantId,
        categoryFeatures.map((feature) => ({ key: feature.key, enabled }))
      );
      showToast(`${category} features updated successfully.`, 'secondary');
    } catch (error: unknown) {
      setRestaurantFeatures(snapshot);
      setPageError(getErrorMessage(error, `Failed to update "${category}" features.`));
    } finally {
      setBulkSavingCategory(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.replace('/super-admin/login');
  };

  return (
    <LiquidBackground>
      <div className="mx-auto min-h-screen max-w-7xl pb-8 pt-6">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Internal Super Admin Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold text-text">Feature Flag Control Room</h1>
              <p className="mt-1 text-sm text-muted">
                Signed in as {user?.email}. Feature changes auto-save and are audited.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LiquidButton tone="primary" onClick={() => navigate('/super-admin/contact-requests')}>
                Visitor requests
              </LiquidButton>
              <LiquidButton tone="primary" onClick={() => navigate('/super-admin/restaurants')}>
                Manage restaurants
              </LiquidButton>
              <LiquidButton tone="primary" onClick={() => navigate('/super-admin/restaurants/new')}>
                New restaurant
              </LiquidButton>
              <LiquidButton tone="tertiary" onClick={() => loadSuperAdminDashboard()}>
                Refresh
              </LiquidButton>
              <LiquidButton tone="secondary" onClick={handleLogout}>
                Logout
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        {pageError ? (
          <div className="mb-5 rounded-xl2 border border-spicy/40 bg-spicy/12 px-4 py-3 text-sm text-spicy">
            {pageError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <GlassCard className="p-0">
            <div className="border-b border-stroke px-4 py-4">
              <h2 className="text-lg font-semibold text-text">Restaurants</h2>
              <p className="mt-1 text-xs text-muted">Search by tenant name or slug</p>
              <div className="mt-3">
                <GlassInput
                  value={restaurantSearch}
                  onChange={(event) => setRestaurantSearch(event.target.value)}
                  placeholder="Search restaurants..."
                />
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto p-3">
              {restaurantsLoading ? (
                <p className="p-3 text-sm text-muted">Loading restaurants...</p>
              ) : filteredRestaurants.length === 0 ? (
                <p className="p-3 text-sm text-muted">No restaurants found.</p>
              ) : (
                <ul className="space-y-2">
                  {filteredRestaurants.map((restaurant) => {
                    const isSelected = restaurant.id === selectedRestaurantId;
                    const isActive = restaurant.status.toLowerCase() === 'active';

                    return (
                      <li key={restaurant.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRestaurantId(restaurant.id)}
                          className={`w-full rounded-xl2 border px-3 py-3 text-left transition ${
                            isSelected
                              ? 'border-gold/45 bg-gold/10 shadow-lux2'
                              : 'border-stroke bg-bg1/55 hover:border-gold/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-text">{restaurant.name}</p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                                isActive
                                  ? 'border-sage/40 bg-sage/12 text-sage'
                                  : 'border-spicy/40 bg-spicy/12 text-spicy'
                              }`}
                            >
                              {isActive ? 'active' : 'inactive'}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted">/{restaurant.slug}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-0">
            <div className="border-b border-stroke px-5 py-4">
              <h2 className="text-xl font-semibold text-text">
                {selectedRestaurant ? selectedRestaurant.name : 'Select a restaurant'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {selectedRestaurant ? `Slug: ${selectedRestaurant.slug}` : 'Pick a restaurant from the left to manage feature flags.'}
              </p>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-auto p-5">
              {!selectedRestaurant ? (
                <p className="text-sm text-muted">No restaurant selected.</p>
              ) : featuresLoading ? (
                <p className="text-sm text-muted">Loading feature flags...</p>
              ) : groupedRestaurantFeatures.length === 0 ? (
                <p className="text-sm text-muted">No features configured yet.</p>
              ) : (
                groupedRestaurantFeatures.map((group) => (
                  <GlassCard key={group.category}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-text">{group.category}</h3>
                      <div className="flex items-center gap-2">
                        <LiquidButton
                          tone="tertiary"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => handleBulkCategory(group.category, true)}
                          disabled={bulkSavingCategory === group.category}
                        >
                          Enable All
                        </LiquidButton>
                        <LiquidButton
                          tone="tertiary"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => handleBulkCategory(group.category, false)}
                          disabled={bulkSavingCategory === group.category}
                        >
                          Disable All
                        </LiquidButton>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {group.features.map((feature) => {
                        const saving = !!savingFeatureKeys[feature.key];
                        return (
                          <div
                            key={feature.id}
                            className="rounded-xl2 border border-stroke/80 bg-panel2/30 px-3 py-3"
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold text-text">{feature.name}</h4>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                                  feature.enabled
                                    ? 'border-sage/40 bg-sage/12 text-sage'
                                    : 'border-muted/40 bg-panel2/60 text-muted'
                                }`}
                              >
                                {feature.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>

                            {feature.description ? (
                              <p className="mb-3 text-xs text-muted">{feature.description}</p>
                            ) : null}

                            <GlassToggle
                              checked={feature.enabled}
                              onChange={(nextChecked) => handleFeatureToggle(feature, nextChecked)}
                              disabled={saving || bulkSavingCategory === group.category}
                              label={saving ? 'Saving...' : 'Toggle Feature'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default SuperAdminDashboardPage;
