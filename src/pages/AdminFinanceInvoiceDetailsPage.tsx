import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassCard, LiquidButton } from '../components/ui/liquid-glass';
import { useAuth } from '../contexts/useAuth';
import { fetchInvoiceById } from '../services/invoiceService';
import type { AdjustmentActionType, FinanceInvoiceDetails, OperationalLossCategory } from '../types';
import { formatPriceWithCurrency, normalizeCurrency, readGuestCurrencySettings } from '../utils/currency';
import {
  ADJUSTMENT_ACTION_LABELS,
  OPERATIONAL_LOSS_CATEGORY_BADGE_LABELS,
  getDefaultOperationalLossCategory,
  getOperationalLossCategoryFromReason,
  inferAdjustmentActionType,
} from '../utils/orderItemCompensation';

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
  operationalLossCategory: OperationalLossCategory | null;
  adjustmentActionType: AdjustmentActionType | null;
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

    const merged = invoice.items.map((item, index) => {
      const quantity = asNumber(item.quantity);
      const unitPrice = asNumber(item.unit_price);
      const lineTotal = asNumber(item.line_total);
      const fallbackOriginalLine = toLineOriginalTotal(item);
      const originalUnit = asNumber((item as { original_unit_price?: string | number | null }).original_unit_price ?? unitPrice);
      const finalUnit = asNumber((item as { final_unit_price?: string | number | null }).final_unit_price ?? (lineTotal > 0 && quantity > 0 ? lineTotal / quantity : unitPrice));
      const originalLineTotal = Number.isFinite(originalUnit) && originalUnit > 0 ? originalUnit * quantity : fallbackOriginalLine;
      const finalLineTotal = Number.isFinite(finalUnit) && quantity > 0 ? finalUnit * quantity : lineTotal;

      const status = (item.status ?? 'normal');
      const compensationType = (item.compensation_type ?? 'none');
      const compensationReason = item.compensation_reason ?? null;
      const compensationNote = item.compensation_note ?? null;
      const accountingBucket = item.accounting_bucket ?? null;
      const operationalLossCategory = item.operational_loss_category
        || getOperationalLossCategoryFromReason(item.compensation_reason ?? null)
        || getDefaultOperationalLossCategory(status, compensationType);
      const isComplimentary = (
        item.is_complimentary === true
        || compensationType === 'complimentary'
      );
      const adjustmentActionType = item.adjustment_action_type
        || inferAdjustmentActionType({
          status,
          compensationType,
          isComplimentary,
          operationalLossCategory,
        });
      const approvedBy = item.approved_by_staff_name ?? null;
      const approvedAt = item.approved_at ?? null;

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
        operationalLossCategory,
        adjustmentActionType,
        approvedBy,
        approvedAt,
        isComplimentary,
      };
    });

    return merged;
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
      } else {
        stats.issue += deduction;
      }

      stats.total += deduction;
      return stats;
    }, {
      issue: 0,
      complimentary: 0,
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
        label: 'Refunds / issue deductions',
        value: formatPriceWithCurrency(adjustmentStats.issue, currency),
        tone: 'issue' as const,
      }] : []),
      ...(adjustmentStats.complimentary > 0 ? [{
        label: 'Complimentary / gift cost',
        value: formatPriceWithCurrency(adjustmentStats.complimentary, currency),
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
      { label: 'Final guest-paid total', value: formatPriceWithCurrency(netTotal, currency) },
      { label: 'Internal operational loss total', value: formatPriceWithCurrency(adjustmentStats.total, currency), tone: 'issue' as const },
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
                      const isIssue = !isComplimentary && (hasDeduction || item.status !== 'normal' || compensationType !== 'none');
                      const isCompensated = compensationType !== null && compensationType !== 'none';
                      const compensationReason = item.compensationReason || null;
                      const approvedBy = item.approvedBy || null;
                      const approvedAt = item.approvedAt || null;
                      const operationalLossCategory = item.operationalLossCategory || null;
                      const actionType = item.adjustmentActionType || null;
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
                        <td className={isComplimentary ? 'px-4 py-3 text-emerald-500' : isIssue || isCompensated ? 'px-4 py-3 text-rose-500' : 'px-4 py-3 text-text'}>
                          <div>
                            <p>{item.name}</p>
                            {isCompensated ? (
                              <p className="mt-1 text-xs text-muted">
                                {label ? `${label}` : `Compensation: ${compensationType?.replaceAll('_', ' ') || 'unknown'}`}
                                {compensationReason ? ` • Reason: ${compensationReason.replaceAll('_', ' ')}` : ''}
                                {accountingBucket ? ` • Bucket: ${accountingBucket.replaceAll('_', ' ')}` : ''}
                                {compensationNote ? ` • ${compensationNote}` : ''}
                                {actionType ? ` • Type: ${ADJUSTMENT_ACTION_LABELS[actionType]}` : ''}
                                {approvedBy ? ` • Approved by ${approvedBy}` : ''}
                                {approvedAt ? ` • ${approvedAt}` : ''}
                              </p>
                            ) : null}
                            {operationalLossCategory ? (
                              <p className="mt-1">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                                  isComplimentary
                                    ? 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                    : 'border-rose-300/35 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                }`}
                                >
                                  {OPERATIONAL_LOSS_CATEGORY_BADGE_LABELS[operationalLossCategory]}
                                </span>
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{item.quantity}</td>
                        <td className="px-4 py-3 text-muted">{formatPriceWithCurrency(item.unitPrice, currency)}</td>
                        <td className={isComplimentary ? 'px-4 py-3 font-semibold text-emerald-500' : isIssue || isCompensated ? 'px-4 py-3 font-semibold text-rose-500' : 'px-4 py-3 font-semibold text-text'}>
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
                        : row.tone === 'issue'
                          ? 'border-rose-400/35 bg-rose-500/12'
                        : row.tone === 'discount'
                          ? 'border-rose-400/30 bg-rose-500/10'
                        : 'border-stroke bg-bg1/55'
                    }`}
                  >
                    <span className="text-sm text-muted">{row.label}</span>
                    <span className={`text-sm font-semibold ${
                      row.tone === 'complimentary'
                        ? 'text-amber-500'
                        : row.tone === 'issue'
                          ? 'text-rose-500'
                        : row.tone === 'discount'
                          ? 'text-rose-500'
                          : 'text-text'
                    }`}>
                      {row.tone === 'complimentary' || row.tone === 'discount' || row.tone === 'issue' ? '- ' : ''}
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
