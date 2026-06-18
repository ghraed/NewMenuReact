import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENU_CATEGORIES } from '../i18n/categories';
import { translateCategoryLabel } from '../i18n/dynamic';
import { useSuperAdminAuth } from '../contexts/useSuperAdminAuth';
import {
  createSuperAdminRestaurant,
  fetchSuperAdminRestaurantSetupOptions,
  type SuperAdminSetupUserOption,
} from '../services/superAdminRestaurantSetupService';
import {
  GlassBoard,
  GlassCard,
  GlassInput,
  GlassToast,
  LiquidBackground,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';

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

const SuperAdminRestaurantSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useSuperAdminAuth();
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SuperAdminSetupUserOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>(['active', 'inactive']);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(['USD']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [restaurantCreated, setRestaurantCreated] = useState(false);
  const [adminMode, setAdminMode] = useState<'new' | 'existing'>('new');
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    slug: '',
    user_id: '',
    status: 'active',
    currency: 'USD',
    custom_domain: '',
  });

  const loadOptions = async () => {
    setLoading(true);
    setPageError(null);

    try {
      const response = await fetchSuperAdminRestaurantSetupOptions();
      setUsers(response.users ?? []);
      setStatusOptions(response.restaurant_statuses?.length ? response.restaurant_statuses : ['active', 'inactive']);
      setCurrencyOptions(response.currencies?.length ? response.currencies : ['USD']);
      setRestaurantForm((current) => ({
        ...current,
        status: response.restaurant_statuses?.[0] ?? current.status,
        currency: response.currencies?.[0] ?? current.currency,
      }));
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to load setup options.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    if (pageError) {
      showToast(pageError, 'tertiary', 4800);
    }
  }, [pageError, showToast]);

  const availableUsers = useMemo(
    () => users.filter((candidate) => !candidate.has_restaurant || String(candidate.id) === restaurantForm.user_id),
    [restaurantForm.user_id, users]
  );

  const toggleCategory = (value: string) => {
    setSelectedCategories((current) => (
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    ));
  };

  const handleCreateRestaurant = async (event: React.FormEvent) => {
    event.preventDefault();
    setPageError(null);

    const payload = {
      name: restaurantForm.name.trim(),
      slug: restaurantForm.slug.trim().toLowerCase(),
      user_id: adminMode === 'existing' ? Number(restaurantForm.user_id) : undefined,
      admin_user: adminMode === 'new'
        ? {
          name: adminForm.name.trim(),
          email: adminForm.email.trim(),
          password: adminForm.password,
          phone: adminForm.phone.trim() || undefined,
        }
        : undefined,
      status: restaurantForm.status.trim(),
      currency: restaurantForm.currency.trim(),
      custom_domain: restaurantForm.custom_domain.trim().toLowerCase(),
      menu_categories: selectedCategories,
    };

    if (!payload.name || !payload.slug || !payload.status || !payload.currency || !payload.custom_domain) {
      setPageError('All restaurant fields are required.');
      return;
    }

    if (adminMode === 'existing' && !payload.user_id) {
      setPageError('Select an existing admin user.');
      return;
    }

    if (
      adminMode === 'new'
      && (!payload.admin_user?.name || !payload.admin_user.email || !payload.admin_user.password)
    ) {
      setPageError('Admin name, email, and password are required when creating a new restaurant admin.');
      return;
    }

    if (payload.menu_categories.length === 0) {
      setPageError('Select at least one menu category.');
      return;
    }

    setCreatingRestaurant(true);
    try {
      const response = await createSuperAdminRestaurant(payload);
      showToast(response.message, 'secondary');
      setRestaurantCreated(true);
      setRestaurantForm({
        name: '',
        slug: '',
        user_id: '',
        status: statusOptions[0] ?? 'active',
        currency: currencyOptions[0] ?? 'USD',
        custom_domain: '',
      });
      setAdminForm({
        name: '',
        email: '',
        password: '',
        phone: '',
      });
      setSelectedCategories([]);
      await loadOptions();
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to create restaurant.'));
    } finally {
      setCreatingRestaurant(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/super-admin/login', { replace: true });
  };

  return (
    <LiquidBackground>
      <div className="mx-auto flex h-screen max-w-7xl flex-col overflow-hidden px-4 py-4">
        <GlassBoard className="mb-4 shrink-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Internal Super Admin Dashboard</p>
              <h1 className="mt-1 text-xl font-semibold text-text">Restaurant Setup</h1>
              <p className="mt-1 text-xs text-muted">
                Signed in as {user?.email}. Restaurant and admin are created together to avoid orphan users.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LiquidButton tone="tertiary" onClick={() => navigate('/super-admin/restaurants')}>
                Manage restaurants
              </LiquidButton>
              <LiquidButton tone="tertiary" onClick={() => navigate('/super-admin/dashboard')}>
                Feature flags
              </LiquidButton>
              <LiquidButton tone="primary" onClick={() => loadOptions()}>
                Refresh
              </LiquidButton>
              <LiquidButton tone="secondary" onClick={handleLogout}>
                Logout
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <GlassCard className="space-y-3 overflow-hidden p-4">
            <div>
              <h2 className="text-base font-semibold text-text">Standalone Admin</h2>
              <p className="mt-1 text-xs text-muted">
                This stays disabled until a restaurant is created first. Use the restaurant form to create the first admin atomically.
              </p>
            </div>

            <div className="space-y-3 opacity-55">
              <GlassInput value="" placeholder="Name" disabled />
              <GlassInput value="" placeholder="Email" disabled />
              <GlassInput value="" placeholder="Password" disabled />
              <GlassInput value="" placeholder="Phone" disabled />
              <LiquidButton className="w-full" disabled>
                {restaurantCreated ? 'Separate admin creation disabled in this build' : 'Create a restaurant first'}
              </LiquidButton>
            </div>
          </GlassCard>

          <GlassCard className="min-h-0 space-y-4 overflow-hidden p-4">
            <div>
              <h2 className="text-base font-semibold text-text">Create Restaurant</h2>
              <p className="mt-1 text-xs text-muted">All fields are required, including admin details and at least one allowed category.</p>
            </div>

            {loading ? (
              <p className="text-sm text-muted">Loading setup options...</p>
            ) : (
              <form onSubmit={handleCreateRestaurant} className="flex h-full min-h-0 flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">Restaurant Name</label>
                    <GlassInput value={restaurantForm.name} onChange={(event) => setRestaurantForm((current) => ({ ...current, name: event.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">Slug</label>
                    <GlassInput value={restaurantForm.slug} onChange={(event) => setRestaurantForm((current) => ({ ...current, slug: event.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">Status</label>
                    <select
                      value={restaurantForm.status}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, status: event.target.value }))}
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2 text-sm font-medium text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                      required
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">Currency</label>
                    <select
                      value={restaurantForm.currency}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, currency: event.target.value }))}
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2 text-sm font-medium text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                      required
                    >
                      {currencyOptions.map((currency) => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">Custom Domain</label>
                    <GlassInput value={restaurantForm.custom_domain} onChange={(event) => setRestaurantForm((current) => ({ ...current, custom_domain: event.target.value }))} placeholder="example.com" required />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-3 rounded-xl2 border border-stroke/80 bg-panel2/25 p-3">
                    <div className="flex gap-2">
                      <LiquidButton type="button" tone={adminMode === 'new' ? 'primary' : 'tertiary'} className="flex-1 px-3 py-1.5 text-xs" onClick={() => setAdminMode('new')}>
                        New admin
                      </LiquidButton>
                      <LiquidButton type="button" tone={adminMode === 'existing' ? 'primary' : 'tertiary'} className="flex-1 px-3 py-1.5 text-xs" onClick={() => setAdminMode('existing')}>
                        Existing
                      </LiquidButton>
                    </div>
                    {adminMode === 'new' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text">Admin Name</label>
                          <GlassInput value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} required={adminMode === 'new'} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text">Admin Email</label>
                          <GlassInput type="email" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} required={adminMode === 'new'} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text">Admin Password</label>
                          <GlassInput type="password" value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} required={adminMode === 'new'} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text">Phone</label>
                          <GlassInput value={adminForm.phone} onChange={(event) => setAdminForm((current) => ({ ...current, phone: event.target.value }))} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text">Admin User</label>
                        <select
                          value={restaurantForm.user_id}
                          onChange={(event) => setRestaurantForm((current) => ({ ...current, user_id: event.target.value }))}
                          className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2 text-sm font-medium text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                          required={adminMode === 'existing'}
                        >
                          <option value="">Select admin user</option>
                          {availableUsers.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name} #{candidate.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="min-h-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-text">Allowed Menu Categories</h3>
                        <p className="text-xs text-muted">Selected: {selectedCategories.length}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <LiquidButton type="button" tone="tertiary" className="px-3 py-1.5 text-xs" onClick={() => setSelectedCategories(MENU_CATEGORIES.map((category) => category.value))}>
                          All
                        </LiquidButton>
                        <LiquidButton type="button" tone="tertiary" className="px-3 py-1.5 text-xs" onClick={() => setSelectedCategories([])}>
                          Clear
                        </LiquidButton>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 rounded-xl2 border border-stroke/80 bg-panel2/25 p-2 xl:grid-cols-6">
                      {MENU_CATEGORIES.map((category) => {
                        const checked = selectedCategories.includes(category.value);
                        return (
                          <label key={category.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke/60 bg-bg1/45 px-2 py-1 text-[11px] leading-tight text-text">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(category.value)}
                              className="h-3.5 w-3.5 rounded border-stroke text-gold focus:ring-gold/50"
                            />
                            <span className="truncate">{translateCategoryLabel(category.value, category.arabic)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">Allowed Menu Categories</h3>
                      <p className="text-xs text-muted">Selected: {selectedCategories.length}</p>
                    </div>
                  </div>
                  <LiquidButton type="submit" className="w-full" disabled={creatingRestaurant}>
                    {creatingRestaurant ? 'Creating restaurant...' : 'Create Restaurant'}
                  </LiquidButton>
                </div>
              </form>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </LiquidBackground>
  );
};

export default SuperAdminRestaurantSetupPage;
