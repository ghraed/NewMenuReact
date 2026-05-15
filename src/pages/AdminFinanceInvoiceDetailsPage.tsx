import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchInvoiceById } from '../services/invoiceService';
import type { FinanceInvoiceDetails } from '../types';
import { formatPriceWithCurrency, normalizeCurrency, readGuestCurrencySettings } from '../utils/currency';
import { readBillAdjustmentsForTable, type BillItemAdjustment } from '../utils/billAdjustments';

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

const normalizeText = (value: string): string => value.trim().toLowerCase();

const normalizeTableReference = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return trimmed;
  }
  return trimmed.replace(/^table\s+table\s+/i, 'Table ');
};

const resolveTableName = (invoice: FinanceInvoiceDetails): string | null => {
  if (invoice.table_reference && invoice.table_reference.trim() !== '' && invoice.table_reference.toLowerCase() !== 'n/a') {
    return normalizeTableReference(invoice.table_reference);
  }

  const notes = invoice.notes || '';
  const tableInParensMatch = notes.match(/\((Table [^)]+)\)/i);
  if (tableInParensMatch?.[1]) {
    return normalizeTableReference(tableInParensMatch[1]);
  }

  const tableMatch = notes.match(/table\s+([a-z0-9 _-]+)/i);
  if (tableMatch?.[1]) {
    return normalizeTableReference(`Table ${tableMatch[1].trim()}`);
  }

  return null;
};

