import React from 'react';
import type { ReactNode } from 'react';
import { useGuestTheme } from '../../hooks/useGuestTheme';
import { getGuestThemeStyle } from './guestTheme';
import GuestCartShortcut from './GuestCartShortcut';

interface GuestPageShellProps {
  children: ReactNode;
}

const GuestPageShell: React.FC<GuestPageShellProps> = ({ children }) => {
  const { theme } = useGuestTheme();

  return (
    <div
      className="relative min-h-screen overflow-hidden font-sans transition-colors duration-500"
      style={getGuestThemeStyle(theme)}
    >
      <div className="relative z-10">{children}</div>
      <GuestCartShortcut />
    </div>
  );
};

export default GuestPageShell;
