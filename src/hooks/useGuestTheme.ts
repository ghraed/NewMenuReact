import { useEffect, useState } from 'react';

export type GuestThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'guest_menu_theme';

const readStoredTheme = (): GuestThemeMode => {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
};

export const useGuestTheme = () => {
  const [theme, setTheme] = useState<GuestThemeMode>(readStoredTheme);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const previousColorScheme = root.style.colorScheme;
    root.style.colorScheme = theme;

    return () => {
      root.style.colorScheme = previousColorScheme;
    };
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme: () => {
      setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
    },
  };
};

