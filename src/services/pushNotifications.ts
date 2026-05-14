import api from './api';

export type WebPushPermission = NotificationPermission | 'unsupported';
export type PushSetupIssueCode =
  | 'iphone_home_screen_required'
  | 'insecure_context'
  | 'server_not_configured'
  | 'service_worker_script_unavailable'
  | 'service_worker_registration_failed'
  | 'subscription_create_failed'
  | 'subscription_sync_failed';

export interface StaffPushState {
  supported: boolean;
  permission: WebPushPermission;
  subscribed: boolean;
  isIosLike: boolean;
  isStandalone: boolean;
  requiresHomeScreenInstall: boolean;
}

interface PushConfigResponse {
  supported: boolean;
  public_key: string | null;
  service_worker_url: string;
}

const SERVICE_WORKER_URL = '/sw.js';
const SERVICE_WORKER_READY_TIMEOUT_MS = 10000;

export class PushSetupError extends Error {
  code: PushSetupIssueCode;

  constructor(code: PushSetupIssueCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PushSetupError';
  }
}

const toUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(normalized);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

export const isWebPushSupported = (): boolean => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
);

export const isIosLikeDevice = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const { userAgent, platform, maxTouchPoints } = window.navigator;

  return /iPhone|iPad|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
};

export const isStandaloneApp = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const iosStandalone = 'standalone' in window.navigator
    && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;

  return iosStandalone || displayModeStandalone;
};

export const requiresHomeScreenInstallForPush = (): boolean => (
  isIosLikeDevice() && !isStandaloneApp()
);

export const getWebPushPermission = (): WebPushPermission => {
  if (!isWebPushSupported()) {
    return 'unsupported';
  }

  return window.Notification.permission;
};

const ensureSecurePushContext = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.isSecureContext) {
    throw new PushSetupError(
      'insecure_context',
      'Push notifications require HTTPS or a secure installed app context.'
    );
  }
};

const ensureServiceWorkerScriptIsReachable = async (): Promise<void> => {
  const response = await fetch(SERVICE_WORKER_URL, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new PushSetupError(
      'service_worker_script_unavailable',
      `The browser could not load ${SERVICE_WORKER_URL} from this site.`
    );
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('javascript') && !contentType.includes('text/plain')) {
    const snippet = (await response.text()).slice(0, 120).toLowerCase();

    if (snippet.includes('<!doctype html') || snippet.includes('<html')) {
      throw new PushSetupError(
        'service_worker_script_unavailable',
        `${SERVICE_WORKER_URL} is not being served as a service worker script.`
      );
    }
  }
};

export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isWebPushSupported()) {
    return null;
  }

  ensureSecurePushContext();
  await ensureServiceWorkerScriptIsReachable();

  const existingRegistration = await navigator.serviceWorker.getRegistration();

  if (existingRegistration) {
    return existingRegistration;
  }

  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
  } catch (error) {
    console.warn('[Push] Service worker registration failed.', error);
    throw new PushSetupError(
      'service_worker_registration_failed',
      'The app could not register its background notification service.'
    );
  }
};

const waitForReadyPushRegistration = async (
  fallbackRegistration: ServiceWorkerRegistration
): Promise<ServiceWorkerRegistration> => {
  if (fallbackRegistration.active) {
    return fallbackRegistration;
  }

  try {
    const readyRegistration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error('Timed out while waiting for service worker readiness.'));
        }, SERVICE_WORKER_READY_TIMEOUT_MS);
      }),
    ]);

    return readyRegistration;
  } catch {
    return fallbackRegistration;
  }
};

const decodeApplicationServerKey = (publicKey: string): Uint8Array<ArrayBuffer> => {
  try {
    return toUint8Array(publicKey);
  } catch (error) {
    console.warn('[Push] Invalid VAPID public key from server.', error);
    throw new PushSetupError(
      'server_not_configured',
      'The server provided an invalid web push public key.'
    );
  }
};

const createPushSubscription = async (
  registration: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array<ArrayBuffer>
): Promise<PushSubscription> => {
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (firstError) {
    console.warn('[Push] First subscribe attempt failed. Retrying after SW update.', firstError);

    try {
      await registration.update();
    } catch (updateError) {
      console.warn('[Push] Service worker update before retry failed.', updateError);
    }

    const readyRegistration = await waitForReadyPushRegistration(registration);
    const staleSubscription = await readyRegistration.pushManager.getSubscription();

    if (staleSubscription) {
      try {
        await staleSubscription.unsubscribe();
      } catch (unsubscribeError) {
        console.warn('[Push] Failed to remove stale subscription before retry.', unsubscribeError);
      }
    }

    return readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }
};

