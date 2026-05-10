import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { FinanceProfitAndLossSummary, FinanceTaxSummary, PayrollSummaryTotals } from '../types';

const COLORS = {
  darkNavy: '0B1120',
  charcoal: '111827',
  gold: 'C9A227',
  lightBg: 'F8FAFC',
  white: 'FFFFFF',
  muted: '64748B',
  green: '16A34A',
  red: 'DC2626',
  borderGray: 'E5E7EB',
};

const currencyFormat = '"$"#,##0.00;[Red]-"$"#,##0.00';
const percentFormat = '0.00%';

export interface FinanceExecutiveWorkbookInput {
  companyName: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
  pnl: FinanceProfitAndLossSummary;
  tax: FinanceTaxSummary;
  payroll: PayrollSummaryTotals;
  chartLabels: string[];
  chartMetrics: {
    revenue: number[];
    totalCosts: number[];
    netProfit: number[];
    cogs: number[];
    operatingExpenses: number[];
    payroll: number[];
  };
}

const sourceRows = (input: FinanceExecutiveWorkbookInput): Array<[string, string | number]> => {
  const rangeLabel = input.dateFrom && input.dateTo
    ? `${input.dateFrom} to ${input.dateTo}`
    : 'All time';

  return [
    ['Currency', input.currency],
    ['Date Range', rangeLabel],
    ['P&L Revenue', input.pnl.revenue],
    ['P&L COGS', input.pnl.cogs],
    ['P&L Gross Profit', input.pnl.gross_profit],
    ['P&L Operating Expenses', input.pnl.operating_expenses],
    ['P&L Net Profit', input.pnl.net_profit],
    ['Taxable Sales', input.tax.taxable_sales],
    ['Output VAT', input.tax.output_vat],
    ['Input VAT', input.tax.input_vat],
    ['Net VAT Payable', input.tax.net_vat_payable],
    ['Payroll Gross', input.payroll.gross_pay],
    ['Payroll Deductions', input.payroll.deductions],
    ['Payroll Tax', input.payroll.tax],
    ['Payroll Net', input.payroll.net_pay],
    ['Employees Paid', input.payroll.employee_count],
  ];
};

const styleKpiCard = (sheet: ExcelJS.Worksheet, fromCol: number, toCol: number, rowStart: number, rowEnd: number) => {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      const cell = sheet.getCell(row, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderGray } },
        left: { style: 'thin', color: { argb: COLORS.borderGray } },
        bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
        right: { style: 'thin', color: { argb: COLORS.borderGray } },
      };
    }
  }

  for (let col = fromCol; col <= toCol; col += 1) {
    sheet.getCell(rowStart, col).border = {
      top: { style: 'medium', color: { argb: COLORS.gold } },
      left: { style: 'thin', color: { argb: COLORS.borderGray } },
      bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
      right: { style: 'thin', color: { argb: COLORS.borderGray } },
    };
  }
};

const placeNoDataCard = (
  sheet: ExcelJS.Worksheet,
  titleCell: string,
  messageCell: string,
  title: string
) => {
  sheet.getCell(titleCell).value = title;
  sheet.getCell(titleCell).font = { name: 'Aptos', bold: true, size: 12, color: { argb: COLORS.charcoal } };
  sheet.getCell(messageCell).value = 'No data available for this chart';
  sheet.getCell(messageCell).font = { name: 'Aptos', italic: true, color: { argb: COLORS.muted } };
};

