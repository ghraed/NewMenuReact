import type { AuthUserSummary } from '../types';

export interface BrowserIdentity { readonly restaurantId: number; readonly userId: number }
let identity: BrowserIdentity | null = null;
let verifiedToken: string | null = null;
let verifiedStorageKey = 'admin_auth_token';

const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const legacyKeys = ['pos_compensation_ledger_v1', 'pos_compensation_audit_v1', 'bill_item_adjustments_v1', 'printable_invoice_payload'];

// Ownership is unknown. Keep exact bytes separately; never import them into a tenant.
export function quarantineLegacyProtectedStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of [...legacyKeys, ...Object.keys(localStorage).filter((key) => key.startsWith('room-plan-border-points:'))]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const base = `protected_quarantine_v1:${key}`;
      const prior = localStorage.getItem(base);
      const destination = prior === null || prior === raw ? base : `${base}:${crypto.randomUUID()}`;
      localStorage.setItem(destination, raw);
      // Retain the original too: localStorage has no atomic compare-and-delete,
      // and an older tab may write to it concurrently. No current reader uses it.
    } catch {
      // If quota/security prevents a durable copy, leave the original untouched.
      // Protected readers still ignore every legacy/unscoped key.
    }
  }
}

export function setVerifiedBrowserIdentity(user: AuthUserSummary | null, token: string | null, storageKey = 'admin_auth_token'): void {
  if (!token || !validId(user?.id) || !validId(user?.restaurant?.id)) {
    identity = null;
    verifiedToken = null;
    return;
  }
  if (identity?.userId !== user.id || identity.restaurantId !== user.restaurant.id || verifiedToken !== token) {
    identity = Object.freeze({ userId: user.id, restaurantId: user.restaurant.id });
  }
  verifiedToken = token;
  verifiedStorageKey = storageKey;
}

export function getVerifiedBrowserIdentity(): BrowserIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!identity || !verifiedToken || localStorage.getItem(verifiedStorageKey) !== verifiedToken) return null;
    if (verifiedStorageKey === 'admin_auth_session') {
      const expected = JSON.parse(localStorage.getItem('admin_auth_identity') || 'null');
      if (!expected || expected.pending || expected.signedOut || expected.userId !== identity?.userId || expected.restaurantId !== identity.restaurantId) return null;
    }
    return identity;
  } catch {
    return null;
  }
}

export const isCurrentBrowserIdentity = (expected: BrowserIdentity | null | undefined): boolean => (
  !!expected && expected === getVerifiedBrowserIdentity()
);

export function protectedStorageKey(base: string, partition: 'restaurant' | 'account' = 'restaurant'): string | null {
  const current = getVerifiedBrowserIdentity();
  return current ? `protected_v2:restaurant:${current.restaurantId}${partition === 'account' ? `:user:${current.userId}` : ''}:${base}` : null;
}

export function readProtectedJson<T>(base: string, fallback: T, partition: 'restaurant' | 'account' = 'restaurant'): T {
  const key = protectedStorageKey(base, partition);
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeProtectedJson(base: string, value: unknown, partition: 'restaurant' | 'account' = 'restaurant', expected = getVerifiedBrowserIdentity()): void {
  if (!isCurrentBrowserIdentity(expected)) return;
  const key = protectedStorageKey(base, partition);
  if (key) localStorage.setItem(key, JSON.stringify(value));
}

export function waiterActionBelongsToCurrentAccount(owner?: BrowserIdentity): boolean {
  const current = getVerifiedBrowserIdentity();
  return !!owner && !!current && owner.restaurantId === current.restaurantId && owner.userId === current.userId;
}
