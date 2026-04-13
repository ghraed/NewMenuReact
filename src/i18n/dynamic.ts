import i18n from './index';
import { findMenuCategory } from './categories';

const normalizeKey = (value?: string | null): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
);

export const translateCategoryLabel = (value?: string | null, arabicValue?: string | null): string => {
  const fallback = value?.trim();
  const directArabic = arabicValue?.trim();

  if (!fallback) {
    return i18n.t('menuList.menu');
  }

  if (i18n.resolvedLanguage === 'ar' && directArabic) {
    return directArabic;
  }

  const globalCategory = findMenuCategory(fallback);
  if (globalCategory) {
    return i18n.resolvedLanguage === 'ar' ? globalCategory.arabic : globalCategory.value;
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
