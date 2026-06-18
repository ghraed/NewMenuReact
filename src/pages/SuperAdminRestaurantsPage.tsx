import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminAuth } from '../contexts/useSuperAdminAuth';
import { MENU_CATEGORIES } from '../i18n/categories';
import {
  fetchSuperAdminRestaurants,
  type SuperAdminRestaurantSummary,
} from '../services/superAdminFeatureFlagsService';
import {
  fetchSuperAdminRestaurantSetupOptions,
  updateSuperAdminRestaurant,
  type SuperAdminRestaurantSetupOptions,
  type UpdateSuperAdminRestaurantPayload,
} from '../services/superAdminRestaurantSetupService';
import {
  GlassBoard,
  GlassCard,
  GlassChip,
  GlassInput,
  GlassSelect,
  GlassToast,
  LiquidBackground,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

type RestaurantEditForm = {
  name: string;
  slug: string;
  status: string;
  currency: string;
  custom_domain: string;
  menu_categories: string[];
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as {
      response?: {
        data?: {
          message?: string;
          errors?: Record<string, string[]>;
        };
      };
    }).response;

    const validationErrors = response?.data?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const firstMessage = Object.values(validationErrors)
        .flat()
        .find((entry) => typeof entry === 'string' && entry.trim() !== '');

      if (firstMessage) {
        return firstMessage;
      }
    }

    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const buildFormFromRestaurant = (
  restaurant: SuperAdminRestaurantSummary,
  options: SuperAdminRestaurantSetupOptions | null
): RestaurantEditForm => ({
  name: restaurant.name,
  slug: restaurant.slug,
  status: restaurant.status || options?.restaurant_statuses?.[0] || 'active',
  currency: restaurant.currency || options?.currencies?.[0] || 'USD',
  custom_domain: restaurant.custom_domain ?? '',
  menu_categories: Array.isArray(restaurant.menu_categories) ? restaurant.menu_categories : [],
});

const normalizeCategories = (values: string[]): string[] => (
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value !== '')))
);

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not issued';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const statusToneClass = (status?: string | null): string => {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
      return 'border-sage/40 bg-sage/12 text-sage';
    case 'provisioning':
    case 'pending_dns':
      return 'border-gold/40 bg-gold/12 text-gold2';
    case 'failed':
    case 'inactive':
      return 'border-spicy/40 bg-spicy/12 text-spicy';
    default:
      return 'border-muted/40 bg-panel2/60 text-muted';
  }
};

const SuperAdminRestaurantsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useSuperAdminAuth();
  const { toast, showToast, dismiss } = useGlassToast(4200);

  const [restaurants, setRestaurants] = useState<SuperAdminRestaurantSummary[]>([]);
  const [options, setOptions] = useState<SuperAdminRestaurantSetupOptions | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RestaurantEditForm>({
    name: '',
    slug: '',
    status: 'active',
    currency: 'USD',
    custom_domain: '',
    menu_categories: [],
  });

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
      || (restaurant.custom_domain ?? '').toLowerCase().includes(query)
    ));
  }, [restaurants, restaurantSearch]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedRestaurant) return false;

    const baseline = buildFormFromRestaurant(selectedRestaurant, options);

    return (
      form.name !== baseline.name
      || form.slug !== baseline.slug
      || form.status !== baseline.status
      || form.currency !== baseline.currency
      || form.custom_domain !== baseline.custom_domain
      || normalizeCategories(form.menu_categories).join('|') !== normalizeCategories(baseline.menu_categories).join('|')
    );
  }, [form, options, selectedRestaurant]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const [restaurantsResponse, optionsResponse] = await Promise.all([
        fetchSuperAdminRestaurants(),
        fetchSuperAdminRestaurantSetupOptions(),
      ]);

      setRestaurants(restaurantsResponse);
      setOptions(optionsResponse);
      setSelectedRestaurantId((current) => {
        if (current && restaurantsResponse.some((restaurant) => restaurant.id === current)) {
          return current;
        }

        return restaurantsResponse[0]?.id ?? null;
      });
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load restaurants.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (selectedRestaurant) {
      setForm(buildFormFromRestaurant(selectedRestaurant, options));
      return;
    }

    setForm({
      name: '',
      slug: '',
      status: options?.restaurant_statuses?.[0] ?? 'active',
      currency: options?.currencies?.[0] ?? 'USD',
      custom_domain: '',
      menu_categories: [],
    });
  }, [options, selectedRestaurant]);

  useEffect(() => {
    if (pageError) {
      showToast(pageError, 'tertiary', 5000);
    }
  }, [pageError, showToast]);

  const handleCategoryToggle = (value: string) => {
    setForm((current) => ({
      ...current,
      menu_categories: current.menu_categories.includes(value)
        ? current.menu_categories.filter((entry) => entry !== value)
        : [...current.menu_categories, value],
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedRestaurant) {
      setPageError('Select a restaurant to update.');
      return;
    }

    const payload: UpdateSuperAdminRestaurantPayload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      status: form.status.trim(),
      currency: form.currency.trim(),
      custom_domain: form.custom_domain.trim(),
      menu_categories: normalizeCategories(form.menu_categories),
    };

    if (!payload.name || !payload.slug || !payload.status || !payload.currency) {
      setPageError('Name, slug, status, and currency are required.');
      return;
    }

    if (payload.menu_categories.length === 0) {
      setPageError('Select at least one menu category.');
      return;
    }

    setSaving(true);
    setPageError(null);

    try {
      const response = await updateSuperAdminRestaurant(selectedRestaurant.id, payload);
      const updatedRestaurant = response.restaurant;

      setRestaurants((current) => current.map((restaurant) => (
        restaurant.id === updatedRestaurant.id ? { ...restaurant, ...updatedRestaurant } : restaurant
      )));
      setSelectedRestaurantId(updatedRestaurant.id);
      setForm(buildFormFromRestaurant(updatedRestaurant, options));
      showToast(response.message, 'secondary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to update restaurant.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!selectedRestaurant) return;
    setForm(buildFormFromRestaurant(selectedRestaurant, options));
    setPageError(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/super-admin/login', { replace: true });
  };

  const statusOptions = (options?.restaurant_statuses ?? ['active', 'inactive']).map((option) => ({
    value: option,
    label: option,
  }));

  const currencyOptions = (options?.currencies ?? ['USD']).map((option) => ({
    value: option,
    label: option,
  }));

  const categoryDefinitions = options?.menu_categories ?? MENU_CATEGORIES;

  return (
    <LiquidBackground>
      <div className="mx-auto min-h-screen max-w-7xl pb-8 pt-6">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Internal Super Admin Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold text-text">Restaurant Management</h1>
              <p className="mt-1 text-sm text-muted">
                Signed in as {user?.email}. Updating a custom domain uses the existing queued provisioning worker.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LiquidButton tone="primary" onClick={() => navigate('/super-admin/restaurants/new')}>
                New restaurant
              </LiquidButton>
              <LiquidButton tone="tertiary" onClick={() => navigate('/super-admin/dashboard')}>
                Feature flags
              </LiquidButton>
              <LiquidButton tone="tertiary" onClick={() => void loadPage()}>
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

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <GlassCard className="p-0">
            <div className="border-b border-stroke px-4 py-4">
              <h2 className="text-lg font-semibold text-text">Restaurants</h2>
              <p className="mt-1 text-xs text-muted">Pick a tenant to edit domain and restaurant fields.</p>
              <div className="mt-3">
                <GlassInput
                  value={restaurantSearch}
                  onChange={(event) => setRestaurantSearch(event.target.value)}
                  placeholder="Search name, slug, or domain..."
                />
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto p-3">
              {loading ? (
                <p className="p-3 text-sm text-muted">Loading restaurants...</p>
              ) : filteredRestaurants.length === 0 ? (
                <p className="p-3 text-sm text-muted">No restaurants found.</p>
              ) : (
                <ul className="space-y-2">
                  {filteredRestaurants.map((restaurant) => {
                    const selected = restaurant.id === selectedRestaurantId;

                    return (
                      <li key={restaurant.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRestaurantId(restaurant.id)}
                          className={`w-full rounded-xl2 border px-3 py-3 text-left transition ${
                            selected
                              ? 'border-gold/45 bg-gold/10 shadow-lux2'
                              : 'border-stroke bg-bg1/55 hover:border-gold/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-text">{restaurant.name}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusToneClass(restaurant.status)}`}>
                              {restaurant.status}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted">/{restaurant.slug}</p>
                          <p className="mt-1 truncate text-xs text-muted">{restaurant.custom_domain || 'No custom domain'}</p>
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
                {selectedRestaurant
                  ? 'Changing the custom domain reuses the current provisioning queue worker and updates server config asynchronously.'
                  : 'Choose a restaurant from the left to edit it.'}
              </p>
            </div>

            <div className="max-h-[75vh] overflow-auto p-5">
              {!selectedRestaurant ? (
                <p className="text-sm text-muted">No restaurant selected.</p>
              ) : (
                <form className="space-y-5" onSubmit={handleSave}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-text">Restaurant Name</span>
                      <GlassInput
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-text">Slug</span>
                      <GlassInput
                        value={form.slug}
                        onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-text">Status</span>
                      <GlassSelect
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                        options={statusOptions}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-text">Currency</span>
                      <GlassSelect
                        value={form.currency}
                        onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                        options={currencyOptions}
                      />
                    </label>
                  </div>

                  <div className="rounded-xl2 border border-gold/20 bg-gold/6 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-text">Custom Domain</h3>
                        <p className="mt-1 text-xs text-muted">
                          Save a domain change here. The backend will queue provisioning and the existing worker will handle Apache and SSL updates.
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${statusToneClass(selectedRestaurant.custom_domain_status)}`}>
                        {selectedRestaurant.custom_domain_status || 'not configured'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-text">Custom Domain</span>
                        <GlassInput
                          value={form.custom_domain}
                          onChange={(event) => setForm((current) => ({ ...current, custom_domain: event.target.value }))}
                          placeholder="example.com"
                        />
                      </label>

                      <div className="rounded-xl2 border border-stroke/80 bg-panel2/30 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">SSL Issued</p>
                        <p className="mt-1 text-sm text-text">{formatDateTime(selectedRestaurant.ssl_issued_at)}</p>
                      </div>

                      <div className="rounded-xl2 border border-stroke/80 bg-panel2/30 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Current Error</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text">
                          {selectedRestaurant.custom_domain_error || 'No error recorded.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-text">Menu Categories</h3>
                        <p className="mt-1 text-xs text-muted">Keep this aligned with the restaurant’s allowed menu structure.</p>
                      </div>
                      <span className="text-xs text-muted">{form.menu_categories.length} selected</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {categoryDefinitions.map((category) => {
                        const selected = form.menu_categories.includes(category.value);
                        return (
                          <GlassChip
                            key={category.value}
                            active={selected}
                            onClick={() => handleCategoryToggle(category.value)}
                          >
                            {category.value}
                            {category.arabic ? ` • ${category.arabic}` : ''}
                          </GlassChip>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4">
                    <p className="text-xs text-muted">
                      {hasUnsavedChanges ? 'Unsaved changes pending.' : 'All changes saved.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <LiquidButton tone="tertiary" type="button" onClick={handleReset} disabled={saving || !hasUnsavedChanges}>
                        Reset
                      </LiquidButton>
                      <LiquidButton tone="primary" type="submit" disabled={saving || !hasUnsavedChanges}>
                        {saving ? 'Saving...' : 'Save restaurant'}
                      </LiquidButton>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {toast ? <GlassToast toast={toast} onClose={dismiss} /> : null}
    </LiquidBackground>
  );
};

export default SuperAdminRestaurantsPage;
