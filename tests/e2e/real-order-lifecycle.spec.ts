import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserContext, Page, WebSocketRoute } from '@playwright/test';
import { expect, test } from '../setup/qaBrowser';

type Fixtures = {
  a: { id: number; slug: string; host: string; tableId: number };
  b: { id: number; email: string; host: string; tableId: number };
  users: { staff: string; chef: string; unassigned: string };
  dish: { id: number; name: string }; foreignDishId: number;
  flags: { a: Record<string, boolean>; b: Record<string, boolean> };
};

async function login(page: Page, email: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST'),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(/\/(admin\/dashboard|staff\/orders|chef\/dashboard)$/);
}

// Real browser fetches for adversarial requests; credentials belong to the current role's context.
async function api(page: Page, endpoint: string, method = 'GET', data?: unknown) {
  return page.evaluate(async ({ endpoint, method, data }) => {
    const response = await fetch(`/api${endpoint}`, {
      method, headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_auth_token') || ''}` },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, { endpoint, method, data });
}

async function action(page: Page, endpoint: string, button: string) {
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === `/api${endpoint}` && r.request().method() === 'POST'),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  return response.json();
}

test('real PIN, staff, kitchen, paid receipt and finance lifecycle isolates two tenants and denied roles', async ({ browser, page, request }, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  expect(process.env.QA_OPERATIONAL, 'Use the paired runner with --launch; real transport is a required gate').toBe('1');
  const fixtures = JSON.parse(execFileSync('php', [resolve('tests/setup/lifecycleFixtures.php')], {
    env: process.env, encoding: 'utf8',
  })) as Fixtures;
  await testInfo.attach('feature-and-role-fixtures', { body: JSON.stringify(fixtures, null, 2), contentType: 'application/json' });
  expect(fixtures.flags.a.table_ordering).toBe(true);
  expect(fixtures.flags.b.table_ordering).toBe(false);
  expect(fixtures.flags.a.ai_chatbot).toBe(false);
  const contexts: BrowserContext[] = [];
  const consoles: string[] = [];
  const ledger: { role: string; method: string; endpoint: string; status: number }[] = [];
  const errors: string[] = [];
  const observe = (p: Page, role: string) => {
    p.on('pageerror', e => errors.push(`${role}: ${e.message}`));
    p.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') consoles.push(`${role}: ${message.text()}`); });
    p.on('response', r => {
      const url = new URL(r.url());
      if (url.pathname.startsWith('/api/')) ledger.push({ role, method: r.request().method(), endpoint: url.pathname, status: r.status() });
    });
  };
  async function rolePage(role: string) {
    const ctx = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL, serviceWorkers: 'block' });
    contexts.push(ctx);
    const origins = [process.env.PLAYWRIGHT_BASE_URL!, process.env.QA_API_URL!];
    await ctx.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com' && route.request().resourceType() === 'stylesheet') {
        await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      } else if (['http:', 'https:'].includes(url.protocol) && !origins.includes(url.origin)) {
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    const p = await ctx.newPage(); p.setDefaultTimeout(15_000); observe(p, role); return p;
  }
  observe(page, 'admin A');
  try {
    await login(page, process.env.PLAYWRIGHT_PROFILE_EMAIL!);
    const staff = await rolePage('assigned staff A'); await login(staff, fixtures.users.staff);
    const chef = await rolePage('chef A');
    const unassigned = await rolePage('unassigned staff A'); await login(unassigned, fixtures.users.unassigned);
    const other = await rolePage('admin B'); await login(other, fixtures.b.email);
    const guest = await rolePage('guest A');

    // Actual host-based tenant resolution with isolated Host headers, never public DNS.
    const enabledHost = await request.get(`${process.env.QA_API_URL}/api/menu/table/1`, { headers: { Host: fixtures.a.host } });
    expect(enabledHost.status()).toBe(200);
    expect((await enabledHost.json()).restaurant.id).toBe(fixtures.a.id);
    expect((await request.get(`${process.env.QA_API_URL}/api/menu/table/1`, { headers: { Host: fixtures.b.host } })).status()).toBe(404);
    expect((await request.get(`${process.env.QA_API_URL}/api/menu/table/1`, { headers: { Host: 'unmapped.qa.invalid' } })).status()).toBe(404);

    const activation = await api(staff, '/table-sessions/activate', 'POST', { table_id: fixtures.a.tableId });
    expect(activation.status).toBe(200);
    const sessionId = activation.body.table_session.id as number;
    expect((await api(unassigned, `/table-sessions/${sessionId}/finalize`, 'POST')).status).toBe(403);
    expect((await api(other, `/table-sessions/${sessionId}/finalize`, 'POST')).status).toBe(404);
    expect((await api(staff, '/kitchen/orders')).status).toBe(403);
    expect((await api(other, '/pos/checkout', 'POST', { items: [{ dish_id: fixtures.foreignDishId, quantity: 1 }], payment_method: 'cash' })).status).toBe(404);
    expect((await api(page, '/chat', 'POST', { message: 'QA_RUN_disabled' })).status).toBe(403);

    await guest.goto('/menu/table/1');
    await expect(guest.getByText('Unlock ordering for this table')).toBeVisible();
    await guest.getByPlaceholder('0000').fill(activation.body.current_pin);
    const pin = guest.waitForResponse(r => new URL(r.url()).pathname === '/api/menu/table/1/verify-pin');
    await guest.getByRole('button', { name: 'Unlock Ordering' }).click();
    expect((await pin).status()).toBe(200);
    await expect(guest.getByText('Protected actions are ready')).toBeVisible();
    await guest.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
    await guest.getByLabel('Increase quantity').click();
    await guest.getByRole('link', { name: /items in cart/i }).click();
    await expect(guest.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
    const placed = guest.waitForResponse(r => new URL(r.url()).pathname === `/api/table-session/${sessionId}/order` && r.request().method() === 'POST');
    await guest.getByRole('button', { name: 'Send Order Request' }).click();
    const placedResponse = await placed; expect(placedResponse.status()).toBe(201);
    expect(await placedResponse.request().headerValue('X-Idempotency-Key')).toBeTruthy();
    const order = (await placedResponse.json()).order;
    const retry = await guest.evaluate(async ({ url, headers, body }) => {
      const response = await fetch(url, { method: 'POST', headers, body });
      return { status: response.status, body: await response.json() };
    }, { url: placedResponse.url(), headers: await placedResponse.request().allHeaders(), body: placedResponse.request().postData() });
    expect(retry.status).toBe(200); expect(retry.body.order.id).toBe(order.id);
    expect(order.invoice.total).toBe('25.00');
    expect(order.items[0].dish_id).toBe(fixtures.dish.id);
    expect(order.items[0].quantity).toBe(2);
    await expect(guest.getByText('Order sent to the staff team')).toBeVisible();
    const orderId = order.id as number;
    expect((await api(unassigned, `/orders/${orderId}/confirm`, 'POST')).status).toBe(403);
    expect((await api(other, `/orders/${orderId}`)).status).toBe(404);
    expect((await api(staff, `/orders/${orderId}/account`, 'POST')).status).toBe(403);

    // Proxy real WS frames. Only disconnect faults are injected, never fake event payloads or API responses.
    let subscribed = 0; let createdFrames = 0; let rejectConnections = false;
    let closeTransport: (() => Promise<void>) | undefined;
    await chef.routeWebSocket(`ws://127.0.0.1:${process.env.QA_REVERB_PORT}/**`, (socket: WebSocketRoute) => {
      if (rejectConnections) { socket.close(); return; }
      const server = socket.connectToServer();
      closeTransport = async () => { await server.close(); await socket.close(); };
      server.onMessage(message => {
        const body = JSON.parse(message.toString());
        if (body.event === 'pusher_internal:subscription_succeeded' && body.channel === `private-restaurant.${fixtures.a.id}.kitchen`) subscribed++;
        if (body.event === 'kitchen-order.created') createdFrames++;
        socket.send(message);
      });
    });
    await login(chef, fixtures.users.chef);
    await chef.goto('/chef/dashboard');
    await expect.poll(() => subscribed).toBeGreaterThan(0);
    expect((await api(chef, `/orders/${orderId}/account`, 'POST')).status).toBe(403);
    expect((await api(other, '/broadcasting/auth', 'POST', { socket_id: '123.456', channel_name: `private-restaurant.${fixtures.a.id}.kitchen` })).status).toBe(403);
    expect((await api(chef, '/broadcasting/auth', 'POST', { socket_id: '123.456', channel_name: `private-restaurant.${fixtures.b.id}.kitchen` })).status).toBe(403);

    await staff.reload();
    await expect(staff.getByText(order.order_number, { exact: true })).toBeVisible();
    const confirmed = await action(staff, `/orders/${orderId}/confirm`, 'Confirm Request');
    expect(confirmed.order.status).toBe('staff_confirmed');
    await expect.poll(() => createdFrames).toBeGreaterThan(0);
    const ticket = chef.getByRole('heading', { name: `Order #${order.order_number}`, exact: true });
    await expect(ticket).toHaveCount(1);
    const kitchenPayload = await api(chef, `/kitchen/orders/${orderId}`);
    expect(kitchenPayload.status).toBe(200);
    const framesBeforeReplay = createdFrames;
    execFileSync('php', [resolve('tests/setup/replayKitchenEvent.php')], { env: process.env, input: JSON.stringify(kitchenPayload.body.order) });
    await expect.poll(() => createdFrames).toBe(framesBeforeReplay + 2);
    await expect(ticket).toHaveCount(1);

    const previousSubscriptions = subscribed;
    await closeTransport!();
    await chef.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => subscribed, { timeout: 20_000 }).toBeGreaterThan(previousSubscriptions);
    await expect(ticket).toHaveCount(1);
    const started = await action(chef, `/kitchen/orders/${orderId}/start`, 'Start Preparing');
    expect(started.order.kitchen_status).toBe('in_progress');
    const ready = await action(chef, `/kitchen/orders/${orderId}/ready`, 'Mark as Ready');
    expect(ready.order.kitchen_status).toBe('ready');
    await expect(chef.getByRole('button', { name: 'Mark as Served' })).toBeVisible();

    // Keep websocket down, mutate through real staff HTTP and require the kitchen's timed polling to reconcile.
    rejectConnections = true; await closeTransport!();
    const served = await api(staff, `/orders/${orderId}/served`, 'POST');
    expect(served.status).toBe(200);
    expect(served.body.order.kitchen_status).toBe('served');
    const fallback = await chef.waitForResponse(r => new URL(r.url()).pathname === '/api/kitchen/orders' && r.request().method() === 'GET', { timeout: 15_000 });
    expect(fallback.status()).toBe(200);
    await expect(ticket).toHaveCount(0);
    const persisted = await api(page, `/orders/${orderId}`);
    expect(persisted.body.order.confirmed_by.id).toBeTruthy();
    expect(persisted.body.order.kitchen_status).toBe('served');
    expect(persisted.body.order.confirmed_by.role).toBe('staff');

    // The finalizer is a separately authenticated admin; UI issues real accounting and finalization requests.
    await page.goto('/admin/cashier');
    await page.getByRole('button', { name: /^All tables/ }).click();
    await page.getByRole('button', { name: 'T01', exact: true }).click();
    await expect(page.getByText(fixtures.dish.name, { exact: true }).first()).toBeVisible();
    await page.locator('label').filter({ hasText: /^VAT %$/ }).locator('..').getByRole('spinbutton').fill('10');
    await page.getByRole('button', { name: 'Fixed amount', exact: true }).click();
    await page.locator('label').filter({ hasText: /^Discount Value$/ }).locator('..').getByRole('spinbutton').fill('2');
    await page.getByPlaceholder('Receipt number, transaction id, or note').fill(`QA_RUN_${process.env.QA_RUN_ID}_cash`);
    const finalized = await action(page, `/table-sessions/${sessionId}/finalize`, 'Finalize T01 Invoice');
    expect(finalized.invoice_status).toBe('paid');
    const invoiceId = finalized.invoice_id as number;
    const invoice = await api(page, `/admin/finance/invoices/${invoiceId}`);
    expect(invoice.status).toBe(200);
    expect(invoice.body.invoice).toMatchObject({ status: 'paid', subtotal: '25.00', discount_amount: '2.00', taxable_subtotal: '23.00', vat_amount: '2.30', total: '25.30' });
    expect(invoice.body.invoice.items).toHaveLength(1);
    const revoked = await guest.evaluate(async ({ url, headers, body }) => {
      const response = await fetch(url, { method: 'POST', headers: { ...headers, 'X-Idempotency-Key': `QA_RUN_post_close_${Date.now()}` }, body });
      return response.status;
    }, { url: placedResponse.url(), headers: await placedResponse.request().allHeaders(), body: placedResponse.request().postData() });
    expect(revoked).toBe(403);
    expect(Number(invoice.body.invoice.items[0].quantity)).toBe(2);
    const repeated = await api(page, `/table-sessions/${sessionId}/finalize`, 'POST', { payment_method: 'cash', payment_reference: `QA_RUN_${process.env.QA_RUN_ID}_cash` });
    expect(repeated.status).toBe(200); expect(repeated.body.invoice_id).toBe(invoiceId);
    expect((await api(other, `/admin/finance/invoices/${invoiceId}`)).status).toBe(404);
    expect((await api(other, `/admin/finance/invoices/${invoiceId}/pdf`)).status).toBe(404);
    expect((await api(staff, `/admin/finance/invoices/${invoiceId}`)).status).toBe(403);
    await page.goto(`/admin/finance/invoices/${invoiceId}`);
    await expect(page.getByText(finalized.invoice_number, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(fixtures.dish.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/25\.30/).first()).toBeVisible();
    const pdf = await page.evaluate(async (id: number) => {
      const r = await fetch(`/api/admin/finance/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` } });
      return { status: r.status, type: r.headers.get('content-type'), bytes: Array.from(new Uint8Array(await r.arrayBuffer())) };
    }, invoiceId);
    expect(pdf.status).toBe(200); expect(pdf.type).toBe('application/pdf');
    const pdfPath = resolve(process.env.QA_EVIDENCE_DIR!, 'real-lifecycle-receipt.pdf');
    writeFileSync(pdfPath, Buffer.from(pdf.bytes));
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
    expect(text).toContain(finalized.invoice_number); expect(text).toContain('25.30'); expect(text).toContain('2.30'); expect(text.replace(/\s+/g, '')).toContain(fixtures.dish.name.replace(/\s+/g, ''));
    const finance = await api(page, '/admin/finance/dashboard-metrics');
    expect(finance.status).toBe(200); expect(finance.body.kpis.revenue.value).toBe(25.3); expect(finance.body.kpis.invoice_count.value).toBe(1);
    const foreignFinance = await api(other, '/admin/finance/dashboard-metrics');
    expect(foreignFinance.status).toBe(200); expect(foreignFinance.body.kpis.revenue.value).toBe(0); expect(foreignFinance.body.kpis.invoice_count.value).toBe(0);
    await page.goto('/admin/finance'); await expect(page.getByText(/25\.30/).first()).toBeVisible();
    await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, 'real-lifecycle-finance.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, 'real-lifecycle-http.json'), JSON.stringify(ledger, null, 2));
    writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, 'real-lifecycle-console.json'), JSON.stringify(consoles, null, 2));
    await Promise.all(contexts.map(c => c.close()));
  }
});
