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

const DB_NAME = 'menu-react-offline';
const DB_VERSION = 1;
const MENU_CACHE_STORE = 'guest_menu_cache';
const ORDER_QUEUE_STORE = 'guest_order_queue';
const WAITER_QUEUE_STORE = 'waiter_action_queue';
const SYNC_EVENTS_STORE = 'sync_events_log';

export interface GuestMenuCacheRecord {
  key: string;
  tableId: number;
  guestAccessToken?: string | null;
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
  id?: number;
  sessionId: number;
  guestAccessToken: string;
  payload: CreateGuestOrderRequest;
  createdAt: string;
  idempotencyKey: string;
  status: OfflineQueueItemStatus;
  lastError: string | null;
}

export type WaiterQueueActionType =
  | 'confirm_order'
  | 'cancel_order'
  | 'mark_served'
  | 'update_order'
  | 'update_and_confirm_order';

export interface WaiterActionQueueRecord {
  id?: number;
  type: WaiterQueueActionType;
  createdAt: string;
  status: OfflineQueueItemStatus;
  lastError: string | null;
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
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const openOfflineDb = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
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
    };

    request.onsuccess = () => resolve(request.result);
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
    await idbRequest(store.put(record));
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
  patch: Partial<Pick<GuestOrderQueueRecord, 'status' | 'lastError' | 'payload'>>
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
  return withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
    const id = await idbRequest(store.add({ ...record, status: 'pending', lastError: null } as WaiterActionQueueRecord));
    return Number(id);
  });
};

export const listQueuedWaiterActions = async (): Promise<WaiterActionQueueRecord[]> => {
  return withStore(WAITER_QUEUE_STORE, 'readonly', async (store) => {
    const result = await idbRequest(store.getAll());
    return (result as WaiterActionQueueRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
};

export const updateQueuedWaiterAction = async (
  id: number,
  patch: Partial<Pick<WaiterActionQueueRecord, 'status' | 'lastError' | 'type' | 'payload'>>
): Promise<void> => {
  await withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
    const current = await idbRequest(store.get(id)) as WaiterActionQueueRecord | undefined;
    if (!current) {
      return;
    }

    await idbRequest(store.put({ ...current, ...patch }));
  });
};

export const deleteQueuedWaiterAction = async (id: number): Promise<void> => {
  await withStore(WAITER_QUEUE_STORE, 'readwrite', async (store) => {
    await idbRequest(store.delete(id));
  });
};
