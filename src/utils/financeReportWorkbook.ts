import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
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

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend);

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

const buildFinancialOverviewChartPng = async (
  input: FinanceExecutiveWorkbookInput
): Promise<string | null> => {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const values = [
    input.pnl.revenue,
    input.pnl.gross_profit,
    input.pnl.operating_expenses,
    input.pnl.net_profit,
    input.tax.net_vat_payable,
  ];
  const labels = ['Revenue', 'Gross Profit', 'Operating Expenses', 'Net Profit', 'Net VAT Payable'];
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const pad = maxAbs * 0.25;

  const chart = new ChartJS(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Amount',
        data: values,
        borderWidth: 0,
        borderRadius: 6,
        barThickness: 22,
        maxBarThickness: 24,
        categoryPercentage: 0.58,
        backgroundColor: values.map((v) => {
          if (v < 0) return '#DC2626';
          if (v === input.pnl.revenue) return 'rgba(201, 162, 90, 0.80)'; // finance page revenue
          if (v === input.pnl.gross_profit) return 'rgba(164, 201, 152, 0.94)'; // finance page profit green
          if (v === input.pnl.operating_expenses) return 'rgba(189, 163, 138, 0.94)'; // finance page operating expenses
          if (v === input.pnl.net_profit) return 'rgba(122, 156, 115, 0.34)'; // finance page net profit
          if (v === input.tax.net_vat_payable) return 'rgba(170, 121, 73, 0.76)'; // finance page cogs-like bronze
          return '#0B1120';
        }),
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Financial Performance Overview',
          color: '#0B1120',
          font: { size: 30, weight: 'bold', family: 'Arial' },
          padding: { bottom: 20 },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${Number(context.parsed.x ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: {
          min: -pad,
          max: maxAbs + pad,
          grid: { color: '#D1D5DB' },
          ticks: { color: '#111827', font: { size: 11, family: 'Arial' } },
        },
        y: {
          grid: { color: '#E5E7EB' },
          ticks: { color: '#111827', font: { size: 12, family: 'Arial' } },
        },
      },
    },
  });

  const pngDataUrl = chart.toBase64Image('image/png', 1);
  chart.destroy();
  return pngDataUrl;
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
    { width: 2 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 2 },
  ];
  source.columns = [{ width: 40 }, { width: 22 }];

  for (let row = 1; row <= 60; row += 1) {
    dashboard.getRow(row).height = 22;
    for (let col = 2; col <= 12; col += 1) {
      dashboard.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F0EC' } };
    }
  }

  const moneyText = (value: number): string => {
    const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (value < 0) {
      return `${input.currency} (${abs})`;
    }
    return `${input.currency} ${abs}`;
  };
  const percentText = (value: number): string => `${(value * 100).toFixed(1)}%`;

  const totalIncome = input.pnl.revenue;
  const netProfit = input.pnl.net_profit;
  const vatTotal = input.tax.net_vat_payable;
  const payrollTotal = input.payroll.net_pay;
  const grossMargin = totalIncome !== 0 ? input.pnl.gross_profit / totalIncome : 0;
  const netMargin = totalIncome !== 0 ? netProfit / totalIncome : 0;
  const operatingMargin = totalIncome !== 0 ? input.pnl.operating_expenses / totalIncome : 0;
  const payrollMargin = totalIncome !== 0 ? payrollTotal / totalIncome : 0;

  // Header
  dashboard.mergeCells('B1:L2');
  for (let row = 1; row <= 2; row += 1) {
    for (let col = 2; col <= 12; col += 1) {
      dashboard.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkNavy } };
    }
  }
  dashboard.getCell('B1').value = 'FINANCIAL PERFORMANCE REPORT';
  dashboard.getCell('B1').font = { name: 'Arial', bold: true, size: 18, color: { argb: 'F6DEA3' } };
  dashboard.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' };
  dashboard.mergeCells('B3:L3');
  dashboard.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gold } };
  dashboard.getCell('F2').value = `${input.currency}  |  ${input.dateFrom && input.dateTo ? `${input.dateFrom} - ${input.dateTo}` : 'All time'}  |  Executive Summary`;
  dashboard.getCell('F2').font = { name: 'Arial', size: 11, color: { argb: COLORS.white } };
  dashboard.getCell('F2').alignment = { horizontal: 'center' };

  // KPI row
  const kpiStarts = ['B5', 'D5', 'F5', 'H5', 'J5'];
  const kpiData = [
    { label: 'Revenue', value: moneyText(totalIncome), hint: 'Total top-line revenue', isNegative: totalIncome < 0 },
    { label: 'Gross Profit', value: moneyText(input.pnl.gross_profit), hint: 'Revenue less COGS', isNegative: input.pnl.gross_profit < 0 },
    { label: 'Operating Expenses', value: moneyText(input.pnl.operating_expenses), hint: 'Total operating costs', isNegative: input.pnl.operating_expenses < 0 },
    { label: 'Net Profit', value: moneyText(netProfit), hint: 'Final profit / loss', isNegative: netProfit < 0 },
    { label: 'Net VAT Payable', value: moneyText(vatTotal), hint: 'VAT credit / payable', isNegative: vatTotal < 0 },
  ];
  kpiStarts.forEach((start, index) => {
    const col = start.charCodeAt(0) - 64;
    for (let r = 5; r <= 9; r += 1) {
      for (let c = col; c <= col + 1; c += 1) {
        dashboard.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
      }
    }
    dashboard.mergeCells(`${String.fromCharCode(64 + col)}5:${String.fromCharCode(64 + col + 1)}5`);
    dashboard.mergeCells(`${String.fromCharCode(64 + col)}7:${String.fromCharCode(64 + col + 1)}7`);
    dashboard.mergeCells(`${String.fromCharCode(64 + col)}9:${String.fromCharCode(64 + col + 1)}9`);
    dashboard.getCell(`${String.fromCharCode(64 + col)}5`).value = kpiData[index].label;
    dashboard.getCell(`${String.fromCharCode(64 + col)}5`).font = { name: 'Arial', bold: true, size: 11, color: { argb: '7A5313' } };
    dashboard.getCell(`${String.fromCharCode(64 + col)}7`).value = kpiData[index].value;
    dashboard.getCell(`${String.fromCharCode(64 + col)}7`).font = {
      name: 'Arial',
      bold: true,
      size: 16,
      color: { argb: kpiData[index].isNegative ? COLORS.red : COLORS.darkNavy },
    };
    dashboard.getCell(`${String.fromCharCode(64 + col)}9`).value = kpiData[index].hint;
    dashboard.getCell(`${String.fromCharCode(64 + col)}9`).font = { name: 'Arial', size: 9, color: { argb: COLORS.muted } };
  });

  // Status strip
  dashboard.mergeCells('B11:L11');
  dashboard.getCell('B11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '121212' } };
  dashboard.getCell('B11').value = netProfit < 0
    ? `Status: Loss Position - net profit is ${moneyText(netProfit)}.`
    : `Status: Profit Position - net profit is ${moneyText(netProfit)}.`;
  dashboard.getCell('B11').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'F6DEA3' } };
  dashboard.getCell('B11').alignment = { horizontal: 'center' };

  const sectionHeader = (range: string, title: string) => {
    dashboard.mergeCells(range);
    const cell = dashboard.getCell(range.split(':')[0]);
    cell.value = title;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkNavy } };
    cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'F6DEA3' } };
  };
  sectionHeader('B13:E13', 'Income Statement');
  sectionHeader('F13:H13', 'VAT Summary');
  sectionHeader('I13:K13', 'Payroll Summary');

  // Income/VAT/Payroll tables
  const incomeRows: Array<[string, string, string | number]> = [
    ['Revenue', moneyText(totalIncome), percentText(totalIncome !== 0 ? 1 : 0)],
    ['COGS', moneyText(input.pnl.cogs), percentText(totalIncome !== 0 ? input.pnl.cogs / totalIncome : 0)],
    ['Gross Profit', moneyText(input.pnl.gross_profit), percentText(grossMargin)],
    ['Operating Expenses', moneyText(input.pnl.operating_expenses), percentText(operatingMargin)],
    ['Net Profit', moneyText(netProfit), percentText(netMargin)],
  ];
  incomeRows.forEach((row, i) => {
    const r = 14 + i;
    dashboard.getCell(`B${r}`).value = row[0];
    dashboard.getCell(`D${r}`).value = row[1];
    dashboard.getCell(`E${r}`).value = row[2];
    dashboard.getCell(`B${r}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: COLORS.darkNavy } };
    dashboard.getCell(`D${r}`).font = { name: 'Arial', size: 11, color: { argb: row[1].includes('(') ? COLORS.red : COLORS.darkNavy } };
    dashboard.getCell(`E${r}`).font = { name: 'Arial', size: 11, color: { argb: Number(row[2]) < 0 ? COLORS.red : COLORS.darkNavy } };
    if (r === 17 || r === 18) {
      for (let c = 2; c <= 5; c += 1) dashboard.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2EAD3' } };
    }
  });

  const vatRows: Array<[string, string]> = [
    ['Taxable Sales', moneyText(input.tax.taxable_sales)],
    ['Output VAT', moneyText(input.tax.output_vat)],
    ['Input VAT', moneyText(input.tax.input_vat)],
    ['Net VAT Payable', moneyText(vatTotal)],
  ];
  vatRows.forEach((row, i) => {
    const r = 14 + i;
    dashboard.getCell(`F${r}`).value = row[0];
    dashboard.getCell(`H${r}`).value = row[1];
    dashboard.getCell(`F${r}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: COLORS.darkNavy } };
    dashboard.getCell(`H${r}`).font = { name: 'Arial', size: 11, color: { argb: row[1].includes('(') ? COLORS.red : COLORS.darkNavy } };
  });

  const payrollRows: Array<[string, string]> = [
    ['Gross Payroll', moneyText(input.payroll.gross_pay)],
    ['Deductions', moneyText(input.payroll.deductions)],
    ['Payroll Tax', moneyText(input.payroll.tax)],
    ['Net Payroll', moneyText(payrollTotal)],
    ['Employees Paid', `${input.currency} ${input.payroll.employee_count.toFixed(2)}`],
  ];
  payrollRows.forEach((row, i) => {
    const r = 14 + i;
    dashboard.getCell(`I${r}`).value = row[0];
    dashboard.getCell(`K${r}`).value = row[1];
    dashboard.getCell(`I${r}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: COLORS.darkNavy } };
    dashboard.getCell(`K${r}`).font = { name: 'Arial', size: 11, color: { argb: row[1].includes('(') ? COLORS.red : COLORS.darkNavy } };
    if (r === 18) {
      for (let c = 9; c <= 11; c += 1) dashboard.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2EAD3' } };
    }
  });

  // Insights block
  sectionHeader('B22:L22', 'EXECUTIVE INSIGHTS');
  const insightRows: Array<[string, string]> = [
    ['Revenue Strength', `Revenue is ${moneyText(totalIncome)}; gross profit equals ${moneyText(input.pnl.gross_profit)}.`],
    ['Cost Pressure', `Operating expenses of ${moneyText(input.pnl.operating_expenses)} versus revenue ${moneyText(totalIncome)}.`],
    ['Profitability', `Net result is ${moneyText(netProfit)} for the selected range.`],
    ['VAT Position', `Net VAT payable is ${moneyText(vatTotal)}.`],
  ];
  insightRows.forEach((row, i) => {
    const r = 23 + i;
    dashboard.mergeCells(`C${r}:L${r}`);
    dashboard.getCell(`B${r}`).value = row[0];
    dashboard.getCell(`C${r}`).value = row[1];
    dashboard.getCell(`B${r}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: '7A5313' } };
    dashboard.getCell(`C${r}`).font = { name: 'Arial', size: 10, color: { argb: COLORS.darkNavy } };
    dashboard.getCell(`B${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2EAD3' } };
    dashboard.getCell(`C${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
  });

  sectionHeader('B28:L28', 'PERFORMANCE INDICATORS');
  dashboard.mergeCells('B30:E30');
  dashboard.getCell('B30').value = 'Expense / Revenue';
  dashboard.getCell('B30').font = { name: 'Arial', bold: true, size: 11, color: { argb: '7A5313' } };
  dashboard.mergeCells('B32:E32');
  dashboard.getCell('B32').value = percentText(operatingMargin);
  dashboard.getCell('B32').font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.darkNavy } };
  dashboard.mergeCells('B34:E34');
  dashboard.getCell('B34').value = 'Operating expenses divided by revenue';
  dashboard.getCell('B34').font = { name: 'Arial', size: 9, color: { argb: COLORS.muted } };

  dashboard.mergeCells('I30:L30');
  dashboard.getCell('I30').value = 'Payroll / Revenue';
  dashboard.getCell('I30').font = { name: 'Arial', bold: true, size: 11, color: { argb: '7A5313' } };
  dashboard.mergeCells('I32:L32');
  dashboard.getCell('I32').value = percentText(payrollMargin);
  dashboard.getCell('I32').font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.darkNavy } };
  dashboard.mergeCells('I34:L34');
  dashboard.getCell('I34').value = 'Net payroll divided by revenue';
  dashboard.getCell('I34').font = { name: 'Arial', size: 9, color: { argb: COLORS.muted } };

  // chart helper data (kept dynamic)
  dashboard.getCell('B44').value = 'Metric';
  dashboard.getCell('C44').value = 'Value';
  const chartPairs: Array<[string, number]> = [
    ['Revenue', totalIncome],
    ['Gross Profit', input.pnl.gross_profit],
    ['Operating Expenses', input.pnl.operating_expenses],
    ['Net Profit', netProfit],
    ['Net VAT Payable', vatTotal],
  ];
  chartPairs.forEach(([metric, value], idx) => {
    const r = 45 + idx;
    dashboard.getCell(`B${r}`).value = metric;
    dashboard.getCell(`C${r}`).value = value;
  });

  // Dynamic chart rendering
  const hasChartData = [totalIncome, input.pnl.gross_profit, input.pnl.operating_expenses, netProfit, vatTotal]
    .some((value) => value !== 0);
  if (hasChartData) {
    const pngDataUrl = await buildFinancialOverviewChartPng(input);
    if (pngDataUrl) {
      const imageId = workbook.addImage({ base64: pngDataUrl, extension: 'png' });
      dashboard.addImage(imageId, 'E30:I42');
    } else {
      placeNoDataCard(dashboard, 'E31', 'E32', 'Financial Performance Overview');
    }
  } else {
    placeNoDataCard(dashboard, 'E31', 'E32', 'Financial Performance Overview');
  }

  // Bottom metric table + note
  sectionHeader('B37:D37', 'Metric');
  dashboard.getCell('E37').value = 'Amount';
  dashboard.getCell('E37').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkNavy } };
  dashboard.getCell('E37').font = { name: 'Arial', bold: true, size: 12, color: { argb: COLORS.white } };
  const bottomRows: Array<[string, string]> = [
    ['Revenue', moneyText(totalIncome)],
    ['Gross Profit', moneyText(input.pnl.gross_profit)],
    ['Operating Expenses', moneyText(input.pnl.operating_expenses)],
    ['Net Profit', moneyText(netProfit)],
    ['Net VAT Payable', moneyText(vatTotal)],
  ];
  bottomRows.forEach((row, i) => {
    const r = 38 + i;
    dashboard.mergeCells(`B${r}:D${r}`);
    dashboard.getCell(`B${r}`).value = row[0];
    dashboard.getCell(`E${r}`).value = row[1];
    dashboard.getCell(`B${r}`).font = { name: 'Arial', size: 11, color: { argb: COLORS.darkNavy } };
    dashboard.getCell(`E${r}`).font = { name: 'Arial', size: 11, color: { argb: row[1].includes('(') ? COLORS.red : COLORS.darkNavy } };
  });
  dashboard.mergeCells('I36:L36');
  dashboard.getCell('I36').value = 'Prepared from source CSV - styled for executive review.';
  dashboard.getCell('I36').font = { name: 'Arial', size: 10, italic: true, color: { argb: COLORS.muted } };

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
