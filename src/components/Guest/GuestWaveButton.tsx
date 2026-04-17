import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GlassToast, useGlassToast } from '../ui/liquid-glass';
import { useOrderCart } from '../../contexts/useOrderCart';
import { callGuestTableWaiter, fetchGuestTableMenu, requestGuestTableBill } from '../../services/orderService';
import { savePrintableInvoice } from '../../utils/printableInvoice';

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
  const { totalItems, draft, clearGuestAccess, setGuestContext } = useOrderCart();
  const { toast, showToast, dismiss } = useGlassToast(3200);
  const [activeAction, setActiveAction] = useState<'waiter' | 'bill' | null>(null);

  const routeTableId = params.table_id ? Number(params.table_id) : null;
  const activeTableId = draft.tableId ?? routeTableId;
  const hasCartShortcut = totalItems > 0 && !location.pathname.endsWith('/review') && location.pathname !== '/order/review';

  const wrapperClassName = useMemo(() => (
    hasCartShortcut
      ? 'pointer-events-none fixed inset-x-4 bottom-20 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-24 sm:justify-end'
      : 'pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end'
  ), [hasCartShortcut]);

  const ensureSessionId = async (): Promise<number | null> => {
    if (draft.tableSessionId) {
      return draft.tableSessionId;
    }

    if (!activeTableId || Number.isNaN(activeTableId)) {
      return null;
    }

    const response = await fetchGuestTableMenu(activeTableId, draft.guestAccessToken);
    setGuestContext({
      restaurant: response.restaurant,
      tableId: response.table.number,
      tableReference: response.table.name,
      tableSessionId: response.table_session.id,
      guestAccess: response.guest_access,
    });

    return response.table_session.id;
  };

  const handleProtectedAction = async (action: 'waiter' | 'bill') => {
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

  if (!activeTableId || !draft.guestAccessVerified) {
    return null;
  }

  return (
    <>
      <div className={wrapperClassName}>
        <div className="pointer-events-auto flex flex-col items-center gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => handleProtectedAction('waiter')}
            disabled={activeAction !== null}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: 'rgb(212 175 55 / 80%)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <span aria-hidden="true" className="text-base leading-none">👋</span>
            <span>{activeAction === 'waiter' ? t('wave.buttonSending') : t('wave.buttonIdle')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleProtectedAction('bill')}
            disabled={activeAction !== null}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            <span>{activeAction === 'bill' ? t('guestAccess.requestingBill') : t('guestAccess.requestBill')}</span>
          </button>
        </div>
      </div>

      <GlassToast toast={toast} onClose={dismiss} />
    </>
  );
};

export default GuestWaveButton;
