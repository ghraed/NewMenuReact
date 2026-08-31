import {
  cancelPendingOrder,
  confirmPendingOrder,
  createGuestTableSessionOrder,
  markOrderServed,
  updatePendingOrder,
  updateAndConfirmPendingOrder,
} from './orderService';
import {
  appendSyncEvent,
  claimQueuedGuestOrder,
  claimQueuedWaiterAction,
  deleteQueuedWaiterAction,
  deleteQueuedGuestOrder,
  enqueueWaiterAction,
  enqueueGuestOrder,
  listQueuedWaiterActions,
  listQueuedGuestOrders,
  type GuestOrderQueueRecord,
  type WaiterActionQueueRecord,
  type WaiterQueueActionType,
  updateQueuedWaiterAction,
  updateQueuedGuestOrder,
  renewQueuedWaiterActionLease,
} from './offlineStore';
import type { CreateGuestOrderRequest, UpdatePendingOrderRequest } from '../types';
import { clearGuestOrderSubmissionAttempt, loadGuestOrderSubmissionAttempt } from './guestOrderSubmission';

const OFFLINE_QUEUE_UPDATED_EVENT = 'offline-queue-updated';
const SYNC_LEASE_DURATION_MS = 60_000;

export interface QueueReplayResult {
  synced: number;
  failed: number;
  needsReview: number;
}

export const emitOfflineQueueUpdated = (): void => {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
};

export const onOfflineQueueUpdated = (handler: () => void): (() => void) => {
  const listener = () => handler();
  window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, listener);
};

export const createIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const REPLAY_OWNER = createIdempotencyKey();

const clearConfirmedGuestAttempt = (sessionId: number, idempotencyKey: string): void => {
  if (loadGuestOrderSubmissionAttempt(sessionId)?.idempotencyKey === idempotencyKey) {
    clearGuestOrderSubmissionAttempt(sessionId);
  }
};

const withWaiterLeaseHeartbeat = async <T>(item: WaiterActionQueueRecord, action: () => Promise<T>): Promise<T> => {
  if (!item.id) return action();
  const timer = window.setInterval(() => {
    void renewQueuedWaiterActionLease(item.id!, REPLAY_OWNER, new Date(), SYNC_LEASE_DURATION_MS);
  }, Math.floor(SYNC_LEASE_DURATION_MS / 3));
  try {
    return await action();
  } finally {
    window.clearInterval(timer);
  }
};

export const queueGuestOrder = async (input: {
  sessionId: number;
  guestAccessToken: string;
  payload: CreateGuestOrderRequest;
  idempotencyKey?: string;
}): Promise<number> => {
  const queueId = await enqueueGuestOrder({
    sessionId: input.sessionId,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    idempotencyKey: input.idempotencyKey || createIdempotencyKey(),
  });

  emitOfflineQueueUpdated();
  return queueId;
};

export const getPendingQueueCount = async (): Promise<number> => {
  const queued = await listQueuedGuestOrders();
  return queued.filter(isReplayableGuestOrder).length;
};

