import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, getStoredLanguage, persistLanguage } from './language';
import { resources } from './resources';

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getStoredLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (language) => {
  persistLanguage(language === 'ar' ? 'ar' : 'en');
});

export default i18n;
