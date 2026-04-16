const GUEST_DEVICE_ID_KEY = 'guest_table_device_id';

const generateDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getGuestDeviceId = (): string => {
  if (typeof window === 'undefined') {
    return 'server-render';
  }

  const existing = window.localStorage.getItem(GUEST_DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const nextId = generateDeviceId();
  window.localStorage.setItem(GUEST_DEVICE_ID_KEY, nextId);
  return nextId;
};

export const buildGuestAccessHeaders = (guestAccessToken?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-Guest-Device-Id': getGuestDeviceId(),
  };

  if (guestAccessToken) {
    headers['X-Guest-Access-Token'] = guestAccessToken;
  }

  return headers;
};
