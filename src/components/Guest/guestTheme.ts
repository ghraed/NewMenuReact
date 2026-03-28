import type { CSSProperties } from 'react';
import type { GuestThemeMode } from '../../hooks/useGuestTheme';

const lightThemeVars = {
  '--guest-bg': '#F6F2EB',
  '--guest-panel': '#FFFFFF',
  '--guest-panel-strong': '#FCFAF5',
  '--guest-text': '#1A1A1A',
  '--guest-muted': '#6E6255',
  '--guest-accent': '#B89A5E',
  '--guest-accent-soft': 'rgba(184,154,94,0.12)',
  '--guest-border': 'rgba(0,0,0,0.08)',
  '--guest-border-soft': 'rgba(0,0,0,0.05)',
  '--guest-shadow': '0 20px 50px rgba(0,0,0,0.08)',
  '--guest-shadow-soft': '0 12px 30px rgba(0,0,0,0.05)',
} as CSSProperties;

const darkThemeVars = {
  '--guest-bg': '#0B0B0C',
  '--guest-panel': 'rgba(255,255,255,0.045)',
  '--guest-panel-strong': 'rgba(255,255,255,0.07)',
  '--guest-text': '#F8F5EF',
  '--guest-muted': '#B8AC96',
  '--guest-accent': '#D4AF37',
  '--guest-accent-soft': 'rgba(212,175,55,0.15)',
  '--guest-border': 'rgba(255,255,255,0.10)',
  '--guest-border-soft': 'rgba(255,255,255,0.06)',
  '--guest-shadow': '0 25px 60px rgba(0,0,0,0.5)',
  '--guest-shadow-soft': '0 18px 40px rgba(0,0,0,0.35)',
} as CSSProperties;

export const getGuestThemeStyle = (theme: GuestThemeMode): CSSProperties => {
  const baseVars = theme === 'dark' ? darkThemeVars : lightThemeVars;

  return {
    ...baseVars,
    backgroundColor: 'var(--guest-bg)',
    color: 'var(--guest-text)',
    backgroundImage: theme === 'dark'
      ? [
        'radial-gradient(circle at top left, rgba(212,175,55,0.12), transparent 28%)',
        'radial-gradient(circle at 85% 12%, rgba(255,255,255,0.05), transparent 18%)',
        'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(11,11,12,0) 32%)',
      ].join(', ')
      : [
        'radial-gradient(circle at top left, rgba(184,154,94,0.18), transparent 26%)',
        'radial-gradient(circle at 90% 8%, rgba(255,255,255,0.95), transparent 16%)',
        'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(246,242,235,0) 30%)',
      ].join(', '),
  };
};

