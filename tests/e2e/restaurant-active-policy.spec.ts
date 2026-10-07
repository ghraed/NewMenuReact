import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, expect } from '../setup/qaBrowser';

test('inactive restaurant keeps menu and staff login but blocks POS with a clear message; reactivation permits checkout', async ({ page }) => {
  const changeStatus = (status: 'active' | 'inactive') => JSON.parse(execFileSync('php', [resolve('tests/setup/restaurantPolicyFixtures.php'), status], {
    cwd: process.cwd(), env: process.env, encoding: 'utf8',
  }));
  const login = async () => {
    await page.goto('/admin/login');
    await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
    await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  };
  await login();
  const name = `QA_RUN_${process.env.QA_RUN_ID}_inactive_menu`;
  const created = await page.evaluate(async (itemName) => {
    const response = await fetch('/api/dishes', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` }, body: JSON.stringify({ name: itemName, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 10, status: 'published' }) });
    return { status: response.status, id: (await response.json()).id };
  }, name);
  expect(created.status).toBe(201);
  await page.goto('/staff/pos');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const inactive = changeStatus('inactive');
  expect(inactive.orders).toBe(0);
  expect(Number(inactive.packaged_stock)).toBe(10);
  const [denied] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/pos/checkout' && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }).click(),
  ]);
  const deniedBody = await denied.json();
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'inactive-pos-rejection.png'), fullPage: true });
  writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, 'inactive-policy-response.json'), JSON.stringify({ status: denied.status(), body: deniedBody }, null, 2));
  expect(denied.status()).toBe(403);
  expect(deniedBody.code).toBe('restaurant_inactive');
  await expect(page.getByText('This restaurant is inactive and cannot accept new orders, sales, reservations or table sessions.', { exact: true })).toBeVisible();
  await expect(page.getByText('Total', { exact: true }).locator('..')).toContainText('$10.00');
  expect(changeStatus('inactive').orders).toBe(0);
  expect(changeStatus('inactive').invoices).toBe(0);
  expect(Number(changeStatus('inactive').packaged_stock)).toBe(10);
  const guestMenu = await page.request.get(`/api/menu/${inactive.slug}/dishes`);
  expect(guestMenu.status()).toBe(200);
  expect((await guestMenu.json()).dishes.some((dish: { id: number }) => dish.id === created.id)).toBe(true);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: /^(Logout|⎋)$/ }).first().click();
  await expect(page.getByText('Confirm Logout', { exact: true })).toBeVisible();
  const [loggedOut] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/logout'),
    page.getByRole('button', { name: 'Logout', exact: true }).last().click(),
  ]);
  expect(loggedOut.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto(`/menu/${inactive.slug}`);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await login();
  await page.goto('/staff/pos');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  changeStatus('active');
  const [settled] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/pos/checkout' && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Checkout (Ctrl+Enter)' }).click(),
  ]);
  expect(settled.status()).toBe(201);
  expect((await settled.json()).order.invoice.total).toBe('10.00');
  expect(changeStatus('active').orders).toBe(1);
  expect(Number(changeStatus('active').packaged_stock)).toBe(9);
});
