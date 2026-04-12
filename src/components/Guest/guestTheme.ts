import type { CSSProperties } from 'react';
import type { GuestThemeMode } from '../../hooks/useGuestTheme';

const lightThemeVars = {
  '--guest-bg': '#F6F2EB',
  '--guest-panel': '#FFFFFF',
  '--guest-panel-solid': '#FFFFFF',
  '--guest-panel-strong': '#FCFAF5',
  '--guest-text': '#1A1A1A',
  '--guest-muted': '#6E6255',
  '--guest-accent': '#B89A5E',
  '--guest-accent-button-text': '#1A1A1A',
  '--guest-accent-soft': 'rgba(184,154,94,0.12)',
  '--guest-border': 'rgba(0,0,0,0.08)',
  '--guest-border-soft': 'rgba(0,0,0,0.05)',
  '--guest-shadow': '0 20px 50px rgba(0,0,0,0.08)',
  '--guest-shadow-soft': '0 12px 30px rgba(0,0,0,0.05)',
} as CSSProperties;

const darkThemeVars = {
  '--guest-bg': '#0B0B0C',
  '--guest-panel': 'rgba(255,255,255,0.045)',
  '--guest-panel-solid': '#121214',
  '--guest-panel-strong': 'rgba(255,255,255,0.07)',
  '--guest-text': '#F8F5EF',
  '--guest-muted': '#B8AC96',
  '--guest-accent': '#D4AF37',
  '--guest-accent-button-text': '#FFFFFF',
  '--guest-accent-soft': 'rgba(212,175,55,0.15)',
  '--guest-border': 'rgba(255,255,255,0.10)',
  '--guest-border-soft': 'rgba(255,255,255,0.06)',
  '--guest-shadow': '0 25px 60px rgba(0,0,0,0.5)',
  '--guest-shadow-soft': '0 18px 40px rgba(0,0,0,0.35)',
} as CSSProperties;

const lightAppVars = {
  '--color-bg0': '246 242 235',
  '--color-bg1': '252 250 245',
  '--color-gold': '184 154 94',
  '--color-gold2': '184 154 94',
  '--color-sage': '123 163 141',
  '--color-spicy': '184 96 82',
  '--color-panel': '26 26 26',
  '--color-text': '26 26 26',
} as CSSProperties;

const darkAppVars = {
  '--color-bg0': '11 11 12',
  '--color-bg1': '18 18 20',
  '--color-gold': '212 175 55',
  '--color-gold2': '212 175 55',
  '--color-sage': '143 214 180',
  '--color-spicy': '214 99 89',
  '--color-panel': '255 255 255',
  '--color-text': '248 245 239',
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
    backgroundImage: theme === 'dark'
      ? [
        'radial-gradient(circle at 85% 12%, rgba(255,255,255,0.05), transparent 18%)',
        'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(11,11,12,0) 32%)',
      ].join(', ')
      : [
        'radial-gradient(circle at 90% 8%, rgba(255,255,255,0.95), transparent 16%)',
        'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(246,242,235,0) 30%)',
      ].join(', '),
  };
};
