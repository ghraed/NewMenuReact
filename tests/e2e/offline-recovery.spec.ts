import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page, APIRequestContext } from '@playwright/test';
import { test, expect } from '../setup/qaBrowser';

const ledgers = new WeakMap<Page, Array<{ endpoint: string; method: string; status: number; serviceWorker: boolean }>>();
test.beforeEach(async ({ page }) => {
  const ledger: Array<{ endpoint: string; method: string; status: number; serviceWorker: boolean }> = [];
  ledgers.set(page, ledger);
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) ledger.push({ endpoint: url.pathname, method: response.request().method(), status: response.status(), serviceWorker: response.fromServiceWorker() });
  });
});
test.afterEach(async ({ page }, testInfo) => {
  const ledger = ledgers.get(page) || [];
  const body = JSON.stringify({ scenario: testInfo.title, status: testInfo.status, requests: ledger }, null, 2);
  writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, `offline-http-${createHash('sha256').update(testInfo.testId).digest('hex').slice(0, 10)}.json`), body);
  await testInfo.attach('real-offline-http', { body, contentType: 'application/json' });
});

function fixture(action = 'create') {
  return JSON.parse(execFileSync('php', [resolve('tests/setup/offlineFixtures.php'), action], { env: process.env, encoding: 'utf8' }));
}
async function queue(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('menu-react-offline');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Array<{ id: number; status: string; idempotencyKey: string }>>(resolve => {
        if (!db.objectStoreNames.contains('guest_order_queue')) { resolve([]); return; }
        const request = db.transaction('guest_order_queue').objectStore('guest_order_queue').getAll();
        request.onsuccess = () => resolve(request.result);
      });
    } finally { db.close(); }
  });
}
async function enter(page: Page, request: APIRequestContext) {
  const data = fixture();
  const auth = await request.post('/api/auth/login', { data: { email: process.env.PLAYWRIGHT_PROFILE_EMAIL, password: process.env.PLAYWRIGHT_PROFILE_PASSWORD } });
  expect(auth.status()).toBe(200);
  const activated = await request.post('/api/table-sessions/activate', { headers: { Authorization: `Bearer ${(await auth.json()).token}` }, data: { table_id: data.a.tableId } });
  expect(activated.status()).toBe(200);
  await page.goto('/menu/table/1');
  // The application's startup registers the shipped worker; no test worker.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload();
  await page.getByPlaceholder('0000').fill((await activated.json()).current_pin);
  await page.getByRole('button', { name: 'Unlock Ordering' }).click();
  await expect(page.getByText('Protected actions are ready')).toBeVisible();
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  await page.getByRole('link', { name: /items? in cart/i }).click();
  await expect(page.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Order Request' })).toBeEnabled();
  return data;
}

test('service worker keeps public offline menu while token-sensitive responses bypass shared caches', async ({ page, context, request }) => {
  const data = await enter(page, request);
  // Same URL, different identity. CacheStorage does not partition custom headers by default.
  const response = await page.evaluate(async () => {
    const r = await fetch('/api/menu/table/1', { headers: { 'X-Guest-Access-Token': 'QA_RUN_invalid' } });
    return r.status;
  });
  expect(response).toBe(200);
  const protectedEntries = await page.evaluate(async () => {
    const found: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        if (new URL(request.url).pathname.startsWith('/api/menu/table/')) found.push(request.url);
      }
    }
    return found;
  });
  expect(protectedEntries).toEqual([]);
  await page.goto('/menu/table/1');
  await expect(page.getByRole('heading', { name: data.dish.name, exact: true })).toBeVisible();
  const catalogs = await page.evaluate(async (slugs: string[]) => Promise.all(slugs.map(async slug => (await fetch(`/api/menu/${slug}/dishes`)).text())), [data.a.slug, data.b.slug]);
  // B uses its own slug supplied by the fixture; both catalogs must stay separate.
  expect(catalogs[0]).toContain(data.dish.name);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: data.dish.name, exact: true })).toBeVisible();
  const offlineCatalogs = await page.evaluate(async (slugs: string[]) => Promise.all(slugs.map(async slug => (await fetch(`/api/menu/${slug}/dishes`)).text())), [data.a.slug, data.b.slug]);
  expect(offlineCatalogs).toEqual(catalogs);
  expect(catalogs[1]).toContain(data.dish.name.replace('_Grill', '_B_Grill'));
  expect(catalogs[0]).not.toContain(data.dish.name.replace('_Grill', '_B_Grill'));
  expect(fixture('snapshot').orders).toHaveLength(0);
});

