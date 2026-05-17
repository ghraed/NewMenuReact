import type { CSSProperties } from 'react';
import type { GuestThemeMode } from '../../hooks/useGuestTheme';

const lightThemeVars = {
  '--guest-bg': '#F6F2EB',
  '--guest-panel': '#ffffff',
  '--guest-panel-solid': '#ffffff',
  '--guest-panel-strong': '#FCFAF5',
  '--guest-text': '#1A1A1A',
  '--guest-muted': '#6E6255',
  '--guest-accent': '#B89A5E',
  '--guest-accent-button-text': '#1A1A1A',
  '--guest-accent-soft': 'rgba(184,154,94,0.12)',
  '--guest-border': 'rgba(0,0,0,0.08)',
  '--guest-border-soft': 'rgba(0,0,0,0.05)',
  '--guest-shadow': '0 8px 28px rgba(0,0,0,0.12)',
  '--guest-shadow-soft': '0 3px 8px rgba(0,0,0,0.08)',
} as CSSProperties;

const darkThemeVars = {
  '--guest-bg': '#0B0B0C',
  '--guest-panel': '#211f26',
  '--guest-panel-solid': '#211f26',
  '--guest-panel-strong': '#2b2930',
  '--guest-text': '#F8F5EF',
  '--guest-muted': '#B8AC96',
  '--guest-accent': '#D4AF37',
  '--guest-accent-button-text': '#1A1A1A',
  '--guest-accent-soft': 'rgba(212,175,55,0.16)',
  '--guest-border': 'rgba(230,224,233,0.14)',
  '--guest-border-soft': 'rgba(230,224,233,0.08)',
  '--guest-shadow': '0 8px 26px rgba(0,0,0,0.45)',
  '--guest-shadow-soft': '0 3px 8px rgba(0,0,0,0.32)',
} as CSSProperties;

const lightAppVars = {
  '--color-bg0': '246 242 235',
  '--color-bg1': '255 255 255',
  '--color-modal-surface': '255 255 255',
  '--color-modal-row': '252 250 245',
  '--color-modal-stroke': '29 27 32',
  '--color-gold': '184 154 94',
  '--color-gold2': '184 154 94',
  '--color-sage': '75 140 104',
  '--color-spicy': '179 38 30',
  '--color-panel': '29 27 32',
  '--color-text': '29 27 32',
} as CSSProperties;

const darkAppVars = {
  '--color-bg0': '20 18 24',
  '--color-bg1': '33 31 38',
  '--color-modal-surface': '33 31 38',
  '--color-modal-row': '44 41 51',
  '--color-modal-stroke': '230 224 233',
  '--color-gold': '215 180 106',
  '--color-gold2': '243 215 154',
  '--color-sage': '147 215 171',
  '--color-spicy': '242 184 181',
  '--color-panel': '230 224 233',
  '--color-text': '230 224 233',
} as CSSProperties;

const getGuestThemeVars = (theme: GuestThemeMode): CSSProperties => (
  theme === 'dark' ? darkThemeVars : lightThemeVars
);

export const getAppThemeStyle = (theme: GuestThemeMode): CSSProperties => ({
  ...(theme === 'dark' ? darkAppVars : lightAppVars),
  ...getGuestThemeVars(theme),
});

export const getGuestThemeStyle = (theme: GuestThemeMode): CSSProperties => {
  const baseVars = getGuestThemeVars(theme);

  return {
    ...baseVars,
    backgroundColor: 'var(--guest-bg)',
    color: 'var(--guest-text)',
    backgroundImage: 'none',
  };
};
