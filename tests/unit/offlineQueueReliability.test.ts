import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderService = vi.hoisted(() => ({
  cancelPendingOrder: vi.fn(),
  confirmPendingOrder: vi.fn(),
  createGuestTableSessionOrder: vi.fn(),
  markOrderServed: vi.fn(),
  updatePendingOrder: vi.fn(),
  updateAndConfirmPendingOrder: vi.fn(),
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
  renewQueuedWaiterActionLease: vi.fn(),
}));

vi.mock('../../src/services/orderService', () => orderService);
vi.mock('../../src/services/offlineStore', () => offlineStore);

import {
  isQueuedRecordClaimable,
  queueGuestOrder,
  replayQueuedWaiterActions,
  queueWaiterAction,
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
      idempotencyKey: 'QA_RUN_REL-waiter-key',
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

  it('renews the database claim while a waiter request runs beyond the original lease', async () => {
    vi.useFakeTimers();
    const record = {
      id: 8,
      type: 'confirm_order' as const,
      createdAt: '2026-08-31T11:59:00.000Z',
      status: 'pending' as const,
      lastError: null,
      idempotencyKey: 'QA_RUN_REL-long-request-key',
      payload: { orderId: 102 },
    };
    offlineStore.listQueuedWaiterActions.mockResolvedValue([record]);
    offlineStore.claimQueuedWaiterAction.mockResolvedValue({ ...record, status: 'syncing' });
    let finish!: () => void;
    orderService.confirmPendingOrder.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));

    const replay = replayQueuedWaiterActions();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(offlineStore.renewQueuedWaiterActionLease).toHaveBeenCalled();
    finish();
    await replay;
    vi.useRealTimers();
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

  it('persists one waiter idempotency key and uses the atomic update-confirm endpoint', async () => {
    offlineStore.enqueueWaiterAction.mockResolvedValue(19);
    await queueWaiterAction({
      type: 'update_and_confirm_order',
      orderId: 44,
      updatePayload: { items: [{ dish_id: 8, quantity: 2 }] },
    });
    expect(offlineStore.enqueueWaiterAction).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: expect.any(String),
    }));

    const record = {
      id: 19,
      type: 'update_and_confirm_order' as const,
      createdAt: new Date().toISOString(),
      status: 'pending' as const,
      lastError: null,
      idempotencyKey: 'QA_RUN_REL-atomic-key',
      payload: { orderId: 44, updatePayload: { items: [{ dish_id: 8, quantity: 2 }] } },
    };
    offlineStore.listQueuedWaiterActions.mockResolvedValue([record]);
    offlineStore.claimQueuedWaiterAction.mockResolvedValue({ ...record, status: 'syncing' });
    orderService.updateAndConfirmPendingOrder.mockResolvedValue({});
    await replayQueuedWaiterActions();

    expect(orderService.updateAndConfirmPendingOrder).toHaveBeenCalledWith(
      44,
      record.payload.updatePayload,
      'QA_RUN_REL-atomic-key'
    );
    expect(orderService.updatePendingOrder).not.toHaveBeenCalled();
    expect(orderService.confirmPendingOrder).not.toHaveBeenCalled();
  });
});
