import type { CreateGuestOrderRequest } from '../types';

export interface GuestOrderSubmissionAttempt {
  fingerprint: string;
  idempotencyKey: string;
}

const submissionFingerprint = (sessionId: number, payload: CreateGuestOrderRequest): string => JSON.stringify({
  sessionId,
  notes: payload.notes?.trim() || null,
  items: payload.items
    .map((item) => ({ dish_id: Number(item.dish_id), quantity: Number(item.quantity) }))
    .sort((left, right) => left.dish_id - right.dish_id || left.quantity - right.quantity),
});

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
