import type { CreateGuestOrderRequest } from '../types';

export interface GuestOrderSubmissionAttempt {
  fingerprint: string;
  idempotencyKey: string;
}

const STORAGE_PREFIX = 'menu-react:guest-order-attempt:';

const storageKey = (sessionId: number): string => `${STORAGE_PREFIX}${sessionId}`;

export const loadGuestOrderSubmissionAttempt = (sessionId: number): GuestOrderSubmissionAttempt | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<GuestOrderSubmissionAttempt>;
    return typeof value.fingerprint === 'string' && typeof value.idempotencyKey === 'string'
      ? value as GuestOrderSubmissionAttempt
      : null;
  } catch {
    return null;
  }
};

export const persistGuestOrderSubmissionAttempt = (
  sessionId: number,
  attempt: GuestOrderSubmissionAttempt
): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(sessionId), JSON.stringify(attempt));
};

export const clearGuestOrderSubmissionAttempt = (sessionId: number): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(sessionId));
};

const submissionFingerprint = (sessionId: number, payload: CreateGuestOrderRequest): string => {
  const normalized = JSON.stringify({
    sessionId,
    notes: payload.notes?.trim() || null,
    items: payload.items
      .map((item) => ({ dish_id: Number(item.dish_id), quantity: Number(item.quantity) }))
      .sort((left, right) => left.dish_id - right.dish_id || left.quantity - right.quantity),
  });
  // Persist only a deterministic fingerprint, not guest notes/cart contents.
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
};

export const resolveGuestOrderSubmissionAttempt = (
  current: GuestOrderSubmissionAttempt | null,
  sessionId: number,
  payload: CreateGuestOrderRequest,
  createKey: () => string
): GuestOrderSubmissionAttempt => {
  const fingerprint = submissionFingerprint(sessionId, payload);
  if (current?.fingerprint === fingerprint) return current;

  return {
    fingerprint,
    idempotencyKey: createKey(),
  };
};
