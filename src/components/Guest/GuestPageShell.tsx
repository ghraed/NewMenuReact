import React from 'react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useGuestTheme } from '../../hooks/useGuestTheme';
import { getGuestThemeStyle } from './guestTheme';
import GuestWaveButton from './GuestWaveButton';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import {
  getPendingQueueCount,
  onOfflineQueueUpdated,
  replayQueuedGuestOrders,
} from '../../services/offlineQueue';

interface GuestPageShellProps {
  children: ReactNode;
}

const GuestPageShell: React.FC<GuestPageShellProps> = ({ children }) => {
  const { theme } = useGuestTheme();
  const { isOnline, justReconnected } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refreshPendingCount = () => {
      void getPendingQueueCount().then((count) => setPendingCount(count));
    };

    refreshPendingCount();
    const unsubscribe = onOfflineQueueUpdated(refreshPendingCount);

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!justReconnected || pendingCount === 0 || syncing) {
      return;
    }

    const approved = window.confirm(
      'Internet is back. Sync pending guest orders now?'
    );

    if (!approved) {
      return;
    }

    setSyncing(true);
    void replayQueuedGuestOrders()
      .then((result) => {
        window.alert(
          `Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.needsReview} need review. Please check with waiter if anything is unclear.`
        );
      })
      .finally(() => {
        setSyncing(false);
      });
  }, [justReconnected, pendingCount, syncing]);

  return (
    <div
      data-guest-theme={theme}
      className="relative min-h-screen font-sans transition-colors duration-500"
      style={{
        ...getGuestThemeStyle(theme),
        colorScheme: theme,
      }}
    >
      {!isOnline ? (
        <div className="sticky top-0 z-30 px-4 pt-3">
          <div
            className="mx-auto max-w-5xl rounded-2xl border px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: 'var(--guest-panel-strong)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
            }}
          >
            You are offline. New orders will be queued and synced when internet is back.
          </div>
        </div>
      ) : null}
      <div className="relative z-10">{children}</div>
      <GuestWaveButton />
    </div>
  );
};

export default GuestPageShell;
