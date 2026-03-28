import React from 'react';
import type { ReactNode } from 'react';
import { useGuestTheme } from '../../hooks/useGuestTheme';
import ThemeToggle from './ThemeToggle';
import { getGuestThemeStyle } from './guestTheme';

interface GuestPageShellProps {
  children: ReactNode;
}

const GuestPageShell: React.FC<GuestPageShellProps> = ({ children }) => {
  const { theme, toggleTheme } = useGuestTheme();

  return (
    <div
      className="relative min-h-screen overflow-hidden font-sans transition-colors duration-500"
      style={getGuestThemeStyle(theme)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-[-10%] top-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'var(--guest-accent-soft)' }}
        />
        <div
          className="absolute bottom-0 right-[-8%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'var(--guest-accent-soft)' }}
        />
      </div>

      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GuestPageShell;

