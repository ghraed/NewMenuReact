import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GuestThemeMode } from '../../hooks/useGuestTheme';

interface ThemeToggleProps {
  theme: GuestThemeMode;
  onToggle: () => void;
}

const iconClassName = 'h-4 w-4';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.75v2.5M12 18.75v2.5M4.75 12h-2.5M21.75 12h-2.5M5.88 5.88 4.1 4.1M19.9 19.9l-1.78-1.78M18.12 5.88 19.9 4.1M4.1 19.9l1.78-1.78" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName} aria-hidden="true">
    <path d="M20.3 14.1A8.7 8.7 0 1 1 9.9 3.7a7.1 7.1 0 0 0 10.4 10.4Z" />
  </svg>
);

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const { t } = useTranslation();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isLight ? t('theme.switchToDark') : t('theme.switchToLight')}
      className="fixed top-4 z-[2147483646] isolate pointer-events-auto inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border text-[var(--guest-text)] backdrop-blur-xl transition duration-300 ease-fluid print:hidden sm:top-6"
      style={{
        right: '1rem',
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow-soft)',
        touchAction: 'manipulation',
      }}
    >
      <span className="inline-flex items-center justify-center rounded-full bg-[var(--guest-accent-soft)] p-2 text-[var(--guest-accent)] transition-transform duration-300">
        {isLight ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
};

export default ThemeToggle;
