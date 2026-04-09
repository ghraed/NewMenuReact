import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getApiOrigin } from './api';

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

let echoInstance: Echo<'pusher'> | null = null;

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getEcho = (): Echo<'pusher'> | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = import.meta.env.VITE_PUSHER_APP_KEY;

  if (!key) {
    return null;
  }

  if (echoInstance) {
    return echoInstance;
  }

  const apiOrigin = getApiOrigin();
  const authToken = localStorage.getItem('admin_auth_token');
  const wsHost = import.meta.env.VITE_PUSHER_HOST || undefined;
  const wsPort = toNumber(import.meta.env.VITE_PUSHER_PORT, 443);
  const forceTls = (import.meta.env.VITE_PUSHER_SCHEME || 'https') === 'https';

  window.Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: 'pusher',
    key,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: forceTls,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${apiOrigin}/api/broadcasting/auth`,
    auth: {
      headers: authToken ? {
        Authorization: `Bearer ${authToken}`,
      } : {},
    },
  });

  return echoInstance;
};

export const resetEcho = (): void => {
  if (!echoInstance) {
    return;
  }

  echoInstance.disconnect();
  echoInstance = null;
};