interface InvoiceDisplayItem {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalLineTotal: number;
  finalLineTotal: number;
  status: string;
  compensationType: string;
  compensationReason: string | null;
  compensationNote: string | null;
  accountingBucket: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  isComplimentary: boolean;
}

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

  const mergedInvoiceItems = useMemo<InvoiceDisplayItem[]>(() => {
    if (!invoice) {
      return [];
    }

    const tableName = resolveTableName(invoice);
    const adjustments = tableName ? readBillAdjustmentsForTable(tableName) : [];
    const unusedAdjustments = [...adjustments];
    const invoiceTimestamp = Number.isFinite(Date.parse(invoice.created_at || ''))
      ? Date.parse(invoice.created_at || '')
      : (Number.isFinite(Date.parse(invoice.updated_at || '')) ? Date.parse(invoice.updated_at || '') : null);
    const matchedAdjustments: BillItemAdjustment[] = [];

    const takeMatchingAdjustment = (
      itemName: string,
      quantity: number,
      unitPrice: number
    ): BillItemAdjustment | null => {
      const normalizedName = normalizeText(itemName);
      const candidates = unusedAdjustments
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => {
        const sameName = normalizeText(candidate.dish_name) === normalizedName;
        if (!sameName) {
          return false;
        }

        const candidateQty = asNumber(candidate.quantity ?? quantity);
        const candidateUnit = asNumber(candidate.original_unit_price ?? unitPrice);
          if (!(Math.abs(candidateQty - quantity) < 0.001 && Math.abs(candidateUnit - unitPrice) < 0.02)) {
            return false;
          }

          if (invoiceTimestamp === null || !candidate.approved_at) {
            return true;
          }

          const approvedAtTs = Date.parse(candidate.approved_at);
          if (!Number.isFinite(approvedAtTs)) {
            return true;
          }

          const maxWindowMs = 2 * 60 * 60 * 1000;
          return Math.abs(approvedAtTs - invoiceTimestamp) <= maxWindowMs;
        })
        .sort((left, right) => {
          if (invoiceTimestamp === null) {
            return left.index - right.index;
          }

          const leftTs = left.candidate.approved_at ? Date.parse(left.candidate.approved_at) : Number.NaN;
          const rightTs = right.candidate.approved_at ? Date.parse(right.candidate.approved_at) : Number.NaN;
          const leftDiff = Number.isFinite(leftTs) ? Math.abs(leftTs - invoiceTimestamp) : Number.POSITIVE_INFINITY;
          const rightDiff = Number.isFinite(rightTs) ? Math.abs(rightTs - invoiceTimestamp) : Number.POSITIVE_INFINITY;
          return leftDiff - rightDiff;
        });

      const match = candidates[0];
      if (!match) {
        return null;
      }

      const index = match.index;
      if (index < 0) {
        return null;
      }

      const [matched] = unusedAdjustments.splice(index, 1);
      matchedAdjustments.push(matched);
      return matched;
    };

    const merged = invoice.items.map((item, index) => {
      const quantity = asNumber(item.quantity);
      const unitPrice = asNumber(item.unit_price);
      const lineTotal = asNumber(item.line_total);
      const fallbackOriginalLine = toLineOriginalTotal(item);
      const matchedAdjustment = takeMatchingAdjustment(item.name, quantity, unitPrice);

      const originalUnit = matchedAdjustment
        ? asNumber(matchedAdjustment.original_unit_price ?? unitPrice)
        : unitPrice;
      const finalUnit = matchedAdjustment
        ? asNumber(matchedAdjustment.final_unit_price ?? unitPrice)
        : (lineTotal > 0 && quantity > 0 ? lineTotal / quantity : unitPrice);
      const originalLineTotal = matchedAdjustment ? originalUnit * quantity : fallbackOriginalLine;
      const finalLineTotal = matchedAdjustment ? finalUnit * quantity : lineTotal;

      const status = matchedAdjustment?.status
        || ((item as { status?: string | null }).status ?? 'normal');
      const compensationType = matchedAdjustment?.compensation_type
        || ((item as { compensation_type?: string | null }).compensation_type ?? 'none');
      const compensationReason = matchedAdjustment?.compensation_reason
        || ((item as { compensation_reason?: string | null }).compensation_reason ?? null);
      const compensationNote = matchedAdjustment?.compensation_note
        || ((item as { compensation_note?: string | null }).compensation_note ?? null);
      const accountingBucket = matchedAdjustment?.accounting_bucket
        || ((item as { accounting_bucket?: string | null }).accounting_bucket ?? null);
      const approvedBy = matchedAdjustment?.approved_by_staff_name
        || ((item as { approved_by_staff_name?: string | null }).approved_by_staff_name ?? null);
      const approvedAt = matchedAdjustment?.approved_at
        || ((item as { approved_at?: string | null }).approved_at ?? null);
      const isComplimentary = (
        matchedAdjustment?.is_complimentary === true
        || compensationType === 'complimentary'
        || (item as { is_complimentary?: boolean | null }).is_complimentary === true
      );

      return {
        key: `invoice-line-${item.id ?? index}`,
        name: item.name,
        quantity,
        unitPrice,
        originalLineTotal,
        finalLineTotal,
        status,
        compensationType,
        compensationReason,
        compensationNote,
        accountingBucket,
        approvedBy,
        approvedAt,
        isComplimentary,
      };
    });

    const fallbackAnchorTimestamp = (() => {
      if (invoiceTimestamp !== null) {
        return invoiceTimestamp;
      }

      const matchedTimes = matchedAdjustments
        .map((adjustment) => (adjustment.approved_at ? Date.parse(adjustment.approved_at) : Number.NaN))
        .filter((timestamp) => Number.isFinite(timestamp));

      if (matchedTimes.length === 0) {
        return null;
      }

      return Math.max(...matchedTimes);
    })();

    const localGiftLines = unusedAdjustments
      .filter((adjustment) => adjustment.local_only === true)
      .filter((adjustment) => {
        if (fallbackAnchorTimestamp === null || !adjustment.approved_at) {
          return false;
        }
        const approvedAtTs = Date.parse(adjustment.approved_at);
        if (!Number.isFinite(approvedAtTs)) {
          return false;
        }
        const maxWindowMs = 20 * 60 * 1000;
        return Math.abs(approvedAtTs - fallbackAnchorTimestamp) <= maxWindowMs;
      })
      .sort((left, right) => {
        const leftTs = left.approved_at ? Date.parse(left.approved_at) : Number.NaN;
        const rightTs = right.approved_at ? Date.parse(right.approved_at) : Number.NaN;
        const leftDiff = Number.isFinite(leftTs) && fallbackAnchorTimestamp !== null
          ? Math.abs(leftTs - fallbackAnchorTimestamp)
          : Number.POSITIVE_INFINITY;
        const rightDiff = Number.isFinite(rightTs) && fallbackAnchorTimestamp !== null
          ? Math.abs(rightTs - fallbackAnchorTimestamp)
          : Number.POSITIVE_INFINITY;
        return leftDiff - rightDiff;
      })
      .map((adjustment, index) => {
        const quantity = Math.max(1, asNumber(adjustment.quantity ?? 1));
        const originalUnit = asNumber(adjustment.original_unit_price ?? 0);
        const finalUnit = asNumber(adjustment.final_unit_price ?? 0);
        return {
          key: `invoice-local-gift-${index + 1}-${adjustment.key}`,
          name: adjustment.dish_name,
          quantity,
          unitPrice: originalUnit,
          originalLineTotal: originalUnit * quantity,
          finalLineTotal: finalUnit * quantity,
          status: adjustment.status || 'compensated',
          compensationType: adjustment.compensation_type || 'complimentary',
          compensationReason: adjustment.compensation_reason ?? null,
          compensationNote: adjustment.compensation_note ?? null,
          accountingBucket: adjustment.accounting_bucket ?? null,
          approvedBy: adjustment.approved_by_staff_name ?? null,
          approvedAt: adjustment.approved_at ?? null,
          isComplimentary: true,
        } satisfies InvoiceDisplayItem;
      });

    return [...merged, ...localGiftLines];
  }, [invoice]);

  const summaryRows = useMemo(() => {
    if (!invoice || mergedInvoiceItems.length === 0) {
      return [];
    }

    const adjustmentStats = mergedInvoiceItems.reduce((stats, item) => {
      const lineTotal = item.finalLineTotal;
      const originalLineTotal = item.originalLineTotal;
      const deduction = Math.max(originalLineTotal - lineTotal, 0);
      const compensationType = item.compensationType || 'none';
      const isComplimentary = item.isComplimentary || compensationType === 'complimentary';

      if (deduction <= 0) {
        return stats;
      }

      if (isComplimentary) {
        stats.complimentary += deduction;
      } else if (compensationType === 'partial_discount') {
        stats.partialDiscount += deduction;
      } else {
        stats.issue += deduction;
      }

      stats.total += deduction;
      return stats;
    }, {
      issue: 0,
      complimentary: 0,
      partialDiscount: 0,
      total: 0,
    });

    const grossSubtotal = mergedInvoiceItems.reduce((sum, item) => sum + item.originalLineTotal, 0);
    const netSubtotal = mergedInvoiceItems.reduce((sum, item) => sum + item.finalLineTotal, 0);
    const additionalDiscount = Math.max(asNumber(invoice.discount_amount), 0);
    const netTaxableSubtotal = Math.max(0, netSubtotal - additionalDiscount);
    const vatRate = asNumber(invoice.vat_rate);
    const recomputedVat = netTaxableSubtotal * (vatRate / 100);
    const netTotal = netTaxableSubtotal + recomputedVat;

    return [
      { label: 'Gross Subtotal (before issues)', value: formatPriceWithCurrency(grossSubtotal, currency) },
      ...(adjustmentStats.issue > 0 ? [{
        label: 'Issue deductions (expense)',
        value: formatPriceWithCurrency(adjustmentStats.issue, currency),
        tone: 'complimentary' as const,
      }] : []),
      ...(adjustmentStats.complimentary > 0 ? [{
        label: 'Complimentary/Gift deductions (expense)',
        value: formatPriceWithCurrency(adjustmentStats.complimentary, currency),
        tone: 'complimentary' as const,
      }] : []),
      ...(adjustmentStats.partialDiscount > 0 ? [{
        label: 'Partial discount deductions (expense)',
        value: formatPriceWithCurrency(adjustmentStats.partialDiscount, currency),
        tone: 'complimentary' as const,
      }] : []),
      ...(adjustmentStats.total > 0 ? [{
        label: 'Net item subtotal (after issues/gifts)',
        value: formatPriceWithCurrency(netSubtotal, currency),
      }] : []),
      {
        label: invoice.discount_type === 'percentage'
          ? `Discount (${asNumber(invoice.discount_value).toFixed(2)}%)`
          : invoice.discount_type === 'fixed'
            ? 'Discount (fixed)'
            : 'Discount',
        value: formatPriceWithCurrency(additionalDiscount, currency),
        tone: 'discount' as const,
      },
      { label: 'Taxable Subtotal', value: formatPriceWithCurrency(netTaxableSubtotal, currency) },
      { label: `VAT (${vatRate.toFixed(2)}%)`, value: formatPriceWithCurrency(recomputedVat, currency) },
      { label: 'Final Total (net revenue)', value: formatPriceWithCurrency(netTotal, currency) },
    ];
  }, [invoice, mergedInvoiceItems, currency]);

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
                    {mergedInvoiceItems.map((item) => {
                      const lineTotal = item.finalLineTotal;
                      const originalLineTotal = item.originalLineTotal;
                      const hasDeduction = originalLineTotal > lineTotal;
                      const compensationType = item.compensationType || null;
                      const compensationNote = item.compensationNote || null;
                      const accountingBucket = item.accountingBucket || null;
                      const isComplimentary = item.isComplimentary || compensationType === 'complimentary';
                      const isCompensated = compensationType !== null && compensationType !== 'none';
                      const compensationReason = item.compensationReason || null;
                      const approvedBy = item.approvedBy || null;
                      const approvedAt = item.approvedAt || null;
                      const label = isComplimentary
                        ? 'COMPLIMENTARY / GIFT'
                        : compensationType === 'partial_discount'
                          ? 'PARTIAL DISCOUNT'
                          : compensationType === 'full_waiver'
                            ? 'FULL WAIVER'
                            : compensationType === 'none' || compensationType === null
                              ? null
                              : compensationType.replaceAll('_', ' ').toUpperCase();
                      return (
                      <tr key={item.key} className="border-t border-stroke/70 bg-bg1/45">
                        <td className={isComplimentary ? 'px-4 py-3 text-emerald-500' : isCompensated ? 'px-4 py-3 text-rose-500' : 'px-4 py-3 text-text'}>
                          <div>
                            <p>{item.name}</p>
                            {isCompensated ? (
                              <p className="mt-1 text-xs text-muted">
                                {label ? `${label}` : `Compensation: ${compensationType?.replaceAll('_', ' ') || 'unknown'}`}
                                {compensationReason ? ` • Reason: ${compensationReason.replaceAll('_', ' ')}` : ''}
                                {accountingBucket ? ` • Bucket: ${accountingBucket.replaceAll('_', ' ')}` : ''}
                                {compensationNote ? ` • ${compensationNote}` : ''}
                                {approvedBy ? ` • Approved by ${approvedBy}` : ''}
                                {approvedAt ? ` • ${approvedAt}` : ''}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{item.quantity}</td>
                        <td className="px-4 py-3 text-muted">{formatPriceWithCurrency(item.unitPrice, currency)}</td>
                        <td className={isComplimentary ? 'px-4 py-3 font-semibold text-emerald-500' : isCompensated ? 'px-4 py-3 font-semibold text-rose-500' : 'px-4 py-3 font-semibold text-text'}>
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
                        ? 'border-amber-400/35 bg-amber-500/12'
                        : row.tone === 'discount'
                          ? 'border-rose-400/30 bg-rose-500/10'
                        : 'border-stroke bg-bg1/55'
                    }`}
                  >
                    <span className="text-sm text-muted">{row.label}</span>
                    <span className={`text-sm font-semibold ${
                      row.tone === 'complimentary'
                        ? 'text-amber-500'
                        : row.tone === 'discount'
                          ? 'text-rose-500'
                          : 'text-text'
                    }`}>
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
