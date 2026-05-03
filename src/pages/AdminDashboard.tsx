import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import type { Dish } from '../types';
import api from '../services/api';
import { GlassCard, GlassInput, GlassPill, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import DishAssetThumbnail from '../components/Common/DishAssetThumbnail';
import RestaurantBrandMark from '../components/Common/RestaurantBrandMark';
import { useAuth } from '../contexts/useAuth';
import { translateCategoryLabel } from '../i18n/dynamic';
import {
  buildRestaurantProfilePayloadFromUser,
  fetchRestaurantProfile,
  mapResponseToProfilePayload,
  type RestaurantProfilePayload,
  updateRestaurantProfile,
  uploadRestaurantLogo,
  validateRestaurantLogoFile,
} from '../services/restaurantProfileService';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
};

type DishFilter = 'all' | 'active' | 'deleted';

interface DishListPayload {
  data?: unknown;
  current_page?: number;
  last_page?: number;
}

const parseDishListPage = (payload: unknown): { items: Dish[]; currentPage: number; lastPage: number } => {
  if (Array.isArray(payload)) {
    return { items: payload as Dish[], currentPage: 1, lastPage: 1 };
  }

  if (typeof payload !== 'object' || payload === null) {
    return { items: [], currentPage: 1, lastPage: 1 };
  }

  const pagePayload = payload as DishListPayload;
  const items = Array.isArray(pagePayload.data) ? (pagePayload.data as Dish[]) : [];
  const currentPage = Number.isFinite(pagePayload.current_page) ? Number(pagePayload.current_page) : 1;
  const lastPage = Number.isFinite(pagePayload.last_page) ? Number(pagePayload.last_page) : 1;

  return { items, currentPage, lastPage };
};

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DishFilter>('all');
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfilePayload>(
    buildRestaurantProfilePayloadFromUser(user?.restaurant)
  );
  const [loadingRestaurantProfile, setLoadingRestaurantProfile] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [savingRestaurantProfile, setSavingRestaurantProfile] = useState(false);
  const [uploadingRestaurantLogo, setUploadingRestaurantLogo] = useState(false);
  const [openMenuDishId, setOpenMenuDishId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRestaurantProfile(buildRestaurantProfilePayloadFromUser(user?.restaurant));
  }, [user?.restaurant]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenMenuDishId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuDishId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!user?.restaurant) {
      return;
    }

    let isCancelled = false;

    const loadRestaurantProfile = async () => {
      setLoadingRestaurantProfile(true);
      try {
        const response = await fetchRestaurantProfile();
        if (!isCancelled) {
          setRestaurantProfile(mapResponseToProfilePayload(response, user.restaurant));
          setRestaurantError(null);
        }
      } catch {
        if (!isCancelled) {
          setRestaurantProfile(buildRestaurantProfilePayloadFromUser(user.restaurant));
        }
      } finally {
        if (!isCancelled) {
          setLoadingRestaurantProfile(false);
        }
      }
    };

    void loadRestaurantProfile();

    return () => {
      isCancelled = true;
    };
  }, [user?.restaurant]);

  const normalizeOptionalField = (value: string | null | undefined): string | null => {
    const trimmed = (value || '').trim();
    return trimmed === '' ? null : trimmed;
  };

  const updateRestaurantProfileField = (
    field: keyof RestaurantProfilePayload,
    value: string
  ) => {
    setRestaurantProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const fetchDishes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseParams =
        filter === 'active'
          ? { include_deleted: '0' }
          : filter === 'deleted'
            ? { only_deleted: '1' }
            : { include_deleted: '1' };

      const perPage = 200;
      let currentPage = 1;
      let lastPage = 1;
      const allDishes: Dish[] = [];

      do {
        const response = await api.get('/dishes', {
          params: {
            ...baseParams,
            page: String(currentPage),
            per_page: String(perPage),
          },
        });

        const parsed = parseDishListPage(response.data);
        allDishes.push(...parsed.items);
        currentPage += 1;
        lastPage = parsed.lastPage;
      } while (currentPage <= lastPage);

      setDishes(allDishes);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, t('menuList.failedToLoad')));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  const handlePublishToggle = async (dish: Dish) => {
    const action = dish.status === 'published' ? 'unpublish' : 'publish';
    try {
      const response = await api.patch(`/dishes/${dish.id}/${action}`);
      const updated = response.data as Dish;
      setDishes((prev) => prev.map((item) => (item.id === dish.id ? updated : item)));
      setOpenMenuDishId(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err, t(`adminDashboard.failed${action === 'publish' ? 'Publish' : 'Unpublish'}`)));
    }
  };

  const handleDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      `Delete "${dish.name}"?\n\nThis is a soft delete. You can restore it later.\n\nIts 3D model files will be removed after 7 days if you do not restore the dish or permanently delete it.`
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}`);
      showToast(response?.data?.message || `Dish "${dish.name}" moved to deleted state.`, 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedDelete')));
    }
  };

  const handleRestore = async (dish: Dish) => {
    try {
      const response = await api.post(`/dishes/${dish.id}/restore`);
      showToast(response?.data?.message || `Dish "${dish.name}" restored.`, 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedRestore')));
    }
  };

  const handlePermanentDelete = async (dish: Dish) => {
    const confirmed = window.confirm(
      `Permanently delete "${dish.name}"?\n\nThis action cannot be undone. The dish and all related model files will be removed forever.`
    );
    if (!confirmed) return;

    try {
      const response = await api.delete(`/dishes/${dish.id}/force`);
      showToast(response?.data?.message || `Dish "${dish.name}" permanently deleted.`, 'secondary', 4200);
      setOpenMenuDishId(null);
      void fetchDishes();
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('adminDashboard.failedPermanentDelete')));
    }
  };

  const handleRestaurantProfileUpdate = async () => {
    setRestaurantError(null);
    const nextName = (restaurantProfile.name || '').trim();
    const currentName = user?.restaurant?.name?.trim() ?? '';

    if (!nextName) {
      setRestaurantError(t('adminDashboard.restaurantNameRequired'));
      return;
    }

    if (restaurantProfile.contact_email) {
      const normalizedEmail = restaurantProfile.contact_email.trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (normalizedEmail !== '' && !emailPattern.test(normalizedEmail)) {
        setRestaurantError(t('adminDashboard.invalidContactEmail'));
        return;
      }
    }

    if (restaurantProfile.website_url) {
      try {
        const normalizedWebsite = restaurantProfile.website_url.trim();
        if (normalizedWebsite !== '') {
          const candidateUrl = normalizedWebsite.startsWith('http')
            ? normalizedWebsite
            : `https://${normalizedWebsite}`;
          // Validate URL shape before submitting.
          // eslint-disable-next-line no-new
          new URL(candidateUrl);
        }
      } catch {
        setRestaurantError(t('adminDashboard.invalidWebsiteUrl'));
        return;
      }
    }

    const payload: RestaurantProfilePayload = {
      name: nextName,
      legal_business_name: normalizeOptionalField(restaurantProfile.legal_business_name),
      cuisine_specialty: normalizeOptionalField(restaurantProfile.cuisine_specialty),
      primary_phone: normalizeOptionalField(restaurantProfile.primary_phone),
      whatsapp_phone: normalizeOptionalField(restaurantProfile.whatsapp_phone),
      contact_email: normalizeOptionalField(restaurantProfile.contact_email),
      website_url: normalizeOptionalField(restaurantProfile.website_url),
      address_line_1: normalizeOptionalField(restaurantProfile.address_line_1),
      address_line_2: normalizeOptionalField(restaurantProfile.address_line_2),
      city: normalizeOptionalField(restaurantProfile.city),
      state_province: normalizeOptionalField(restaurantProfile.state_province),
      postal_code: normalizeOptionalField(restaurantProfile.postal_code),
      country: normalizeOptionalField(restaurantProfile.country),
      tax_registration_number: normalizeOptionalField(restaurantProfile.tax_registration_number),
      vat_registration_number: normalizeOptionalField(restaurantProfile.vat_registration_number),
      service_hours: normalizeOptionalField(restaurantProfile.service_hours),
      short_description: normalizeOptionalField(restaurantProfile.short_description),
    };

    const isNoChange = JSON.stringify(payload) === JSON.stringify(buildRestaurantProfilePayloadFromUser(user?.restaurant));
    if (isNoChange) {
      setRestaurantError(t('adminDashboard.noRestaurantNameChanges'));
      return;
    }

    const confirmed = window.confirm(
      nextName !== currentName
        ? t('adminDashboard.confirmNameChange', { currentName, nextName })
        : t('adminDashboard.confirmProfileSave')
    );
    if (!confirmed) return;

    setSavingRestaurantProfile(true);
    try {
      const response = await updateRestaurantProfile(payload);
      setRestaurantProfile(mapResponseToProfilePayload(response, user?.restaurant));
      showToast(response.message || t('adminDashboard.profileSaved'), 'secondary', 4200);
      await refreshUser();
    } catch (err: unknown) {
      const status = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : null;

      if (status === 404 || status === 405) {
        try {
          const fallbackResponse = await api.patch('/restaurant/name', { name: payload.name });
          showToast(
            fallbackResponse.data?.message || t('adminDashboard.restaurantNameUpdated'),
            'secondary',
            4200
          );
          await refreshUser();
        } catch (fallbackError: unknown) {
          setRestaurantError(getErrorMessage(fallbackError, t('adminDashboard.failedRestaurantNameUpdate')));
        }
      } else {
        setRestaurantError(getErrorMessage(err, t('adminDashboard.failedRestaurantNameUpdate')));
      }
    } finally {
      setSavingRestaurantProfile(false);
    }
  };

  const handleRestaurantLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    setRestaurantError(null);
    const fileValidationError = await validateRestaurantLogoFile(file);
    if (fileValidationError) {
      setRestaurantError(fileValidationError);
      return;
    }

    setUploadingRestaurantLogo(true);
    try {
      const response = await uploadRestaurantLogo(file);
      setRestaurantProfile(mapResponseToProfilePayload(response, user?.restaurant));
      showToast(response.message || t('adminDashboard.logoUploaded'), 'secondary', 4200);
      await refreshUser();
    } catch (err: unknown) {
      setRestaurantError(getErrorMessage(err, t('adminDashboard.failedLogoUpload')));
    } finally {
      setUploadingRestaurantLogo(false);
    }
  };

  return (
    <DashboardLayout title={t('admin.dashboard')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-text">{t('adminDashboard.yourDishes')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/admin/accounting">
            <LiquidButton tone="tertiary">
              <span>💳</span> {t('admin.accounting')}
            </LiquidButton>
          </Link>
          <Link to="/admin/staff">
            <LiquidButton tone="secondary">
              <span>👥</span> {t('adminDashboard.manageStaff')}
            </LiquidButton>
          </Link>
          <Link to="/admin/dishes/create">
            <LiquidButton tone="primary">
              <span>➕</span> {t('createDish.pageTitle')}
            </LiquidButton>
          </Link>
        </div>
      </div>

      <GlassCard className="mb-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted2">{t('adminDashboard.profileTitle')}</h3>
            <p className="mt-1 text-xs text-muted">{t('adminDashboard.profileSubtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <RestaurantBrandMark
              name={restaurantProfile.name}
              logoUrl={user?.restaurant?.logo_url}
              className="h-12 w-12"
              fallbackClassName="text-base"
            />
            <div className="text-right">
              <p className="text-sm font-semibold text-text">{restaurantProfile.name || t('adminDashboard.restaurantNamePlaceholder')}</p>
              <p className="text-xs text-muted">/{user?.restaurant?.slug || 'restaurant'}</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-stroke/60 bg-bg1/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text">{t('adminDashboard.logoTitle')}</p>
              <p className="text-xs text-muted">{t('adminDashboard.logoHint')}</p>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleRestaurantLogoUpload}
                disabled={uploadingRestaurantLogo}
              />
              <span className="inline-flex rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold2 transition hover:border-gold/55">
                {uploadingRestaurantLogo ? t('adminDashboard.uploadingLogo') : t('adminDashboard.uploadLogo')}
              </span>
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.restaurantName')}</span>
            <GlassInput
              value={restaurantProfile.name}
              onChange={(event) => updateRestaurantProfileField('name', event.target.value)}
              placeholder={t('adminDashboard.restaurantNamePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.legalBusinessName')}</span>
            <GlassInput
              value={restaurantProfile.legal_business_name ?? ''}
              onChange={(event) => updateRestaurantProfileField('legal_business_name', event.target.value)}
              placeholder={t('adminDashboard.legalBusinessNamePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.cuisineSpecialty')}</span>
            <GlassInput
              value={restaurantProfile.cuisine_specialty ?? ''}
              onChange={(event) => updateRestaurantProfileField('cuisine_specialty', event.target.value)}
              placeholder={t('adminDashboard.cuisineSpecialtyPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.contactEmail')}</span>
            <GlassInput
              type="email"
              value={restaurantProfile.contact_email ?? ''}
              onChange={(event) => updateRestaurantProfileField('contact_email', event.target.value)}
              placeholder={t('adminDashboard.contactEmailPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.primaryPhone')}</span>
            <GlassInput
              value={restaurantProfile.primary_phone ?? ''}
              onChange={(event) => updateRestaurantProfileField('primary_phone', event.target.value)}
              placeholder={t('adminDashboard.primaryPhonePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.whatsappPhone')}</span>
            <GlassInput
              value={restaurantProfile.whatsapp_phone ?? ''}
              onChange={(event) => updateRestaurantProfileField('whatsapp_phone', event.target.value)}
              placeholder={t('adminDashboard.whatsappPhonePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.websiteUrl')}</span>
            <GlassInput
              value={restaurantProfile.website_url ?? ''}
              onChange={(event) => updateRestaurantProfileField('website_url', event.target.value)}
              placeholder={t('adminDashboard.websiteUrlPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.serviceHours')}</span>
            <GlassInput
              value={restaurantProfile.service_hours ?? ''}
              onChange={(event) => updateRestaurantProfileField('service_hours', event.target.value)}
              placeholder={t('adminDashboard.serviceHoursPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.addressLineOne')}</span>
            <GlassInput
              value={restaurantProfile.address_line_1 ?? ''}
              onChange={(event) => updateRestaurantProfileField('address_line_1', event.target.value)}
              placeholder={t('adminDashboard.addressLineOnePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.addressLineTwo')}</span>
            <GlassInput
              value={restaurantProfile.address_line_2 ?? ''}
              onChange={(event) => updateRestaurantProfileField('address_line_2', event.target.value)}
              placeholder={t('adminDashboard.addressLineTwoPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.city')}</span>
            <GlassInput
              value={restaurantProfile.city ?? ''}
              onChange={(event) => updateRestaurantProfileField('city', event.target.value)}
              placeholder={t('adminDashboard.cityPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.stateProvince')}</span>
            <GlassInput
              value={restaurantProfile.state_province ?? ''}
              onChange={(event) => updateRestaurantProfileField('state_province', event.target.value)}
              placeholder={t('adminDashboard.stateProvincePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.postalCode')}</span>
            <GlassInput
              value={restaurantProfile.postal_code ?? ''}
              onChange={(event) => updateRestaurantProfileField('postal_code', event.target.value)}
              placeholder={t('adminDashboard.postalCodePlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.country')}</span>
            <GlassInput
              value={restaurantProfile.country ?? ''}
              onChange={(event) => updateRestaurantProfileField('country', event.target.value)}
              placeholder={t('adminDashboard.countryPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.taxRegistration')}</span>
            <GlassInput
              value={restaurantProfile.tax_registration_number ?? ''}
              onChange={(event) => updateRestaurantProfileField('tax_registration_number', event.target.value)}
              placeholder={t('adminDashboard.taxRegistrationPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.vatRegistration')}</span>
            <GlassInput
              value={restaurantProfile.vat_registration_number ?? ''}
              onChange={(event) => updateRestaurantProfileField('vat_registration_number', event.target.value)}
              placeholder={t('adminDashboard.vatRegistrationPlaceholder')}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted2">{t('adminDashboard.shortDescription')}</span>
            <textarea
              value={restaurantProfile.short_description ?? ''}
              onChange={(event) => updateRestaurantProfileField('short_description', event.target.value)}
              placeholder={t('adminDashboard.shortDescriptionPlaceholder')}
              rows={3}
              disabled={savingRestaurantProfile || loadingRestaurantProfile}
              className="w-full rounded-xl2 border border-stroke bg-panel2 px-3 py-2 text-sm text-text outline-none transition focus:border-gold/50 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <LiquidButton
            tone="primary"
            onClick={handleRestaurantProfileUpdate}
            disabled={savingRestaurantProfile || loadingRestaurantProfile}
            className="w-full sm:w-auto"
          >
            {savingRestaurantProfile ? t('adminDashboard.saving') : t('adminDashboard.saveProfile')}
          </LiquidButton>
        </div>
        {restaurantError && <p className="mt-2 text-sm text-spicy">{restaurantError}</p>}
      </GlassCard>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <GlassPill active={filter === 'all'} onClick={() => setFilter('all')}>{t('menuList.allCategories')}</GlassPill>
        <GlassPill active={filter === 'active'} onClick={() => setFilter('active')}>{t('admin.active')}</GlassPill>
        <GlassPill active={filter === 'deleted'} onClick={() => setFilter('deleted')}>{t('adminDashboard.deleted')}</GlassPill>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted">{t('adminDashboard.loadingDishes')}</div>
      ) : error ? (
        <div className="rounded-xl2 border border-spicy/40 bg-spicy/12 py-12 text-center text-spicy">{error}</div>
      ) : dishes.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">📭</div>
          <h3 className="mb-2 text-xl font-medium text-text">{t('adminDashboard.noDishesYet')}</h3>
          <p className="mb-4 text-muted">{t('adminDashboard.noDishesDescription')}</p>
          <Link to="/admin/dishes/create">
            <LiquidButton tone="primary">{t('createDish.submit')}</LiquidButton>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {dishes.map((dish) => (
            <GlassCard
              key={dish.id}
              className={openMenuDishId === dish.id ? 'z-50 overflow-visible' : 'overflow-visible'}
            >
              <div className="flex items-start gap-4">
                <DishAssetThumbnail dish={dish} className="h-20 w-20" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-text">{dish.name}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                        <span>{translateCategoryLabel(dish.category, dish.category_ar)}</span>
                        <span
                          className={
                            dish.status === 'published'
                              ? 'inline-flex items-center gap-1 rounded-full border border-sage/35 bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage'
                              : 'inline-flex items-center gap-1 rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy'
                          }
                        >
                          {dish.status === 'published' ? '✓' : '✕'}
                        </span>
                        {dish.model_state === 'processing' && (
                          <span className="inline-flex items-center rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-sky-200">
                            {t('adminDashboard.modelProcessing')}
                          </span>
                        )}
                        {dish.model_state === 'error' && (
                          <span className="inline-flex items-center rounded-full border border-spicy/35 bg-spicy/10 px-2 py-0.5 text-xs font-medium text-spicy">
                            {t('adminDashboard.modelError')}
                          </span>
                        )}
                        {dish.deleted_at && (
                          <span className="inline-flex items-center rounded-full border border-gold/35 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold2">
                            {t('adminDashboard.deleted')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-gold2">${Number(dish.price).toFixed(2)}</div>
                  </div>

                  <div className="mt-4">
                    {dish.deleted_at ? (
                      <div className="grid grid-cols-2 gap-2">
                        <LiquidButton tone="tertiary" onClick={() => handleRestore(dish)} className="w-full px-3 py-1.5 text-xs">
                          {t('adminDashboard.restore')}
                        </LiquidButton>
                        <LiquidButton tone="secondary" onClick={() => handlePermanentDelete(dish)} className="w-full px-3 py-1.5 text-xs">
                          {t('adminDashboard.deletePermanently')}
                        </LiquidButton>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {dish.status !== 'published' && (
                          <LiquidButton
                            tone="primary"
                            onClick={() => handlePublishToggle(dish)}
                            className="flex-1 px-3 py-1.5 text-xs"
                          >
                            {t('adminDashboard.publish')}
                          </LiquidButton>
                        )}
                        <div className="relative" ref={openMenuDishId === dish.id ? actionMenuRef : null}>
                          <button
                            type="button"
                            aria-label={`More actions for ${dish.name}`}
                            aria-expanded={openMenuDishId === dish.id}
                            onClick={() => setOpenMenuDishId((current) => (current === dish.id ? null : dish.id))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-text transition hover:border-gold/30 hover:bg-white/10 hover:text-white"
                          >
                            ⋯
                          </button>
                          {openMenuDishId === dish.id && (
                            <div
                              className="absolute right-0 top-12 z-50 isolate w-44 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-2xl"
                              style={{ backgroundColor: 'rgb(var(--color-bg1))' }}
                            >
                              {dish.status === 'published' && (
                                <button
                                  type="button"
                                  onClick={() => handlePublishToggle(dish)}
                                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-text transition hover:bg-white/10"
                                >
                                  {t('adminDashboard.unpublish')}
                                </button>
                              )}
                              <Link
                                to={`/admin/dishes/${dish.id}/edit`}
                                className="block rounded-xl px-3 py-2 text-sm text-text transition hover:bg-white/10"
                                onClick={() => setOpenMenuDishId(null)}
                              >
                                {t('adminDashboard.edit')}
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(dish)}
                                className="w-full rounded-xl px-3 py-2 text-left text-sm text-spicy transition hover:bg-spicy/10"
                              >
                                {t('adminDashboard.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminDashboard;
