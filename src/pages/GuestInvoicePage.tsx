import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GuestPageShell from '../components/Guest/GuestPageShell';
import InvoiceTemplate from '../components/Invoice/InvoiceTemplate';
import { loadPrintableInvoice } from '../utils/printableInvoice';

const GuestInvoicePage: React.FC = () => {
  const { t } = useTranslation();
  const invoice = useMemo(() => loadPrintableInvoice(), []);

  const handleSaveBill = () => {
    if (!invoice || typeof window === 'undefined') {
      return;
    }

    const lines: string[] = [
      invoice.restaurantName,
      t('invoice.tableTitle', { table: invoice.tableName }),
      `${t('invoice.preview')}: ${invoice.generatedAt}`,
      '',
      t('accountingPage.invoiceItems'),
      ...invoice.items.map((item) => (
        `${item.quantity} x ${item.dishName}  |  ${item.unitPrice}  |  ${item.lineSubtotal}`
      )),
      '',
      t('accountingPage.invoiceSummary'),
      `Subtotal: ${invoice.summary.subtotal}`,
      `${invoice.summary.discountLabel}: - ${invoice.summary.discountAmount}`,
      `Taxable: ${invoice.summary.taxableSubtotal}`,
      `${invoice.summary.vatLabel}: + ${invoice.summary.vatAmount}`,
      `Total: ${invoice.summary.total}`,
    ];

    if (invoice.notes.length > 0) {
      lines.push('', t('invoice.notes'), ...invoice.notes.map((note) => `- ${note}`));
    }

    if (invoice.includedOrders.length > 0) {
      lines.push('', t('invoice.includedOrders'), ...invoice.includedOrders.map((order) => `- ${order}`));
    }

    const fileContent = lines.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeRestaurant = invoice.restaurantName.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'restaurant';
    const safeTable = String(invoice.tableName).replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'table';
    const fileName = `${safeRestaurant}-${safeTable}-bill.txt`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
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
            onClick={handleSaveBill}
            className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5"
            style={{
              backgroundColor: 'var(--guest-panel)',
              borderColor: 'var(--guest-border)',
              color: 'var(--guest-text)',
              boxShadow: 'var(--guest-shadow-soft)',
            }}
          >
            {t('guestInvoice.saveBill', { defaultValue: 'Save Bill' })}
          </button>
        </div>
        <InvoiceTemplate invoice={invoice} variant="guest" />
      </main>
    </GuestPageShell>
  );
};

export default GuestInvoicePage;
