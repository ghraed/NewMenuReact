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
  return queued.filter((item) => item.status === 'pending' || item.status === 'failed').length;
};

export const replayQueuedGuestOrders = async (): Promise<QueueReplayResult> => {
  const queued = await listQueuedGuestOrders();
  const replayable = queued.filter((item) => item.status === 'pending' || item.status === 'failed');

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

    await updateQueuedGuestOrder(item.id, { status: 'syncing', lastError: null });

    try {
      await createGuestTableSessionOrder(item.sessionId, item.payload, item.guestAccessToken, item.idempotencyKey);
      await deleteQueuedGuestOrder(item.id);
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

      await updateQueuedGuestOrder(item.id, {
        status: needsReview ? 'needs_review' : 'failed',
        lastError: errorMessage,
      });

      if (needsReview) {
        summary.needsReview += 1;
      } else {
        summary.failed += 1;
      }

      await appendSyncEvent({
        type: 'sync_failed',
        createdAt: new Date().toISOString(),
        message: `Failed syncing order for session ${item.sessionId}: ${errorMessage}`,
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

export const syncQueuedGuestOrder = async (id: number): Promise<{ synced: boolean; error?: string }> => {
  const queued = await listQueuedGuestOrders();
  const item = queued.find((row) => row.id === id);
  if (!item || !item.id) {
    return { synced: false, error: 'Queued order not found' };
  }

  await updateQueuedGuestOrder(item.id, { status: 'syncing', lastError: null });
  try {
    await createGuestTableSessionOrder(item.sessionId, item.payload, item.guestAccessToken, item.idempotencyKey);
    await deleteQueuedGuestOrder(item.id);
    emitOfflineQueueUpdated();
    return { synced: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    await updateQueuedGuestOrder(item.id, { status: 'failed', lastError: errorMessage });
    emitOfflineQueueUpdated();
    return { synced: false, error: errorMessage };
  }
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
  const { orderId, updatePayload } = item.payload;
  switch (item.type) {
    case 'confirm_order':
      await confirmPendingOrder(orderId);
      return;
    case 'cancel_order':
      await cancelPendingOrder(orderId);
      return;
    case 'mark_served':
      await markOrderServed(orderId);
      return;
    case 'update_order':
      if (!updatePayload) throw new Error('Missing update payload');
      await updatePendingOrder(orderId, updatePayload);
      return;
    case 'update_and_confirm_order':
      if (!updatePayload) throw new Error('Missing update payload');
      await updatePendingOrder(orderId, updatePayload);
      await confirmPendingOrder(orderId);
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
