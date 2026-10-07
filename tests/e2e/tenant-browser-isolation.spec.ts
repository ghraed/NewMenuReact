import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../setup/qaBrowser';

type TenantFixture = { id: number; userId: number; name: string; email: string };

async function login(page: Page, email: string, route = /\/admin\/dashboard$/) {
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  const [response] = await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/login' && res.request().method() === 'POST'),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(route);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /^(Logout|⎋)$/ }).first().click();
  await expect(page.getByText('Confirm Logout', { exact: true })).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/logout'),
    page.getByRole('button', { name: 'Logout', exact: true }).last().click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/login$/);
}

test('same browser isolates compensation across logout, failed login, reload and two tenant accounts', async ({ page }) => {
  const fixtures = JSON.parse(execFileSync('php', [resolve('tests/setup/tenantFixtures.php')], {
    cwd: process.cwd(), env: process.env, encoding: 'utf8',
  })) as { a: TenantFixture; b: TenantFixture; accountant: TenantFixture; adminA2: TenantFixture };
  const cost = page.getByText('Total Compensation Cost', { exact: true }).locator('..');
  const itemName = `QA_RUN_${process.env.QA_RUN_ID}_A_compensation`;

  await login(page, fixtures.a.email);
  const created = await page.evaluate(async (name) => {
    const response = await fetch('/api/dishes', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` },
      body: JSON.stringify({ name, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 10, status: 'published' }),
    });
    return { status: response.status };
  }, itemName);
  expect(created.status).toBe(201);
  await page.goto('/staff/pos');
  await page.getByRole('button', { name: 'Complimentary', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Issue / Compensation', exact: true }).click();
  await page.getByRole('button', { name: 'Save Compensation', exact: true }).click();
  await expect(cost).toContainText('$10.00');
  await expect(page.getByText(fixtures.a.name, { exact: false }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Hold (F4)' }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.reload();
  await expect(cost).toContainText('$10.00');
  await logout(page);

  await page.getByLabel('Email or phone').fill(fixtures.b.email);
  await page.getByLabel('Password').fill('QA_RUN_wrong_password');
  const [rejected] = await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/login'),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  expect(rejected.status()).toBe(401);
  await expect(page).toHaveURL(/\/admin\/login$/);

  await login(page, fixtures.b.email);
  await page.goto('/staff/pos');
  await expect(cost).toContainText('$0.00');
  await expect(page.getByText(fixtures.a.name, { exact: false })).toHaveCount(0);
  await expect(page.getByText(itemName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(cost).toContainText('$0.00');
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'tenant-B-isolated.png'), fullPage: true });
  await logout(page);

  await login(page, fixtures.adminA2.email);
  await page.goto('/staff/pos');
  await expect(cost).toContainText('$10.00');
  await expect(page.getByText(fixtures.a.name, { exact: false })).toBeVisible();
  await logout(page);
  await login(page, fixtures.accountant.email, /\/admin\/finance$/);
  await page.goto('/staff/pos');
  await expect(page).toHaveURL(/\/admin\/finance$/);
  await expect(page.getByText('Complaint & Compensation Dashboard', { exact: true })).toHaveCount(0);
});

test('unresolved auth hides legacy caches, account queues remain private and guest offline work survives', async ({ page }) => {
  const fixtures = JSON.parse(execFileSync('php', [resolve('tests/setup/tenantFixtures.php')], {
    cwd: process.cwd(), env: process.env, encoding: 'utf8',
  })) as { a: TenantFixture; b: TenantFixture; accountant: TenantFixture };
  await login(page, fixtures.a.email);
  const preserved = await page.evaluate(async (a) => {
    const legacy = JSON.stringify([{ id: 'QA_RUN_legacy', dish_name: 'QA_RUN_legacy_dish', loss_amount: 10, approved_by: { name: a.name, role: 'admin' } }]);
    localStorage.setItem('pos_compensation_ledger_v1', legacy);
    localStorage.setItem('pos_compensation_audit_v1', JSON.stringify([{ actor_name: a.name }]));
    localStorage.setItem('bill_item_adjustments_v1', JSON.stringify({ T01: [{ dish_name: 'QA_RUN_legacy_bill', approved_by_staff_name: a.name }] }));
    localStorage.setItem('printable_invoice_payload', JSON.stringify({ restaurantName: 'QA_RUN_legacy_invoice', tableName: 'T01', items: [], notes: [], includedOrders: [], summary: { subtotal: '$10', discountAmount: '$0', taxableSubtotal: '$10', vatAmount: '$0', total: '$10' } }));
    localStorage.setItem('menu_locale', 'en');
    localStorage.setItem('guest_menu_theme', 'dark');
    const guestCart = JSON.stringify({ restaurant: { id: a.id, name: 'QA_RUN_guest_cart', slug: 'qa-run-guest' }, items: [], draft: { tableId: 70001, tableSessionId: 70001, tableReference: 'QA_RUN_guest_table', guestAccessToken: 'QA_RUN_guest_offline', guestAccessVerified: true, guestAccessExpiresAt: null, notes: 'QA_RUN_preserved_work' } });
    localStorage.setItem('guest_order_cart_state', guestCart);
    await new Promise<void>((done, reject) => {
      const open = indexedDB.open('menu-react-offline', 1);
      open.onupgradeneeded = () => {
        for (const name of ['guest_menu_cache', 'guest_order_queue', 'waiter_action_queue', 'sync_events_log']) {
          if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name, { keyPath: name === 'guest_menu_cache' ? 'key' : 'id', autoIncrement: name !== 'guest_menu_cache' });
        }
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['guest_order_queue', 'waiter_action_queue'], 'readwrite');
        tx.objectStore('guest_order_queue').put({ id: 100, sessionId: 70001, guestAccessToken: 'QA_RUN_guest_offline', payload: { items: [{ dish_id: 70001, quantity: 1 }] }, idempotencyKey: 'QA_RUN_guest_retry', status: 'pending', lastError: null, createdAt: '2026-10-07T12:00:00Z' });
        tx.objectStore('waiter_action_queue').put({ id: 101, type: 'confirm_order', payload: { orderId: 900001 }, status: 'pending', createdAt: '2026-10-07T12:00:00Z' });
        tx.objectStore('waiter_action_queue').put({ id: 102, owner: { restaurantId: a.id, userId: a.userId }, type: 'confirm_order', payload: { orderId: 900002 }, status: 'pending', createdAt: '2026-10-07T12:00:00Z' });
        tx.oncomplete = () => { db.close(); done(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    return { legacy, guestCart };
  }, fixtures.a);
  await page.goto('/staff/orders');
  await expect(page.getByText(/900002/)).toBeVisible();
  await expect(page.getByText(/900001/)).toHaveCount(0);
  await logout(page);
  await login(page, fixtures.b.email);

  let requestedMe = false;
  let releaseMe!: () => void;
  const gate = new Promise<void>((resolve) => { releaseMe = resolve; });
  await page.route('**/api/auth/me', async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    requestedMe = true;
    await gate;
    await route.fulfill({ response });
  });
  await page.goto('/staff/pos');
  await expect.poll(() => requestedMe).toBe(true);
  await expect(page.getByText('Complaint & Compensation Dashboard', { exact: true })).toHaveCount(0);
  await expect(page.getByText(fixtures.a.name, { exact: false })).toHaveCount(0);
  releaseMe();
  await expect(page.getByText('Complaint & Compensation Dashboard', { exact: true })).toBeVisible();
  await page.unroute('**/api/auth/me');
  await expect(page.getByText('Total Compensation Cost', { exact: true }).locator('..')).toContainText('$0.00');
  await page.goto('/invoice/print');
  await expect(page.getByText('QA_RUN_legacy_invoice', { exact: true })).toHaveCount(0);
  await page.goto('/staff/orders');
  await expect(page.getByText(/900002/)).toHaveCount(0);
  await expect(page.getByText(/900001/)).toHaveCount(0);

  const after = await page.evaluate(async () => {
    const guestQueue = await new Promise<unknown[]>((done, reject) => {
      const open = indexedDB.open('menu-react-offline', 1);
      open.onsuccess = () => {
        const db = open.result;
        const get = db.transaction('guest_order_queue').objectStore('guest_order_queue').getAll();
        get.onsuccess = () => { db.close(); done(get.result); };
        get.onerror = () => reject(get.error);
      };
      open.onerror = () => reject(open.error);
    });
    return { legacy: localStorage.getItem('protected_quarantine_v1:pos_compensation_ledger_v1'), guestCart: localStorage.getItem('guest_order_cart_state'), guestQueue, language: localStorage.getItem('menu_locale'), theme: localStorage.getItem('guest_menu_theme') };
  });
  expect(after.legacy).toBe(preserved.legacy);
  expect(after.guestCart).toBe(preserved.guestCart);
  expect(after.guestQueue).toHaveLength(1);
  expect(after.guestQueue[0]).toMatchObject({ id: 100, idempotencyKey: 'QA_RUN_guest_retry', status: 'pending' });
  expect(after.language).toBe('en');
  expect(after.theme).toBe('dark');
  await logout(page);
  await login(page, fixtures.a.email);
  await page.goto('/staff/orders');
  await expect(page.getByText(/900002/)).toBeVisible();
});
