import { expect, test, type APIResponse, type BrowserContext, type Page, type Response } from '@playwright/test';

const runId = process.env.E2E_RUN_ID || '';
const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:8001/api';
const password = 'QA-only-password-42!';
const tenantHost = `${runId.toLowerCase().replaceAll('_', '-')}-release.localhost`;

interface LoginResult {
  user: {
    role: string;
    assigned_tables: Array<{ id: number; name: string }>;
    restaurant: { id: number; feature_flags: Record<string, boolean> };
  };
}

interface GuestAccessState {
  deviceId: string;
  sessionId: number;
  exposedToken: string;
}

type JsonResponse = APIResponse | Response;

const json = async <T>(response: JsonResponse): Promise<T> => response.json() as Promise<T>;
const roleEmail = (role: string): string => `${runId.toLowerCase()}_${role}@example.test`;
const authHeaders = (): Record<string, string> => ({ Accept: 'application/json' });

const expectStatus = async (response: JsonResponse, expected: number): Promise<void> => {
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
  expect(await page.evaluate(() => window.localStorage.getItem('admin_auth_token'))).toBeNull();
  const response = await page.request.get(`${apiURL}/auth/me`, { headers: authHeaders() });
  await expectStatus(response, 200);
  const payload = await json<{ user: LoginResult['user'] }>(response);
  return { user: payload.user };
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
        headers: authHeaders(),
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
      const unlockResponsePromise = guestPage.waitForResponse((response) => (
        response.url().endsWith('/menu/table/1/verify-pin') && response.request().method() === 'POST'
      ));
      await pinInput.locator('xpath=ancestor::form').getByRole('button').click();
      const unlockPayload = await (await unlockResponsePromise).json() as unknown;
      expect(JSON.stringify(unlockPayload)).not.toMatch(/guest_access_token|access_token/i);
      await expect(guestPage.getByText(/تم فتح|جاهزة/).first()).toBeVisible();

      const guestAccess = await guestPage.evaluate(() => {
        const cart = JSON.parse(window.localStorage.getItem('guest_order_cart_state') || '{}') as {
          draft?: { guestAccessToken?: string; tableSessionId?: number };
        };
        return {
          sessionId: cart.draft?.tableSessionId || 0,
          deviceId: window.localStorage.getItem('guest_table_device_id') || '',
          exposedToken: cart.draft?.guestAccessToken || window.localStorage.getItem('guest_access_token') || '',
        };
      }) as GuestAccessState;
      expect(guestAccess.sessionId).toBe(activated.table_session.id);
      expect(guestAccess.exposedToken).toBe('');
      expect(guestAccess.deviceId).not.toBe('');
      const guestHeaders = {
        Accept: 'application/json',
        'X-Forwarded-Host': tenantHost,
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
      const pushDisabled = await waiterContext.request.get(`${apiURL}/push/config`, { headers: authHeaders() });
      await expectStatus(pushDisabled, 404);

      const tenantContext = await newContext();
      const tenantPage = await tenantContext.newPage();
      const tenantB = await loginThroughUi(tenantPage, roleEmail('tenant-b-owner'), /\/admin\/dashboard$/);
      expect(tenantB.user.role).toBe('admin');
      const crossTenant = await tenantContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/confirm`, { headers: authHeaders() });
      await expectStatus(crossTenant, 404);

      const accountantContext = await newContext();
      const accountantPage = await accountantContext.newPage();
      const accountant = await loginThroughUi(accountantPage, roleEmail('accountant'), /\/admin\/finance$/);
      expect(accountant.user.role).toBe('accountant');
      const unauthorizedConfirm = await accountantContext.request.post(`${apiURL}/orders/${lifecycle.order.id}/confirm`, { headers: authHeaders() });
      await expectStatus(unauthorizedConfirm, 403);
      await accountantPage.goto('/admin/finance/payroll');
      await expect(accountantPage.getByRole('heading', { name: '404' })).toBeVisible();
      await expect(accountantPage.getByText('The page you requested does not exist.')).toBeVisible();

      await waiterPage.goto('/staff/orders');
      await expect(waiterPage.getByText(`${runId}_LIFECYCLE`, { exact: true })).toBeVisible();
      const pendingCard = (notes: string) => waiterPage.getByText(notes, { exact: true })
        .locator('xpath=ancestor::*[.//button[normalize-space()="Confirm Request"]][1]');
      const lifecycleConfirm = waiterPage.waitForResponse((response) => (
        response.url().endsWith(`/orders/${lifecycle.order.id}/confirm`) && response.request().method() === 'POST'
      ));
      await pendingCard(`${runId}_LIFECYCLE`).getByRole('button', { name: 'Confirm Request' }).click();
      await expectStatus(await lifecycleConfirm, 200);
      const cancellationConfirm = waiterPage.waitForResponse((response) => (
        response.url().endsWith(`/orders/${cancellation.order.id}/confirm`) && response.request().method() === 'POST'
      ));
      await pendingCard(`${runId}_CANCEL`).getByRole('button', { name: 'Confirm Request' }).click();
      await expectStatus(await cancellationConfirm, 200);

      // There is no visible control for cancelling an already confirmed order. Exercise the
      // backend restoration contract explicitly and keep that UI gap documented in README.
      const cancelResponse = await waiterContext.request.post(`${apiURL}/orders/${cancellation.order.id}/cancel`, { headers: authHeaders() });
      await expectStatus(cancelResponse, 200);
      expect((await json<{ order: { status: string } }>(cancelResponse)).order.status).toBe('staff_cancelled');

      const chefContext = await newContext();
      const chefPage = await chefContext.newPage();
      const chef = await loginThroughUi(chefPage, roleEmail('chef'), /\/admin\/dashboard$/);
      expect(chef.user.role).toBe('chef');
      await chefPage.goto('/chef/dashboard');
      await expect(chefPage.getByText(`${runId}_LIFECYCLE`, { exact: true })).toBeVisible();
      const startResponse = chefPage.waitForResponse((response) => (
        response.url().endsWith(`/kitchen/orders/${lifecycle.order.id}/start`) && response.request().method() === 'POST'
      ));
      await chefPage.getByRole('button', { name: 'Start Preparing' }).click();
      await expectStatus(await startResponse, 200);
      const readyResponse = chefPage.waitForResponse((response) => (
        response.url().endsWith(`/kitchen/orders/${lifecycle.order.id}/ready`) && response.request().method() === 'POST'
      ));
      await chefPage.getByRole('button', { name: 'Mark as Ready' }).click();
      await expectStatus(await readyResponse, 200);

      await expect(chefPage.getByRole('button', { name: 'Mark as Served' })).toBeVisible();
      const servedResponse = chefPage.waitForResponse((response) => (
        response.url().endsWith(`/orders/${lifecycle.order.id}/served`) && response.request().method() === 'POST'
      ));
      await chefPage.getByRole('button', { name: 'Mark as Served' }).click();
      await expectStatus(await servedResponse, 200);

      const billResponsePromise = guestPage.waitForResponse((response) => (
        response.url().endsWith(`/table-session/${guestAccess.sessionId}/request-bill`)
        && response.request().method() === 'POST'
      ));
      await guestPage.getByRole('button', { name: 'Open quick actions' }).click();
      await guestPage.getByRole('button', { name: 'اطلب الفاتورة' }).click();
      const billResponse = await billResponsePromise;
      await expectStatus(billResponse, 201);
      const bill = await json<{ invoice_preview: { summary: { subtotal: string; total: string; currency: string } } }>(billResponse);
      expect(bill.invoice_preview.summary).toEqual(expect.objectContaining({ subtotal: '25.00', total: '25.00', currency: 'USD' }));

      await guestPage.goto('/menu/table/1/invoice');
      await expect(guestPage.getByText('المبلغ المستحق')).toBeVisible();
      await expect(guestPage.locator('body')).toContainText(/(?:٢٥|25)[٫.,](?:٠٠|00)/);
      await expect(guestPage.getByRole('button', { name: /تنزيل PDF|Download PDF/ })).toBeVisible();
      await guestPage.goto('/invoice/print');
      await expect(guestPage.locator('body')).toContainText(/(?:٢٥|25)[٫.,](?:٠٠|00)/);
      expect((await guestPage.pdf({ format: 'A4' })).byteLength).toBeGreaterThan(1_000);

      await accountantPage.goto('/admin/cashier');
      await expect(accountantPage.getByText('1 staff-confirmed order waiting for accounting')).toBeVisible();
      const tableName = waiter.user.assigned_tables[0].name;
      await accountantPage.getByRole('button', { name: 'All tables' }).click();
      await accountantPage.getByRole('listbox').getByRole('button', { name: tableName }).click();
      const saveDraftResponse = accountantPage.waitForResponse((response) => (
        response.url().endsWith(`/orders/${lifecycle.order.id}/accounting-draft`) && response.request().method() === 'PATCH'
      ));
      await accountantPage.getByRole('button', { name: `Save ${tableName} Issues & Gifts` }).click();
      await expectStatus(await saveDraftResponse, 200);

      const cashierContext = await newContext();
      const cashierPage = await cashierContext.newPage();
      await loginThroughUi(cashierPage, roleEmail('owner'), /\/admin\/dashboard$/);
      await cashierPage.goto('/admin/cashier');
      await cashierPage.getByRole('button', { name: 'All tables' }).click();
      await cashierPage.getByRole('listbox').getByRole('button', { name: tableName }).click();
      await cashierPage.locator('select').filter({ has: cashierPage.locator('option[value="card"]') }).selectOption('card');
      await cashierPage.getByPlaceholder('Receipt number, transaction id, or note').fill(`${runId}_PAYMENT`);
      const accountResponsePromise = cashierPage.waitForResponse((response) => (
        response.url().endsWith(`/orders/${lifecycle.order.id}/account`) && response.request().method() === 'POST'
      ));
      const finalizeResponsePromise = cashierPage.waitForResponse((response) => (
        response.url().endsWith(`/table-sessions/${guestAccess.sessionId}/finalize`) && response.request().method() === 'POST'
      ));
      await cashierPage.getByRole('button', { name: `Finalize ${tableName} Invoice` }).click();
      await expectStatus(await accountResponsePromise, 200);
      const finalizeResponse = await finalizeResponsePromise;
      await expectStatus(finalizeResponse, 200);
      const finalized = await json<{ table_session: { status: string }; invoice_id: number; invoice_number: string; invoice_status: string }>(finalizeResponse);
      expect(finalized.invoice_status).toBe('paid');
      expect(finalized.table_session.status).toBe('closed');

      const invoiceResponse = await accountantContext.request.get(`${apiURL}/admin/finance/invoices/${finalized.invoice_id}`, { headers: authHeaders() });
      await expectStatus(invoiceResponse, 200);
      const invoice = await json<{ invoice: { invoice_number: string; status: string; total: string; payment_reference: string } }>(invoiceResponse);
      expect(invoice.invoice).toEqual(expect.objectContaining({
        invoice_number: finalized.invoice_number,
        status: 'paid',
        total: '25.00',
        payment_reference: `${runId}_PAYMENT`,
      }));
      const pdfResponse = await accountantContext.request.get(`${apiURL}/admin/finance/invoices/${finalized.invoice_id}/pdf`, { headers: authHeaders() });
      await expectStatus(pdfResponse, 200);
      expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
      expect((await pdfResponse.body()).byteLength).toBeGreaterThan(1_000);

      const revokedGuest = await guestContext.request.get(`${apiURL}/table-session/${guestAccess.sessionId}/orders`, { headers: guestHeaders });
      await expectStatus(revokedGuest, 403);
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
    }
  });
});
