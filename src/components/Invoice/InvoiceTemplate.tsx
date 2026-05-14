import React from 'react';
import { useTranslation } from 'react-i18next';
import { translateDishLabel } from '../../i18n/dishes';
import type { PrintableInvoicePayload } from '../../utils/printableInvoice';

interface InvoiceTemplateProps {
  invoice: PrintableInvoicePayload;
  variant?: 'guest' | 'print';
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, variant = 'guest' }) => {
  const { t, i18n } = useTranslation();
  const isGuest = variant === 'guest';

  return (
    <section
      className={`mx-auto max-w-6xl rounded-[36px] border p-6 sm:p-8 ${
        isGuest
          ? ''
          : 'border-white/10 bg-[#1b1b1d] shadow-lux2 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none'
      }`}
      style={isGuest ? {
        backgroundColor: 'var(--guest-panel)',
        borderColor: 'var(--guest-border)',
        boxShadow: 'var(--guest-shadow)',
      } : undefined}
    >
      <div
        className={`rounded-[28px] border p-6 sm:p-8 ${
          isGuest
            ? ''
            : 'border-white/10 bg-white/[0.03] print:rounded-none print:border-0 print:bg-white print:p-0'
        }`}
        style={isGuest ? {
          backgroundColor: 'var(--guest-panel-strong)',
          borderColor: 'var(--guest-border)',
        } : undefined}
      >
        <div
          className={`flex flex-wrap items-start justify-between gap-6 pb-6 ${
            isGuest ? '' : 'print:border-black/15'
          }`}
          style={isGuest ? {
            borderBottom: '1px solid var(--guest-border)',
          } : undefined}
        >
          <div>
            <p
              className={`text-xs uppercase tracking-[0.24em] ${isGuest ? '' : 'text-gold2/85 print:text-black'}`}
              style={isGuest ? { color: 'var(--guest-accent)' } : undefined}
            >
              {t('invoice.preview')}
            </p>
            <h1
              className={`mt-3 text-3xl font-semibold ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
              style={isGuest ? { color: 'var(--guest-text)' } : undefined}
            >
              {t('invoice.tableTitle', { table: invoice.tableName })}
            </h1>
            <p
              className={`mt-2 text-sm ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/70'}`}
              style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
            >
              {invoice.restaurantName}
              {' • '}
              {invoice.generatedAt}
            </p>
          </div>

          <div
            className={`rounded-[22px] border px-5 py-4 text-right ${isGuest ? '' : 'border-gold/20 bg-gold/10 print:border-black/15 print:bg-black/[0.04]'}`}
            style={isGuest ? {
              backgroundColor: 'var(--guest-accent-soft)',
              borderColor: 'var(--guest-border)',
            } : undefined}
          >
            <p
              className={`text-xs uppercase tracking-[0.18em] ${isGuest ? '' : 'text-gold2/85 print:text-black/70'}`}
              style={isGuest ? { color: 'var(--guest-accent)' } : undefined}
            >
              {t('invoice.amountDue')}
            </p>
            <p
              className={`mt-2 text-3xl font-semibold ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
              style={isGuest ? { color: 'var(--guest-text)' } : undefined}
            >
              {invoice.summary.total}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p
              className={`text-sm font-semibold ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
              style={isGuest ? { color: 'var(--guest-text)' } : undefined}
            >
              {t('accountingPage.invoiceItems')}
            </p>
            <div
              className={`mt-4 overflow-hidden rounded-[24px] border ${isGuest ? '' : 'border-white/10 print:border-black/15'}`}
              style={isGuest ? { borderColor: 'var(--guest-border)' } : undefined}
            >
              <div
                className={`grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 px-4 py-3 text-xs uppercase tracking-[0.18em] ${
                  isGuest ? '' : 'border-b border-white/10 bg-white/[0.04] text-[#9a958c] print:border-black/15 print:bg-black/[0.04] print:text-black/65'
                }`}
                style={isGuest ? {
                  borderBottom: '1px solid var(--guest-border)',
                  backgroundColor: 'var(--guest-panel)',
                  color: 'var(--guest-muted)',
                } : undefined}
              >
                <span>{t('accountingPage.item')}</span>
                <span className="text-right">{t('accountingPage.qty')}</span>
                <span className="text-right">{t('accountingPage.total')}</span>
              </div>
              <div className={isGuest ? '' : 'divide-y divide-white/10 print:divide-black/10'}>
                {invoice.items.map((item) => (
                  <div
                    key={item.key}
                    className={`grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 px-4 py-4 text-sm ${
                      item.isComplimentary
                        ? isGuest
                          ? ''
                          : 'bg-emerald-500/[0.08] text-emerald-100 print:bg-emerald-100/40 print:text-black'
                        : item.status === 'cancelled' || item.status === 'problematic'
                          ? isGuest
                            ? ''
                            : 'bg-rose-500/[0.08] text-rose-100 print:bg-rose-100/40 print:text-black'
                          : isGuest
                            ? ''
                            : 'text-[#f1ede4] print:text-black'
                    }`}
                    style={isGuest ? {
                      color: item.isComplimentary
                        ? '#3bd48b'
                        : item.status === 'cancelled' || item.status === 'problematic'
                          ? '#ff7e93'
                          : 'var(--guest-text)',
                      borderTop: '1px solid var(--guest-border)',
                    } : undefined}
                  >
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${item.status === 'cancelled' || item.status === 'problematic' ? 'line-through' : ''}`}>
                        {translateDishLabel(item.dishName, i18n.resolvedLanguage, item.dishNameArabic)}
                      </p>
                      <p
                        className={`mt-1 text-xs ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/65'}`}
                        style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
                      >
                        {item.unitPrice}
                      </p>
                      {item.badgeLabel ? (
                        <p
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                            isGuest ? '' : 'border-white/15 bg-white/5 text-[#c8c0b2] print:border-black/20 print:bg-black/[0.04] print:text-black/70'
                          }`}
                          style={isGuest ? {
                            borderColor: 'var(--guest-border)',
                            color: 'var(--guest-muted)',
                          } : undefined}
                        >
                          {item.badgeLabel}
                        </p>
                      ) : null}
                      {item.reasonLabel ? (
                        <p
                          className={`mt-1 text-[11px] ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/65'}`}
                          style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
                        >
                          Reason: {item.reasonLabel}
                          {item.note ? ` • ${item.note}` : ''}
                        </p>
                      ) : null}
                      {item.approvedBy ? (
                        <p
                          className={`mt-1 text-[11px] ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/65'}`}
                          style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
                        >
                          Approved by {item.approvedBy}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`text-right ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/75'}`}
                      style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
                    >
                      {item.quantity}
                    </span>
                    <span className="text-right font-medium">
                      {item.lineSubtotal}
                      {item.originalLineSubtotal && item.originalLineSubtotal !== item.lineSubtotal ? (
                        <span className={`block text-xs line-through ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/65'}`}>
                          {item.originalLineSubtotal}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {invoice.notes.length > 0 ? (
              <div
                className={`mt-5 rounded-[22px] border p-4 ${isGuest ? '' : 'border-white/10 bg-black/10 print:border-black/15 print:bg-black/[0.04]'}`}
                style={isGuest ? {
                  backgroundColor: 'var(--guest-panel)',
                  borderColor: 'var(--guest-border)',
                } : undefined}
              >
                <p
                  className={`text-xs uppercase tracking-[0.18em] ${isGuest ? '' : 'text-[#9a958c] print:text-black/65'}`}
                  style={isGuest ? { color: 'var(--guest-accent)' } : undefined}
                >
                  {t('invoice.notes')}
                </p>
                <div
                  className={`mt-3 space-y-2 text-sm ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/75'}`}
                  style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
                >
                  {invoice.notes.map((note, index) => (
                    <p key={`print-note-${index + 1}`}>{note}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              className={`mt-5 rounded-[22px] border p-4 ${isGuest ? '' : 'border-white/10 bg-black/10 print:border-black/15 print:bg-black/[0.04]'}`}
              style={isGuest ? {
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
              } : undefined}
            >
              <p
                className={`text-xs uppercase tracking-[0.18em] ${isGuest ? '' : 'text-[#9a958c] print:text-black/65'}`}
                style={isGuest ? { color: 'var(--guest-accent)' } : undefined}
              >
                {t('invoice.includedOrders')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {invoice.includedOrders.map((order) => (
                  <span
                    key={order}
                    className={`rounded-full border px-3 py-1.5 text-xs ${isGuest ? '' : 'border-white/10 bg-white/[0.04] text-[#b8b0a5] print:border-black/15 print:bg-white print:text-black/75'}`}
                    style={isGuest ? {
                      borderColor: 'var(--guest-border)',
                      backgroundColor: 'var(--guest-panel-strong)',
                      color: 'var(--guest-muted)',
                    } : undefined}
                  >
                    {order}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p
              className={`text-sm font-semibold ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
              style={isGuest ? { color: 'var(--guest-text)' } : undefined}
            >
              {t('accountingPage.invoiceSummary')}
            </p>
            <div
              className={`mt-4 rounded-[24px] border p-5 ${isGuest ? '' : 'border-white/10 bg-black/10 print:border-black/15 print:bg-black/[0.04]'}`}
              style={isGuest ? {
                backgroundColor: 'var(--guest-panel)',
                borderColor: 'var(--guest-border)',
              } : undefined}
            >
              <div
                className={`space-y-3 text-sm ${isGuest ? '' : 'text-[#b8b0a5] print:text-black/75'}`}
                style={isGuest ? { color: 'var(--guest-muted)' } : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{t('accountingPage.subtotal')}</span>
                  <span
                    className={`font-medium ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
                    style={isGuest ? { color: 'var(--guest-text)' } : undefined}
                  >
                    {invoice.summary.subtotal}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{invoice.summary.discountLabel}</span>
                  <span
                    className={`font-medium ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
                    style={isGuest ? { color: 'var(--guest-text)' } : undefined}
                  >
                    - {invoice.summary.discountAmount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('accountingPage.taxableSubtotal')}</span>
                  <span
                    className={`font-medium ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
                    style={isGuest ? { color: 'var(--guest-text)' } : undefined}
                  >
                    {invoice.summary.taxableSubtotal}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{invoice.summary.vatLabel}</span>
                  <span
                    className={`font-medium ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
                    style={isGuest ? { color: 'var(--guest-text)' } : undefined}
                  >
                    + {invoice.summary.vatAmount}
                  </span>
                </div>
              </div>

              <div
                className={`mt-5 pt-4 ${isGuest ? '' : 'border-t border-white/10 print:border-black/15'}`}
                style={isGuest ? { borderTop: '1px solid var(--guest-border)' } : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-base font-semibold ${isGuest ? '' : 'text-[#f1ede4] print:text-black'}`}
                    style={isGuest ? { color: 'var(--guest-text)' } : undefined}
                  >
                    {t('accountingPage.grandTotal')}
                  </span>
                  <span
                    className={`text-2xl font-semibold ${isGuest ? '' : 'text-gold2 print:text-black'}`}
                    style={isGuest ? { color: 'var(--guest-accent)' } : undefined}
                  >
                    {invoice.summary.total}
                  </span>
                </div>
              </div>

              {invoice.split?.enabled && invoice.split.breakdown.length > 0 ? (
                <div
                  className={`mt-5 pt-4 ${isGuest ? '' : 'border-t border-white/10 print:border-black/15'}`}
                  style={isGuest ? { borderTop: '1px solid var(--guest-border)' } : undefined}
                >
                  <p
                    className={`text-xs uppercase tracking-[0.18em] ${isGuest ? '' : 'text-[#9a958c] print:text-black/65'}`}
                    style={isGuest ? { color: 'var(--guest-accent)' } : undefined}
                  >
                    {t('guestOrders.splitSectionTitle', { defaultValue: 'Invoice Split' })}
                  </p>
                  <div className="mt-3 space-y-2">
                    {invoice.split.breakdown.map((item) => (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between rounded-[18px] border px-3 py-2.5 text-sm ${
                          isGuest
                            ? ''
                            : 'border-white/10 bg-black/10 text-[#f1ede4] print:border-black/15 print:bg-black/[0.04] print:text-black'
                        }`}
                        style={isGuest ? {
                          borderColor: 'var(--guest-border)',
                          backgroundColor: 'var(--guest-panel-strong)',
                          color: 'var(--guest-text)',
                        } : undefined}
                      >
                        <span>{item.label}</span>
                        <span className="font-semibold">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvoiceTemplate;
