import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getApiOrigin } from './api';

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

let echoInstance: Echo<'pusher'> | null = null;
let hasBoundDebugEvents = false;

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const logRealtime = (message: string, details?: Record<string, unknown>): void => {
  if (details) {
    console.info(`[Realtime] ${message}`, details);
    return;
  }

  console.info(`[Realtime] ${message}`);
};

export const getEcho = (): Echo<'pusher'> | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = import.meta.env.VITE_PUSHER_APP_KEY;

  if (!key) {
    console.warn('[Realtime] Missing VITE_PUSHER_APP_KEY. Echo will not start.');
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
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1';

  window.Pusher = Pusher;

  logRealtime('Initializing Echo', {
    apiOrigin,
    key,
    cluster,
    wsHost: wsHost || 'default',
    wsPort,
    forceTls,
    hasAuthToken: Boolean(authToken),
  });

  echoInstance = new Echo({
    broadcaster: 'pusher',
    key,
    cluster,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: forceTls,
    disableStats: true,
    authEndpoint: `${apiOrigin}/api/broadcasting/auth`,
    auth: {
      headers: authToken ? {
        Authorization: `Bearer ${authToken}`,
      } : {},
    },
  });

  const pusherConnection = (echoInstance.connector as { pusher?: Pusher }).pusher?.connection;

  if (pusherConnection && !hasBoundDebugEvents) {
    hasBoundDebugEvents = true;

    pusherConnection.bind('state_change', (states: { previous: string; current: string }) => {
      logRealtime('Connection state changed', states);
    });

    pusherConnection.bind('connected', () => {
      logRealtime('Connected to Pusher successfully');
    });

    pusherConnection.bind('error', (error: unknown) => {
      console.error('[Realtime] Pusher connection error', error);
    });

    pusherConnection.bind('disconnected', () => {
      console.warn('[Realtime] Pusher disconnected');
    });
  }

  return echoInstance;
};

export const ensureEchoConnection = (): void => {
  if (!echoInstance) {
    return;
  }

  const pusher = (echoInstance.connector as { pusher?: Pusher }).pusher;
  const state = pusher?.connection.state;

  if (!pusher || state === 'connected' || state === 'connecting') {
    return;
  }

  logRealtime('Attempting to reconnect Echo transport', { state });
  pusher.connect();
};

export const resetEcho = (): void => {
  if (!echoInstance) {
    return;
  }

  echoInstance.disconnect();
  echoInstance = null;
  hasBoundDebugEvents = false;
};
