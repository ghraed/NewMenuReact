import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENU_CATEGORIES } from '../i18n/categories';
import { translateCategoryLabel } from '../i18n/dynamic';
import { useSuperAdminAuth } from '../contexts/useSuperAdminAuth';
import {
  createSuperAdminRestaurant,
  createSuperAdminUser,
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
    const response = (error as { response?: { data?: { message?: string } } }).response;
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
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [userForm, setUserForm] = useState({
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

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setPageError(null);

    const name = userForm.name.trim();
    const email = userForm.email.trim();
    const password = userForm.password;

    if (!name || !email || !password) {
      setPageError('Name, email, and password are required.');
      return;
    }

    setCreatingUser(true);
    try {
      const response = await createSuperAdminUser({
        name,
        email,
        password,
        phone: userForm.phone.trim() || undefined,
      });

      setUsers((current) => [...current, response.user].sort((left, right) => left.name.localeCompare(right.name)));
      setRestaurantForm((current) => ({ ...current, user_id: String(response.user.id) }));
      setUserForm({ name: '', email: '', password: '', phone: '' });
      showToast(response.message, 'secondary');
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Failed to create admin user.'));
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateRestaurant = async (event: React.FormEvent) => {
    event.preventDefault();
    setPageError(null);

    const payload = {
      name: restaurantForm.name.trim(),
      slug: restaurantForm.slug.trim().toLowerCase(),
      user_id: Number(restaurantForm.user_id),
      status: restaurantForm.status.trim(),
      currency: restaurantForm.currency.trim(),
      custom_domain: restaurantForm.custom_domain.trim().toLowerCase(),
      menu_categories: selectedCategories,
    };

    if (!payload.name || !payload.slug || !payload.user_id || !payload.status || !payload.currency || !payload.custom_domain) {
      setPageError('All restaurant fields are required.');
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
      setRestaurantForm({
        name: '',
        slug: '',
        user_id: '',
        status: statusOptions[0] ?? 'active',
        currency: currencyOptions[0] ?? 'USD',
        custom_domain: '',
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
      <div className="mx-auto min-h-screen max-w-7xl pb-8 pt-6">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Internal Super Admin Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold text-text">Restaurant Setup</h1>
              <p className="mt-1 text-sm text-muted">
                Signed in as {user?.email}. Create admin users, onboard restaurants, and assign menu categories.
              </p>
            </div>
            <div className="flex items-center gap-2">
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

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <GlassCard className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Create Admin User</h2>
              <p className="mt-1 text-sm text-muted">This user can then be attached to a restaurant as the required `user_id`.</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Name</label>
                <GlassInput value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Email</label>
                <GlassInput type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Password</label>
                <GlassInput type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Phone</label>
                <GlassInput value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
              <LiquidButton type="submit" className="w-full" disabled={creatingUser}>
                {creatingUser ? 'Creating admin...' : 'Create Admin User'}
              </LiquidButton>
            </form>
          </GlassCard>

          <GlassCard className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-text">Create Restaurant</h2>
              <p className="mt-1 text-sm text-muted">All restaurant fields below are required, including a custom domain and at least one allowed menu category.</p>
            </div>

            {loading ? (
              <p className="text-sm text-muted">Loading setup options...</p>
            ) : (
              <form onSubmit={handleCreateRestaurant} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Restaurant Name</label>
                    <GlassInput value={restaurantForm.name} onChange={(event) => setRestaurantForm((current) => ({ ...current, name: event.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Slug</label>
                    <GlassInput value={restaurantForm.slug} onChange={(event) => setRestaurantForm((current) => ({ ...current, slug: event.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Admin User</label>
                    <select
                      value={restaurantForm.user_id}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, user_id: event.target.value }))}
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm font-medium text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                      required
                    >
                      <option value="">Select admin user</option>
                      {availableUsers.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} #{candidate.id} {candidate.email ? `(${candidate.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Status</label>
                    <select
                      value={restaurantForm.status}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, status: event.target.value }))}
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm font-medium text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                      required
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Currency</label>
                    <select
                      value={restaurantForm.currency}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, currency: event.target.value }))}
                      className="w-full rounded-2xl border border-stroke bg-bg1/65 px-4 py-2.5 text-sm font-medium text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/55"
                      required
                    >
                      {currencyOptions.map((currency) => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Custom Domain</label>
                    <GlassInput value={restaurantForm.custom_domain} onChange={(event) => setRestaurantForm((current) => ({ ...current, custom_domain: event.target.value }))} placeholder="example.com" required />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">Allowed Menu Categories</h3>
                      <p className="text-xs text-muted">Selected: {selectedCategories.length}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <LiquidButton type="button" tone="tertiary" className="px-3 py-1.5 text-xs" onClick={() => setSelectedCategories(MENU_CATEGORIES.map((category) => category.value))}>
                        Select All
                      </LiquidButton>
                      <LiquidButton type="button" tone="tertiary" className="px-3 py-1.5 text-xs" onClick={() => setSelectedCategories([])}>
                        Clear
                      </LiquidButton>
                    </div>
                  </div>
                  <div className="grid max-h-[420px] gap-2 overflow-auto rounded-xl2 border border-stroke/80 bg-panel2/25 p-3 md:grid-cols-2 xl:grid-cols-3">
                    {MENU_CATEGORIES.map((category) => {
                      const checked = selectedCategories.includes(category.value);
                      return (
                        <label key={category.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-stroke/70 bg-bg1/45 px-3 py-3 text-sm text-text">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategory(category.value)}
                            className="mt-0.5 h-4 w-4 rounded border-stroke text-gold focus:ring-gold/50"
                          />
                          <span>{translateCategoryLabel(category.value, category.arabic)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <LiquidButton type="submit" className="w-full" disabled={creatingRestaurant}>
                  {creatingRestaurant ? 'Creating restaurant...' : 'Create Restaurant'}
                </LiquidButton>
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