export const downloadFinanceExecutiveWorkbook = async (input: FinanceExecutiveWorkbookInput): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Menu Finance';
  workbook.created = new Date();

  // Section A: Workbook structure (Executive Dashboard first, Source Data second)
  const dashboard = workbook.addWorksheet('Executive Dashboard', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const source = workbook.addWorksheet('Source Data', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  dashboard.columns = [
    { width: 4 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 4 }, { width: 4 },
  ];
  source.columns = [{ width: 40 }, { width: 22 }];

  for (let row = 1; row <= 140; row += 1) {
    dashboard.getRow(row).height = row === 1 ? 28 : 22;
    for (let col = 1; col <= 10; col += 1) {
      dashboard.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightBg } };
    }
  }

  // Section B: Top luxury header
  dashboard.mergeCells('B2:J5');
  for (let row = 2; row <= 5; row += 1) {
    for (let col = 2; col <= 10; col += 1) {
      dashboard.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkNavy } };
    }
  }
  dashboard.getCell('B3').value = 'Executive Finance Report';
  dashboard.getCell('B3').font = { name: 'Aptos', bold: true, size: 24, color: { argb: COLORS.white } };
  dashboard.getCell('B4').value = input.companyName || 'Company Finance';
  dashboard.getCell('B4').font = { name: 'Aptos', bold: true, size: 12, color: { argb: COLORS.gold } };
  dashboard.getCell('I3').value = 'Report Period';
  dashboard.getCell('I3').font = { name: 'Aptos', bold: true, size: 10, color: { argb: COLORS.gold } };
  dashboard.getCell('I4').value = input.dateFrom && input.dateTo ? `${input.dateFrom} - ${input.dateTo}` : 'All time';
  dashboard.getCell('I4').font = { name: 'Aptos', size: 11, color: { argb: COLORS.white } };

  dashboard.mergeCells('B6:J6');
  dashboard.getCell('B6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gold } };

  // Section C: KPI summary cards
  const totalIncome = input.pnl.revenue;
  const totalExpenses = input.pnl.cogs + input.pnl.operating_expenses;
  const netProfit = input.pnl.net_profit;
  const vatTotal = input.tax.net_vat_payable;
  const payrollTotal = input.payroll.net_pay;
  const profitMargin = totalIncome !== 0 ? netProfit / totalIncome : 0;

  const kpis = [
    { label: 'TOTAL INCOME', value: totalIncome, format: currencyFormat },
    { label: 'TOTAL EXPENSES', value: totalExpenses, format: currencyFormat },
    { label: 'NET PROFIT', value: netProfit, format: currencyFormat },
    { label: 'VAT TOTAL', value: vatTotal, format: currencyFormat },
    { label: 'PAYROLL TOTAL', value: payrollTotal, format: currencyFormat },
    { label: 'PROFIT MARGIN', value: profitMargin, format: percentFormat },
  ];

  const starts = ['B8', 'E8', 'H8', 'B12', 'E12', 'H12'];
  for (let i = 0; i < kpis.length; i += 1) {
    const start = starts[i];
    const col = start.charCodeAt(0) - 64;
    const row = Number(start.slice(1));
    styleKpiCard(dashboard, col, col + 2, row, row + 2);
    dashboard.mergeCells(`${start}:${String.fromCharCode(64 + col + 2)}${row}`);
    dashboard.mergeCells(`${String.fromCharCode(64 + col)}${row + 1}:${String.fromCharCode(64 + col + 2)}${row + 1}`);
    dashboard.getCell(start).value = kpis[i].label;
    dashboard.getCell(start).font = { name: 'Aptos', bold: true, size: 9, color: { argb: COLORS.muted } };
    dashboard.getCell(start).alignment = { horizontal: 'left', vertical: 'middle' };
    const valueCell = dashboard.getCell(`${String.fromCharCode(64 + col)}${row + 1}`);
    valueCell.value = kpis[i].value;
    valueCell.numFmt = kpis[i].format;
    valueCell.font = {
      name: 'Aptos',
      bold: true,
      size: 16,
      color: { argb: (typeof kpis[i].value === 'number' && kpis[i].value < 0) ? COLORS.red : COLORS.green },
    };
  }

  // Section D: Helper chart datasets (real worksheet cells)
  dashboard.getCell('B17').value = 'Chart Data (Connected to Source Data)';
  dashboard.getCell('B17').font = { name: 'Aptos', bold: true, size: 11, color: { argb: COLORS.charcoal } };
  dashboard.getCell('B18').value = 'Period';
  dashboard.getCell('C18').value = 'Income';
  dashboard.getCell('D18').value = 'Expenses';
  dashboard.getCell('E18').value = 'Net Profit';
  dashboard.getCell('F18').value = 'VAT';
  dashboard.getCell('G18').value = 'Payroll';
  ['B18', 'C18', 'D18', 'E18', 'F18', 'G18'].forEach((address) => {
    const cell = dashboard.getCell(address);
    cell.font = { name: 'Aptos', bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.charcoal } };
    cell.border = { bottom: { style: 'medium', color: { argb: COLORS.gold } } };
  });

  const periodRows = Math.max(input.chartLabels.length, 1);
  for (let i = 0; i < periodRows; i += 1) {
    const row = 19 + i;
    dashboard.getCell(`B${row}`).value = input.chartLabels[i] || 'N/A';
    dashboard.getCell(`C${row}`).value = input.chartMetrics.revenue[i] ?? totalIncome;
    dashboard.getCell(`D${row}`).value = input.chartMetrics.totalCosts[i] ?? totalExpenses;
    dashboard.getCell(`E${row}`).value = input.chartMetrics.netProfit[i] ?? netProfit;
    dashboard.getCell(`F${row}`).value = input.tax.net_vat_payable;
    dashboard.getCell(`G${row}`).value = input.chartMetrics.payroll[i] ?? payrollTotal;
    ['C', 'D', 'E', 'F', 'G'].forEach((col) => {
      dashboard.getCell(`${col}${row}`).numFmt = currencyFormat;
    });
  }

  // Section E: Chart placeholders / no-data states
  placeNoDataCard(dashboard, 'B30', 'B31', 'Income vs Expenses');
  placeNoDataCard(dashboard, 'E30', 'E31', 'Net Profit');
  if (vatTotal !== 0) {
    dashboard.getCell('H30').value = 'VAT Summary';
    dashboard.getCell('H30').font = { name: 'Aptos', bold: true, size: 12, color: { argb: COLORS.charcoal } };
    dashboard.getCell('H31').value = 'Uses data range F19:F200';
    dashboard.getCell('H31').font = { name: 'Aptos', color: { argb: COLORS.muted } };
  } else {
    placeNoDataCard(dashboard, 'H30', 'H31', 'VAT Summary');
  }
  if (payrollTotal !== 0) {
    dashboard.getCell('B35').value = 'Payroll Summary';
    dashboard.getCell('B35').font = { name: 'Aptos', bold: true, size: 12, color: { argb: COLORS.charcoal } };
    dashboard.getCell('B36').value = 'Uses data range G19:G200';
    dashboard.getCell('B36').font = { name: 'Aptos', color: { argb: COLORS.muted } };
  } else {
    placeNoDataCard(dashboard, 'B35', 'B36', 'Payroll Summary');
  }

  // Section F: Executive insights area
  dashboard.getCell('B40').value = 'Executive Insights';
  dashboard.getCell('B40').font = { name: 'Aptos', bold: true, size: 13, color: { argb: COLORS.charcoal } };
  const insights: Array<[string, string | number]> = [
    ['Total income', totalIncome],
    ['Total expenses', totalExpenses],
    ['Net profit', netProfit],
    ['Profit margin', profitMargin],
    ['Largest income category', 'Revenue'],
    ['Largest expense category', input.pnl.cogs >= input.pnl.operating_expenses ? 'COGS' : 'Operating Expenses'],
    ['VAT total', vatTotal],
    ['Payroll total', payrollTotal],
  ];
  insights.forEach(([label, value], index) => {
    const row = 41 + index;
    dashboard.getCell(`B${row}`).value = label;
    dashboard.getCell(`B${row}`).font = { name: 'Aptos', color: { argb: COLORS.charcoal } };
    dashboard.getCell(`E${row}`).value = value;
    dashboard.getCell(`E${row}`).font = { name: 'Aptos', bold: true, color: { argb: COLORS.charcoal } };
    if (typeof value === 'number') {
      dashboard.getCell(`E${row}`).numFmt = label.includes('margin') ? percentFormat : currencyFormat;
    }
  });

  // Section G: Source Data styling (preserve exported metrics/values)
  source.getCell('A1').value = 'metric';
  source.getCell('B1').value = 'value';
  ['A1', 'B1'].forEach((address) => {
    const cell = source.getCell(address);
    cell.font = { name: 'Aptos', bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkNavy } };
    cell.border = { bottom: { style: 'medium', color: { argb: COLORS.gold } } };
  });

  const rows = sourceRows(input);
  rows.forEach(([metric, value], index) => {
    const row = index + 2;
    source.getCell(`A${row}`).value = metric;
    source.getCell(`B${row}`).value = value;
    source.getCell(`A${row}`).font = { name: 'Calibri', size: 11, color: { argb: COLORS.charcoal } };
    source.getCell(`B${row}`).font = { name: 'Calibri', size: 11, color: { argb: COLORS.charcoal } };
    if (typeof value === 'number' && metric !== 'Employees Paid') {
      source.getCell(`B${row}`).numFmt = currencyFormat;
    }

    const fillColor = row % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
    ['A', 'B'].forEach((col) => {
      const cell = source.getCell(`${col}${row}`);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.borderGray } },
        left: { style: 'thin', color: { argb: COLORS.borderGray } },
        bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
        right: { style: 'thin', color: { argb: COLORS.borderGray } },
      };
    });
  });

  source.autoFilter = {
    from: 'A1',
    to: `B${rows.length + 1}`,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const dateToken = `${input.dateFrom || 'all'}-${input.dateTo || 'all'}`;
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `finance-report-${dateToken}.xlsx`
  );
};
