import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import InvoiceTemplate from '../components/Invoice/InvoiceTemplate';
import { loadPrintableInvoice } from '../utils/printableInvoice';

const GuestInvoicePage: React.FC = () => {
  const { t } = useTranslation();
  const invoice = useMemo(() => loadPrintableInvoice(), []);

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
        <InvoiceTemplate invoice={invoice} />
      </main>
    </GuestPageShell>
  );
};

export default GuestInvoicePage;
