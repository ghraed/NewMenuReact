import React from 'react';
import type { ReactNode } from 'react';
import { useGuestTheme } from '../../hooks/useGuestTheme';
import { getGuestThemeStyle } from './guestTheme';
import GuestWaveButton from './GuestWaveButton';

interface GuestPageShellProps {
  children: ReactNode;
}

const GuestPageShell: React.FC<GuestPageShellProps> = ({ children }) => {
  const { theme } = useGuestTheme();

  return (
    <div
      data-guest-theme={theme}
      className="relative min-h-screen font-sans transition-colors duration-500"
      style={{
        ...getGuestThemeStyle(theme),
        colorScheme: theme,
      }}
    >
      <div className="relative z-10">{children}</div>
      <GuestWaveButton />
    </div>
  );
};

export default GuestPageShell;
