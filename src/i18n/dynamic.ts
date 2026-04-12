import i18n from './index';

const normalizeKey = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
);

export const translateCategoryLabel = (value?: string | null): string => {
  const fallback = value?.trim();

  if (!fallback) {
    return i18n.t('menuList.menu');
  }

  return i18n.t(`dynamic.categories.${normalizeKey(fallback)}`, {
    defaultValue: fallback,
  });
};

export const translateStatusLabel = (value?: string | null): string => {
  const fallback = value?.trim();

  if (!fallback) {
    return '';
  }

  return i18n.t(`dynamic.status.${normalizeKey(fallback)}`, {
    defaultValue: fallback,
  });
};
