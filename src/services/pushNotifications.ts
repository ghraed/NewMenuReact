import api from './api';

export type WebPushPermission = NotificationPermission | 'unsupported';
export type PushSetupIssueCode =
  | 'iphone_home_screen_required'
  | 'server_not_configured'
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

  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
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

export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isWebPushSupported()) {
    return null;
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/');

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

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(config.public_key),
      });
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
  const registration = await registerPushServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  const isIosLike = isIosLikeDevice();
  const isStandalone = isStandaloneApp();
  const requiresHomeScreenInstall = requiresHomeScreenInstallForPush();

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