test('lost acknowledgement survives reload, application upgrade and competing tabs with one server order', async ({ page, context, request }) => {
  await enter(page, request);
  let committed = false;
  await context.route('**/api/table-session/*/order', async route => {
    if (!committed && route.request().method() === 'POST') {
      const response = await route.fetch();
      expect(response.status()).toBe(201); committed = true;
      await route.abort('connectionreset');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Send Order Request' }).click();
  await expect.poll(() => committed).toBe(true);
  await expect.poll(async () => (await queue(page)).length).toBe(1);
  const key = (await queue(page))[0].idempotencyKey;
  expect(fixture('snapshot').orders).toHaveLength(1);
  fixture('clear-cache');
  await context.setOffline(true);
  await page.reload();
  expect((await queue(page))[0].idempotencyKey).toBe(key);
  // Run the real shipped activation lifecycle with obsolete caches present.
  await context.setOffline(false);
  await page.evaluate(async () => {
    await caches.open('guest-api-v3');
    await caches.open('QA_RUN_unrelated_cache');
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.unregister();
    await navigator.serviceWorker.register('/sw.js?QA_RUN_upgrade=1');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes('guest-api-v3'))).toBe(false);
  expect(await page.evaluate(async () => (await caches.keys()).includes('QA_RUN_unrelated_cache'))).toBe(true);
  await context.unroute('**/api/table-session/*/order');
  expect(await page.evaluate(() => Boolean(navigator.locks))).toBe(true);
  const second = await context.newPage();
  await second.goto(page.url());
  const buttons = [page, second].map(p => p.getByRole('button', { name: 'Confirm this order now', exact: true }));
  await expect(buttons[0]).toBeVisible(); await expect(buttons[1]).toBeVisible();
  await Promise.all(buttons.map(button => button.click()));
  await expect.poll(async () => (await queue(page)).length).toBe(0);
  const snapshot = fixture('snapshot');
  expect(snapshot.orders).toHaveLength(1); expect(snapshot.orders[0].total).toBe('12.50');
  expect(snapshot.foreign_orders).toBe(0);
  await second.close();
});

test('interrupted network submit before server commit survives reload and reconnect', async ({ page, context, request }) => {
  await enter(page, request);
  await context.route('**/api/table-session/*/order', route => route.abort('connectionreset'));
  await page.getByRole('button', { name: 'Send Order Request' }).click();
  await expect.poll(async () => (await queue(page)).length).toBe(1);
  const key = (await queue(page))[0].idempotencyKey;
  expect(fixture('snapshot').orders).toHaveLength(0);
  await context.setOffline(true);
  await page.reload();
  expect((await queue(page))[0].idempotencyKey).toBe(key);
  await context.unroute('**/api/table-session/*/order');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Confirm this order now', exact: true }).click();
  await expect.poll(async () => (await queue(page)).length).toBe(0);
  expect(fixture('snapshot').orders).toHaveLength(1);
});

test('reload during an unacknowledged committed submit recovers the queued intent instead of sending a new cart', async ({ page, context, request }) => {
  await enter(page, request);
  let committed = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/api/table-session/*/order', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    committed = true;
    await gate;
    await route.abort('connectionreset').catch(() => undefined);
  });
  await page.getByRole('button', { name: 'Send Order Request' }).click();
  await expect.poll(() => committed).toBe(true);
  expect((await queue(page))[0].status).toBe('syncing');
  const key = (await queue(page))[0].idempotencyKey;
  await page.reload();
  release();
  await context.unroute('**/api/table-session/*/order');
  await expect(page.getByRole('button', { name: 'Send Order Request' })).toHaveCount(0);
  expect((await queue(page))[0].idempotencyKey).toBe(key);
  await page.getByRole('button', { name: 'Confirm this order now', exact: true }).click();
  await expect.poll(async () => (await queue(page)).length).toBe(0);
  expect(fixture('snapshot').orders).toHaveLength(1);
});

for (const invalidation of ['expire', 'close', 'disable']) {
  test(`offline interrupted submit requires review after session ${invalidation}`, async ({ page, context, request }) => {
    await enter(page, request);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Send Order Request' }).click();
    await expect.poll(async () => (await queue(page)).length).toBe(1);
    const key = (await queue(page))[0].idempotencyKey;
    expect(fixture(invalidation).orders).toHaveLength(0);
    await page.reload();
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Confirm this order now', exact: true }).click();
    await expect.poll(async () => (await queue(page))[0]?.status).toBe('needs_review');
    expect((await queue(page))[0].idempotencyKey).toBe(key);
    expect(fixture('snapshot').orders).toHaveLength(0);
  });
}
