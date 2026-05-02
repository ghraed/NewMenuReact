import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GlassToast, useGlassToast } from '../ui/liquid-glass';
import { useOrderCart } from '../../contexts/useOrderCart';
import { callGuestTableWaiter, requestGuestTableBill } from '../../services/orderService';
import { savePrintableInvoice } from '../../utils/printableInvoice';
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
  const { totalItems, subtotal, draft, clearGuestAccess, setGuestContext, updateDraft } = useOrderCart();
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
  }, {
    enabled: Boolean(activeTableId),
    ttlMs: 10_000,
  });

  const actionWrapperClassName = useMemo(() => (
    hasCartShortcut
      ? 'pointer-events-none fixed inset-x-4 bottom-20 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-24 sm:justify-end'
      : 'pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end'
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
  }, [activeTableId, draft.guestAccessVerified, guestMenuResource.data?.protected_actions]);

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
        savePrintableInvoice({
          sourceTableId: activeTableId,
          restaurantName: response.invoice_preview.restaurant_name,
          tableName: response.invoice_preview.table_name,
          generatedAt: new Date(response.invoice_preview.generated_at).toLocaleString(),
          notes: response.invoice_preview.notes,
          items: response.invoice_preview.items.map((item) => ({
            key: item.key,
            dishName: item.dish_name,
            dishNameArabic: item.dish_name_ar || undefined,
            quantity: item.quantity,
            unitPrice: `$${item.unit_price}`,
            lineSubtotal: `$${item.line_subtotal}`,
          })),
          includedOrders: response.invoice_preview.included_orders,
          summary: {
            subtotal: `$${response.invoice_preview.summary.subtotal}`,
            discountLabel: t('accountingPage.discount'),
            discountAmount: `$${response.invoice_preview.summary.discount_amount}`,
            taxableSubtotal: `$${response.invoice_preview.summary.taxable_subtotal}`,
            vatLabel: t('accountingPage.vatWithValue', { value: response.invoice_preview.summary.vat_rate }),
            vatAmount: `$${response.invoice_preview.summary.vat_amount}`,
            total: `$${response.invoice_preview.summary.total}`,
          },
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
              'w-[min(88vw,320px)] overflow-hidden rounded-2xl border transition-all duration-300 ease-out sm:w-72',
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
            <div className="space-y-2 p-3">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event('guest-chatbot:open'));
                  setIsActionsOpen(false);
                }}
                className="inline-flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition duration-200 hover:translate-x-0.5"
                style={{
                  backgroundColor: 'rgb(255 255 255 / 62%)',
                  borderColor: 'var(--guest-border)',
                  color: 'var(--guest-text)',
                }}
              >
                <span>Bootchat</span>
                <span aria-hidden="true">💬</span>
              </button>

              {canRequestBill ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleProtectedAction('bill');
                    setIsActionsOpen(false);
                  }}
                  disabled={activeAction !== null}
                  className="inline-flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition duration-200 hover:translate-x-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundColor: 'rgb(255 255 255 / 62%)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                >
                  <span>{activeAction === 'bill' ? t('guestAccess.requestingBill') : t('guestAccess.requestBill')}</span>
                  <span aria-hidden="true">🧾</span>
                </button>
              ) : null}

              {hasCartShortcut ? (
                <button
                  type="button"
                  onClick={() => {
                    navigate(buildGuestOrderReviewPath(activeTableId));
                    setIsActionsOpen(false);
                  }}
                  className="inline-flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition duration-200 hover:translate-x-0.5"
                  style={{
                    backgroundColor: 'rgb(255 255 255 / 62%)',
                    borderColor: 'var(--guest-border)',
                    color: 'var(--guest-text)',
                  }}
                >
                  <span>{t('cart.itemsInCart', { count: totalItems })}</span>
                  <span>${subtotal.toFixed(2)}</span>
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsActionsOpen((open) => !open)}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full border text-2xl font-semibold transition duration-300 hover:-translate-y-0.5 hover:scale-105"
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
          </button>
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </>
  );
};

export default GuestWaveButton;
