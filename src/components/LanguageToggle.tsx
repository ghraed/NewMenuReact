import React from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LANGUAGE, type AppLanguage, normalizeLanguage } from '../i18n/language';

const toggleLanguages: AppLanguage[] = ['en', 'ar'];

const LanguageToggle: React.FC = () => {
  const { i18n, t } = useTranslation();
  const activeLanguage = normalizeLanguage(i18n.resolvedLanguage || DEFAULT_LANGUAGE);

  return (
    <div
      className="fixed top-4 z-[80] isolate pointer-events-auto inline-flex items-center gap-1 rounded-full border p-1 text-[var(--guest-text)] backdrop-blur-xl transition duration-300 ease-fluid print:hidden sm:top-6"
      style={{
        insetInlineStart: '1rem',
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow-soft)',
      }}
    >
      {toggleLanguages.map((language) => {
        const isActive = activeLanguage === language;

        return (
          <button
            key={language}
            type="button"
            onClick={() => void i18n.changeLanguage(language)}
            aria-pressed={isActive}
            aria-label={`${t('common.language')}: ${language.toUpperCase()}`}
            className="rounded-full px-3 py-2 text-xs font-semibold tracking-[0.18em] transition sm:px-4"
            style={{
              backgroundColor: isActive ? 'var(--guest-accent-soft)' : 'transparent',
              color: isActive ? 'var(--guest-accent)' : 'var(--guest-muted)',
            }}
          >
            {language.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageToggle;
