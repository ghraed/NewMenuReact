import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../setup/qaBrowser';

for (const mode of ['complimentary', 'full_waiver', 'partial_discount', 'cancelled', 'mixed'] as const) {
  test(`real POS ${mode} checkout agrees with payable invoice and PDF`, async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
    await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    const name = `QA_RUN_${process.env.QA_RUN_ID}_${mode}`;
    const created = await page.evaluate(async (itemName) => {
      const res = await fetch('/api/dishes', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` },
        body: JSON.stringify({ name: itemName, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 10, status: 'published' }),
      });
      return { status: res.status, id: (await res.json()).id };
    }, name);
    expect(created.status).toBe(201);
    await page.goto('/staff/pos');
    if (mode === 'mixed') await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Complimentary', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Issue / Compensation', exact: true }).last().click();
    if (mode === 'cancelled') await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('cancelled');
    else if (mode !== 'mixed') await page.getByRole('combobox', { name: 'Compensation Type', exact: true }).selectOption(mode);
    if (mode === 'partial_discount') await page.getByRole('spinbutton', { name: /Partial Discount/ }).fill('25');
    await page.getByRole('button', { name: 'Save Compensation', exact: true }).click();
    if (mode === 'mixed') {
      await page.getByRole('combobox', { name: 'Discount Type', exact: true }).selectOption('fixed');
      await page.getByRole('spinbutton', { name: 'Discount Value', exact: true }).fill('1');
      await page.getByRole('spinbutton', { name: 'VAT %', exact: true }).fill('10');
    }
    const expected = mode === 'mixed' ? '9.90' : mode === 'partial_discount' ? '7.50' : '0.00';
    await expect(page.getByText('Total', { exact: true }).locator('..')).toContainText(`$${expected}`);
    await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `pos-${mode}-before-checkout.png`), fullPage: true });
    const [response] = await Promise.all([
      page.waitForResponse((res) => new URL(res.url()).pathname === '/api/pos/checkout' && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }).click(),
    ]);
    const body = await response.json();
    writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, `pos-${mode}-response.json`), JSON.stringify({ status: response.status(), displayedTotal: expected, order: body.order, payment: body.payment }, null, 2));
    expect(response.status()).toBe(201);
    expect(body.order.invoice.total).toBe(expected);
    expect(body.payment.total).toBe(expected);
    expect(body.order.items[mode === 'mixed' ? 1 : 0].final_unit_price).toBe(mode === 'mixed' ? '0.00' : expected);
    expect(body.order.items[mode === 'mixed' ? 1 : 0].approved_by.id).toBe(body.order.accounted_by.id);
    const retry = await page.evaluate(async ({ payload, key, dishId }) => {
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}`, 'X-Idempotency-Key': key };
      const res = await fetch('/api/pos/checkout', { method: 'POST', headers, body: JSON.stringify(payload) });
      const order = await res.json();
      const item = await (await fetch(`/api/dishes/${dishId}`, { headers })).json();
      return { status: res.status, id: order.order.id, total: order.payment.total, stock: item.packaged_stock_quantity };
    }, { payload: response.request().postDataJSON(), key: (await response.request().headerValue('X-Idempotency-Key'))!, dishId: created.id });
    expect(retry.status).toBe(200);
    expect(retry.id).toBe(body.order.id);
    expect(retry.total).toBe(expected);
    expect(Number(retry.stock)).toBe(mode === 'mixed' ? 8 : 9);
    await expect(page.getByText('Waived Revenue', { exact: true }).locator('..')).toContainText(mode === 'partial_discount' ? '$2.50' : '$10.00');
    await expect(page.getByText('Refunded Revenue', { exact: true }).locator('..')).toContainText('$0.00');
    await expect(page.getByText('Gift Catalog Value', { exact: true }).locator('..')).toContainText('$0.00');
    await expect(page.getByText(/Checkout complete:/)).toBeVisible();
    await expect(page.getByRole('status')).toContainText(`Paid $${expected}`);
    await expect(page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' })).toBeDisabled();
    const invoice = await page.evaluate(async (invoiceNumber) => {
      const headers = { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
      const res = await fetch('/api/admin/finance/invoices?search=' + encodeURIComponent(invoiceNumber), { headers });
      const data = await res.json();
      const match = data.invoices.find((row: { invoice_number: string }) => row.invoice_number === invoiceNumber);
      const pdf = await fetch(`/api/admin/finance/invoices/${match.id}/pdf`, { headers });
      return { status: res.status, total: match.total, pdfStatus: pdf.status, pdfType: pdf.headers.get('content-type') };
    }, body.order.invoice_number);
    expect(invoice).toEqual({ status: 200, total: expected, pdfStatus: 200, pdfType: 'application/pdf' });
    await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `pos-${mode}-settled.png`), fullPage: true });
  });
}

test('real compensation validation failure retains the POS cart and does not announce success', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const dish = await page.evaluate(async (name) => {
    const response = await fetch('/api/dishes', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` },
      body: JSON.stringify({ name, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 1, status: 'published' }),
    });
    return { httpStatus: response.status, ...(await response.json()) };
  }, `QA_RUN_${process.env.QA_RUN_ID}_rejection`);
  expect(dish.httpStatus).toBe(201);
  await page.goto('/staff/pos');
  await page.getByRole('button', { name: 'Complimentary', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Issue / Compensation', exact: true }).click();
  await page.getByRole('button', { name: 'Save Compensation', exact: true }).click();
  // A separate real checkout consumes the last unit after this cart was prepared.
  const otherSale = await page.evaluate(async (id) => {
    const response = await fetch('/api/pos/checkout', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` },
      body: JSON.stringify({ payment_method: 'cash', items: [{ dish_id: id, quantity: 1 }] }),
    });
    return response.status;
  }, dish.id);
  expect(otherSale).toBe(201);
  const [rejected] = await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).pathname === '/api/pos/checkout' && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }).click(),
  ]);
  expect(rejected.status()).toBe(422);
  writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, 'pos-rejected-response.json'), JSON.stringify({ status: rejected.status(), response: await rejected.json() }, null, 2));
  await expect(page.getByText(/out of stock/i).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' })).toBeEnabled();
  await expect(page.getByText(/Checkout complete:/)).toHaveCount(0);
  await expect(page.getByText(/Last checkout:/)).toHaveCount(0);
  await expect(page.getByText('Waived Revenue', { exact: true }).locator('..')).toContainText('$0.00');
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'pos-rejected-cart-retained.png'), fullPage: true });
});
