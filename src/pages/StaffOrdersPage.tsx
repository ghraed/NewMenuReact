import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import StaffOrderEditor from '../components/Staff/StaffOrderEditor';
import {
  GlassCard,
  GlassInput,
  GlassSearchSelect,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';
import PageSkeleton from '../components/Common/PageSkeleton';
import { useAuth } from '../contexts/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  enableStaffPushNotifications,
  getStaffPushState,
  PushSetupError,
  refreshStaffPushSubscription,
} from '../services/pushNotifications';
import { ensureEchoConnection, getEcho } from '../services/realtime';
import {
  activateGuestTableSession,
  cancelPendingOrder,
  confirmPendingOrder,
  createGuestTableSessionOrder,
  fetchActiveTableSessions,
  fetchPublishedDishes,
  fetchGuestTables,
  fetchPendingOrders,
  fetchPendingWaves,
  fetchKitchenOrders,
  finalizeGuestTableSession,
  markOrderServed,
  resetActiveTableSessionPin,
  resolvePendingWave,
  updatePendingOrder,
  verifyGuestTablePin,
} from '../services/orderService';
import api from '../services/api';
import {
  emitOfflineQueueUpdated,
  getPendingWaiterQueueCount,
  getQueuedWaiterActions,
  onOfflineQueueUpdated,
  removeQueuedWaiterAction,
  syncQueuedWaiterAction,
  queueWaiterAction,
} from '../services/offlineQueue';
import { updateQueuedWaiterAction } from '../services/offlineStore';
import { getIngredientDisplayName } from '../utils/ingredientDisplay';
import type {
  ActiveTableSessionRecord,
  InventoryIngredient,
  KitchenOrderRecord,
  OrderRecord,
  PublishedDishSummary,
  RestaurantTableSummary,
  TableWaveRecord,
  UpdatePendingOrderRequest,
} from '../types';

type BrowserNotificationStatus = NotificationPermission | 'unsupported';
const MOBILE_POLL_INTERVAL_MS = 10000;
type StaffQuickOrderItem = {
  dish_id: number;
  dish_name: string;
  quantity: number;
  unit_price: number;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const getNotificationStatus = (): BrowserNotificationStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return window.Notification.permission;
};

const showWaveNotification = (wave: TableWaveRecord, title: string, body: string): boolean => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new window.Notification(title, {
      body,
      icon: '/rozer-favicon.svg',
      badge: '/rozer-favicon.svg',
      tag: `table-wave-${wave.id}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (error) {
    console.warn('[Realtime] Browser notification failed to show.', error);
    return false;
  }
};

const showOrderNotification = (order: OrderRecord, title: string, body: string): boolean => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new window.Notification(title, {
      body,
      icon: '/rozer-favicon.svg',
      badge: '/rozer-favicon.svg',
      tag: `pending-order-${order.id}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (error) {
    console.warn('[Realtime] Browser order notification failed to show.', error);
    return false;
  }
};

const isLikelyMobileDevice = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);

  return coarsePointer || mobileUserAgent;
};

const isBillRequest = (wave: TableWaveRecord): boolean => (
  wave.request_type === 'request_bill'
);

const StaffOrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast, showToast, dismiss } = useGlassToast(3600);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [readyOrders, setReadyOrders] = useState<KitchenOrderRecord[]>([]);
  const [waves, setWaves] = useState<TableWaveRecord[]>([]);
  const [tableSessions, setTableSessions] = useState<ActiveTableSessionRecord[]>([]);
  const [accessibleTables, setAccessibleTables] = useState<RestaurantTableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [processingServedOrderId, setProcessingServedOrderId] = useState<number | null>(null);
  const [processingWaveId, setProcessingWaveId] = useState<number | null>(null);
  const [processingSessionId, setProcessingSessionId] = useState<number | null>(null);
  const [staffOrderingSessionId, setStaffOrderingSessionId] = useState<number | null>(null);
  const [staffOrderDishId, setStaffOrderDishId] = useState('');
  const [staffOrderQuantity, setStaffOrderQuantity] = useState('1');
  const [staffOrderItems, setStaffOrderItems] = useState<StaffQuickOrderItem[]>([]);
  const [staffOrderSubmitting, setStaffOrderSubmitting] = useState(false);
  const [tableUrlPopup, setTableUrlPopup] = useState<{ label: string; url: string } | null>(null);
  const [editorBusyAction, setEditorBusyAction] = useState<'save' | 'saveConfirm' | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [publishedDishes, setPublishedDishes] = useState<PublishedDishSummary[]>([]);
  const [publishedDishesLoading, setPublishedDishesLoading] = useState(false);
  const [publishedDishesError, setPublishedDishesError] = useState<string | null>(null);
  const [lowStockIngredients, setLowStockIngredients] = useState<InventoryIngredient[]>([]);
  const [adminRealtimeTableIds, setAdminRealtimeTableIds] = useState<number[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<BrowserNotificationStatus>(() => (
    getNotificationStatus()
  ));
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [mobilePollingEnabled, setMobilePollingEnabled] = useState<boolean>(() => isLikelyMobileDevice());
  const [isIosLike, setIsIosLike] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [requiresHomeScreenInstall, setRequiresHomeScreenInstall] = useState(false);
  const [pendingWaiterSyncCount, setPendingWaiterSyncCount] = useState(0);
  const [syncingWaiterQueue, setSyncingWaiterQueue] = useState(false);
  const [queuedWaiterActions, setQueuedWaiterActions] = useState<Array<{
    id: number;
    type: string;
    status: string;
    orderId: number;
    updatePayload?: UpdatePendingOrderRequest;
  }>>([]);
  const refreshInFlightRef = useRef(false);
  const hasLoadedPublishedDishesRef = useRef(false);
  const knownPendingOrderIdsRef = useRef<Set<number>>(new Set());
  const hasSeededPendingOrdersRef = useRef(false);
  const { isOnline, justReconnected } = useNetworkStatus();
  const assignedTableIds = useMemo(
    () => new Set((user?.assigned_tables ?? []).map((table) => table.id)),
    [user?.assigned_tables]
  );
  const canAccessKitchenReadyOrders = user?.role === 'admin' || user?.role === 'chef';

  const getOrderLabel = useCallback((order: OrderRecord): string => (
    order.order_number || t('staffOrdersPage.orderNumberLabel', { id: order.id })
  ), [t]);

  const getWaveTitle = useCallback((wave: TableWaveRecord): string => (
    isBillRequest(wave)
      ? t('staffOrdersPage.billRequest')
      : t('staffOrdersPage.guestWave')
  ), [t]);

  const getWaveDescription = useCallback((wave: TableWaveRecord): string => (
    isBillRequest(wave)
      ? t('staffOrdersPage.guestRequestingBill')
      : t('staffOrdersPage.guestCallingForAssistance')
  ), [t]);

  const getWaveBadgeLabel = useCallback((wave: TableWaveRecord): string => (
    isBillRequest(wave)
      ? t('staffOrdersPage.billRequestBadge')
      : t('staffOrdersPage.serviceCall')
  ), [t]);

  const getWaveNotificationTitle = useCallback((wave: TableWaveRecord): string => (
    isBillRequest(wave)
      ? t('staffOrdersPage.billNotificationTitle', { table: wave.table_reference })
      : t('staffOrdersPage.notificationTitle', { table: wave.table_reference })
  ), [t]);

  const getWaveNotificationBody = useCallback((wave: TableWaveRecord): string => (
    isBillRequest(wave)
      ? t('staffOrdersPage.billNotificationBody')
      : t('staffOrdersPage.notificationBody')
  ), [t]);

  const getWaveToastMessage = useCallback((wave: TableWaveRecord, withBrowserNotification: boolean): string => (
    isBillRequest(wave)
      ? withBrowserNotification
        ? t('staffOrdersPage.newBillRequestWithBrowserNotification', { table: wave.table_reference })
        : t('staffOrdersPage.newBillRequest', { table: wave.table_reference })
      : withBrowserNotification
        ? t('staffOrdersPage.newWaveWithBrowserNotification', { table: wave.table_reference })
        : t('staffOrdersPage.newWave', { table: wave.table_reference })
  ), [t]);

  const getOrderNotificationTitle = useCallback((order: OrderRecord): string => (
    t('staffOrdersPage.orderNotificationTitle', { table: order.table_reference })
  ), [t]);

  const getOrderNotificationBody = useCallback((order: OrderRecord): string => (
    t('staffOrdersPage.orderNotificationBody', { order: getOrderLabel(order) })
  ), [getOrderLabel, t]);

  const getOrderToastMessage = useCallback((order: OrderRecord, withBrowserNotification: boolean): string => (
    withBrowserNotification
      ? t('staffOrdersPage.newAssignedOrderWithBrowserNotification', {
        order: getOrderLabel(order),
        table: order.table_reference,
      })
      : t('staffOrdersPage.newAssignedOrder', {
        order: getOrderLabel(order),
        table: order.table_reference,
      })
  ), [getOrderLabel, t]);

  const isOrderAssignedToCurrentStaff = useCallback((order: OrderRecord): boolean => {
    if (user?.role !== 'staff') {
      return false;
    }

    const tableId = order.table?.id;

    if (typeof tableId === 'number' && assignedTableIds.has(tableId)) {
      return true;
    }

    return (user.assigned_tables ?? []).some((table) => table.name === order.table_reference);
  }, [assignedTableIds, user?.assigned_tables, user?.role]);

  const getPushSetupMessage = useCallback((error: unknown): string | null => {
    if (error instanceof PushSetupError) {
      switch (error.code) {
        case 'iphone_home_screen_required':
          return t('staffOrdersPage.push.iphoneHomeScreenRequired');
        case 'insecure_context':
          return t('staffOrdersPage.push.insecureContext');
        case 'server_not_configured':
          return t('staffOrdersPage.push.serverNotConfigured');
        case 'service_worker_script_unavailable':
          return t('staffOrdersPage.push.serviceWorkerScriptUnavailable');
        case 'service_worker_registration_failed':
          return t('staffOrdersPage.push.serviceWorkerRegistrationFailed');
        case 'subscription_create_failed':
          return [
            t('staffOrdersPage.push.subscriptionCreateFailed'),
            error.detail ? `Browser detail: ${error.detail}` : null,
          ].filter(Boolean).join(' ');
        case 'subscription_sync_failed':
          return t('staffOrdersPage.push.subscriptionSyncFailed');
        default:
          return error.message;
      }
    }

    return null;
  }, [t]);

  const applyPushState = useCallback((nextState: Awaited<ReturnType<typeof getStaffPushState>>) => {
    setNotificationStatus(nextState.permission);
    setPushSubscribed(nextState.subscribed);
    setIsIosLike(nextState.isIosLike);
    setIsStandalone(nextState.isStandalone);
    setRequiresHomeScreenInstall(nextState.requiresHomeScreenInstall);
  }, []);

  const refreshStaffActivity = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const [nextOrders, nextWaves] = await Promise.all([
        fetchPendingOrders(),
        fetchPendingWaves(),
      ]);

      if (hasSeededPendingOrdersRef.current) {
        nextOrders
          .filter((order) => !knownPendingOrderIdsRef.current.has(order.id))
          .filter(isOrderAssignedToCurrentStaff)
          .forEach((order) => {
            const notificationShown = showOrderNotification(
              order,
              getOrderNotificationTitle(order),
              getOrderNotificationBody(order)
            );

            showToast(
              getOrderToastMessage(order, notificationShown),
              'secondary',
              4200
            );
          });
      }

      knownPendingOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
      hasSeededPendingOrdersRef.current = true;

      setOrders(nextOrders);
      setWaves(nextWaves);
      if (canAccessKitchenReadyOrders) {
        try {
          const nextReadyOrders = await fetchKitchenOrders('ready');
          setReadyOrders(nextReadyOrders);
        } catch (kitchenErr) {
          console.warn('[Staff] Failed to load ready kitchen orders.', kitchenErr);
          setReadyOrders([]);
        }
      } else {
        setReadyOrders([]);
      }
      try {
        const nextSessions = await fetchActiveTableSessions();
        setTableSessions(nextSessions);
      } catch (sessionError) {
        console.warn('[Staff] Failed to load active table sessions.', sessionError);
      }
    } catch (err: unknown) {
      if (!silent) {
        setError(getErrorMessage(err, t('staffOrdersPage.failedLoadActivity')));
      } else {
        console.warn('[Staff Polling] Silent refresh failed.', err);
      }
    } finally {
      refreshInFlightRef.current = false;

      if (!silent) {
        setLoading(false);
      }
    }
  }, [
    getOrderNotificationBody,
    getOrderNotificationTitle,
    getOrderToastMessage,
    isOrderAssignedToCurrentStaff,
    canAccessKitchenReadyOrders,
    showToast,
    t,
  ]);

  const replaceOrder = useCallback((nextOrder: OrderRecord) => {
    setOrders((current) => current.map((item) => (item.id === nextOrder.id ? nextOrder : item)));
  }, []);

  const loadPublishedMenu = useCallback(async () => {
    if (publishedDishesLoading || hasLoadedPublishedDishesRef.current) {
      return;
    }

    setPublishedDishesLoading(true);
    setPublishedDishesError(null);

    try {
      const nextDishes = await fetchPublishedDishes();
      setPublishedDishes(nextDishes);
      hasLoadedPublishedDishesRef.current = true;
    } catch (err: unknown) {
      setPublishedDishesError(getErrorMessage(err, t('staffOrdersPage.failedLoadPublishedDishes')));
    } finally {
      setPublishedDishesLoading(false);
    }
  }, [publishedDishesLoading, t]);

  const loadOrders = useCallback(async () => {
    await refreshStaffActivity();
  }, [refreshStaffActivity]);

  useEffect(() => {
    const refreshPendingCount = () => {
      void getPendingWaiterQueueCount().then((count) => setPendingWaiterSyncCount(count));
      void getQueuedWaiterActions().then((rows) => {
        setQueuedWaiterActions(rows.filter((row) => typeof row.id === 'number').map((row) => ({
          id: row.id as number,
          type: row.type,
          status: row.status,
          orderId: row.payload.orderId,
          updatePayload: row.payload.updatePayload,
        })));
      });
    };

    refreshPendingCount();
    const unsubscribe = onOfflineQueueUpdated(refreshPendingCount);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!justReconnected || pendingWaiterSyncCount === 0 || syncingWaiterQueue) {
      return;
    }

    setSyncingWaiterQueue(true);
    void getQueuedWaiterActions()
      .then(async (rows) => {
        let synced = 0;
        let failed = 0;
        for (const row of rows) {
          if (!row.id || (row.status !== 'pending' && row.status !== 'failed')) {
            continue;
          }
          const approved = window.confirm(`Sync waiter action #${row.id} (${row.type}) for order #${row.payload.orderId}?`);
          if (!approved) {
            continue;
          }
          const result = await syncQueuedWaiterAction(row.id);
          if (result.synced) {
            synced += 1;
          } else {
            failed += 1;
          }
        }
        showToast(`Waiter sync complete: ${synced} synced, ${failed} failed.`, 'secondary', 4200);
        void refreshStaffActivity({ silent: true });
      })
      .finally(() => {
        setSyncingWaiterQueue(false);
      });
  }, [justReconnected, pendingWaiterSyncCount, syncingWaiterQueue, showToast, refreshStaffActivity]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let isActive = true;

    const loadLowStock = async () => {
      if (user?.role !== 'admin') {
        setLowStockIngredients([]);
        return;
      }

      try {
        const response = await api.get('/inventory/ingredients');
        const nextIngredients = Array.isArray(response.data?.ingredients)
          ? (response.data.ingredients as InventoryIngredient[])
          : [];

        if (!isActive) {
          return;
        }

        setLowStockIngredients(nextIngredients.filter((ingredient) => ingredient.is_low_stock));
      } catch {
        if (isActive) {
          setLowStockIngredients([]);
        }
      }
    };

    loadLowStock();

    return () => {
      isActive = false;
    };
  }, [user?.role, user?.restaurant?.id]);

  useEffect(() => {
    setEditingOrder(null);
    setPublishedDishes([]);
    setPublishedDishesError(null);
    hasLoadedPublishedDishesRef.current = false;
  }, [user?.restaurant?.id]);

  useEffect(() => {
    if (!staffOrderingSessionId || typeof window === 'undefined') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.getElementById(`staff-table-session-${staffOrderingSessionId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [staffOrderingSessionId]);

  useEffect(() => {
    const syncMobileEnvironment = () => {
      setMobilePollingEnabled(isLikelyMobileDevice());
    };

    syncMobileEnvironment();

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('resize', syncMobileEnvironment);

    return () => {
      window.removeEventListener('resize', syncMobileEnvironment);
    };
  }, []);

  useEffect(() => {
    const syncNotificationStatus = () => {
      setNotificationStatus(getNotificationStatus());
    };

    syncNotificationStatus();

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('focus', syncNotificationStatus);
    document.addEventListener('visibilitychange', syncNotificationStatus);

    return () => {
      window.removeEventListener('focus', syncNotificationStatus);
      document.removeEventListener('visibilitychange', syncNotificationStatus);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const syncPushState = async () => {
      try {
        const nextState = await getStaffPushState();

        if (!isActive) {
          return;
        }

        applyPushState(nextState);

        if (nextState.permission === 'granted' && nextState.subscribed) {
          const syncedState = await refreshStaffPushSubscription();

          if (!isActive) {
            return;
          }

          applyPushState(syncedState);
        }
      } catch (error) {
        console.warn('[Push] Failed to inspect the current push subscription state.', error);
      }
    };

    syncPushState();

    return () => {
      isActive = false;
    };
  }, [applyPushState]);

  useEffect(() => {
    const resumeRealtime = () => {
      if (document.visibilityState === 'visible') {
        ensureEchoConnection();
        void refreshStaffActivity({ silent: true });
      }
    };

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('focus', resumeRealtime);
    document.addEventListener('visibilitychange', resumeRealtime);
    window.addEventListener('online', resumeRealtime);

    return () => {
      window.removeEventListener('focus', resumeRealtime);
      document.removeEventListener('visibilitychange', resumeRealtime);
      window.removeEventListener('online', resumeRealtime);
    };
  }, [refreshStaffActivity]);

  useEffect(() => {
    if (!mobilePollingEnabled || !user?.restaurant?.id || editingOrder !== null) {
      return undefined;
    }

    const runSilentRefresh = () => {
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      void refreshStaffActivity({ silent: true });
    };

    const intervalId = window.setInterval(runSilentRefresh, MOBILE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [editingOrder, mobilePollingEnabled, refreshStaffActivity, user?.restaurant?.id]);

  useEffect(() => {
    const restaurantSlug = user?.restaurant?.slug;

    if (!restaurantSlug) {
      setAccessibleTables([]);
      return;
    }

    if (user.role === 'staff') {
      setAccessibleTables(user.assigned_tables ?? []);
      return;
    }

    let isActive = true;

    const loadAccessibleTables = async () => {
      try {
        const response = await fetchGuestTables(restaurantSlug);

        if (!isActive) {
          return;
        }

        setAccessibleTables(response.tables);
      } catch {
        if (isActive) {
          setAccessibleTables([]);
        }
      }
    };

    loadAccessibleTables();

    return () => {
      isActive = false;
    };
  }, [user?.assigned_tables, user?.role, user?.restaurant?.slug]);

  useEffect(() => {
    const restaurantSlug = user?.restaurant?.slug;

    if (user?.role !== 'admin' || !restaurantSlug) {
      setAdminRealtimeTableIds([]);
      return;
    }

    let isActive = true;

    const loadRealtimeTables = async () => {
      try {
        const response = await fetchGuestTables(restaurantSlug);

        if (!isActive) {
          return;
        }

        setAdminRealtimeTableIds(response.tables.map((table) => table.id));
      } catch {
        if (isActive) {
          setAdminRealtimeTableIds([]);
        }
      }
    };

    loadRealtimeTables();

    return () => {
      isActive = false;
    };
  }, [user?.role, user?.restaurant?.slug]);

  useEffect(() => {
    if (!user?.restaurant?.id) {
      console.warn('[Realtime] Skipping Echo subscription because no restaurant is linked to this user.');
      return undefined;
    }

    const restaurantId = user.restaurant.id;

    const echo = getEcho();

    if (!echo) {
      console.warn('[Realtime] Echo client is unavailable on the staff page.');
      return undefined;
    }

    const tableIds = user.role === 'admin'
      ? adminRealtimeTableIds
      : (user.assigned_tables ?? []).map((table) => table.id);

    if (tableIds.length === 0) {
      console.warn('[Realtime] No table ids available for staff wave subscription.', {
        role: user.role,
        restaurantId,
      });
      return undefined;
    }

    const uniqueTableIds = Array.from(new Set(tableIds));
    const channelNames = uniqueTableIds.map(
      (tableId) => `restaurant.${restaurantId}.table.${tableId}.waves`
    );

    console.info('[Realtime] Subscribing to staff wave channels', {
      role: user.role,
      restaurantId,
      channelNames,
    });

    channelNames.forEach((channelName) => {
      const channel = echo.private(channelName);

      channel.listen('.table-wave.created', (event: { wave?: TableWaveRecord }) => {
        const nextWave = event.wave;

        if (!nextWave) {
          console.warn('[Realtime] Received table-wave.created without a wave payload.', { channelName });
          return;
        }

        console.info('[Realtime] Received table-wave.created', {
          channelName,
          waveId: nextWave.id,
          tableReference: nextWave.table_reference,
        });

        setWaves((current) => {
          const alreadyExists = current.some((wave) => wave.id === nextWave.id);

          if (alreadyExists) {
            return current.map((wave) => (wave.id === nextWave.id ? nextWave : wave));
          }

          return [nextWave, ...current];
        });

        const notificationShown = showWaveNotification(
          nextWave,
          getWaveNotificationTitle(nextWave),
          getWaveNotificationBody(nextWave)
        );
        showToast(
          getWaveToastMessage(nextWave, notificationShown),
          'secondary',
          4200
        );
      });

      channel.listen('.table-wave.resolved', (event: { wave?: TableWaveRecord }) => {
        const resolvedWave = event.wave;

        if (!resolvedWave) {
          console.warn('[Realtime] Received table-wave.resolved without a wave payload.', { channelName });
          return;
        }

        console.info('[Realtime] Received table-wave.resolved', {
          channelName,
          waveId: resolvedWave.id,
          tableReference: resolvedWave.table_reference,
        });

        setWaves((current) => current.filter((wave) => wave.id !== resolvedWave.id));
      });
    });

    return () => {
      console.info('[Realtime] Leaving staff wave channels', {
        restaurantId,
        channelNames,
      });
      channelNames.forEach((channelName) => {
        echo.leave(channelName);
      });
    };
  }, [
    adminRealtimeTableIds,
    getWaveNotificationBody,
    getWaveNotificationTitle,
    getWaveToastMessage,
    showToast,
    user?.assigned_tables,
    user?.restaurant?.id,
    user?.role,
  ]);

  const orderCountLabel = useMemo(() => (
    t('staffOrdersPage.requestsWaiting', { count: orders.length })
  ), [orders.length, t]);

  const waveCountLabel = useMemo(() => (
    t('staffOrdersPage.wavesWaiting', { count: waves.length })
  ), [waves.length, t]);
  const readyOrderCountLabel = useMemo(() => (
    `Ready to serve: ${readyOrders.length}`
  ), [readyOrders.length]);

  const activeTableSessionCountLabel = useMemo(() => (
    t('staffOrdersPage.activeTableSessions', { count: tableSessions.length })
  ), [tableSessions.length, t]);

  const publishedDishOptions = useMemo(() => (
    publishedDishes
      .filter((dish) => dish.is_orderable !== false && dish.is_out_of_stock !== true)
      .map((dish) => ({
        value: String(dish.id),
        label: `${dish.name} • ${dish.category} • $${Number(dish.price).toFixed(2)}`,
      }))
  ), [publishedDishes]);

  const inactiveTables = useMemo(() => {
    const activeTableIds = new Set(
      tableSessions
        .map((session) => session.table?.id)
        .filter((tableId): tableId is number => typeof tableId === 'number')
    );

    return accessibleTables.filter((table) => !activeTableIds.has(table.id));
  }, [accessibleTables, tableSessions]);

  const resetStaffOrderComposer = useCallback(() => {
    setStaffOrderDishId('');
    setStaffOrderQuantity('1');
    setStaffOrderItems([]);
    setStaffOrderSubmitting(false);
  }, []);

  const openStaffOrderComposer = useCallback((sessionId: number) => {
    setStaffOrderingSessionId(sessionId);
    resetStaffOrderComposer();
    void loadPublishedMenu();
  }, [loadPublishedMenu, resetStaffOrderComposer]);

  const handleEnableNotifications = async () => {
    setError(null);
    setPushBusy(true);

    try {
      const nextState = await enableStaffPushNotifications();
      applyPushState(nextState);

      if (nextState.permission === 'granted' && nextState.subscribed) {
        showToast(
          t('staffOrdersPage.push.active'),
          'secondary',
          4200
        );
        return;
      }

      if (nextState.permission === 'denied') {
        setError(t('staffOrdersPage.push.blocked'));
        return;
      }

      showToast(t('staffOrdersPage.push.permissionNotGranted'), 'tertiary', 3600);
    } catch (err: unknown) {
      setError(getPushSetupMessage(err) ?? getErrorMessage(err, t('staffOrdersPage.push.failedEnable')));
    } finally {
      setPushBusy(false);
    }
  };

  const handleConfirm = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    setError(null);

    try {
      if (!isOnline) {
        await queueWaiterAction({ type: 'confirm_order', orderId: order.id });
        setOrders((current) => current.filter((item) => item.id !== order.id));
        showToast(`Queued confirm for ${getOrderLabel(order)}.`, 'tertiary', 3600);
        return;
      }
      const response = await confirmPendingOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      showToast(
        t('staffOrdersPage.confirmedOrder', { order: getOrderLabel(response.order), table: response.order.table_reference }),
        'secondary',
        4200
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedConfirmOrder')));
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCancel = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    setError(null);

    try {
      if (!isOnline) {
        await queueWaiterAction({ type: 'cancel_order', orderId: order.id });
        setOrders((current) => current.filter((item) => item.id !== order.id));
        showToast(`Queued cancel for ${getOrderLabel(order)}.`, 'tertiary', 3600);
        return;
      }
      const response = await cancelPendingOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      showToast(
        t('staffOrdersPage.cancelledOrder', { order: getOrderLabel(response.order), table: response.order.table_reference }),
        'secondary',
        4200
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedCancelOrder')));
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleResolveWave = async (wave: TableWaveRecord) => {
    setProcessingWaveId(wave.id);
    setError(null);

    try {
      const response = await resolvePendingWave(wave.id);
      setWaves((current) => current.filter((item) => item.id !== wave.id));
      showToast(t('staffOrdersPage.waveHandled', { table: response.wave.table_reference }), 'secondary', 4200);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedResolveWave')));
    } finally {
      setProcessingWaveId(null);
    }
  };

  const handleMarkServed = async (order: KitchenOrderRecord) => {
    setProcessingServedOrderId(order.id);
    setError(null);

    try {
      if (!isOnline) {
        await queueWaiterAction({ type: 'mark_served', orderId: order.id });
        setReadyOrders((current) => current.filter((item) => item.id !== order.id));
        showToast(`Queued served update for ${order.order_number || `#${order.id}`}.`, 'tertiary', 3600);
        return;
      }
      const response = await markOrderServed(order.id);
      setReadyOrders((current) => current.filter((item) => item.id !== order.id));
      showToast(
        `Marked ${response.order.order_number || `#${response.order.id}`} as served.`,
        'secondary',
        3600
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to mark order as served.'));
    } finally {
      setProcessingServedOrderId(null);
    }
  };

  const handleResetSessionPin = async (session: ActiveTableSessionRecord) => {
    setProcessingSessionId(session.id);
    setError(null);

    try {
      const response = await resetActiveTableSessionPin(session.id);
      setTableSessions((current) => current.map((item) => (
        item.id === session.id
          ? { ...item, ...response.table_session, current_pin: response.current_pin, table: item.table }
          : item
      )));
      showToast(response.message, 'secondary', 4200);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedResetSessionPin')));
    } finally {
      setProcessingSessionId(null);
    }
  };

  const handleActivateTable = async (table: RestaurantTableSummary, options?: { openOrdering?: boolean }) => {
    setProcessingSessionId(table.id);
    setError(null);

    try {
      const response = await activateGuestTableSession(table.id);
      const nextSession: ActiveTableSessionRecord = {
        ...response.table_session,
        current_pin: response.current_pin,
        table: response.table ?? table,
      };

      setTableSessions((current) => {
        const existingIndex = current.findIndex((item) => item.id === nextSession.id);

        if (existingIndex >= 0) {
          return current.map((item) => (item.id === nextSession.id ? nextSession : item));
        }

        return [...current, nextSession].sort((left, right) => left.table_id - right.table_id);
      });

      showToast(
        response.message || t('staffOrdersPage.activatedTable', { table: table.name }),
        'secondary',
        4200
      );

      if (options?.openOrdering) {
        openStaffOrderComposer(nextSession.id);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedActivateTable')));
    } finally {
      setProcessingSessionId(null);
    }
  };

  const handleAddStaffOrderItem = () => {
    const selectedDish = publishedDishes.find((dish) => String(dish.id) === staffOrderDishId);
    const normalizedQuantity = staffOrderQuantity.trim() === '' ? '1' : staffOrderQuantity;
    const quantity = Number.parseInt(normalizedQuantity, 10);

    if (!selectedDish) {
      showToast(t('staffOrdersPage.selectDishFirst'), 'tertiary', 3200);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast(t('staffOrdersPage.invalidDishQuantity'), 'tertiary', 3200);
      return;
    }

    setStaffOrderItems((current) => {
      const existing = current.find((item) => item.dish_id === selectedDish.id);

      if (existing) {
        return current.map((item) => (
          item.dish_id === selectedDish.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        ));
      }

      return [
        ...current,
        {
          dish_id: selectedDish.id,
          dish_name: selectedDish.name,
          quantity,
          unit_price: Number(selectedDish.price),
        },
      ];
    });

    setStaffOrderDishId('');
    setStaffOrderQuantity('1');
  };

  const handleIncrementStaffOrderQuantity = () => {
    const currentValue = Number.parseInt(staffOrderQuantity || '0', 10);
    const safeValue = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : 0;
    setStaffOrderQuantity(String(Math.min(999, safeValue + 1)));
  };

  const handleDecrementStaffOrderQuantity = () => {
    const currentValue = Number.parseInt(staffOrderQuantity || '0', 10);
    const safeValue = Number.isFinite(currentValue) && currentValue > 1 ? currentValue : 1;
    setStaffOrderQuantity(String(Math.max(1, safeValue - 1)));
  };

  const handleRemoveStaffOrderItem = (dishId: number) => {
    setStaffOrderItems((current) => current.filter((item) => item.dish_id !== dishId));
  };

  const handleSubmitStaffOrder = async (session: ActiveTableSessionRecord) => {
    if (staffOrderItems.length === 0) {
      showToast(t('staffOrdersPage.addAtLeastOneDish'), 'tertiary', 3200);
      return;
    }

    if (!session.table_id || !session.current_pin) {
      setError(t('staffOrdersPage.missingSessionPin'));
      return;
    }

    setStaffOrderSubmitting(true);
    setError(null);

    try {
      const accessResponse = await verifyGuestTablePin(session.table_id, session.current_pin);
      const response = await createGuestTableSessionOrder(session.id, {
        items: staffOrderItems.map((item) => ({
          dish_id: item.dish_id,
          quantity: item.quantity,
        })),
      }, accessResponse.guest_access.token);

      setOrders((current) => [response.order, ...current]);
      resetStaffOrderComposer();
      setStaffOrderingSessionId(session.id);
      showToast(
        t('staffOrdersPage.createdStaffOrder', {
          order: getOrderLabel(response.order),
          table: response.order.table_reference,
        }),
        'secondary',
        4200
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedCreateStaffOrder')));
    } finally {
      setStaffOrderSubmitting(false);
    }
  };

  const handleFinalizeSession = async (session: ActiveTableSessionRecord) => {
    setProcessingSessionId(session.id);
    setError(null);

    try {
      if (user?.restaurant?.finalize_invoice_status_mode === 'paid') {
        throw new Error(t('staffOrdersPage.finalizeRequiresAccountingPaidMode'));
      }

      const response = await finalizeGuestTableSession(session.id);

      setTableSessions((current) => current.filter((item) => item.id !== session.id));
      showToast(response.message || t('staffOrdersPage.finalizedSession', { table: session.table_reference }), 'secondary', 4200);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('staffOrdersPage.failedFinalizeSession')));
    } finally {
      setProcessingSessionId(null);
    }
  };

  const handleOpenEditor = (order: OrderRecord) => {
    if (order.items.some((item) => item.dish_id === null)) {
      showToast(t('staffOrdersPage.legacyItemsOnly'), 'tertiary', 4200);
      return;
    }

    setEditingOrder(order);
    void loadPublishedMenu();
  };

  const handleShowTableUrl = (tableId: number | null | undefined, tableLabel: string) => {
    if (!tableId) {
      showToast('Table URL is unavailable for this table session.', 'tertiary', 3200);
      return;
    }

    setTableUrlPopup({
      label: tableLabel,
      url: `${window.location.origin}/menu/table/${tableId}`,
    });
  };

  const handleCopyTableUrl = async () => {
    if (!tableUrlPopup) return;

    try {
      await navigator.clipboard.writeText(tableUrlPopup.url);
      showToast('Table URL copied.', 'secondary', 2400);
    } catch {
      showToast('Failed to copy table URL.', 'tertiary', 3200);
    }
  };

  const handleSaveEditedOrder = async (payload: UpdatePendingOrderRequest) => {
    if (!editingOrder) {
      return;
    }

    setEditorBusyAction('save');
    setError(null);

    try {
      if (!isOnline) {
        await queueWaiterAction({ type: 'update_order', orderId: editingOrder.id, updatePayload: payload });
        setEditingOrder(null);
        showToast(`Queued changes for ${getOrderLabel(editingOrder)}.`, 'tertiary', 3600);
        return;
      }
      const response = await updatePendingOrder(editingOrder.id, payload);
      replaceOrder(response.order);
      setEditingOrder(null);
      showToast(response.message || t('staffOrdersPage.updatedOrder', { order: getOrderLabel(response.order) }), 'secondary', 4200);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, t('staffOrdersPage.failedSaveChanges')), 'tertiary', 4800);
    } finally {
      setEditorBusyAction(null);
    }
  };

  const handleSaveAndConfirmEditedOrder = async (payload: UpdatePendingOrderRequest) => {
    if (!editingOrder) {
      return;
    }

    setEditorBusyAction('saveConfirm');
    setError(null);

    try {
      if (!isOnline) {
        await queueWaiterAction({ type: 'update_and_confirm_order', orderId: editingOrder.id, updatePayload: payload });
        setOrders((current) => current.filter((item) => item.id !== editingOrder.id));
        setEditingOrder(null);
        showToast(`Queued save and confirm for ${getOrderLabel(editingOrder)}.`, 'tertiary', 3600);
        return;
      }
      const updateResponse = await updatePendingOrder(editingOrder.id, payload);
      replaceOrder(updateResponse.order);
      setEditingOrder(null);

      try {
        const confirmResponse = await confirmPendingOrder(updateResponse.order.id);
        setOrders((current) => current.filter((item) => item.id !== updateResponse.order.id));
        showToast(
          t('staffOrdersPage.savedAndConfirmed', { order: getOrderLabel(confirmResponse.order), table: confirmResponse.order.table_reference }),
          'secondary',
          4200
        );
      } catch (confirmError: unknown) {
        setError(getErrorMessage(confirmError, t('staffOrdersPage.failedConfirmAfterSave')));
        showToast(
          t('staffOrdersPage.savedButConfirmFailed', { order: getOrderLabel(updateResponse.order) }),
          'tertiary',
          5200
        );
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err, t('staffOrdersPage.failedSaveChanges')), 'tertiary', 4800);
    } finally {
      setEditorBusyAction(null);
    }
  };

  return (
    <DashboardLayout title={t('staffOrdersPage.title')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">
            {user?.role === 'staff' ? t('staffOrdersPage.headingStaff') : t('staffOrdersPage.headingAdmin')}
          </h2>
          <p className="mt-1 text-sm text-muted">{waveCountLabel} • {orderCountLabel}</p>
          <p className="text-xs text-muted">{readyOrderCountLabel}</p>
        </div>

        {!pushSubscribed ? (
          <div className="flex flex-wrap items-center gap-3">
            {notificationStatus !== 'unsupported' ? (
              <LiquidButton tone="secondary" onClick={handleEnableNotifications} disabled={pushBusy}>
                {pushBusy
                  ? t('staffOrdersPage.push.connecting')
                  : pushSubscribed
                    ? t('staffOrdersPage.push.reconnect')
                    : t('staffOrdersPage.push.enable')}
              </LiquidButton>
            ) : null}

            <LiquidButton tone="tertiary" onClick={loadOrders} disabled={loading}>
              {loading ? t('staffOrdersPage.refreshing') : t('staffOrdersPage.refresh')}
            </LiquidButton>
          </div>
        ) : null}
      </div>

      {!isOnline || pendingWaiterSyncCount > 0 ? (
        <div className="mb-4 rounded-xl2 border border-gold/30 bg-gold/10 p-3 text-sm text-text">
          {!isOnline
            ? `You are offline. Waiter actions will be queued locally. Pending sync: ${pendingWaiterSyncCount}.`
            : `You have ${pendingWaiterSyncCount} pending waiter action(s) waiting to sync.`}
          {isOnline && pendingWaiterSyncCount > 0 ? (
            <div className="mt-3">
              <LiquidButton
                tone="secondary"
                onClick={() => {
                  if (syncingWaiterQueue) {
                    return;
                  }
                  setSyncingWaiterQueue(true);
                  void getQueuedWaiterActions()
                    .then(async (rows) => {
                      let synced = 0;
                      let failed = 0;
                      for (const row of rows) {
                        if (!row.id || (row.status !== 'pending' && row.status !== 'failed')) {
                          continue;
                        }
                        const approved = window.confirm(`Sync waiter action #${row.id} (${row.type}) for order #${row.payload.orderId}?`);
                        if (!approved) {
                          continue;
                        }
                        const result = await syncQueuedWaiterAction(row.id);
                        if (result.synced) {
                          synced += 1;
                        } else {
                          failed += 1;
                        }
                      }
                      showToast(`Waiter sync complete: ${synced} synced, ${failed} failed.`, 'secondary', 4200);
                      void refreshStaffActivity({ silent: true });
                    })
                    .finally(() => {
                      setSyncingWaiterQueue(false);
                    });
                }}
                disabled={syncingWaiterQueue}
              >
                {syncingWaiterQueue ? 'Syncing...' : 'Sync now'}
              </LiquidButton>
            </div>
          ) : null}
        </div>
      ) : null}
      {queuedWaiterActions.length > 0 ? (
        <div className="mb-4 space-y-2 rounded-xl2 border border-gold/30 bg-gold/10 p-3 text-sm text-text">
          <p className="font-semibold">{t('staffOrdersExtra.queuedWaiterActions')}</p>
          {queuedWaiterActions.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/20 bg-black/5 px-2 py-2">
              <span>#{item.id}</span>
              <span>{item.type}</span>
              <span>{t('staffOrdersExtra.orderLabel', { id: item.orderId })}</span>
              <span>({item.status})</span>
              <button
                type="button"
                className="rounded-full border px-2 py-1 text-xs"
                onClick={() => {
                  if (item.type !== 'update_order' && item.type !== 'update_and_confirm_order') {
                    return;
                  }
                  const current = item.updatePayload ? JSON.stringify(item.updatePayload) : '{"items":[]}';
                  const nextRaw = window.prompt('Edit queued payload JSON', current);
                  if (!nextRaw) return;
                  try {
                    const parsed = JSON.parse(nextRaw) as UpdatePendingOrderRequest;
                    void updateQueuedWaiterAction(item.id, {
                      payload: {
                        orderId: item.orderId,
                        updatePayload: parsed,
                      },
                    });
                    emitOfflineQueueUpdated();
                  } catch {
                    showToast('Invalid JSON payload.', 'tertiary', 3000);
                  }
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-full border px-2 py-1 text-xs"
                onClick={() => {
                  void removeQueuedWaiterAction(item.id);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border px-2 py-1 text-xs"
                onClick={() => {
                  if (!navigator.onLine) return;
                  void syncQueuedWaiterAction(item.id);
                }}
              >
                Confirm this action
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {notificationStatus === 'default' ? (
        <div className="mb-4 rounded-xl2 border border-gold/30 bg-gold/10 p-3 text-sm text-text">
          {t('staffOrdersPage.push.enableHint')}
        </div>
      ) : null}

      {mobilePollingEnabled ? (
        <div className="mb-4 rounded-xl2 border border-white/10 bg-white/[0.03] p-3 text-sm text-muted">
          {t('staffOrdersPage.mobileFallbackActive')}
        </div>
      ) : null}

      {requiresHomeScreenInstall ? (
        <div className="mb-4 rounded-xl2 border border-gold/30 bg-gold/10 p-3 text-sm text-text">
          {t('staffOrdersPage.push.homeScreenInstallHint')}
        </div>
      ) : null}

      {isIosLike && isStandalone && notificationStatus === 'granted' && !pushSubscribed ? (
        <div className="mb-4 rounded-xl2 border border-gold/30 bg-gold/10 p-3 text-sm text-text">
          {t('staffOrdersPage.push.iosNotSubscribed')}
        </div>
      ) : null}

      {notificationStatus === 'denied' ? (
        <div className="mb-4 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {t('staffOrdersPage.push.blockedSite')}
        </div>
      ) : null}

      {notificationStatus === 'unsupported' ? (
        <div className="mb-4 rounded-xl2 border border-white/10 bg-white/[0.03] p-3 text-sm text-muted">
          {t('staffOrdersPage.push.unsupported')}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3 text-sm text-spicy">
          {error}
        </div>
      ) : null}

      {user?.role === 'admin' && lowStockIngredients.length > 0 ? (
        <div className="mb-4 rounded-xl2 border border-spicy/40 bg-spicy/12 p-3">
          <p className="text-sm font-semibold text-spicy">
            {t('staffOrdersPage.lowStockAlertTitle', { count: lowStockIngredients.length })}
          </p>
          <p className="mt-1 text-sm text-spicy/90">
            {t('staffOrdersPage.lowStockAlertHint')}
          </p>
          <p className="mt-2 text-sm text-spicy/90">
            {lowStockIngredients
              .slice(0, 5)
              .map((ingredient) => `${getIngredientDisplayName(ingredient, i18n.resolvedLanguage)} (${ingredient.current_quantity} ${ingredient.unit})`)
              .join(' • ')}
          </p>
        </div>
      ) : null}

      {!loading && inactiveTables.length > 0 ? (
        <div className="mb-6">
          <GlassCard className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.activateTables')}</p>
                <h3 className="mt-2 text-2xl font-semibold text-text">{t('staffOrdersPage.readyToActivate', { count: inactiveTables.length })}</h3>
                <p className="mt-2 text-sm text-muted">{t('staffOrdersPage.activateTablesHint')}</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {inactiveTables.map((table) => (
                <div key={table.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.tableReady')}</p>
                    <h4 className="mt-2 text-xl font-semibold text-text">{table.name}</h4>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[190px]">
                    <LiquidButton
                      tone="primary"
                      onClick={() => handleActivateTable(table, { openOrdering: true })}
                      disabled={processingSessionId === table.id}
                      className="w-full"
                    >
                      {processingSessionId === table.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.activateAndOrder')}
                    </LiquidButton>
                    <LiquidButton
                      tone="secondary"
                      onClick={() => handleActivateTable(table)}
                      disabled={processingSessionId === table.id}
                      className="w-full"
                    >
                      {processingSessionId === table.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.activateTable')}
                    </LiquidButton>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {!loading && tableSessions.length > 0 ? (
        <div className="mb-6">
          <GlassCard className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.tablePins')}</p>
                <h3 className="mt-2 text-2xl font-semibold text-text">{activeTableSessionCountLabel}</h3>
                <p className="mt-2 text-sm text-muted">{t('staffOrdersPage.tablePinsHint')}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {tableSessions.map((session) => (
                <div
                  key={session.id}
                  id={`staff-table-session-${session.id}`}
                  className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.tableSessionCard')}</p>
                      <h4 className="mt-2 text-xl font-semibold text-text">{session.table_reference}</h4>
                      <p className="mt-2 text-sm text-muted">
                        {session.last_activity_at
                          ? t('staffOrdersPage.lastActivityAt', { time: new Date(session.last_activity_at).toLocaleString() })
                          : t('staffOrdersPage.waitingForGuests')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.currentPin')}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-[0.26em] text-text">
                        {session.current_pin || t('staffOrdersPage.pinUnavailable')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <LiquidButton
                      tone="primary"
                      onClick={() => openStaffOrderComposer(session.id)}
                      className="w-full"
                    >
                      {t('staffOrdersPage.takeOrder')}
                    </LiquidButton>
                    <LiquidButton
                      tone="secondary"
                      onClick={() => handleResetSessionPin(session)}
                      disabled={processingSessionId === session.id}
                      className="w-full"
                    >
                      {processingSessionId === session.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.resetPin')}
                    </LiquidButton>
                    <LiquidButton
                      tone="tertiary"
                      onClick={() => handleFinalizeSession(session)}
                      disabled={processingSessionId === session.id}
                      className="w-full"
                    >
                      {processingSessionId === session.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.finalizeSession')}
                    </LiquidButton>
                    <LiquidButton
                      tone="primary"
                      onClick={() => handleShowTableUrl(session.table?.id, session.table_reference)}
                      className="w-full"
                    >
                      🔗 Table URL
                    </LiquidButton>
                  </div>

                  {staffOrderingSessionId === session.id ? (
                    <div className="mt-4 rounded-[22px] border border-gold/20 bg-gold/8 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.quickOrder')}</p>
                          <h5 className="mt-2 text-lg font-semibold text-text">{t('staffOrdersPage.quickOrderTitle', { table: session.table_reference })}</h5>
                          <p className="mt-1 text-sm text-muted">{t('staffOrdersPage.quickOrderHint')}</p>
                        </div>
                        {session.current_pin ? (
                          <div className="rounded-2xl border border-gold/20 bg-white/[0.04] px-4 py-3 text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.currentPin')}</p>
                            <p className="mt-2 text-2xl font-semibold tracking-[0.26em] text-text">{session.current_pin}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)]">
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.chooseDish')}</p>
                          <GlassSearchSelect
                            value={staffOrderDishId}
                            options={publishedDishOptions}
                            onChange={setStaffOrderDishId}
                            placeholder={t('staffOrdersPage.chooseDishPlaceholder')}
                            searchPlaceholder={t('staffOrdersPage.searchDishPlaceholder')}
                            emptyText={t('staffOrdersPage.noMatchingDishes')}
                            disabled={publishedDishesLoading || staffOrderSubmitting}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,160px)_auto_auto]">
                        <div className="flex items-end">
                          <LiquidButton
                            type="button"
                            tone="tertiary"
                            onClick={handleDecrementStaffOrderQuantity}
                            disabled={staffOrderSubmitting}
                            className="min-w-[56px]"
                          >
                            -
                          </LiquidButton>
                        </div>

                        <div>
                          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.quantity')}</p>
                          <GlassInput
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={staffOrderQuantity}
                            onChange={(event) => setStaffOrderQuantity(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                            onBlur={() => {
                              if (staffOrderQuantity.trim() === '') {
                                setStaffOrderQuantity('1');
                                return;
                              }
                              const nextValue = Number.parseInt(staffOrderQuantity, 10);
                              setStaffOrderQuantity(String(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1));
                            }}
                            disabled={staffOrderSubmitting}
                            className="text-center"
                          />
                        </div>

                        <div className="flex items-end">
                          <LiquidButton
                            type="button"
                            tone="tertiary"
                            onClick={handleIncrementStaffOrderQuantity}
                            disabled={staffOrderSubmitting}
                            className="min-w-[56px]"
                          >
                            +
                          </LiquidButton>
                        </div>

                        <div className="flex items-end">
                          <LiquidButton
                            type="button"
                            tone="secondary"
                            onClick={handleAddStaffOrderItem}
                            disabled={publishedDishesLoading || staffOrderSubmitting}
                            className="w-full lg:min-w-[150px]"
                          >
                            {t('staffOrdersPage.addDish')}
                          </LiquidButton>
                        </div>
                      </div>

                      {publishedDishesError ? (
                        <div className="mt-3 rounded-xl border border-spicy/30 bg-spicy/10 px-3 py-2 text-sm text-spicy">
                          {publishedDishesError}
                        </div>
                      ) : null}

                      {staffOrderItems.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {staffOrderItems.map((item) => (
                            <div key={item.dish_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                              <div>
                                <p className="font-medium text-text">{item.dish_name}</p>
                                <p className="text-sm text-muted">{t('staffOrdersPage.dishQuantitySummary', { quantity: item.quantity })}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveStaffOrderItem(item.dish_id)}
                                className="inline-flex items-center justify-center rounded-full border border-spicy/35 bg-spicy/12 px-4 py-2 text-xs font-semibold text-spicy transition hover:bg-spicy/18"
                                disabled={staffOrderSubmitting}
                              >
                                {t('staffOrdersPage.removeDish')}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-muted">
                          {t('staffOrdersPage.noDraftItems')}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap justify-end gap-3">
                        <LiquidButton
                          type="button"
                          tone="tertiary"
                          onClick={resetStaffOrderComposer}
                          disabled={staffOrderSubmitting}
                        >
                          {t('staffOrdersPage.clearDraft')}
                        </LiquidButton>
                        <LiquidButton
                          type="button"
                          tone="primary"
                          onClick={() => handleSubmitStaffOrder(session)}
                          disabled={staffOrderSubmitting || staffOrderItems.length === 0}
                        >
                          {staffOrderSubmitting ? t('staffOrdersPage.processing') : t('staffOrdersPage.submitOrder')}
                        </LiquidButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {loading ? (
        <PageSkeleton rows={5} columns={1} className="py-2" loadingText={t('staffOrdersPage.loadingActivity')} />
      ) : null}

      {!loading && waves.length === 0 && orders.length === 0 && readyOrders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-5xl">👋</div>
          <h3 className="mb-2 text-xl font-medium text-text">{t('staffOrdersPage.noPendingActivity')}</h3>
          <p className="text-muted">{t('staffOrdersPage.noPendingActivityHint')}</p>
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-4">
          {waves.map((wave) => (
            <GlassCard key={`wave-${wave.id}`} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{getWaveTitle(wave)}</p>
                  <h3 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-text">
                    <span aria-hidden="true">{isBillRequest(wave) ? '🧾' : '👋'}</span>
                    <span>{t('invoice.tableTitle', { table: wave.table_reference })}</span>
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    {getWaveDescription(wave)}
                    {wave.created_at ? ` • ${new Date(wave.created_at).toLocaleString()}` : ''}
                  </p>
                </div>

                <div className="w-full rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{getWaveBadgeLabel(wave)}</p>
                  <p className="mt-2 text-lg font-semibold text-text">{wave.table_reference}</p>
                </div>
              </div>

              <div className="mt-2 flex w-full flex-wrap gap-3">
                <LiquidButton
                  className="w-full"
                  tone="primary"
                  onClick={() => handleResolveWave(wave)}
                  disabled={processingWaveId === wave.id}
                >
                  {processingWaveId === wave.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.markHandled')}
                </LiquidButton>
              </div>
            </GlassCard>
          ))}

          {readyOrders.map((order) => (
            <GlassCard key={`ready-${order.id}`} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersExtra.readyToServe')}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-text">
                    {order.order_number || `Order #${order.id}`}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    Table {order.table_reference}
                    {order.kitchen_ready_at ? ` • Ready at ${new Date(order.kitchen_ready_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersExtra.total')}</p>
                  <p className="mt-2 text-2xl font-semibold text-text">${order.invoice.total}</p>
                </div>
              </div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[16px] border border-white/10 bg-black/10 px-3 py-2 text-sm">
                    <span className="text-text">{item.quantity} × {item.dish_name}</span>
                    <span className="text-gold2">${item.line_subtotal}</span>
                  </div>
                ))}
              </div>
              <LiquidButton
                tone="primary"
                onClick={() => void handleMarkServed(order)}
                disabled={processingServedOrderId === order.id}
                className="w-full"
              >
                {processingServedOrderId === order.id ? t('staffOrdersPage.processing') : 'Mark Served'}
              </LiquidButton>
            </GlassCard>
          ))}

          {orders.map((order) => (
            <GlassCard key={order.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('staffOrdersPage.pendingStaffReview')}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-text">
                    {getOrderLabel(order)}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    {t('invoice.tableTitle', { table: order.table_reference })}
                    {order.created_at ? ` • ${new Date(order.created_at).toLocaleString()}` : ''}
                  </p>
                  {order.notes ? (
                    <p className="mt-3 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
                      {order.notes}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold2/85">{t('common.currentSubtotal')}</p>
                  <p className="mt-2 text-2xl font-semibold text-text">${order.invoice.subtotal}</p>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-text">{t('staffOrdersPage.items')}</p>
                <div className="mt-3 space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-black/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{item.dish_name}</p>
                        <p className="text-sm text-muted">
                          {item.quantity} × ${item.unit_price}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-gold2">${item.line_subtotal}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <LiquidButton
                  tone="secondary"
                  onClick={() => handleOpenEditor(order)}
                  disabled={processingOrderId === order.id || order.items.some((item) => item.dish_id === null)}
                  className="w-full"
                >
                  {t('staffOrdersPage.editOrder')}
                </LiquidButton>
                <LiquidButton
                  tone="tertiary"
                  onClick={() => handleCancel(order)}
                  disabled={processingOrderId === order.id}
                  className="w-full"
                >
                  {processingOrderId === order.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.cancelRequest')}
                </LiquidButton>
                <LiquidButton
                  tone="primary"
                  onClick={() => handleConfirm(order)}
                  disabled={processingOrderId === order.id}
                  className="w-full"
                >
                  {processingOrderId === order.id ? t('staffOrdersPage.processing') : t('staffOrdersPage.confirmRequest')}
                </LiquidButton>
              </div>

              {order.items.some((item) => item.dish_id === null) ? (
                <p className="text-sm text-muted">
                  {t('staffOrdersPage.legacyItemsOnly')}
                </p>
              ) : null}
            </GlassCard>
          ))}
        </div>
      ) : null}

      <StaffOrderEditor
        key={editingOrder ? String(editingOrder.id) : 'no-order'}
        order={editingOrder}
        dishes={publishedDishes}
        dishesLoading={publishedDishesLoading}
        dishesError={publishedDishesError}
        busyAction={editorBusyAction}
        onClose={() => setEditingOrder(null)}
        onSave={handleSaveEditedOrder}
        onSaveAndConfirm={handleSaveAndConfirmEditedOrder}
      />

      {tableUrlPopup && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[2147483647] overflow-y-auto bg-black/55 p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-lg rounded-2xl border border-modalStroke bg-modalSurface p-5">
            <h3 className="text-lg font-semibold text-text">{t('staffOrdersExtra.guestTableUrl')}</h3>
            <p className="mt-1 text-sm text-muted">{tableUrlPopup.label}</p>
            <div className="mt-4 break-all rounded-xl border border-modalStroke bg-modalRow p-3 text-sm text-text">
              {tableUrlPopup.url}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <LiquidButton tone="secondary" onClick={() => void handleCopyTableUrl()}>
                Copy URL
              </LiquidButton>
              <a
                href={tableUrlPopup.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-gold/35 bg-gold/15 px-4 py-2 text-sm font-medium text-gold2"
              >
                Open URL
              </a>
              <LiquidButton tone="tertiary" onClick={() => setTableUrlPopup(null)}>
                Close
              </LiquidButton>
            </div>
            </div>
          </div>
        </div>
      , document.body) : null}

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default StaffOrdersPage;
