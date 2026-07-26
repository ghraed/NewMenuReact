import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GlassToast, useGlassToast } from '../ui/liquid-glass';
import { useOrderCart } from '../../contexts/useOrderCart';
import { callGuestTableWaiter, requestGuestTableBill } from '../../services/orderService';
import { savePrintableInvoice } from '../../utils/printableInvoice';
import { readBillAdjustmentsForTableInvoice } from '../../utils/billAdjustments';
import {
  buildPrintableInvoiceItemsFromPreview,
  buildPrintableInvoiceSplitFromPreview,
  buildPrintableInvoiceSummaryFromPreview,
} from '../../utils/invoicePreviewCompensation';
import { useGuestMenuResource } from '../../contexts/GuestMenuResourceContext';
import { buildGuestOrderReviewPath } from '../../utils/guestTableRoutes';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

const GuestWaveButton: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ table_id?: string }>();
  const { t } = useTranslation();
  const { totalItems, draft, clearGuestAccess, setGuestContext, updateDraft } = useOrderCart();
  const { toast, showToast, dismiss } = useGlassToast(3200);
  const [activeAction, setActiveAction] = useState<'waiter' | 'bill' | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [canCallWaiter, setCanCallWaiter] = useState(false);
  const [canRequestBill, setCanRequestBill] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const routeTableId = params.table_id ? Number(params.table_id) : null;
  const activeTableId = draft.tableId ?? routeTableId;
  const hasCartShortcut = totalItems > 0 && !location.pathname.endsWith('/review') && location.pathname !== '/order/review';
  const guestMenuResource = useGuestMenuResource({
    tableId: activeTableId,
    guestAccessToken: draft.guestAccessToken,
    includeDishes: 'none',
  }, {
    enabled: Boolean(activeTableId),
    ttlMs: 10_000,
  });
  const guestMenuResourceKey = guestMenuResource.key;

  const actionWrapperClassName = useMemo(() => (
    hasCartShortcut
      ? 'pointer-events-none fixed bottom-20 right-2 z-40 sm:bottom-24 sm:right-3'
      : 'pointer-events-none fixed bottom-4 right-2 z-40 sm:bottom-6 sm:right-3'
  ), [hasCartShortcut]);

  const waveWrapperClassName = useMemo(() => (
    hasCartShortcut
      ? 'pointer-events-none fixed bottom-20 left-4 z-40 sm:bottom-24 sm:left-6'
      : 'pointer-events-none fixed bottom-4 left-4 z-40 sm:bottom-6 sm:left-6'
  ), [hasCartShortcut]);

  const ensureSessionId = async (): Promise<number | null> => {
    if (guestMenuResource.data?.table_session?.id) {
      return guestMenuResource.data.table_session.id;
    }

    if (!activeTableId || Number.isNaN(activeTableId)) {
      return null;
    }

    const refreshed = await guestMenuResource.refresh();
    const data = refreshed.data;

    if (!data?.table || !data?.table_session) {
      if (data?.table) {
        updateDraft({
          tableId: data.table.number,
          tableReference: data.table.name,
          tableSessionId: null,
        });
      }
      clearGuestAccess();
      return null;
    }

    if (data.guest_access) {
      setGuestContext({
        restaurant: data.restaurant,
        tableId: data.table.number,
        tableReference: data.table.name,
        tableSessionId: data.table_session.id,
        guestAccess: data.guest_access,
      });
    }

    return data.table_session.id;
  };

  useEffect(() => {
    let cancelled = false;

    if (!activeTableId || Number.isNaN(activeTableId) || !draft.guestAccessVerified) {
      setCanCallWaiter(false);
      setCanRequestBill(false);
      setPermissionsLoaded(false);
      return;
    }

    if (guestMenuResource.data?.protected_actions) {
      setCanCallWaiter(guestMenuResource.data.protected_actions.can_call_waiter === true);
      setCanRequestBill(guestMenuResource.data.protected_actions.can_request_bill === true);
      setPermissionsLoaded(true);
      return;
    }

    void guestMenuResource.ensure()
      .then((entry) => {
        if (cancelled) return;
        setCanCallWaiter(entry.data?.protected_actions?.can_call_waiter === true);
        setCanRequestBill(entry.data?.protected_actions?.can_request_bill === true);
        setPermissionsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCanCallWaiter(false);
        setCanRequestBill(false);
        setPermissionsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTableId, draft.guestAccessVerified, guestMenuResourceKey, guestMenuResource.data?.protected_actions]);

  const handleProtectedAction = async (action: 'waiter' | 'bill') => {
    if ((action === 'waiter' && !canCallWaiter) || (action === 'bill' && !canRequestBill)) {
      return;
    }

    setActiveAction(action);

    try {
      const sessionId = await ensureSessionId();

      if (!sessionId || !draft.guestAccessToken) {
        throw new Error(t('wave.validationMissingSession'));
      }

      if (action === 'waiter') {
        const response = await callGuestTableWaiter(sessionId, draft.guestAccessToken);
        showToast(response.message || t('wave.success'), 'primary', 3200);
        return;
      }

      const response = await requestGuestTableBill(sessionId, draft.guestAccessToken);

      if (response.invoice_preview && activeTableId) {
        const adjustments = readBillAdjustmentsForTableInvoice(
          response.invoice_preview.table_name,
          response.invoice_preview.included_orders
        );
        const printableItems = buildPrintableInvoiceItemsFromPreview(response.invoice_preview.items, adjustments);
        const printableSummary = buildPrintableInvoiceSummaryFromPreview(printableItems, response.invoice_preview.summary, t);

        savePrintableInvoice({
          sourceTableId: activeTableId,
          restaurantName: response.invoice_preview.restaurant_name,
          tableName: response.invoice_preview.table_name,
          generatedAt: new Date(response.invoice_preview.generated_at).toLocaleString(),
          generatedAtIso: response.invoice_preview.generated_at,
          notes: response.invoice_preview.notes,
          items: printableItems,
          includedOrders: response.invoice_preview.included_orders,
          summary: printableSummary,
          split: buildPrintableInvoiceSplitFromPreview(response.invoice_preview.invoice_split),
        });

        navigate(`/menu/table/${activeTableId}/invoice`);
      }

      showToast(response.message || t('wave.success'), 'primary', 3200);
    } catch (error: unknown) {
      const status = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;

      if (status && [401, 403, 404, 409, 423].includes(status)) {
        clearGuestAccess();
      }

      showToast(getErrorMessage(error, t('wave.failedSend')), 'secondary', 4200);
    } finally {
      setActiveAction(null);
    }
  };

  if (!activeTableId || !draft.guestAccessVerified || !permissionsLoaded || (!canCallWaiter && !canRequestBill)) {
    return null;
  }

  return (
    <>
      {canCallWaiter ? (
        <div className={waveWrapperClassName}>
          <button
            type="button"
            onClick={() => handleProtectedAction('waiter')}
            disabled={activeAction !== null}
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border text-lg transition duration-300 hover:-translate-y-0.5 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: 'rgb(212 175 55 / 85%)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
            aria-label={activeAction === 'waiter' ? t('wave.buttonSending') : t('wave.buttonIdle')}
          >
            <span aria-hidden="true" className="leading-none">👋</span>
          </button>
        </div>
      ) : null}

      <div className={actionWrapperClassName}>
        <div className="pointer-events-auto flex flex-col items-center gap-2 sm:items-end">
          <div
            className={[
              'relative z-20 overflow-hidden rounded-2xl border transition-all duration-300 ease-out',
              isActionsOpen ? 'max-h-72 opacity-100 translate-y-0' : 'max-h-0 opacity-0 translate-y-2 pointer-events-none',
            ].join(' ')}
            style={{
              backgroundColor: 'rgb(255 255 255 / 38%)',
              borderColor: 'rgb(255 255 255 / 30%)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <div className="flex flex-col items-center gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new Event('guest-chatbot:open'));
                    setIsActionsOpen(false);
                  }}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl border transition duration-200 hover:-translate-y-0.5"
                  style={{
                    backgroundColor: 'rgb(255 255 255 / 62%)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                  aria-label="Open BootChat"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-7 5 2.8-2.2c.3-.2.7-.3 1-.3H18a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H6A3 3 0 0 0 3 7v6a3 3 0 0 0 3 3v3Z" />
                  </svg>
                </button>

                {canRequestBill ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleProtectedAction('bill');
                      setIsActionsOpen(false);
                    }}
                    disabled={activeAction !== null}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      backgroundColor: 'rgb(255 255 255 / 62%)',
                      borderColor: 'var(--guest-border)',
                      color: 'var(--guest-text)',
                    }}
                    aria-label={activeAction === 'bill' ? t('guestAccess.requestingBill') : t('guestAccess.requestBill')}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10v18l-2.25-1.6L12 21l-2.75-1.6L7 21V3Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6M9 12h6M9 16h4" />
                    </svg>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (hasCartShortcut) {
                      navigate(buildGuestOrderReviewPath(activeTableId));
                    }
                    setIsActionsOpen(false);
                  }}
                  disabled={!hasCartShortcut}
                  className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundColor: 'rgb(255 255 255 / 62%)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                  aria-label={t('cart.itemsInCart', { count: totalItems })}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H7" />
                    <circle cx="10" cy="19" r="1.4" />
                    <circle cx="17" cy="19" r="1.4" />
                  </svg>
                  {totalItems > 0 ? (
                    <span
                      className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                      style={{ backgroundColor: 'var(--guest-accent)', color: 'var(--guest-accent-button-text)' }}
                    >
                      {totalItems > 99 ? '99+' : totalItems}
                    </span>
                  ) : null}
                </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsActionsOpen((open) => !open)}
            className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border text-2xl font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-105"
            style={{
              backgroundColor: 'rgb(15 23 42 / 92%)',
              borderColor: 'rgb(255 255 255 / 30%)',
              color: '#fff',
              boxShadow: 'var(--guest-shadow)',
            }}
            aria-label={isActionsOpen ? 'Close quick actions' : 'Open quick actions'}
          >
            <span
              className="inline-block transition-transform duration-300"
              style={{ transform: isActionsOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
            >
              +
            </span>
            {totalItems > 0 ? (
              <span
                className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ backgroundColor: 'var(--guest-accent)', color: 'var(--guest-accent-button-text)' }}
              >
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </>
  );
};

export default GuestWaveButton;
