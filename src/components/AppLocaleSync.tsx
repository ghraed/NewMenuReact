import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isRtlLanguage, normalizeLanguage } from '../i18n/language';

const AppLocaleSync = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    const language = normalizeLanguage(i18n.resolvedLanguage);
    const direction = isRtlLanguage(language) ? 'rtl' : 'ltr';

    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
  }, [i18n.resolvedLanguage]);

  return null;
};

export default AppLocaleSync;
