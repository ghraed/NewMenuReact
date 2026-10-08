import type {
  CreateGuestOrderRequest,
  GuestAccessSummary,
  GuestProtectedActions,
  GuestTableSummary,
  OfflineQueueItemStatus,
  RestaurantSummary,
  TableSessionSummary,
  Dish,
  GuestDishIndexEntry,
  GuestDishesMeta,
  UpdatePendingOrderRequest,
} from '../types';
import { getVerifiedBrowserIdentity, waiterActionBelongsToCurrentAccount, type BrowserIdentity } from './protectedBrowserStorage';

const DB_NAME = 'menu-react-offline';
const DB_VERSION = 4;
const MENU_CACHE_STORE = 'guest_menu_cache';
const ORDER_QUEUE_STORE = 'guest_order_queue';
const WAITER_QUEUE_STORE = 'waiter_action_queue';
const SYNC_EVENTS_STORE = 'sync_events_log';

export interface GuestMenuCacheRecord {
  key: string;
  tableId: number;
  language: string;
  updatedAt: number;
  payload: {
    restaurant: RestaurantSummary;
    dishes?: Dish[];
    dishes_page?: Dish[];
    dish_index?: GuestDishIndexEntry[];
    dishes_meta?: GuestDishesMeta;
    table: GuestTableSummary | null;
    table_session: TableSessionSummary | null;
    guest_access: GuestAccessSummary | null;
    protected_actions: GuestProtectedActions | null;
  };
}

export interface GuestOrderQueueRecord {
  /** Opaque cookie cache scope only; never a bearer credential. */
  guestAccessToken?: string;
  id?: number;
  sessionId: number;
  payload: CreateGuestOrderRequest;
  createdAt: string;
  idempotencyKey: string;
  status: OfflineQueueItemStatus;
  lastError: string | null;
  syncLeaseOwner?: string | null;
  syncLeaseExpiresAt?: string | null;
}

export type WaiterQueueActionType =
  | 'confirm_order'
  | 'cancel_order'
  | 'mark_served'
  | 'update_order'
  | 'update_and_confirm_order';

export interface WaiterActionQueueRecord {
  owner?: BrowserIdentity;
  id?: number;
  type: WaiterQueueActionType;
  createdAt: string;
  status: OfflineQueueItemStatus;
  lastError: string | null;
  idempotencyKey: string;
  syncLeaseOwner?: string | null;
  syncLeaseExpiresAt?: string | null;
  payload: {
    orderId: number;
    updatePayload?: UpdatePendingOrderRequest;
  };
}

interface SyncEventRecord {
  id?: number;
  type: 'enqueue' | 'sync_start' | 'sync_success' | 'sync_failed';
  createdAt: string;
  message: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await openOfflineDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const completionPromise = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const result = await action(store);
  await completionPromise;

  return result;
};

const idbRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Preserve all order intent/keys and menu data; replace only readable credentials.
// Crypto runs outside IndexedDB transactions so an idle transaction cannot commit
// before its digest completes. Unknown shared cache ownership is quarantined.
const sanitizeLegacyGuestCredentials = async (db: IDBDatabase): Promise<void> => {
  const scope = async (token: string): Promise<string> => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const queued = await idbRequest(db.transaction(ORDER_QUEUE_STORE).objectStore(ORDER_QUEUE_STORE).getAll()) as GuestOrderQueueRecord[];
  for (const row of queued) {
    if (!row.guestAccessToken || row.guestAccessToken.startsWith('http-only-cookie:')) continue;
    const next = { ...row, guestAccessToken: `http-only-cookie:${await scope(row.guestAccessToken)}` };
    await idbRequest(db.transaction(ORDER_QUEUE_STORE, 'readwrite').objectStore(ORDER_QUEUE_STORE).put(next));
  }
  const cached = await idbRequest(db.transaction(MENU_CACHE_STORE).objectStore(MENU_CACHE_STORE).getAll()) as GuestMenuCacheRecord[];
  for (const row of cached) {
    const keyToken = row.key.match(/:token:(.*?):lang:/)?.[1];
    const raw = row.payload.guest_access?.token || (keyToken && !['no-token', 'verified'].includes(keyToken) && !keyToken.startsWith('http-only-cookie:') ? keyToken : null);
    if (!raw && keyToken !== 'verified') continue;
    const fingerprint = raw ? await scope(raw) : null;
    const nextKey = raw && keyToken ? row.key.replace(`:token:${keyToken}:lang:`, `:token:http-only-cookie:${fingerprint}:lang:`)
      : keyToken === 'verified' ? `quarantined-cache:${await scope(row.key)}` : row.key;
    const next = { ...row, key: nextKey, payload: { ...row.payload, guest_access: row.payload.guest_access ? { ...row.payload.guest_access, token: undefined, cache_key: fingerprint || row.payload.guest_access.cache_key } : null } };
    const tx = db.transaction(MENU_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(MENU_CACHE_STORE);
    store.put(next);
    if (nextKey !== row.key) store.delete(row.key);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  }
};

export const openOfflineDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains(MENU_CACHE_STORE)) {
        const menuStore = db.createObjectStore(MENU_CACHE_STORE, { keyPath: 'key' });
        menuStore.createIndex('tableId', 'tableId', { unique: false });
        menuStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(ORDER_QUEUE_STORE)) {
        const queueStore = db.createObjectStore(ORDER_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(WAITER_QUEUE_STORE)) {
        const waiterQueueStore = db.createObjectStore(WAITER_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        waiterQueueStore.createIndex('status', 'status', { unique: false });
        waiterQueueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(SYNC_EVENTS_STORE)) {
        db.createObjectStore(SYNC_EVENTS_STORE, { keyPath: 'id', autoIncrement: true });
      }

      if (event.oldVersion < 3) {
        const waiterStore = request.transaction?.objectStore(WAITER_QUEUE_STORE);
        const cursorRequest = waiterStore?.openCursor();
        if (cursorRequest) {
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const record = cursor.value as WaiterActionQueueRecord;
            record.idempotencyKey ||= `legacy-${record.id}-${Date.now()}`;
            cursor.update(record);
            cursor.continue();
          };
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      void sanitizeLegacyGuestCredentials(db).then(() => resolve(db), (error) => { db.close(); dbPromise = null; reject(error); });
    };
    request.onblocked = () => { dbPromise = null; reject(new Error('Close older application tabs to finish the safe offline-data upgrade.')); };
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

export const getGuestMenuCache = async (key: string): Promise<GuestMenuCacheRecord | null> => {
  return withStore(MENU_CACHE_STORE, 'readonly', async (store) => {
    const result = await idbRequest(store.get(key));
    return (result as GuestMenuCacheRecord | undefined) ?? null;
  });
};

export const putGuestMenuCache = async (record: GuestMenuCacheRecord): Promise<void> => {
  await withStore(MENU_CACHE_STORE, 'readwrite', async (store) => {
    const guestAccess = record.payload.guest_access;
    const safeRecord: GuestMenuCacheRecord = {
      ...record,
      payload: {
        ...record.payload,
        guest_access: guestAccess ? { ...guestAccess, token: undefined } : null,
      },
    };
    await idbRequest(store.put(safeRecord));
  });
};

export const enqueueGuestOrder = async (record: Omit<GuestOrderQueueRecord, 'id' | 'status' | 'lastError'>): Promise<number> => {
  return withStore(ORDER_QUEUE_STORE, 'readwrite', async (store) => {
    const id = await idbRequest(store.add({ ...record, status: 'pending', lastError: null } as GuestOrderQueueRecord));
    await appendSyncEvent({
      type: 'enqueue',
      createdAt: new Date().toISOString(),
      message: `Queued guest order for session ${record.sessionId}`,
    });
    return Number(id);
  });
};

export const listQueuedGuestOrders = async (): Promise<GuestOrderQueueRecord[]> => {
  return withStore(ORDER_QUEUE_STORE, 'readonly', async (store) => {
    const result = await idbRequest(store.getAll());
    return (result as GuestOrderQueueRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
};

export const updateQueuedGuestOrder = async (
  id: number,
  patch: Partial<Pick<GuestOrderQueueRecord, 'status' | 'lastError' | 'payload' | 'syncLeaseOwner' | 'syncLeaseExpiresAt'>>
): Promise<void> => {
  await withStore(ORDER_QUEUE_STORE, 'readwrite', async (store) => {
    const current = await idbRequest(store.get(id)) as GuestOrderQueueRecord | undefined;
    if (!current) {
      return;
    }

    await idbRequest(store.put({ ...current, ...patch }));
  });
};

export const deleteQueuedGuestOrder = async (id: number): Promise<void> => {
  await withStore(ORDER_QUEUE_STORE, 'readwrite', async (store) => {
    await idbRequest(store.delete(id));
  });
};

export const appendSyncEvent = async (record: SyncEventRecord): Promise<void> => {
  await withStore(SYNC_EVENTS_STORE, 'readwrite', async (store) => {
    await idbRequest(store.add(record));
  });
};

export const enqueueWaiterAction = async (record: Omit<WaiterActionQueueRecord, 'id' | 'status' | 'lastError'>): Promise<number> => {
  const owner = getVerifiedBrowserIdentity();
  if (!owner) throw new Error('Resolve the authenticated restaurant and user before queueing staff work.');
  return withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
    const id = await idbRequest(store.add({ ...record, owner, status: 'pending', lastError: null } as WaiterActionQueueRecord));
    return Number(id);
  });
};

export const listQueuedWaiterActions = async (): Promise<WaiterActionQueueRecord[]> => {
  return withStore(WAITER_QUEUE_STORE, 'readonly', async (store) => {
    const result = await idbRequest(store.getAll());
    return (result as WaiterActionQueueRecord[])
      .filter((item) => waiterActionBelongsToCurrentAccount(item.owner))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
};

export const updateQueuedWaiterAction = async (
  id: number,
  patch: Partial<Pick<WaiterActionQueueRecord, 'status' | 'lastError' | 'type' | 'payload' | 'syncLeaseOwner' | 'syncLeaseExpiresAt'>>
): Promise<void> => {
  await withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
    const current = await idbRequest(store.get(id)) as WaiterActionQueueRecord | undefined;
    if (!current || !waiterActionBelongsToCurrentAccount(current.owner)) {
      return;
    }

    await idbRequest(store.put({ ...current, ...patch }));
  });
};

export const deleteQueuedWaiterAction = async (id: number): Promise<void> => {
  await withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
    const current = await idbRequest(store.get(id)) as WaiterActionQueueRecord | undefined;
    if (!current || !waiterActionBelongsToCurrentAccount(current.owner)) return;
    await idbRequest(store.delete(id));
  });
};

const claimQueuedRecord = async <T extends GuestOrderQueueRecord | WaiterActionQueueRecord>(
  storeName: string,
  id: number,
  leaseOwner: string,
  now: Date,
  leaseDurationMs: number
): Promise<T | null> => {
  return withStore(storeName, 'readwrite', async (store) => {
    const current = await idbRequest(store.get(id)) as T | undefined;
    if (!current) return null;

    const leaseExpiresAt = current.syncLeaseExpiresAt ? Date.parse(current.syncLeaseExpiresAt) : Number.NaN;
    const legacySyncStartedAt = Date.parse(current.createdAt);
    const leaseExpired = current.status === 'syncing' && (
      Number.isFinite(leaseExpiresAt)
        ? leaseExpiresAt <= now.getTime()
        : Number.isFinite(legacySyncStartedAt) && legacySyncStartedAt <= now.getTime() - leaseDurationMs
    );
    const claimable = current.status === 'pending' || current.status === 'failed' || leaseExpired;
    if (!claimable) return null;

    const claimed = {
      ...current,
      status: 'syncing' as const,
      lastError: null,
      syncLeaseOwner: leaseOwner,
      syncLeaseExpiresAt: new Date(now.getTime() + leaseDurationMs).toISOString(),
    };
    await idbRequest(store.put(claimed));
    return claimed as T;
  });
};

export const claimQueuedGuestOrder = (
  id: number,
  leaseOwner: string,
  now: Date,
  leaseDurationMs: number
): Promise<GuestOrderQueueRecord | null> => (
  claimQueuedRecord<GuestOrderQueueRecord>(ORDER_QUEUE_STORE, id, leaseOwner, now, leaseDurationMs)
);

export const claimQueuedWaiterAction = (
  id: number,
  leaseOwner: string,
  now: Date,
  leaseDurationMs: number
): Promise<WaiterActionQueueRecord | null> => (
  claimQueuedRecord<WaiterActionQueueRecord>(WAITER_QUEUE_STORE, id, leaseOwner, now, leaseDurationMs)
);

export const renewQueuedWaiterActionLease = async (
  id: number,
  leaseOwner: string,
  now: Date,
  leaseDurationMs: number
): Promise<boolean> => withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
  const current = await idbRequest(store.get(id)) as WaiterActionQueueRecord | undefined;
  if (!current || current.status !== 'syncing' || current.syncLeaseOwner !== leaseOwner) return false;
  await idbRequest(store.put({
    ...current,
    syncLeaseExpiresAt: new Date(now.getTime() + leaseDurationMs).toISOString(),
  }));
  return true;
});
