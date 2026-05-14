import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchInvoiceById } from '../services/invoiceService';
import type { FinanceInvoiceDetails } from '../types';
import { formatPriceWithCurrency, normalizeCurrency, readGuestCurrencySettings } from '../utils/currency';

const asNumber = (value?: string | number | null): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const valueOrDash = (value?: string | null): string => {
  if (!value || value.trim() === '') {
    return 'N/A';
  }

  return value;
};

const toLineOriginalTotal = (item: FinanceInvoiceDetails['items'][number]): number => {
  const explicitOriginal = Number((item as { original_line_total?: string | number | null }).original_line_total ?? 0);
  if (Number.isFinite(explicitOriginal) && explicitOriginal > 0) {
    return explicitOriginal;
  }

  const quantity = asNumber(item.quantity);
  const unit = asNumber(item.unit_price);
  return Math.max(quantity * unit, 0);
};

const AdminFinanceInvoiceDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { invoice_id } = useParams<{ invoice_id: string }>();
  const { user } = useAuth();
  const storedGuestCurrency = readGuestCurrencySettings()?.currency;
  const currency = normalizeCurrency(storedGuestCurrency || user?.restaurant?.currency || 'USD');

  const [invoice, setInvoice] = useState<FinanceInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoice_id) {
        setError('Missing invoice id.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetchInvoiceById(invoice_id);
        setInvoice(response);
      } catch {
        setError('Failed to load invoice details.');
      } finally {
        setLoading(false);
      }
    };

    void loadInvoice();
  }, [invoice_id]);

  const summaryRows = useMemo(() => {
    if (!invoice) {
      return [];
    }

    const complimentaryDeduction = invoice.items.reduce((sum, item) => {
      const lineTotal = asNumber(item.line_total);
      const originalLineTotal = toLineOriginalTotal(item);
      return sum + Math.max(originalLineTotal - lineTotal, 0);
    }, 0);

    return [
      { label: 'Subtotal', value: formatPriceWithCurrency(asNumber(invoice.subtotal), currency) },
      ...(complimentaryDeduction > 0 ? [{
        label: 'Complimentary deduction',
        value: formatPriceWithCurrency(complimentaryDeduction, currency),
        tone: 'complimentary' as const,
      }] : []),
      {
        label: invoice.discount_type === 'percentage'
          ? `Discount (${asNumber(invoice.discount_value).toFixed(2)}%)`
          : invoice.discount_type === 'fixed'
            ? 'Discount (fixed)'
            : 'Discount',
        value: formatPriceWithCurrency(asNumber(invoice.discount_amount), currency),
        tone: 'discount' as const,
      },
      { label: 'Taxable Subtotal', value: formatPriceWithCurrency(asNumber(invoice.taxable_subtotal), currency) },
      { label: `VAT (${asNumber(invoice.vat_rate).toFixed(2)}%)`, value: formatPriceWithCurrency(asNumber(invoice.vat_amount), currency) },
      { label: 'Total', value: formatPriceWithCurrency(asNumber(invoice.total), currency) },
    ];
  }, [invoice, currency]);

  return (
    <DashboardLayout title="Invoice Details">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Open invoice details including table, line items, taxes, and waiter info.</p>
          <LiquidButton type="button" tone="tertiary" onClick={() => navigate('/admin/finance')}>
            Back to Finance
          </LiquidButton>
        </div>

        {loading ? (
          <GlassCard>
            <div className="py-10 text-sm text-muted">Loading invoice details...</div>
          </GlassCard>
        ) : null}

        {!loading && error ? (
          <GlassCard>
            <div className="rounded-xl2 border border-spicy/50 bg-spicy/12 px-3 py-3 text-sm text-spicy">{error}</div>
          </GlassCard>
        ) : null}

        {!loading && !error && invoice ? (
          <>
            <GlassCard>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Invoice Number</p>
                  <p className="mt-1 text-base font-semibold text-text">{valueOrDash(invoice.invoice_number)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Date</p>
                  <p className="mt-1 text-base font-semibold text-text">{valueOrDash(invoice.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Table</p>
                  <p className="mt-1 text-base font-semibold text-text">{valueOrDash(invoice.table_reference)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Status</p>
                  <p className="mt-1 text-base font-semibold capitalize text-text">{invoice.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Waiter</p>
                  <p className="mt-1 text-base font-semibold text-text">{valueOrDash(invoice.waiter_name || invoice.waiter?.name || null)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Paid At</p>
                  <p className="mt-1 text-base font-semibold text-text">{valueOrDash(invoice.paid_at || null)}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-gold2/85">Notes</p>
                  <p className="mt-1 text-sm text-text">{valueOrDash(invoice.notes || null)}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-lg font-semibold text-text">Invoice Items</h3>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-stroke">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-bg1/90 text-xs uppercase tracking-[0.14em] text-gold2/85">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => {
                      const lineTotal = asNumber(item.line_total);
                      const originalLineTotal = toLineOriginalTotal(item);
                      const hasDeduction = originalLineTotal > lineTotal;
                      const isComplimentary = (
                        (item as { is_complimentary?: boolean | null }).is_complimentary === true
                        || lineTotal === 0
                      );
                      return (
                      <tr
                        key={item.id}
                        className={`border-t border-stroke/70 ${isComplimentary ? 'bg-emerald-500/10' : 'bg-bg1/45'}`}
                      >
                        <td className={isComplimentary ? 'px-4 py-3 text-emerald-100' : 'px-4 py-3 text-text'}>
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-muted">{item.quantity}</td>
                        <td className="px-4 py-3 text-muted">{formatPriceWithCurrency(asNumber(item.unit_price), currency)}</td>
                        <td className={isComplimentary ? 'px-4 py-3 font-semibold text-emerald-100' : 'px-4 py-3 font-semibold text-text'}>
                          {formatPriceWithCurrency(lineTotal, currency)}
                          {hasDeduction ? (
                            <div className="text-xs text-muted line-through">{formatPriceWithCurrency(originalLineTotal, currency)}</div>
                          ) : null}
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-lg font-semibold text-text">Invoice Summary</h3>
              <div className="mt-3 grid gap-2">
                {summaryRows.map((row) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${
                      row.tone === 'complimentary'
                        ? 'border-emerald-400/30 bg-emerald-500/10'
                        : 'border-stroke bg-bg1/55'
                    }`}
                  >
                    <span className="text-sm text-muted">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.tone === 'complimentary' ? 'text-emerald-100' : 'text-text'}`}>
                      {row.tone === 'complimentary' || row.tone === 'discount' ? '- ' : ''}
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default AdminFinanceInvoiceDetailsPage;
