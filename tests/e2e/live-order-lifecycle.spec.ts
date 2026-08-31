import { expect, test, type APIResponse, type BrowserContext, type Page } from '@playwright/test';

const runId = process.env.E2E_RUN_ID || '';
const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:8001/api';
const password = 'QA-only-password-42!';
const tenantHost = `${runId.toLowerCase().replaceAll('_', '-')}-release.localhost`;

interface LoginResult {
  token: string;
  user: {
    role: string;
    assigned_tables: Array<{ id: number; name: string }>;
    restaurant: { id: number; feature_flags: Record<string, boolean> };
  };
}

interface GuestAccessState {
  token: string;
  deviceId: string;
  sessionId: number;
}

const json = async <T>(response: APIResponse): Promise<T> => response.json() as Promise<T>;
const roleEmail = (role: string): string => `${runId.toLowerCase()}_${role}@example.test`;
const authHeaders = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' });

const expectStatus = async (response: APIResponse, expected: number): Promise<void> => {
  if (response.status() !== expected) {
    throw new Error(`Expected HTTP ${expected}, received ${response.status()}: ${await response.text()}`);
  }
};

const loginThroughUi = async (page: Page, email: string, expectedPath: RegExp): Promise<LoginResult> => {
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(expectedPath);
  const token = await page.evaluate(() => window.localStorage.getItem('admin_auth_token'));
  expect(token).toBeTruthy();
  const response = await page.request.get(`${apiURL}/auth/me`, { headers: authHeaders(token!) });
  await expectStatus(response, 200);
  const payload = await json<{ user: LoginResult['user'] }>(response);
  return { token: token!, user: payload.user };
};

