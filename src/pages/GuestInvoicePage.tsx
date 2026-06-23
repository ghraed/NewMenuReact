import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import InvoiceTemplate from '../components/Invoice/InvoiceTemplate';
import { loadPrintableInvoice, savePrintableInvoice, type PrintableInvoicePayload } from '../utils/printableInvoice';
import { buildGuestOrdersPath } from '../utils/guestTableRoutes';
import { useOrderCart } from '../contexts/useOrderCart';
import { fetchGuestTableSessionInvoiceSplit, fetchGuestTableSessionOrders } from '../services/orderService';
import { useGuestMenuResource } from '../contexts/GuestMenuResourceContext';
import { buildGuestInvoicePayload } from '../utils/guestInvoicePayload';
import { readBillAdjustmentsForTableInvoice } from '../utils/billAdjustments';
import { applyBillAdjustmentsToOrders } from '../utils/guestOrderCompensation';

const GuestInvoicePage: React.FC = () => {
  const { t } = useTranslation();
  const { table_id } = useParams<{ table_id?: string }>();
  const { restaurant, draft, clearGuestAccess, setGuestContext, updateDraft } = useOrderCart();
  const cachedInvoice = useMemo(() => loadPrintableInvoice(), []);
  const [invoice, setInvoice] = useState<PrintableInvoicePayload | null>(cachedInvoice);
  const [loading, setLoading] = useState(Boolean(draft.tableSessionId && draft.guestAccessToken));

  const activeTableId = draft.tableId ?? (table_id ? Number(table_id) : null);
  const guestMenuResource = useGuestMenuResource({
    tableId: activeTableId,
    guestAccessToken: draft.guestAccessToken,
    includeDishes: 'none',
  }, {
    enabled: Boolean(activeTableId),
    ttlMs: 10_000,
  });
  const guestMenuResourceKey = guestMenuResource.key;

  useEffect(() => {
    if (!activeTableId || !draft.guestAccessToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadLiveInvoice = async () => {
      setLoading(true);

      try {
        const entry = await guestMenuResource.ensure();
        const data = entry.data;

        if (!data?.table || !data.table_session) {
          if (data?.table) {
            updateDraft({
              tableId: data.table.number,
              tableReference: data.table.name,
              tableSessionId: null,
            });
          }
          clearGuestAccess();
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        setGuestContext({
          restaurant: data.restaurant,
          tableId: data.table.number,
          tableReference: data.table.name,
          tableSessionId: data.table_session.id,
          guestAccess: data.guest_access ?? undefined,
        });

        const orders = await fetchGuestTableSessionOrders(data.table_session.id, draft.guestAccessToken);
        const adjustments = readBillAdjustmentsForTableInvoice(
          data.table.name,
          orders.map((order) => order.order_number || String(order.id))
        );
        const adjustedOrders = applyBillAdjustmentsToOrders(orders, adjustments);
        const splitEnabled = data.restaurant.feature_flags?.invoice_splitting === true;
        const split = splitEnabled
          ? await fetchGuestTableSessionInvoiceSplit(data.table_session.id, draft.guestAccessToken)
          : null;

        const nextInvoice = buildGuestInvoicePayload({
          sourceTableId: activeTableId,
          restaurantName: data.restaurant.name || restaurant?.name || t('guestOrders.title'),
          tableName: data.table.name,
          generatedAt: new Date().toLocaleString(),
          notes: adjustedOrders
            .map((order) => order.notes?.trim())
            .filter((note): note is string => Boolean(note)),
          orders: adjustedOrders,
          split,
          t,
        });

        if (!cancelled) {
          savePrintableInvoice(nextInvoice);
          setInvoice(nextInvoice);
        }
      } catch (error: unknown) {
        const status = typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

        if (status && [401, 403, 404, 409, 423].includes(status)) {
          clearGuestAccess();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLiveInvoice();

    return () => {
      cancelled = true;
    };
  }, [
    activeTableId,
    clearGuestAccess,
    draft.guestAccessToken,
    guestMenuResourceKey,
    restaurant?.name,
    setGuestContext,
    t,
    updateDraft,
  ]);

  const handleDownloadPdf = () => {
    if (!invoice || typeof window === 'undefined') {
      return;
    }

    const printUrl = `${window.location.origin}/invoice/print`;
    const printWindow = window.open(printUrl, '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      window.location.assign(printUrl);
    }
  };

  if (loading && !invoice) {
    return (
      <GuestPageShell>
        <main className="mx-auto max-w-4xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
          <div className="rounded-[32px] border p-6 text-center" style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow)',
            color: 'var(--guest-muted)',
          }}>
            {t('guestOrders.loading')}
          </div>
        </main>
      </GuestPageShell>
    );
  }

  if (!invoice) {
    return (
      <GuestPageShell>
        <main className="mx-auto max-w-4xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
          <div className="rounded-[32px] border p-6 text-center" style={{
            backgroundColor: 'var(--guest-panel)',
            borderColor: 'var(--guest-border)',
            boxShadow: 'var(--guest-shadow)',
            color: 'var(--guest-muted)',
          }}>
            {t('guestInvoice.unavailable')}
          </div>
        </main>
      </GuestPageShell>
    );
  }

  return (
    <GuestPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-14 sm:pt-24 lg:px-8">
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          {invoice.sourceTableId ? (
            <Link
              to={buildGuestOrdersPath(invoice.sourceTableId)}
              className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5"
              style={{
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
                color: 'var(--guest-text)',
                boxShadow: 'var(--guest-shadow-soft)',
              }}
            >
              {t('orderReview.viewOrders')}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            {t('guestInvoice.downloadPdf', { defaultValue: 'Download PDF' })}
          </button>
        </div>
        <InvoiceTemplate invoice={invoice} variant="guest" />
      </main>
    </GuestPageShell>
  );
};

export default GuestInvoicePage;