const fetchPushConfig = async (): Promise<PushConfigResponse> => {
  const response = await api.get<PushConfigResponse>('/push/config');
  return response.data;
};

const syncSubscriptionWithBackend = async (subscription: PushSubscription): Promise<void> => {
  await api.post('/push/subscriptions', {
    subscription: subscription.toJSON(),
  });
};

export const getStaffPushState = async (): Promise<StaffPushState> => {
  const permission = getWebPushPermission();
  const isIosLike = isIosLikeDevice();
  const isStandalone = isStandaloneApp();
  const requiresHomeScreenInstall = requiresHomeScreenInstallForPush();

  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission,
      subscribed: false,
      isIosLike,
      isStandalone,
      requiresHomeScreenInstall,
    };
  }

  if (requiresHomeScreenInstall) {
    return {
      supported: true,
      permission,
      subscribed: false,
      isIosLike,
      isStandalone,
      requiresHomeScreenInstall,
    };
  }

  const registration = await registerPushServiceWorker();
  const existingSubscription = await registration?.pushManager.getSubscription();

  return {
    supported: true,
    permission,
    subscribed: Boolean(existingSubscription),
    isIosLike,
    isStandalone,
    requiresHomeScreenInstall,
  };
};

export const enableStaffPushNotifications = async (): Promise<StaffPushState> => {
  const isIosLike = isIosLikeDevice();
  const isStandalone = isStandaloneApp();
  const requiresHomeScreenInstall = requiresHomeScreenInstallForPush();

  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      isIosLike,
      isStandalone,
      requiresHomeScreenInstall,
    };
  }

  if (requiresHomeScreenInstall) {
    throw new PushSetupError(
      'iphone_home_screen_required',
      'On iPhone, add this app to your Home Screen first, then open the installed app to enable push notifications.'
    );
  }

  ensureSecurePushContext();

  const permission = await window.Notification.requestPermission();

  if (permission !== 'granted') {
    return {
      supported: true,
      permission,
      subscribed: false,
      isIosLike,
      isStandalone,
      requiresHomeScreenInstall,
    };
  }

  const config = await fetchPushConfig();

  if (!config.supported || !config.public_key) {
    throw new PushSetupError(
      'server_not_configured',
      'The server is not configured for web push yet.'
    );
  }

  const registration = await registerPushServiceWorker();

  if (!registration) {
    throw new PushSetupError(
      'service_worker_registration_failed',
      'The app could not register its background notification service.'
    );
  }

  const applicationServerKey = decodeApplicationServerKey(config.public_key);
  const readyRegistration = await waitForReadyPushRegistration(registration);
  let subscription = await readyRegistration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await createPushSubscription(readyRegistration, applicationServerKey);
    } catch (error) {
      console.warn('[Push] Push subscription creation failed.', error);
      throw new PushSetupError(
        'subscription_create_failed',
        'The browser could not create a push subscription for this device.'
      );
    }
  }

  try {
    await syncSubscriptionWithBackend(subscription);
  } catch (error) {
    console.warn('[Push] Push subscription sync failed.', error);
    throw new PushSetupError(
      'subscription_sync_failed',
      'The server rejected the push subscription for this device.'
    );
  }

  return {
    supported: true,
    permission,
    subscribed: true,
    isIosLike,
    isStandalone,
    requiresHomeScreenInstall,
  };
};

export const refreshStaffPushSubscription = async (): Promise<StaffPushState> => {
  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      isIosLike: isIosLikeDevice(),
      isStandalone: isStandaloneApp(),
      requiresHomeScreenInstall: requiresHomeScreenInstallForPush(),
    };
  }

  const permission = getWebPushPermission();
  const isIosLike = isIosLikeDevice();
  const isStandalone = isStandaloneApp();
  const requiresHomeScreenInstall = requiresHomeScreenInstallForPush();

  if (requiresHomeScreenInstall) {
    return {
      supported: true,
      permission,
      subscribed: false,
      isIosLike,
      isStandalone,
      requiresHomeScreenInstall,
    };
  }

  const registration = await registerPushServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();

  if (permission === 'granted' && subscription) {
    await syncSubscriptionWithBackend(subscription);
  }

  return {
    supported: true,
    permission,
    subscribed: Boolean(subscription),
    isIosLike,
    isStandalone,
    requiresHomeScreenInstall,
  };
};
