import { useEffect, useRef, useState } from 'react';

export interface NetworkStatusState {
  isOnline: boolean;
  justReconnected: boolean;
}

const RECONNECTED_FLAG_MS = 5000;

export const useNetworkStatus = (): NetworkStatusState => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      clearReconnectTimer();
      reconnectTimeoutRef.current = window.setTimeout(() => {
        setJustReconnected(false);
      }, RECONNECTED_FLAG_MS);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      clearReconnectTimer();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearReconnectTimer();
    };
  }, []);

  return { isOnline, justReconnected };
};
