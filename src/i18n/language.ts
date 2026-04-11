export const LANGUAGE_STORAGE_KEY = 'menu_locale';
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const isSupportedLanguage = (value: string): value is AppLanguage => (
  SUPPORTED_LANGUAGES.includes(value as AppLanguage)
);

export const normalizeLanguage = (value?: string | null): AppLanguage => {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }

  const normalized = value.toLowerCase().split('-')[0];
  return isSupportedLanguage(normalized) ? normalized : DEFAULT_LANGUAGE;
};

export const getStoredLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
};

export const persistLanguage = (language: AppLanguage): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
};

export const isRtlLanguage = (language: string): boolean => normalizeLanguage(language) === 'ar';
