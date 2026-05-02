import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import InvoiceTemplate from '../components/Invoice/InvoiceTemplate';
import { loadPrintableInvoice } from '../utils/printableInvoice';

const GuestInvoicePage: React.FC = () => {
  const { t } = useTranslation();
  const invoice = useMemo(() => loadPrintableInvoice(), []);

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
        <div className="mb-4 flex justify-end">
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
