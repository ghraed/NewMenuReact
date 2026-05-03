import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, GlassInput, GlassToast, LiquidButton, useGlassToast } from '../components/ui/liquid-glass';
import RestaurantBrandMark from '../components/Common/RestaurantBrandMark';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
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

const AdminRestaurantProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);

  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfilePayload>(
    buildRestaurantProfilePayloadFromUser(user?.restaurant)
  );
  const [loadingRestaurantProfile, setLoadingRestaurantProfile] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [savingRestaurantProfile, setSavingRestaurantProfile] = useState(false);
  const [uploadingRestaurantLogo, setUploadingRestaurantLogo] = useState(false);

  useEffect(() => {
    setRestaurantProfile(buildRestaurantProfilePayloadFromUser(user?.restaurant));
  }, [user?.restaurant]);

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
    <DashboardLayout title={t('adminDashboard.profileTitle')}>
      <GlassCard>
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

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminRestaurantProfilePage;
