import i18n from '../i18n';

const configuredGuestRestaurantSlug = import.meta.env.VITE_GUEST_RESTAURANT_SLUG || 'pizza-palace';
const fallbackGuestRestaurantSlug = 'admin-restaurant';

export const getGuestRestaurantCandidateSlugs = (preferredSlug?: string): string[] => {
  if (preferredSlug) {
    return [preferredSlug];
  }

  return Array.from(new Set([
    configuredGuestRestaurantSlug,
    fallbackGuestRestaurantSlug,
  ]));
};

export const getPreferredGuestRestaurantSlug = (): string => configuredGuestRestaurantSlug;

export const formatRestaurantLabel = (value?: string): string => (
  value?.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || i18n.t('menuList.menu')
);
