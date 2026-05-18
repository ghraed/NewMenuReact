import { createGuestTableSessionOrder } from './orderService';
import {
  appendSyncEvent,
  deleteQueuedGuestOrder,
  enqueueGuestOrder,
  listQueuedGuestOrders,
  type GuestOrderQueueRecord,
  updateQueuedGuestOrder,
} from './offlineStore';
import type { CreateGuestOrderRequest } from '../types';

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
