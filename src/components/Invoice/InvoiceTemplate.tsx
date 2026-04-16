import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PrintableInvoicePayload } from '../../utils/printableInvoice';

interface InvoiceTemplateProps {
  invoice: PrintableInvoicePayload;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice }) => {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-6xl rounded-[36px] border border-white/10 bg-[#1b1b1d] p-6 shadow-lux2 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 sm:p-8 print:rounded-none print:border-0 print:bg-white print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-white/10 pb-6 print:border-black/15">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gold2/85 print:text-black">{t('invoice.preview')}</p>
            <h1 className="mt-3 text-3xl font-semibold text-[#f1ede4] print:text-black">{t('invoice.tableTitle', { table: invoice.tableName })}</h1>
            <p className="mt-2 text-sm text-[#b8b0a5] print:text-black/70">
              {invoice.restaurantName}
              {' • '}
              {invoice.generatedAt}
            </p>
          </div>

          <div className="rounded-[22px] border border-gold/20 bg-gold/10 px-5 py-4 text-right print:border-black/15 print:bg-black/[0.04]">
            <p className="text-xs uppercase tracking-[0.18em] text-gold2/85 print:text-black/70">{t('invoice.amountDue')}</p>
            <p className="mt-2 text-3xl font-semibold text-[#f1ede4] print:text-black">{invoice.summary.total}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="text-sm font-semibold text-[#f1ede4] print:text-black">{t('accountingPage.invoiceItems')}</p>
            <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 print:border-black/15">
              <div className="grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[#9a958c] print:border-black/15 print:bg-black/[0.04] print:text-black/65">
                <span>{t('accountingPage.item')}</span>
                <span className="text-right">{t('accountingPage.qty')}</span>
                <span className="text-right">{t('accountingPage.total')}</span>
              </div>
              <div className="divide-y divide-white/10 print:divide-black/10">
                {invoice.items.map((item) => (
                  <div
                    key={item.key}
                    className="grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 px-4 py-4 text-sm text-[#f1ede4] print:text-black"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.dishName}</p>
                      <p className="mt-1 text-xs text-[#b8b0a5] print:text-black/65">{item.unitPrice}</p>
                    </div>
                    <span className="text-right text-[#b8b0a5] print:text-black/75">{item.quantity}</span>
                    <span className="text-right font-medium">{item.lineSubtotal}</span>
                  </div>
                ))}
              </div>
            </div>

            {invoice.notes.length > 0 ? (
              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4 print:border-black/15 print:bg-black/[0.04]">
                <p className="text-xs uppercase tracking-[0.18em] text-[#9a958c] print:text-black/65">{t('invoice.notes')}</p>
                <div className="mt-3 space-y-2 text-sm text-[#b8b0a5] print:text-black/75">
                  {invoice.notes.map((note, index) => (
                    <p key={`print-note-${index + 1}`}>{note}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4 print:border-black/15 print:bg-black/[0.04]">
              <p className="text-xs uppercase tracking-[0.18em] text-[#9a958c] print:text-black/65">{t('invoice.includedOrders')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {invoice.includedOrders.map((order) => (
                  <span
                    key={order}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#b8b0a5] print:border-black/15 print:bg-white print:text-black/75"
                  >
                    {order}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#f1ede4] print:text-black">{t('accountingPage.invoiceSummary')}</p>
            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-5 print:border-black/15 print:bg-black/[0.04]">
              <div className="space-y-3 text-sm text-[#b8b0a5] print:text-black/75">
                <div className="flex items-center justify-between gap-3">
                  <span>{t('accountingPage.subtotal')}</span>
                  <span className="font-medium text-[#f1ede4] print:text-black">{invoice.summary.subtotal}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{invoice.summary.discountLabel}</span>
                  <span className="font-medium text-[#f1ede4] print:text-black">- {invoice.summary.discountAmount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('accountingPage.taxableSubtotal')}</span>
                  <span className="font-medium text-[#f1ede4] print:text-black">{invoice.summary.taxableSubtotal}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{invoice.summary.vatLabel}</span>
                  <span className="font-medium text-[#f1ede4] print:text-black">+ {invoice.summary.vatAmount}</span>
                </div>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4 print:border-black/15">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-[#f1ede4] print:text-black">{t('accountingPage.grandTotal')}</span>
                  <span className="text-2xl font-semibold text-gold2 print:text-black">{invoice.summary.total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvoiceTemplate;
