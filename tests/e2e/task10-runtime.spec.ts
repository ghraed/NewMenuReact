import { resolve } from 'node:path';
import { test, expect } from '../setup/qaBrowser';

test('finance deep link reload and demand-loaded spreadsheet export work from built assets', async ({ page }, testInfo) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your Menu Items', exact: true })).toBeVisible();
  const settled = await page.evaluate(async (run) => {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
    const created = await fetch('/api/dishes', { method: 'POST', headers, body: JSON.stringify({ name: `QA_RUN_${run}_export`, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 5, status: 'published' }) });
    const dish = await created.json();
    const response = await fetch('/api/pos/checkout', { method: 'POST', headers, body: JSON.stringify({ payment_method: 'cash', items: [{ dish_id: dish.id, quantity: 1 }] }) });
    const sale = await response.json();
    return { created: created.status, paid: response.status, total: sale.payment.total };
  }, process.env.QA_RUN_ID);
  expect(settled).toEqual({ created: 201, paid: 201, total: '10.00' });
  const scripts: string[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scripts.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto('/admin/finance');
  await expect(page.getByRole('heading', { name: 'Luxury Financial Overview' })).toBeVisible();
  expect(scripts.some((path) => path.includes('financeReportWorkbook'))).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Luxury Financial Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download finance excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = testInfo.outputPath('QA_RUN_finance.xlsx');
  await download.saveAs(path);
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  expect(workbook.worksheets.length).toBeGreaterThan(0);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Executive Dashboard', 'Source Data']);
  expect(workbook.getWorksheet('Executive Dashboard')!.getCell('B7').text).toBe('USD 10.00');
  expect(scripts.some((script) => /^200 .*financeReportWorkbook/.test(script))).toBe(true);
  expect(scripts.every((script) => script.startsWith('200 '))).toBe(true);
  await testInfo.attach('loaded-scripts', { body: JSON.stringify(scripts), contentType: 'application/json' });
  // Simulate an unavailable lazy asset; backend responses remain real.
  await page.route('**/assets/AdminFinanceDashboardPage-*.js', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA_RUN missing asset' }));
  await page.goto('/admin/finance');
  await expect(page.getByText('Something went wrong', { exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'task10-unavailable-chunk.png') });
  await page.unroute('**/assets/AdminFinanceDashboardPage-*.js');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Luxury Financial Overview' })).toBeVisible();
});
