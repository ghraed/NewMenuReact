// Non-secret cross-tab revision/identity signals. Credentials live in HttpOnly
// cookies, never in these keys. A verified API response still gates protected reads.
export const AUTH_SESSION_STORAGE_KEY = 'admin_auth_session';
export const AUTH_IDENTITY_STORAGE_KEY = 'admin_auth_identity';
export const HTTP_ONLY_AUTH_SESSION = 'http-only-cookie';
export const newAuthSessionRevision = (): string => crypto.randomUUID();
export const readAuthSessionIdentity = (): { userId: number; restaurantId: number } | null => {
  try {
    const value = JSON.parse(localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY) || 'null');
    return value && Number.isSafeInteger(value.userId) && value.userId > 0
      && Number.isSafeInteger(value.restaurantId) && value.restaurantId > 0 ? value : null;
  } catch { return null; }
};
