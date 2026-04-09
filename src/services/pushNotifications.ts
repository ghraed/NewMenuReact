import api from './api';

export type WebPushPermission = NotificationPermission | 'unsupported';

export interface StaffPushState {
  supported: boolean;
  permission: WebPushPermission;
  subscribed: boolean;
}

interface PushConfigResponse {
  supported: boolean;
  public_key: string | null;
  service_worker_url: string;
}

const SERVICE_WORKER_URL = '/sw.js';

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

  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
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

  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission,
      subscribed: false,
    };
  }

  const registration = await registerPushServiceWorker();
  const existingSubscription = await registration?.pushManager.getSubscription();

  return {
    supported: true,
    permission,
    subscribed: Boolean(existingSubscription),
  };
};

export const enableStaffPushNotifications = async (): Promise<StaffPushState> => {
  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
    };
  }

  const permission = await window.Notification.requestPermission();

  if (permission !== 'granted') {
    return {
      supported: true,
      permission,
      subscribed: false,
    };
  }

  const config = await fetchPushConfig();

  if (!config.supported || !config.public_key) {
    throw new Error('Web push is not configured on the server yet.');
  }

  const registration = await registerPushServiceWorker();

  if (!registration) {
    throw new Error('Service worker registration is not available in this browser.');
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(config.public_key),
    });
  }

  await syncSubscriptionWithBackend(subscription);

  return {
    supported: true,
    permission,
    subscribed: true,
  };
};

export const refreshStaffPushSubscription = async (): Promise<StaffPushState> => {
  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
    };
  }

  const permission = getWebPushPermission();
  const registration = await registerPushServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();

  if (permission === 'granted' && subscription) {
    await syncSubscriptionWithBackend(subscription);
  }

  return {
    supported: true,
    permission,
    subscribed: Boolean(subscription),
  };
};
