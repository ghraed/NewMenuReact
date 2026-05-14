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
  restaurantName: string;
  tableName: string;
  generatedAt: string;
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