export const replayQueuedGuestOrders = async (): Promise<QueueReplayResult> => {
  return withReplayLock('menu-react:guest-order-replay', async () => {
    const queued = await listQueuedGuestOrders();
    const replayable = queued.filter(isReplayableGuestOrder);
    const summary: QueueReplayResult = {
      synced: 0,
      failed: 0,
      needsReview: 0,
    };

    if (replayable.length === 0) return summary;

    await appendSyncEvent({
      type: 'sync_start',
      createdAt: new Date().toISOString(),
      message: `Sync started for ${replayable.length} queued guest orders`,
    });

    for (const candidate of replayable) {
      if (!candidate.id) continue;
      const item = await claimQueuedGuestOrder(
        candidate.id,
        REPLAY_OWNER,
        new Date(),
        SYNC_LEASE_DURATION_MS
      );
      if (!item) continue;

      try {
        await createGuestTableSessionOrder(item.sessionId, item.payload, undefined, item.idempotencyKey);
        clearConfirmedGuestAttempt(item.sessionId, item.idempotencyKey);
        await deleteQueuedGuestOrder(item.id!);
        summary.synced += 1;
        await appendSyncEvent({
          type: 'sync_success',
          createdAt: new Date().toISOString(),
          message: `Synced queued order for session ${item.sessionId}`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed';
        const status = typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
        const needsReview = Boolean(status && [401, 403, 404, 409, 423].includes(status));

        await updateQueuedGuestOrder(item.id!, {
          status: needsReview ? 'needs_review' : 'failed',
          lastError: errorMessage,
          syncLeaseOwner: null,
          syncLeaseExpiresAt: null,
        });
        if (needsReview) summary.needsReview += 1;
        else summary.failed += 1;
        await appendSyncEvent({
          type: 'sync_failed',
          createdAt: new Date().toISOString(),
          message: `Failed syncing order for session ${item.sessionId}: ${errorMessage}`,
        });
      }
    }

    emitOfflineQueueUpdated();
    return summary;
  }, {
    synced: 0,
    failed: 0,
    needsReview: 0,
  });
};

export const getQueuedGuestOrders = async (): Promise<GuestOrderQueueRecord[]> => {
  return listQueuedGuestOrders();
};

export const removeQueuedGuestOrder = async (id: number): Promise<void> => {
  await deleteQueuedGuestOrder(id);
  emitOfflineQueueUpdated();
};

export const editQueuedGuestOrder = async (
  id: number,
  payload: CreateGuestOrderRequest
): Promise<void> => {
  await updateQueuedGuestOrder(id, { payload });
  emitOfflineQueueUpdated();
};

export const syncQueuedGuestOrder = async (id: number): Promise<{ synced: boolean; error?: string }> => {
  const queued = await listQueuedGuestOrders();
  const item = queued.find((row) => row.id === id);
  if (!item || !item.id) {
    return { synced: false, error: 'Queued order not found' };
  }
  if (!isReplayableGuestOrder(item)) {
    return { synced: false, error: 'Queued order is not replayable' };
  }

  const claimed = await claimQueuedGuestOrder(item.id, REPLAY_OWNER, new Date(), SYNC_LEASE_DURATION_MS);
  if (!claimed) return { synced: false, error: 'Queued order is already being synced' };
  try {
    await createGuestTableSessionOrder(claimed.sessionId, claimed.payload, undefined, claimed.idempotencyKey);
    clearConfirmedGuestAttempt(claimed.sessionId, claimed.idempotencyKey);
    await deleteQueuedGuestOrder(claimed.id!);
    emitOfflineQueueUpdated();
    return { synced: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    await updateQueuedGuestOrder(claimed.id!, {
      status: 'failed',
      lastError: errorMessage,
      syncLeaseOwner: null,
      syncLeaseExpiresAt: null,
    });
    emitOfflineQueueUpdated();
    return { synced: false, error: errorMessage };
  }
};

const isReplayableGuestOrder = (item: GuestOrderQueueRecord): boolean => {
  if (!isQueuedRecordClaimable(item)) {
    return false;
  }

  if (!item.payload || !Array.isArray(item.payload.items) || item.payload.items.length === 0) {
    return false;
  }

  return item.payload.items.some((row) => {
    const dishId = Number((row as { dish_id?: number }).dish_id);
    const quantity = Number((row as { quantity?: number }).quantity);
    return Number.isFinite(dishId) && dishId > 0 && Number.isFinite(quantity) && quantity > 0;
  });
};

export const queueWaiterAction = async (input: {
  type: WaiterQueueActionType;
  orderId: number;
  updatePayload?: UpdatePendingOrderRequest;
}): Promise<number> => {
  const queueId = await enqueueWaiterAction({
    type: input.type,
    createdAt: new Date().toISOString(),
    idempotencyKey: createIdempotencyKey(),
    payload: {
      orderId: input.orderId,
      updatePayload: input.updatePayload,
    },
  });
  emitOfflineQueueUpdated();
  return queueId;
};

export const getPendingWaiterQueueCount = async (): Promise<number> => {
  const queued = await listQueuedWaiterActions();
  return queued.filter(isQueuedRecordClaimable).length;
};

const replaySingleWaiterAction = async (item: WaiterActionQueueRecord): Promise<void> => {
  const { orderId, updatePayload } = item.payload;
  switch (item.type) {
    case 'confirm_order':
      await confirmPendingOrder(orderId, item.idempotencyKey);
      return;
    case 'cancel_order':
      await cancelPendingOrder(orderId, item.idempotencyKey);
      return;
    case 'mark_served':
      await markOrderServed(orderId, item.idempotencyKey);
      return;
    case 'update_order':
      if (!updatePayload) throw new Error('Missing update payload');
      await updatePendingOrder(orderId, updatePayload, item.idempotencyKey);
      return;
    case 'update_and_confirm_order':
      if (!updatePayload) throw new Error('Missing update payload');
      await updateAndConfirmPendingOrder(orderId, updatePayload, item.idempotencyKey);
      return;
    default:
      throw new Error('Unsupported waiter queue action');
  }
};

export const replayQueuedWaiterActions = async (): Promise<QueueReplayResult> => {
  return withReplayLock('menu-react:waiter-action-replay', async () => {
    const queued = await listQueuedWaiterActions();
    const replayable = queued.filter(isQueuedRecordClaimable);
    const summary: QueueReplayResult = { synced: 0, failed: 0, needsReview: 0 };

    for (const candidate of replayable) {
      if (!candidate.id) continue;
      const item = await claimQueuedWaiterAction(
        candidate.id,
        REPLAY_OWNER,
        new Date(),
        SYNC_LEASE_DURATION_MS
      );
      if (!item) continue;
      try {
        await withWaiterLeaseHeartbeat(item, () => replaySingleWaiterAction(item));
        await deleteQueuedWaiterAction(item.id!);
        summary.synced += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed';
        await updateQueuedWaiterAction(item.id!, {
          status: 'failed',
          lastError: errorMessage,
          syncLeaseOwner: null,
          syncLeaseExpiresAt: null,
        });
        summary.failed += 1;
      }
    }

    emitOfflineQueueUpdated();
    return summary;
  }, { synced: 0, failed: 0, needsReview: 0 });
};

export const getQueuedWaiterActions = async (): Promise<WaiterActionQueueRecord[]> => {
  return listQueuedWaiterActions();
};

export const removeQueuedWaiterAction = async (id: number): Promise<void> => {
  await deleteQueuedWaiterAction(id);
  emitOfflineQueueUpdated();
};

export const syncQueuedWaiterAction = async (id: number): Promise<{ synced: boolean; error?: string }> => {
  const queued = await listQueuedWaiterActions();
  const item = queued.find((row) => row.id === id);
  if (!item || !item.id) {
    return { synced: false, error: 'Queued waiter action not found' };
  }

  const claimed = await claimQueuedWaiterAction(item.id, REPLAY_OWNER, new Date(), SYNC_LEASE_DURATION_MS);
  if (!claimed) return { synced: false, error: 'Queued waiter action is already being synced' };
  try {
    await withWaiterLeaseHeartbeat(claimed, () => replaySingleWaiterAction(claimed));
    await deleteQueuedWaiterAction(claimed.id!);
    emitOfflineQueueUpdated();
    return { synced: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    await updateQueuedWaiterAction(claimed.id!, {
      status: 'failed',
      lastError: errorMessage,
      syncLeaseOwner: null,
      syncLeaseExpiresAt: null,
    });
    emitOfflineQueueUpdated();
    return { synced: false, error: errorMessage };
  }
};

export const isQueuedRecordClaimable = (item: GuestOrderQueueRecord | WaiterActionQueueRecord): boolean => {
  if (item.status === 'pending' || item.status === 'failed') return true;
  if (item.status !== 'syncing') return false;

  const leaseExpiresAt = item.syncLeaseExpiresAt ? Date.parse(item.syncLeaseExpiresAt) : Number.NaN;
  if (Number.isFinite(leaseExpiresAt)) return leaseExpiresAt <= Date.now();

  const createdAt = Date.parse(item.createdAt);
  return Number.isFinite(createdAt) && createdAt <= Date.now() - SYNC_LEASE_DURATION_MS;
};

const withReplayLock = async <T>(name: string, action: () => Promise<T>, unavailable: T): Promise<T> => {
  const lockManager = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!lockManager) return action();

  return lockManager.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => (
    lock ? action() : unavailable
  ));
};