test.describe('isolated live restaurant lifecycle', () => {
  test.skip(process.env.E2E_LIVE !== '1', 'Run with test:e2e:live against restaurantdb_test.');

  test('guest, waiter, kitchen, accounting, closure, cancellation, and isolation', async ({ browser }) => {
    expect(runId).toMatch(/^QA_RUN_[A-Z0-9][A-Z0-9_-]{2,48}$/);
    const contexts: BrowserContext[] = [];
    const newContext = async (options: Parameters<typeof browser.newContext>[0] = {}) => {
      const context = await browser.newContext(options);
      contexts.push(context);
      return context;
    };

    try {
      const waiterContext = await newContext();
      const waiterPage = await waiterContext.newPage();
      const waiter = await loginThroughUi(waiterPage, roleEmail('waiter'), /\/staff\/orders$/);
      expect(waiter.user.role).toBe('staff');
      expect(waiter.user.assigned_tables).toHaveLength(1);
      await expect(waiterPage.locator('html')).toHaveAttribute('dir', 'ltr');
      await waiterPage.goto('/admin/finance');
      await expect(waiterPage).toHaveURL(/\/staff\/orders$/);

      const activateResponse = await waiterContext.request.post(`${apiURL}/table-sessions/activate`, {
        headers: authHeaders(waiter.token),
        data: { table_id: waiter.user.assigned_tables[0].id },
      });
      await expectStatus(activateResponse, 200);
      const activated = await json<{ table_session: { id: number }; current_pin: string }>(activateResponse);
      expect(activated.current_pin).toMatch(/^\d{4}$/);

      const guestContext = await newContext({
        viewport: { width: 390, height: 844 },
        locale: 'ar-LB',
        extraHTTPHeaders: { 'X-Forwarded-Host': tenantHost },
      });
      await guestContext.addInitScript(() => window.localStorage.setItem('menu_locale', 'ar'));
      const guestPage = await guestContext.newPage();
      await guestPage.goto('/menu/table/1');
      await expect(guestPage.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(guestPage.getByText('مشاوي اختبار')).toBeVisible();
      const pinInput = guestPage.locator('input[inputmode="numeric"]');
      await pinInput.fill(activated.current_pin);
      await pinInput.locator('xpath=ancestor::form').getByRole('button').click();
      await expect(guestPage.getByText(/تم فتح|جاهزة/).first()).toBeVisible();

      const guestAccess = await guestPage.evaluate(() => {
        const cart = JSON.parse(window.localStorage.getItem('guest_order_cart_state') || '{}') as {
          draft?: { guestAccessToken?: string; tableSessionId?: number };
        };
        return {
          token: cart.draft?.guestAccessToken || '',
          sessionId: cart.draft?.tableSessionId || 0,
          deviceId: window.localStorage.getItem('guest_table_device_id') || '',
        };
      }) as GuestAccessState;
      expect(guestAccess.sessionId).toBe(activated.table_session.id);
      expect(guestAccess.token.length).toBeGreaterThan(20);
      expect(guestAccess.deviceId).not.toBe('');
      const guestHeaders = {
        Accept: 'application/json',
        'X-Forwarded-Host': tenantHost,
        'X-Guest-Access-Token': guestAccess.token,
        'X-Guest-Device-Id': guestAccess.deviceId,
      };

      const menuResponse = await guestContext.request.get(`${apiURL}/menu/table/1`, { headers: guestHeaders });
      await expectStatus(menuResponse, 200);
      const menu = await json<{ dishes: Array<{ id: number }>; restaurant: { feature_flags: Record<string, boolean> } }>(menuResponse);
      expect(menu.restaurant.feature_flags).toEqual(expect.objectContaining({
        table_ordering: true,
        request_bill: true,
        invoice_splitting: false,
      }));
      const dishId = menu.dishes[0].id;

      const createOrder = async (suffix: string) => {
        const response = await guestContext.request.post(`${apiURL}/table-session/${guestAccess.sessionId}/order`, {
          headers: { ...guestHeaders, 'X-Idempotency-Key': `${runId}-${suffix}` },
          data: { notes: `${runId}_${suffix}`, items: [{ dish_id: dishId, quantity: 2 }] },
        });
        await expectStatus(response, 201);
        return json<{ order: { id: number; status: string; invoice: { total: string } } }>(response);
      };
      const lifecycle = await createOrder('LIFECYCLE');
      const cancellation = await createOrder('CANCEL');
      expect(Number(lifecycle.order.invoice.total)).toBe(25);

      const splitDisabled = await guestContext.request.get(`${apiURL}/table-session/${guestAccess.sessionId}/invoice-split`, { headers: guestHeaders });
      await expectStatus(splitDisabled, 404);
      const pushDisabled = await waiterContext.request.get(`${apiURL}/push/config`, { headers: authHeaders(waiter.token) });
      await expectStatus(pushDisabled, 404);

      const tenantContext = await newContext();
      const tenantPage = await tenantContext.newPage();
      const tenantB = await loginThroughUi(tenantPage, roleEmail('tenant-b-owner'), /\/admin\/dashboard$/);
      const crossTenant = await tenantContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/confirm`, { headers: authHeaders(tenantB.token) });
      await expectStatus(crossTenant, 404);

      const accountantContext = await newContext();
      const accountantPage = await accountantContext.newPage();
      const accountant = await loginThroughUi(accountantPage, roleEmail('accountant'), /\/admin\/finance$/);
      const unauthorizedConfirm = await accountantContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/confirm`, { headers: authHeaders(accountant.token) });
      await expectStatus(unauthorizedConfirm, 403);

      const confirmResponse = await waiterContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/confirm`, { headers: authHeaders(waiter.token) });
      await expectStatus(confirmResponse, 200);
      const cancelResponse = await waiterContext.request.post(`${apiURL}/orders/${cancellation.order.id}/cancel`, { headers: authHeaders(waiter.token) });
      await expectStatus(cancelResponse, 200);
      expect((await json<{ order: { status: string } }>(cancelResponse)).order.status).toBe('staff_cancelled');

      const chefContext = await newContext();
      const chefPage = await chefContext.newPage();
      const chef = await loginThroughUi(chefPage, roleEmail('chef'), /\/admin\/dashboard$/);
      await chefPage.goto('/chef/dashboard');
      await expect(chefPage.getByText(runId).first()).toBeVisible();
      const startResponse = await chefContext.request.post(`${apiURL}/kitchen/orders/${lifecycle.order.id}/start`, { headers: authHeaders(chef.token) });
      await expectStatus(startResponse, 200);
      const readyResponse = await chefContext.request.post(`${apiURL}/kitchen/orders/${lifecycle.order.id}/ready`, { headers: authHeaders(chef.token) });
      await expectStatus(readyResponse, 200);
      expect((await json<{ order: { kitchen_status: string } }>(readyResponse)).order.kitchen_status).toBe('ready');

      const servedResponse = await waiterContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/served`, { headers: authHeaders(waiter.token) });
      await expectStatus(servedResponse, 200);
      expect((await json<{ order: { kitchen_status: string } }>(servedResponse)).order.kitchen_status).toBe('served');

      const billResponse = await guestContext.request.post(`${apiURL}/table-session/${guestAccess.sessionId}/request-bill`, { headers: guestHeaders });
      await expectStatus(billResponse, 201);
      const bill = await json<{ invoice_preview: { summary: { subtotal: string; total: string; currency: string } } }>(billResponse);
      expect(bill.invoice_preview.summary).toEqual(expect.objectContaining({ subtotal: '25.00', total: '25.00', currency: 'USD' }));

      await guestPage.goto('/menu/table/1/invoice');
      await expect(guestPage.getByText('المبلغ المستحق')).toBeVisible();
      await expect(guestPage.locator('body')).toContainText(/٢٥[٫.,]٠٠/);
      await expect(guestPage.getByRole('button', { name: /تنزيل PDF|Download PDF/ })).toBeVisible();
      await guestPage.goto('/invoice/print');
      await expect(guestPage.locator('body')).toContainText(/٢٥[٫.,]٠٠/);
      expect((await guestPage.pdf({ format: 'A4' })).byteLength).toBeGreaterThan(1_000);

      await accountantPage.goto('/admin/cashier');
      await expect(accountantPage.getByText('1 staff-confirmed order waiting for accounting')).toBeVisible();
      const accountResponse = await accountantContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/account`, {
        headers: authHeaders(accountant.token),
        data: { vat_rate: 0, service_charge_rate: 0, discount_value: 0 },
      });
      await expectStatus(accountResponse, 200);
      expect((await json<{ order: { status: string } }>(accountResponse)).order.status).toBe('accounted');

      const finalizeResponse = await waiterContext.request.post(`${apiURL}/table-sessions/${guestAccess.sessionId}/finalize`, {
        headers: authHeaders(waiter.token),
        data: { payment_method: 'card', payment_reference: `${runId}_PAYMENT` },
      });
      await expectStatus(finalizeResponse, 200);
      const finalized = await json<{ table_session: { status: string }; invoice_id: number; invoice_number: string; invoice_status: string }>(finalizeResponse);
      expect(finalized.invoice_status).toBe('paid');
      expect(finalized.table_session.status).toBe('closed');

      const invoiceResponse = await accountantContext.request.get(`${apiURL}/admin/finance/invoices/${finalized.invoice_id}`, { headers: authHeaders(accountant.token) });
      await expectStatus(invoiceResponse, 200);
      const invoice = await json<{ invoice: { invoice_number: string; status: string; total: string; payment_reference: string } }>(invoiceResponse);
      expect(invoice.invoice).toEqual(expect.objectContaining({
        invoice_number: finalized.invoice_number,
        status: 'paid',
        total: '25.00',
        payment_reference: `${runId}_PAYMENT`,
      }));
      const pdfResponse = await accountantContext.request.get(`${apiURL}/admin/finance/invoices/${finalized.invoice_id}/pdf`, { headers: authHeaders(accountant.token) });
      await expectStatus(pdfResponse, 200);
      expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
      expect((await pdfResponse.body()).byteLength).toBeGreaterThan(1_000);

      const revokedGuest = await guestContext.request.get(`${apiURL}/table-session/${guestAccess.sessionId}/orders`, { headers: guestHeaders });
      await expectStatus(revokedGuest, 403);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
