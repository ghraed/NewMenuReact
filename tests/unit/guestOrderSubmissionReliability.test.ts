import { describe, expect, it, vi } from 'vitest';
import { resolveGuestOrderSubmissionAttempt } from '../../src/services/guestOrderSubmission';

describe('guest order submission idempotency', () => {
  const payload = {
    notes: 'QA_RUN_REL no onions',
    items: [{ dish_id: 7, quantity: 2 }],
  };

  it('keeps one key across double-click, timeout, dropped response, and identical retry', () => {
    const createKey = vi.fn()
      .mockReturnValueOnce('QA_RUN_REL-key-one')
      .mockReturnValueOnce('QA_RUN_REL-key-two');

    const first = resolveGuestOrderSubmissionAttempt(null, 42, payload, createKey);
    const rapidSecondClick = resolveGuestOrderSubmissionAttempt(first, 42, payload, createKey);
    const retryAfterTimeout = resolveGuestOrderSubmissionAttempt(first, 42, payload, createKey);
    const retryAfterDroppedResponse = resolveGuestOrderSubmissionAttempt(first, 42, payload, createKey);

    expect(rapidSecondClick.idempotencyKey).toBe(first.idempotencyKey);
    expect(retryAfterTimeout.idempotencyKey).toBe(first.idempotencyKey);
    expect(retryAfterDroppedResponse.idempotencyKey).toBe(first.idempotencyKey);
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('creates a new key only when the logical request changes', () => {
    const createKey = vi.fn()
      .mockReturnValueOnce('QA_RUN_REL-key-one')
      .mockReturnValueOnce('QA_RUN_REL-key-two');
    const first = resolveGuestOrderSubmissionAttempt(null, 42, payload, createKey);
    const changed = resolveGuestOrderSubmissionAttempt(first, 42, {
      ...payload,
      items: [{ dish_id: 7, quantity: 3 }],
    }, createKey);

    expect(changed.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(createKey).toHaveBeenCalledTimes(2);
  });
});
