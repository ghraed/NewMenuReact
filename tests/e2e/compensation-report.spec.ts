import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, expect } from '../setup/qaBrowser';

test('draft edits, normal restoration, holding and removal stay out of finalized reporting; fresh browser agrees', async ({ page, browser }) => {
  const login = async (target: typeof page) => {
    await target.goto('/admin/login');
    await target.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
    await target.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
    await target.getByRole('button', { name: /login/i }).click();
    await expect(target).toHaveURL(/\/admin\/dashboard$/);
  };
  await login(page);
  const created = await page.evaluate(async (name) => {
    const response = await fetch('/api/dishes', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` }, body: JSON.stringify({ name, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 10, status: 'published' }) });
    return { httpStatus: response.status, ...(await response.json()) };
  }, `QA_RUN_${process.env.QA_RUN_ID}_report`);
  expect(created.httpStatus).toBe(201);
  await page.goto('/staff/pos');
  const cost = page.getByText('Waived Revenue', { exact: true }).locator('..');
  await page.getByRole('button', { name: 'Complimentary', exact: true }).click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Edit Issue / Compensation', exact: true }).click();
    await page.getByRole('button', { name: 'Save Compensation', exact: true }).click();
  }
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'report-repeated-drafts.png'), fullPage: true });
  await expect(cost).toContainText('$0.00');
  await page.getByRole('button', { name: 'Edit Issue / Compensation', exact: true }).click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('normal');
  await page.getByRole('button', { name: 'Save Compensation', exact: true }).click();
  await expect(cost).toContainText('$0.00');
  await page.getByRole('button', { name: 'Hold (F4)' }).click();
  await expect(cost).toContainText('$0.00');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: '-', exact: true }).click();
  await expect(cost).toContainText('$0.00');
  await page.getByRole('button', { name: 'Complimentary', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Issue / Compensation', exact: true }).click();
  await page.getByRole('button', { name: 'Save Compensation', exact: true }).click();
  const [settled] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/pos/checkout' && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }).click(),
  ]);
  expect(settled.status()).toBe(201);
  await expect(cost).toContainText('$10.00');
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Refresh Report', exact: true }).click();
    await expect(cost).toContainText('$10.00');
  }
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  await context.route((url) => ['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1', async (route) => {
    if (new URL(route.request().url()).hostname === 'fonts.googleapis.com') await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    else await route.abort('blockedbyclient');
  });
  try {
    const fresh = await context.newPage();
    await login(fresh);
    await fresh.goto('/staff/pos');
    await expect(fresh.getByText('Waived Revenue', { exact: true }).locator('..')).toContainText('$10.00');
    const report = await fresh.evaluate(async () => {
      const response = await fetch('/api/pos/compensation-report', { headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` } });
      return { status: response.status, body: await response.json() };
    });
    expect(report.status).toBe(200);
    expect(report.body.entries).toHaveLength(1);
    expect(report.body.totals_by_currency.USD.waived_revenue).toBe('10.00');
    writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, 'fresh-browser-report.json'), JSON.stringify(report, null, 2));
    await fresh.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'fresh-browser-report.png'), fullPage: true });
    const posting = await page.evaluate(async (dishId) => {
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
      const saleResponse = await fetch('/api/pos/checkout', { method: 'POST', headers, body: JSON.stringify({ payment_method: 'cash', items: [{ dish_id: dishId, quantity: 1 }] }) });
      const sale = (await saleResponse.json()).order;
      const draftResponse = await fetch(`/api/pos/orders/${sale.id}/complaint-adjustments`, { method: 'POST', headers, body: JSON.stringify({ complaint_reason: 'quality_issue', refund_amount: 8, affected_item_ids: [sale.items[0].id], gifts: [{ dish_id: dishId, quantity: 1 }] }) });
      const draft = (await draftResponse.json()).adjustment;
      const before = await (await fetch('/api/pos/compensation-report', { headers })).json();
      const posted = await fetch(`/api/pos/complaint-adjustments/${draft.id}/post`, { method: 'POST', headers });
      const retry = await fetch(`/api/pos/complaint-adjustments/${draft.id}/post`, { method: 'POST', headers });
      const after = await (await fetch('/api/pos/compensation-report', { headers })).json();
      const denied = await fetch('/api/pos/compensation-report', { credentials: 'omit', headers: { Accept: 'application/json' } });
      return { sale: saleResponse.status, draft: draftResponse.status, before, posted: posted.status, retry: retry.status, after, denied: denied.status };
    }, created.id);
    expect(posting.sale).toBe(201);
    expect(posting.draft).toBe(201);
    expect(posting.before.entries).toHaveLength(1);
    expect(posting.posted).toBe(200);
    expect(posting.retry).toBe(200);
    expect(posting.after.entries).toHaveLength(3);
    expect(posting.after.totals_by_currency.USD).toEqual({ waived_revenue: '10.00', refunded_revenue: '8.00', gift_catalog_value: '10.00' });
    expect(posting.denied).toBe(401);
    await fresh.getByRole('button', { name: 'Refresh Report', exact: true }).click();
    await expect(fresh.getByText('Waived Revenue', { exact: true }).locator('..')).toContainText('$10.00');
    await expect(fresh.getByText('Refunded Revenue', { exact: true }).locator('..')).toContainText('$8.00');
    await expect(fresh.getByText('Gift Catalog Value', { exact: true }).locator('..')).toContainText('$10.00');
    writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, 'browser-posted-report.json'), JSON.stringify(posting, null, 2));
    await fresh.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'browser-posted-report.png'), fullPage: true });
    await fresh.getByLabel('Report through').fill('2020-01-01');
    await expect(fresh.getByText('Waived Revenue', { exact: true }).locator('..')).toContainText('$0.00');
    await expect(fresh.getByText('Refunded Revenue', { exact: true }).locator('..')).toContainText('$0.00');
    await fresh.route('**/api/pos/compensation-report*', (route) => route.fulfill({ status: 503, json: { message: 'QA report unavailable' } }));
    await fresh.getByRole('button', { name: 'Refresh Report', exact: true }).click();
    await expect(fresh.getByText(/Report unavailable/)).toBeVisible();
    await expect(fresh.getByText('Waived Revenue', { exact: true }).locator('..')).toContainText('—');

  } finally { await context.close(); }
});
