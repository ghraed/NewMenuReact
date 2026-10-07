import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import InvoiceTemplate from '../components/Invoice/InvoiceTemplate';
import { getPrintableInvoiceDownloadFilename, loadPrintableInvoice } from '../utils/printableInvoice';
import { useOrderCart } from '../contexts/useOrderCart';
import { useAuth } from '../contexts/useAuth';

const InvoicePrintPage: React.FC = () => {
  const { t } = useTranslation();
  const { restaurant, draft } = useOrderCart();
  const { user, loading } = useAuth();
  const invoice = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('guest_table_id')) return loading || !user?.id || !user.restaurant?.id ? null : loadPrintableInvoice();
    const tableId = Number(query.get('guest_table_id'));
    const restaurantId = Number(query.get('restaurant_id'));
    if (restaurant?.id !== restaurantId || draft.tableId !== tableId || !draft.guestAccessVerified || !draft.guestAccessToken) return null;
    return loadPrintableInvoice({ restaurantId, tableId, guestAccessToken: draft.guestAccessToken });
  }, [restaurant?.id, draft.tableId, draft.guestAccessVerified, draft.guestAccessToken, loading, user]);
  const hasTriggeredPrintRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !invoice || hasTriggeredPrintRef.current) {
      return;
    }

    hasTriggeredPrintRef.current = true;
    const timer = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [invoice]);

  useEffect(() => {
    if (typeof document === 'undefined' || !invoice) {
      return;
    }

    const previousTitle = document.title;
    document.title = getPrintableInvoiceDownloadFilename(invoice);

    return () => {
      document.title = previousTitle;
    };
  }, [invoice]);

  if (!invoice) {
    return (
      <main className="min-h-screen bg-bg0 px-4 py-12 text-text">
        <div className="mx-auto max-w-3xl">
          <GlassCard className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-gold2/85">{t('invoice.printEyebrow')}</p>
            <h1 className="text-3xl font-semibold text-text">{t('invoice.noInvoice')}</h1>
            <p className="text-muted">{t('invoice.noInvoiceDescription')}</p>
          </GlassCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] px-4 py-10 text-[#f1ede4] print:bg-white print:px-[12mm] print:py-[12mm] print:text-black">
      <style>
        {`
          @media print {
            .invoice-print-toolbar {
              display: none !important;
            }

            @page {
              size: auto;
              margin: 0;
            }

            html, body {
              background: #ffffff !important;
            }
          }
        `}
      </style>

      <div className="invoice-print-toolbar mx-auto mb-6 flex max-w-6xl items-center justify-end gap-3">
        <div className="flex flex-wrap gap-3">
          <LiquidButton type="button" tone="secondary" onClick={() => window.print()}>
            {t('invoice.printAgain')}
          </LiquidButton>
        </div>
      </div>

      <InvoiceTemplate invoice={invoice} variant="print" />
    </main>
  );
};

export default InvoicePrintPage;
