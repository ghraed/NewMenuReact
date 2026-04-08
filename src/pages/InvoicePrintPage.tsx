import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { loadPrintableInvoice } from '../utils/printableInvoice';

const InvoicePrintPage: React.FC = () => {
  const invoice = useMemo(() => loadPrintableInvoice(), []);
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

  if (!invoice) {
    return (
      <main className="min-h-screen bg-bg0 px-4 py-12 text-text">
        <div className="mx-auto max-w-3xl">
          <GlassCard className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-gold2/85">Invoice Print</p>
            <h1 className="text-3xl font-semibold text-text">No invoice loaded</h1>
            <p className="text-muted">
              Open the invoice from the accounting page first, then print it from this page.
            </p>
            <div className="pt-2">
              <Link to="/admin/accounting" className="inline-flex">
                <LiquidButton type="button" tone="primary">Back to Accounting</LiquidButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] px-4 py-10 text-[#f1ede4] print:bg-white print:px-0 print:py-0 print:text-black">
      <style>
        {`
          @media print {
            .invoice-print-toolbar {
              display: none !important;
            }

            @page {
              size: auto;
              margin: 12mm;
            }

            html, body {
              background: #ffffff !important;
            }
          }
        `}
      </style>

      <div className="invoice-print-toolbar mx-auto mb-6 flex max-w-6xl items-center justify-between gap-3">
        <Link to="/admin/accounting" className="inline-flex">
          <LiquidButton type="button" tone="tertiary">Back to Accounting</LiquidButton>
        </Link>
        <div className="flex flex-wrap gap-3">
          <LiquidButton type="button" tone="secondary" onClick={() => window.print()}>
            Print Again
          </LiquidButton>
          <LiquidButton type="button" tone="primary" onClick={() => window.close()}>
            Close
          </LiquidButton>
        </div>
      </div>

      <section className="mx-auto max-w-6xl rounded-[36px] border border-white/10 bg-[#1b1b1d] p-6 shadow-lux2 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 sm:p-8 print:rounded-none print:border-0 print:bg-white print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-white/10 pb-6 print:border-black/15">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-gold2/85 print:text-black">Invoice Preview</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#f1ede4] print:text-black">Table {invoice.tableName}</h1>
              <p className="mt-2 text-sm text-[#b8b0a5] print:text-black/70">
                {invoice.restaurantName}
                {' • '}
                {invoice.generatedAt}
              </p>
            </div>

            <div className="rounded-[22px] border border-gold/20 bg-gold/10 px-5 py-4 text-right print:border-black/15 print:bg-black/[0.04]">
              <p className="text-xs uppercase tracking-[0.18em] text-gold2/85 print:text-black/70">Amount Due</p>
              <p className="mt-2 text-3xl font-semibold text-[#f1ede4] print:text-black">{invoice.summary.total}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <p className="text-sm font-semibold text-[#f1ede4] print:text-black">Invoice Items</p>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 print:border-black/15">
                <div className="grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[#9a958c] print:border-black/15 print:bg-black/[0.04] print:text-black/65">
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="divide-y divide-white/10 print:divide-black/10">
                  {invoice.items.map((item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[minmax(0,1fr)_100px_110px] gap-3 px-4 py-4 text-sm text-[#f1ede4] print:text-black"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.dishName}</p>
                        <p className="mt-1 text-xs text-[#b8b0a5] print:text-black/65">{item.unitPrice} each</p>
                      </div>
                      <span className="text-right text-[#b8b0a5] print:text-black/75">{item.quantity}</span>
                      <span className="text-right font-medium">{item.lineSubtotal}</span>
                    </div>
                  ))}
                </div>
              </div>

              {invoice.notes.length > 0 ? (
                <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4 print:border-black/15 print:bg-black/[0.04]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#9a958c] print:text-black/65">Notes</p>
                  <div className="mt-3 space-y-2 text-sm text-[#b8b0a5] print:text-black/75">
                    {invoice.notes.map((note, index) => (
                      <p key={`print-note-${index + 1}`}>{note}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4 print:border-black/15 print:bg-black/[0.04]">
                <p className="text-xs uppercase tracking-[0.18em] text-[#9a958c] print:text-black/65">Included Orders</p>
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
              <p className="text-sm font-semibold text-[#f1ede4] print:text-black">Invoice Summary</p>
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-5 print:border-black/15 print:bg-black/[0.04]">
                <div className="space-y-3 text-sm text-[#b8b0a5] print:text-black/75">
                  <div className="flex items-center justify-between gap-3">
                    <span>Subtotal</span>
                    <span className="font-medium text-[#f1ede4] print:text-black">{invoice.summary.subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{invoice.summary.discountLabel}</span>
                    <span className="font-medium text-[#f1ede4] print:text-black">- {invoice.summary.discountAmount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Taxable subtotal</span>
                    <span className="font-medium text-[#f1ede4] print:text-black">{invoice.summary.taxableSubtotal}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{invoice.summary.vatLabel}</span>
                    <span className="font-medium text-[#f1ede4] print:text-black">+ {invoice.summary.vatAmount}</span>
                  </div>
                </div>

                <div className="mt-5 border-t border-white/10 pt-4 print:border-black/15">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-[#f1ede4] print:text-black">Grand Total</span>
                    <span className="text-2xl font-semibold text-gold2 print:text-black">{invoice.summary.total}</span>
                  </div>
                </div>

                <p className="mt-4 text-xs text-[#9a958c] print:text-black/65">
                  This page is dedicated to printing the invoice only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default InvoicePrintPage;
