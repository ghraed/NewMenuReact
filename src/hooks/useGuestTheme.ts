import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type GuestThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'guest_menu_theme';

const readStoredTheme = (): GuestThemeMode => {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
};

interface AppThemeContextValue {
  theme: GuestThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<GuestThemeMode>>;
  toggleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => {
      setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
    },
  }), [theme]);

  return React.createElement(AppThemeContext.Provider, { value }, children);
};

export const useAppTheme = () => {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return context;
};

export const useGuestTheme = useAppTheme;
