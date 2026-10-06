import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuestOrderQueueRecord } from '../../src/services/offlineStore';

const mocks = vi.hoisted(() => ({
  records: [] as GuestOrderQueueRecord[],
  createOrder: vi.fn(),
  appendSyncEvent: vi.fn(),
}));

vi.mock('../../src/services/orderService', () => ({
  createGuestTableSessionOrder: mocks.createOrder,
  cancelPendingOrder: vi.fn(),
  confirmPendingOrder: vi.fn(),
  markOrderServed: vi.fn(),
  updatePendingOrder: vi.fn(),
}));

vi.mock('../../src/services/offlineStore', () => ({
  appendSyncEvent: mocks.appendSyncEvent,
  listQueuedGuestOrders: vi.fn(async () => structuredClone(mocks.records)),
  updateQueuedGuestOrder: vi.fn(async (id: number, patch: Partial<GuestOrderQueueRecord>) => {
    mocks.records = mocks.records.map((record) => record.id === id ? { ...record, ...patch } : record);
  }),
  deleteQueuedGuestOrder: vi.fn(async (id: number) => {
    mocks.records = mocks.records.filter((record) => record.id !== id);
  }),
  enqueueGuestOrder: vi.fn(),
  deleteQueuedWaiterAction: vi.fn(),
  enqueueWaiterAction: vi.fn(),
  listQueuedWaiterActions: vi.fn(),
  updateQueuedWaiterAction: vi.fn(),
}));

import {
  getPendingQueueCount,
  replayQueuedGuestOrders,
  syncQueuedGuestOrder,
} from '../../src/services/offlineQueue';

const interruptedOrder = (): GuestOrderQueueRecord => ({
  id: 1,
  sessionId: 501,
  guestAccessToken: 'QA_RUN_20261006_test_guest',
  payload: { items: [{ dish_id: 101, quantity: 2 }], notes: 'QA_RUN_20261006_interrupted' },
  createdAt: '2026-10-06T12:00:00.000Z',
  idempotencyKey: 'QA_RUN_20261006_original_request',
  status: 'syncing',
  lastError: null,
});

describe('interrupted offline guest orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records = [interruptedOrder()];
    mocks.createOrder.mockResolvedValue({ order: { id: 901 } });
    mocks.appendSyncEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts a persisted in-flight order after a reload as pending', async () => {
    expect(await getPendingQueueCount()).toBe(1);
  });

  it('automatically replays an interrupted order with its original idempotency key', async () => {
    const record = interruptedOrder();
    expect(await replayQueuedGuestOrders()).toEqual({ synced: 1, failed: 0, needsReview: 0 });
    expect(mocks.createOrder).toHaveBeenCalledWith(record.sessionId, record.payload, record.guestAccessToken, record.idempotencyKey);
    expect(mocks.records).toEqual([]);
  });

  it('allows manual recovery of an interrupted order', async () => {
    expect(await syncQueuedGuestOrder(1)).toEqual({ synced: true });
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.records).toEqual([]);
  });

  it('shares an active attempt between simultaneous replay and manual sync', async () => {
    mocks.records[0].status = 'pending';
    let finishRequest!: (value: { order: { id: number } }) => void;
    mocks.createOrder.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    const replay = replayQueuedGuestOrders();
    await vi.waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(1));
    const manual = syncQueuedGuestOrder(1);
    await Promise.resolve();
    finishRequest({ order: { id: 901 } });
    await expect(manual).resolves.toEqual({ synced: true });
    await expect(replay).resolves.toEqual({ synced: 1, failed: 0, needsReview: 0 });
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });

  it('retains the order and idempotency key after a retryable network error', async () => {
    mocks.createOrder.mockRejectedValueOnce(new Error('QA_RUN network interrupted'));
    expect(await syncQueuedGuestOrder(1)).toEqual({ synced: false, error: 'QA_RUN network interrupted' });
    expect(mocks.records[0]).toMatchObject({ status: 'failed', idempotencyKey: 'QA_RUN_20261006_original_request' });
    expect(await syncQueuedGuestOrder(1)).toEqual({ synced: true });
    expect(mocks.createOrder.mock.calls[0][3]).toBe(mocks.createOrder.mock.calls[1][3]);
  });

  it('serializes attempts from separate tabs with the same browser lock', async () => {
    let lastLock: Promise<unknown> = Promise.resolve();
    const requestLock = vi.fn((_name: string, action: () => Promise<unknown>) => {
      const next = lastLock.then(action);
      lastLock = next.catch(() => undefined);
      return next;
    });
    vi.stubGlobal('navigator', { locks: { request: requestLock } });
    let finishRequest!: (value: { order: { id: number } }) => void;
    mocks.createOrder.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    const firstTab = syncQueuedGuestOrder(1);
    await vi.waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(1));
    vi.resetModules();
    const secondTabModule = await import('../../src/services/offlineQueue');
    const secondTab = secondTabModule.syncQueuedGuestOrder(1);
    await vi.waitFor(() => expect(requestLock).toHaveBeenCalledTimes(2));
    finishRequest({ order: { id: 901 } });
    await expect(firstTab).resolves.toEqual({ synced: true });
    await expect(secondTab).resolves.toEqual({ synced: false, error: 'Queued order not found' });
    expect(requestLock.mock.calls.map(([name]) => name)).toEqual(['menu-react-guest-order-1', 'menu-react-guest-order-1']);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });

  it('keeps expired-session failures out of automatic replay', async () => {
    mocks.createOrder.mockRejectedValueOnce(Object.assign(new Error('QA_RUN session expired'), { response: { status: 403 } }));
    expect(await replayQueuedGuestOrders()).toEqual({ synced: 0, failed: 0, needsReview: 1 });
    expect(mocks.records[0].status).toBe('needs_review');
    expect(await getPendingQueueCount()).toBe(0);
    expect(await replayQueuedGuestOrders()).toEqual({ synced: 0, failed: 0, needsReview: 0 });
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });

  it('does not replay review-required, completed, or empty orders', async () => {
    mocks.records = [
      { ...interruptedOrder(), status: 'needs_review' },
      { ...interruptedOrder(), id: 2, status: 'synced' },
      { ...interruptedOrder(), id: 3, payload: { items: [] } },
    ];
    expect(await getPendingQueueCount()).toBe(0);
    expect(await replayQueuedGuestOrders()).toEqual({ synced: 0, failed: 0, needsReview: 0 });
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});
