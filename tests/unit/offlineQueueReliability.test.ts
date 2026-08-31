import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderService = vi.hoisted(() => ({
  cancelPendingOrder: vi.fn(),
  confirmPendingOrder: vi.fn(),
  createGuestTableSessionOrder: vi.fn(),
  markOrderServed: vi.fn(),
  updatePendingOrder: vi.fn(),
}));

const offlineStore = vi.hoisted(() => ({
  appendSyncEvent: vi.fn(),
  claimQueuedGuestOrder: vi.fn(),
  claimQueuedWaiterAction: vi.fn(),
  deleteQueuedWaiterAction: vi.fn(),
  deleteQueuedGuestOrder: vi.fn(),
  enqueueWaiterAction: vi.fn(),
  enqueueGuestOrder: vi.fn(),
  listQueuedWaiterActions: vi.fn(),
  listQueuedGuestOrders: vi.fn(),
  updateQueuedWaiterAction: vi.fn(),
  updateQueuedGuestOrder: vi.fn(),
}));

vi.mock('../../src/services/orderService', () => orderService);
vi.mock('../../src/services/offlineStore', () => offlineStore);

import {
  isQueuedRecordClaimable,
  queueGuestOrder,
  replayQueuedWaiterActions,
} from '../../src/services/offlineQueue';

describe('offline queue recovery and multi-tab claiming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recovers an expired syncing lease but leaves an active lease alone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'));
    const base = {
      id: 1,
      type: 'confirm_order' as const,
      createdAt: '2026-08-31T11:50:00.000Z',
      status: 'syncing' as const,
      lastError: null,
      payload: { orderId: 99 },
    };

    expect(isQueuedRecordClaimable({
      ...base,
      syncLeaseExpiresAt: '2026-08-31T11:59:59.000Z',
    })).toBe(true);
    expect(isQueuedRecordClaimable({
      ...base,
      syncLeaseExpiresAt: '2026-08-31T12:00:30.000Z',
    })).toBe(false);
    expect(isQueuedRecordClaimable(base)).toBe(true);
    vi.useRealTimers();
  });

  it('allows two tabs to race while issuing only one waiter mutation', async () => {
    const record = {
      id: 7,
      type: 'confirm_order' as const,
      createdAt: '2026-08-31T11:59:00.000Z',
      status: 'pending' as const,
      lastError: null,
      payload: { orderId: 101 },
    };
    offlineStore.listQueuedWaiterActions.mockResolvedValue([record]);

    let claimed = false;
    offlineStore.claimQueuedWaiterAction.mockImplementation(async () => {
      if (claimed) return null;
      claimed = true;
      return { ...record, status: 'syncing' };
    });
    orderService.confirmPendingOrder.mockResolvedValue({});

    const held = new Set<string>();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: async (name: string, _options: unknown, callback: (lock: object | null) => Promise<unknown>) => {
          if (held.has(name)) return callback(null);
          held.add(name);
          try {
            return await callback({ name });
          } finally {
            held.delete(name);
          }
        },
      },
    });

    await Promise.all([replayQueuedWaiterActions(), replayQueuedWaiterActions()]);

    expect(orderService.confirmPendingOrder).toHaveBeenCalledTimes(1);
    expect(offlineStore.deleteQueuedWaiterAction).toHaveBeenCalledTimes(1);
  });

  it('queues an offline guest order without persisting its bearer credential', async () => {
    offlineStore.enqueueGuestOrder.mockResolvedValue(12);

    await queueGuestOrder({
      sessionId: 55,
      guestAccessToken: 'QA_RUN_SEC-readable-guest-token',
      payload: { items: [{ dish_id: 5, quantity: 1 }] },
      idempotencyKey: 'QA_RUN_REL-offline-key',
    });

    expect(offlineStore.enqueueGuestOrder).toHaveBeenCalledWith(expect.not.objectContaining({
      guestAccessToken: expect.anything(),
    }));
  });
});
