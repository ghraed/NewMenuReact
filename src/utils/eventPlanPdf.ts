import { jsPDF } from 'jspdf';
import type { EventForecast, EventReservationRecord } from '../types';

export interface EventPlanPdfPayload {
  restaurantName: string;
  event: Pick<
    EventReservationRecord,
    'id' | 'title' | 'customer_name' | 'customer_phone' | 'customer_email' | 'status' | 'notes' | 'event_date' | 'start_time' | 'end_time' | 'room_plan'
  >;
  plannedMenu: Array<{
    category: string;
    items: Array<{
      dishName: string;
      plannedQuantity: number;
      prepNotes?: string | null;
    }>;
  }>;
  forecast?: EventForecast | null;
}

const sanitizeFilenamePart = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'event-plan';
};

const addWrappedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number => {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const ensurePageSpace = (doc: jsPDF, y: number, requiredHeight: number): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + requiredHeight <= pageHeight - 14) {
    return y;
  }

  doc.addPage();
  return 18;
};

export const getEventPlanPdfFilename = (payload: EventPlanPdfPayload): string => {
  const restaurant = sanitizeFilenamePart(payload.restaurantName);
  const eventTitle = sanitizeFilenamePart(payload.event.title);
  const date = sanitizeFilenamePart(payload.event.event_date);

  return `${restaurant}-${eventTitle}-${date}.pdf`;
};

export const downloadEventPlanPdf = (payload: EventPlanPdfPayload): void => {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;
  const left = 14;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Event Plan', left, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(payload.restaurantName || 'Restaurant', left, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Event Details', left, y);
  y += 6;
  doc.setFont('helvetica', 'normal');

  const detailRows = [
    `Title: ${payload.event.title || '-'}`,
    `Customer: ${payload.event.customer_name || '-'}`,
    `Phone: ${payload.event.customer_phone || '-'}`,
    `Email: ${payload.event.customer_email || '-'}`,
    `Date: ${payload.event.event_date || '-'}`,
    `Time: ${payload.event.start_time || '-'} - ${payload.event.end_time || '-'}`,
    `Status: ${payload.event.status || '-'}`,
    `Room plan: ${payload.event.room_plan?.name || 'All Room Plans'}`,
  ];

  detailRows.forEach((row) => {
    y = ensurePageSpace(doc, y, 8);
    y = addWrappedText(doc, row, left, y, contentWidth, 5);
    y += 1;
  });

  y += 3;
  y = ensurePageSpace(doc, y, 16);
  doc.setFont('helvetica', 'bold');
  doc.text('Operational Notes', left, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(doc, payload.event.notes?.trim() || 'None', left, y, contentWidth, 5);
  y += 4;

  y = ensurePageSpace(doc, y, 16);
  doc.setFont('helvetica', 'bold');
  doc.text('Planned Menu', left, y);
  y += 6;

  if (payload.plannedMenu.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('No planned menu items.', left, y);
    y += 6;
  } else {
    payload.plannedMenu.forEach((group) => {
      y = ensurePageSpace(doc, y, 12);
      doc.setFont('helvetica', 'bold');
      doc.text(group.category, left, y);
      y += 5;

      group.items.forEach((item) => {
        y = ensurePageSpace(doc, y, 12);
        doc.setFont('helvetica', 'normal');
        y = addWrappedText(doc, `${item.dishName} x${item.plannedQuantity}`, left + 2, y, contentWidth - 2, 5);
        if (item.prepNotes?.trim()) {
          y = addWrappedText(doc, `Prep: ${item.prepNotes.trim()}`, left + 6, y, contentWidth - 6, 5);
        }
        y += 1;
      });

      y += 2;
    });
  }

  y = ensurePageSpace(doc, y, 18);
  doc.setFont('helvetica', 'bold');
  doc.text('Forecast Summary', left, y);
  y += 6;
  doc.setFont('helvetica', 'normal');

  if (!payload.forecast) {
    doc.text('Forecast not available for this export.', left, y);
    y += 6;
  } else {
    const summaryRows = [
      `Planned dishes: ${payload.forecast.summary.dish_count}`,
      `Ingredients involved: ${payload.forecast.summary.ingredient_count}`,
      `Shortages: ${payload.forecast.summary.shortage_count}`,
    ];

    summaryRows.forEach((row) => {
      y = ensurePageSpace(doc, y, 8);
      doc.text(row, left, y);
      y += 5;
    });

    if (payload.forecast.ingredient_totals.length > 0) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Ingredient Totals', left, y);
      y += 6;
      doc.setFont('helvetica', 'normal');

      payload.forecast.ingredient_totals.forEach((ingredient) => {
        y = ensurePageSpace(doc, y, 10);
        const line = `${ingredient.ingredient_name} (${ingredient.unit}): need ${ingredient.required_quantity}, available ${ingredient.available_quantity}`;
        y = addWrappedText(doc, line, left, y, contentWidth, 5);
        if (ingredient.is_shortage) {
          y = addWrappedText(doc, `Shortage: ${ingredient.shortage_quantity}`, left + 4, y, contentWidth - 4, 5);
        }
        y += 1;
      });
    }
  }

  doc.save(getEventPlanPdfFilename(payload));
};
