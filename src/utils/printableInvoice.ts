import { getVerifiedBrowserIdentity, readProtectedJson, writeProtectedJson, type BrowserIdentity } from '../services/protectedBrowserStorage';
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

export interface GuestInvoiceIdentity { restaurantId: number; tableId: number; guestAccessToken: string }

const guestInvoiceKey = (guest: GuestInvoiceIdentity): string | null => (
  Number.isSafeInteger(guest.restaurantId) && guest.restaurantId > 0
    && Number.isSafeInteger(guest.tableId) && guest.tableId > 0 && !!guest.guestAccessToken
    ? `guest_invoice_v2:restaurant:${guest.restaurantId}:table:${guest.tableId}` : null
);

export const savePrintableInvoice = (payload: PrintableInvoicePayload, guest?: GuestInvoiceIdentity, expected: BrowserIdentity | null = getVerifiedBrowserIdentity()): void => {
  if (!guest) {
    writeProtectedJson(PRINTABLE_INVOICE_STORAGE_KEY, payload, 'account', expected);
    return;
  }
  const key = guestInvoiceKey(guest);
  if (key) localStorage.setItem(key, JSON.stringify({ guestAccessToken: guest.guestAccessToken, payload }));
};

export const loadPrintableInvoice = (guest?: GuestInvoiceIdentity): PrintableInvoicePayload | null => {
  if (!guest) return readProtectedJson<PrintableInvoicePayload | null>(PRINTABLE_INVOICE_STORAGE_KEY, null, 'account');
  const key = guestInvoiceKey(guest);
  try {
    const raw = key ? localStorage.getItem(key) : null;
    const cached = raw ? JSON.parse(raw) : null;
    return cached?.guestAccessToken === guest.guestAccessToken ? cached.payload : null;
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
