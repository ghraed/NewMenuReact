import React from 'react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useGuestTheme } from '../../hooks/useGuestTheme';
import { getGuestThemeStyle } from './guestTheme';
import GuestCartShortcut from './GuestCartShortcut';
import GuestWaveButton from './GuestWaveButton';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOrderCart } from '../../contexts/useOrderCart';
import { heartbeatGuestTableSession } from '../../services/orderService';
import {
  getPendingQueueCount,
  getQueuedGuestOrders,
  onOfflineQueueUpdated,
  syncQueuedGuestOrder,
} from '../../services/offlineQueue';

interface GuestPageShellProps {
  children: ReactNode;
}

const HEARTBEAT_INTERVAL_MS = 60_000;

const GuestPageShell: React.FC<GuestPageShellProps> = ({ children }) => {
  const { theme } = useGuestTheme();
  const { isOnline, justReconnected } = useNetworkStatus();
  const { draft } = useOrderCart();
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

    setSyncing(true);
    void getQueuedGuestOrders()
      .then(async (queued) => {
        const replayable = queued.filter((item) =>
          Boolean(item.id)
          && (item.status === 'pending' || item.status === 'failed')
          && Array.isArray(item.payload?.items)
          && item.payload.items.some((row) => Number(row.dish_id) > 0 && Number(row.quantity) > 0)
        );

        if (replayable.length === 0) {
          return;
        }

        let synced = 0;
        let failed = 0;
        for (const item of replayable) {
          if (!item.id) continue;
          const approved = window.confirm(`Sync queued guest order #${item.id} now?`);
          if (!approved) {
            continue;
          }
          const result = await syncQueuedGuestOrder(item.id);
          if (result.synced) {
            synced += 1;
          } else {
            failed += 1;
          }
        }

        if (synced + failed > 0) {
          window.alert(`Guest sync complete: ${synced} synced, ${failed} failed. Please check with waiter if anything is unclear.`);
        }
      })
      .finally(() => {
        setSyncing(false);
      });
  }, [justReconnected, pendingCount, syncing]);

  useEffect(() => {
    if (!isOnline || !draft.guestAccessVerified || !draft.guestAccessToken || !draft.tableSessionId) {
      return;
    }

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (cancelled || typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        await heartbeatGuestTableSession(draft.tableSessionId!, draft.guestAccessToken);
      } catch {
        // Presence refresh is best-effort and should not interrupt the guest experience.
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draft.guestAccessToken, draft.guestAccessVerified, draft.tableSessionId, isOnline]);

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
      <GuestCartShortcut />
      <GuestWaveButton />
    </div>
  );
};

export default GuestPageShell;
