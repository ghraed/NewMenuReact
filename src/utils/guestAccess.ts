const GUEST_DEVICE_ID_KEY = 'guest_table_device_id';
export const HTTP_ONLY_GUEST_CREDENTIAL = 'http-only-cookie';

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

  const cacheKey = guestCookieCacheKey(guestAccessToken);
  if (cacheKey) headers['X-Guest-Cache-Key'] = cacheKey;
  if (guestAccessToken && !guestAccessToken.startsWith(HTTP_ONLY_GUEST_CREDENTIAL)) {
    headers['X-Guest-Access-Token'] = guestAccessToken;
  }

  return headers;
};


export const guestCredentialFromAccess = (access?: { token?: string | null; cache_key?: string | null }): string | null => {
  if (access?.cache_key && /^[a-f0-9]{64}$/.test(access.cache_key)) return `${HTTP_ONLY_GUEST_CREDENTIAL}:${access.cache_key}`;
  return access?.token || null;
};
export const guestCookieCacheKey = (token?: string | null): string | null => {
  const key = token?.startsWith(`${HTTP_ONLY_GUEST_CREDENTIAL}:`) ? token.slice(HTTP_ONLY_GUEST_CREDENTIAL.length + 1) : null;
  return key && /^[a-f0-9]{64}$/.test(key) ? key : null;
};
