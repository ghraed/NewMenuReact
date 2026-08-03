export interface PrintableInvoiceItem {
  key: string;
  dishName: string;
  dishNameArabic?: string;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  originalLineSubtotal?: string;
  status?: 'normal' | 'problematic' | 'cancelled' | 'compensated';
  compensationType?: 'none' | 'full_waiver' | 'partial_discount' | 'complimentary';
  reasonLabel?: string;
  note?: string;
  badgeLabel?: string;
  approvedBy?: string;
  approvedAt?: string;
  accountingBucketLabel?: string;
  isComplimentary?: boolean;
}

export interface PrintableInvoiceSummary {
  subtotal: string;
  discountLabel: string;
  discountAmount: string;
  taxableSubtotal: string;
  vatLabel: string;
  vatAmount: string;
  total: string;
}

export interface PrintableInvoiceSplitBreakdownItem {
  key: string;
  label: string;
  amount: string;
}

export interface PrintableInvoiceSplit {
  enabled: boolean;
  mode: 'none' | 'by_person_order' | 'equal' | null;
  splitCount: number | null;
  breakdown: PrintableInvoiceSplitBreakdownItem[];
}

export interface PrintableInvoicePayload {
  sourceTableId?: number | string;
  invoiceNumber?: string;
  restaurantName: string;
  tableName: string;
  generatedAt: string;
  generatedAtIso?: string;
  notes: string[];
  items: PrintableInvoiceItem[];
  includedOrders: string[];
  summary: PrintableInvoiceSummary;
  split?: PrintableInvoiceSplit;
}

export const PRINTABLE_INVOICE_STORAGE_KEY = 'printable_invoice_payload';

export const savePrintableInvoice = (payload: PrintableInvoicePayload): void => {
  localStorage.setItem(PRINTABLE_INVOICE_STORAGE_KEY, JSON.stringify(payload));
};

export const loadPrintableInvoice = (): PrintableInvoicePayload | null => {
  const rawPayload = localStorage.getItem(PRINTABLE_INVOICE_STORAGE_KEY);

  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as PrintableInvoicePayload;
  } catch {
    return null;
  }
};

const sanitizeFilenamePart = (value: string): string => {
  const normalized = value
    .trim()
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'invoice';
};

const resolveInvoiceDate = (invoice: PrintableInvoicePayload): Date => {
  const generatedAt = invoice.generatedAtIso ? new Date(invoice.generatedAtIso) : new Date(invoice.generatedAt);
  return Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt;
};

export const getPrintableInvoiceDownloadFilename = (invoice: PrintableInvoicePayload): string => {
  const generatedAt = resolveInvoiceDate(invoice);
  const year = generatedAt.getFullYear();
  const month = String(generatedAt.getMonth() + 1).padStart(2, '0');
  const day = String(generatedAt.getDate()).padStart(2, '0');
  const hours = String(generatedAt.getHours()).padStart(2, '0');
  const minutes = String(generatedAt.getMinutes()).padStart(2, '0');

  const restaurantName = sanitizeFilenamePart(invoice.restaurantName);
  const tableId = sanitizeFilenamePart(String(invoice.sourceTableId ?? invoice.tableName));

  return `${restaurantName}-${tableId}-${year}-${month}-${day}-${hours}-${minutes}.pdf`;
};
