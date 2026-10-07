import { getVerifiedBrowserIdentity, isCurrentBrowserIdentity, waiterActionBelongsToCurrentAccount } from './protectedBrowserStorage';
import {
  cancelPendingOrder,
  confirmPendingOrder,
  createGuestTableSessionOrder,
  markOrderServed,
  updatePendingOrder,
} from './orderService';
import {
  appendSyncEvent,
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
} from './offlineStore';
import type { CreateGuestOrderRequest, UpdatePendingOrderRequest } from '../types';

const OFFLINE_QUEUE_UPDATED_EVENT = 'offline-queue-updated';

export interface QueueReplayResult {
  synced: number;
  failed: number;
  needsReview: number;
}

interface GuestOrderSyncResult {
  synced: boolean;
  error?: string;
  needsReview?: boolean;
}

const guestOrderSyncs = new Map<number, Promise<GuestOrderSyncResult>>();

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

export const queueGuestOrder = async (input: {
  sessionId: number;
  guestAccessToken: string;
  payload: CreateGuestOrderRequest;
  idempotencyKey?: string;
}): Promise<number> => {
  const queueId = await enqueueGuestOrder({
    sessionId: input.sessionId,
    guestAccessToken: input.guestAccessToken,
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
  const queued = await listQueuedGuestOrders();
  const replayable = queued.filter(isReplayableGuestOrder);

  const summary: QueueReplayResult = {
    synced: 0,
    failed: 0,
    needsReview: 0,
  };

  if (replayable.length === 0) {
    return summary;
  }

  await appendSyncEvent({
    type: 'sync_start',
    createdAt: new Date().toISOString(),
    message: `Sync started for ${replayable.length} queued guest orders`,
  });

  for (const item of replayable) {
    if (!item.id) {
      continue;
    }

    const result = await syncQueuedGuestOrder(item.id);
    if (result.synced) {
      summary.synced += 1;
      await appendSyncEvent({
        type: 'sync_success',
        createdAt: new Date().toISOString(),
        message: `Synced queued order for session ${item.sessionId}`,
      });
    } else {
      if (result.needsReview) {
        summary.needsReview += 1;
      } else {
        summary.failed += 1;
      }

      await appendSyncEvent({
        type: 'sync_failed',
        createdAt: new Date().toISOString(),
        message: `Failed syncing order for session ${item.sessionId}: ${result.error}`,
      });
    }
  }

  emitOfflineQueueUpdated();
  return summary;
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

export const syncQueuedGuestOrder = (id: number): Promise<GuestOrderSyncResult> => {
  const existing = guestOrderSyncs.get(id);
  if (existing) {
    return existing;
  }

  const sync = (async () => {
    // A lock is released when its tab closes, so another tab can safely recover
    // the persisted syncing record without overlapping a live attempt.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(`menu-react-guest-order-${id}`, () => syncGuestOrder(id));
    }

    return syncGuestOrder(id);
  })().finally(() => {
    guestOrderSyncs.delete(id);
  });

  guestOrderSyncs.set(id, sync);
  return sync;
};

const syncGuestOrder = async (id: number): Promise<GuestOrderSyncResult> => {
  const queued = await listQueuedGuestOrders();
  const item = queued.find((row) => row.id === id);
  if (!item || !item.id) {
    return { synced: false, error: 'Queued order not found' };
  }
  if (!isReplayableGuestOrder(item)) {
    return { synced: false, error: 'Queued order is not replayable' };
  }

  await updateQueuedGuestOrder(item.id, { status: 'syncing', lastError: null });
  try {
    await createGuestTableSessionOrder(item.sessionId, item.payload, item.guestAccessToken, item.idempotencyKey);
    await deleteQueuedGuestOrder(item.id);
    emitOfflineQueueUpdated();
    return { synced: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    const status = typeof error === 'object' && error !== null && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;
    const needsReview = Boolean(status && [401, 403, 404, 409, 423].includes(status));
    await updateQueuedGuestOrder(item.id, { status: needsReview ? 'needs_review' : 'failed', lastError: errorMessage });
    emitOfflineQueueUpdated();
    return { synced: false, error: errorMessage, ...(needsReview ? { needsReview: true } : {}) };
  }
};

export const isReplayableGuestOrder = (item: GuestOrderQueueRecord): boolean => {
  // Persisted syncing records can survive a reload after their request was
  // interrupted. Replay keeps the original key to recover a server-side success.
  if (item.status !== 'pending' && item.status !== 'failed' && item.status !== 'syncing') {
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
  return queued.filter((item) => item.status === 'pending' || item.status === 'failed').length;
};

const replaySingleWaiterAction = async (item: WaiterActionQueueRecord): Promise<void> => {
  if (!waiterActionBelongsToCurrentAccount(item.owner)) throw new Error('The queued action belongs to a different or unresolved account.');
  const identity = getVerifiedBrowserIdentity();
  const replayToken = localStorage.getItem('admin_auth_token')!;
  const { orderId, updatePayload } = item.payload;
  switch (item.type) {
    case 'confirm_order':
      await confirmPendingOrder(orderId, replayToken);
      return;
    case 'cancel_order':
      await cancelPendingOrder(orderId, replayToken);
      return;
    case 'mark_served':
      await markOrderServed(orderId, replayToken);
      return;
    case 'update_order':
      if (!updatePayload) throw new Error('Missing update payload');
      await updatePendingOrder(orderId, updatePayload, replayToken);
      return;
    case 'update_and_confirm_order':
      if (!updatePayload) throw new Error('Missing update payload');
      await updatePendingOrder(orderId, updatePayload, replayToken);
      if (!isCurrentBrowserIdentity(identity)) throw new Error('The authenticated account changed during replay.');
      await confirmPendingOrder(orderId, replayToken);
      return;
    default:
      throw new Error('Unsupported waiter queue action');
  }
};

export const replayQueuedWaiterActions = async (): Promise<QueueReplayResult> => {
  const queued = await listQueuedWaiterActions();
  const replayable = queued.filter((item) => item.status === 'pending' || item.status === 'failed');
  const summary: QueueReplayResult = { synced: 0, failed: 0, needsReview: 0 };

  for (const item of replayable) {
    if (!item.id) continue;
    await updateQueuedWaiterAction(item.id, { status: 'syncing', lastError: null });
    try {
      await replaySingleWaiterAction(item);
      await deleteQueuedWaiterAction(item.id);
      summary.synced += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      await updateQueuedWaiterAction(item.id, { status: 'failed', lastError: errorMessage });
      summary.failed += 1;
    }
  }

  emitOfflineQueueUpdated();
  return summary;
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

  await updateQueuedWaiterAction(item.id, { status: 'syncing', lastError: null });
  try {
    await replaySingleWaiterAction(item);
    await deleteQueuedWaiterAction(item.id);
    emitOfflineQueueUpdated();
    return { synced: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    await updateQueuedWaiterAction(item.id, { status: 'failed', lastError: errorMessage });
    emitOfflineQueueUpdated();
    return { synced: false, error: errorMessage };
  }
};
