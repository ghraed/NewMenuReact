import api from './api';
import type { RestaurantProfile, RestaurantSummary } from '../types';

const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const ALLOWED_LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;
const MAX_LOGO_SIZE_BYTES = 3 * 1024 * 1024;

const getLogoFileExtension = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf('.');

  if (lastDotIndex < 0) {
    return '';
  }

  return normalized.slice(lastDotIndex);
};

const hasAllowedLogoSignature = async (file: File): Promise<boolean> => {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  const isPng = bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4E
    && bytes[3] === 0x47
    && bytes[4] === 0x0D
    && bytes[5] === 0x0A
    && bytes[6] === 0x1A
    && bytes[7] === 0x0A;

  const isJpeg = bytes.length >= 3
    && bytes[0] === 0xFF
    && bytes[1] === 0xD8
    && bytes[2] === 0xFF;

  const isWebp = bytes.length >= 12
    && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF'
    && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP';

  return isPng || isJpeg || isWebp;
};

export const validateRestaurantLogoFile = async (file: File): Promise<string | null> => {
  const extension = getLogoFileExtension(file.name);
  const hasAllowedMime = file.type === ''
    ? true
    : ALLOWED_LOGO_MIME_TYPES.includes(file.type as (typeof ALLOWED_LOGO_MIME_TYPES)[number]);
  const hasAllowedExtension = ALLOWED_LOGO_EXTENSIONS.includes(extension as (typeof ALLOWED_LOGO_EXTENSIONS)[number]);

  if (!hasAllowedMime || !hasAllowedExtension) {
    return 'Only PNG, JPG, JPEG, and WEBP logo files are allowed.';
  }

  if (file.size <= 0) {
    return 'The selected logo file is empty.';
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return 'Logo size must be 3 MB or less.';
  }

  const hasValidSignature = await hasAllowedLogoSignature(file);
  if (!hasValidSignature) {
    return 'The selected file does not match a valid PNG, JPG, or WEBP image signature.';
  }

  return null;
};

export interface RestaurantProfilePayload extends RestaurantProfile {
  name: string;
}

export interface RestaurantProfileResponse {
  message?: string;
  restaurant?: RestaurantSummary;
  profile?: RestaurantProfile;
}

const normalizeProfileFromRestaurant = (restaurant?: RestaurantSummary | null): RestaurantProfilePayload => {
  return {
    name: restaurant?.name?.trim() || '',
    legal_business_name: restaurant?.profile?.legal_business_name ?? null,
    cuisine_specialty: restaurant?.profile?.cuisine_specialty ?? null,
    primary_phone: restaurant?.profile?.primary_phone ?? null,
    whatsapp_phone: restaurant?.profile?.whatsapp_phone ?? null,
    contact_email: restaurant?.profile?.contact_email ?? null,
    website_url: restaurant?.profile?.website_url ?? null,
    address_line_1: restaurant?.profile?.address_line_1 ?? null,
    address_line_2: restaurant?.profile?.address_line_2 ?? null,
    city: restaurant?.profile?.city ?? null,
    state_province: restaurant?.profile?.state_province ?? null,
    postal_code: restaurant?.profile?.postal_code ?? null,
    country: restaurant?.profile?.country ?? null,
    tax_registration_number: restaurant?.profile?.tax_registration_number ?? null,
    vat_registration_number: restaurant?.profile?.vat_registration_number ?? null,
    service_hours: restaurant?.profile?.service_hours ?? null,
    short_description: restaurant?.profile?.short_description ?? null,
  };
};

export const buildRestaurantProfilePayloadFromUser = (
  restaurant?: RestaurantSummary | null
): RestaurantProfilePayload => normalizeProfileFromRestaurant(restaurant);

export const fetchRestaurantProfile = async (): Promise<RestaurantProfileResponse> => {
  const response = await api.get<RestaurantProfileResponse>('/restaurant/profile');
  return response.data;
};

export const updateRestaurantProfile = async (payload: RestaurantProfilePayload): Promise<RestaurantProfileResponse> => {
  const response = await api.patch<RestaurantProfileResponse>('/restaurant/profile', payload);
  return response.data;
};

export const uploadRestaurantLogo = async (file: File): Promise<RestaurantProfileResponse> => {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await api.post<RestaurantProfileResponse>('/restaurant/profile/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const mapResponseToProfilePayload = (
  response: RestaurantProfileResponse,
  fallbackRestaurant?: RestaurantSummary | null
): RestaurantProfilePayload => {
  const restaurant = response.restaurant ?? fallbackRestaurant;
  const normalized = normalizeProfileFromRestaurant(restaurant);
  const profile = response.profile;

  return {
    ...normalized,
    legal_business_name: profile?.legal_business_name ?? normalized.legal_business_name,
    cuisine_specialty: profile?.cuisine_specialty ?? normalized.cuisine_specialty,
    primary_phone: profile?.primary_phone ?? normalized.primary_phone,
    whatsapp_phone: profile?.whatsapp_phone ?? normalized.whatsapp_phone,
    contact_email: profile?.contact_email ?? normalized.contact_email,
    website_url: profile?.website_url ?? normalized.website_url,
    address_line_1: profile?.address_line_1 ?? normalized.address_line_1,
    address_line_2: profile?.address_line_2 ?? normalized.address_line_2,
    city: profile?.city ?? normalized.city,
    state_province: profile?.state_province ?? normalized.state_province,
    postal_code: profile?.postal_code ?? normalized.postal_code,
    country: profile?.country ?? normalized.country,
    tax_registration_number: profile?.tax_registration_number ?? normalized.tax_registration_number,
    vat_registration_number: profile?.vat_registration_number ?? normalized.vat_registration_number,
    service_hours: profile?.service_hours ?? normalized.service_hours,
    short_description: profile?.short_description ?? normalized.short_description,
  };
};
