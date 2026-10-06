import { expect, test } from '@playwright/test';

test('a settled POS sale appears in history and opens its details', async ({ page }) => {
  const name = `QA_RUN_20261006_History_${Date.now()}`;
  await page.goto('/admin/login');
  expect(new URL(page.url()).hostname).toMatch(/^(127\.0\.0\.1|localhost|.*\.localhost)$/);
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL || 'test@example.com');
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD || 'password');
  await Promise.all([page.waitForURL('**/admin/dashboard'), page.getByRole('button', { name: /login/i }).click()]);
  const sale = await page.evaluate(async (dishName) => {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
    const create = await fetch('/api/dishes', {
      method: 'POST', headers,
      body: JSON.stringify({ name: dishName, price: 3.50, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 10, status: 'published' }),
    });
    if (create.status !== 201) throw new Error(`QA dish creation failed: ${create.status}`);
    const dish = await create.json();
    const checkout = await fetch('/api/pos/checkout', {
      method: 'POST', headers: { ...headers, 'X-Idempotency-Key': dishName },
      body: JSON.stringify({ table_reference: 'T01', payment_method: 'cash', notes: 'QA_RUN_20261006_OrderHistory', items: [{ dish_id: dish.id, quantity: 1 }] }),
    });
    if (checkout.status !== 201) throw new Error(`QA POS checkout failed: ${checkout.status}`);
    const body = await checkout.json();
    return { id: body.order.id as number, orderNumber: body.order.order_number as string, status: body.order.status as string };
  }, name);
  expect(sale.status).toBe('accounted');
  const [history] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/orders/history'),
    page.goto('/staff/today-orders'),
  ]);
  expect(history.status()).toBe(200);
  const browserTimezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  expect(new URL(history.url()).searchParams.get('timezone')).toBe(browserTimezone);
  await expect(page.getByText(sale.orderNumber, { exact: true })).toBeVisible();
  await expect(page.getByText('Paid: 1', { exact: true })).toBeVisible();
  const [details] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === `/api/orders/${sale.id}`),
    page.getByRole('link').filter({ hasText: sale.orderNumber }).click(),
  ]);
  expect(details.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/staff/today-orders/${sale.id}$`));
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText('$3.50', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});
