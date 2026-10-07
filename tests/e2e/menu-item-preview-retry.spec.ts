import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '../setup/qaBrowser';

test('retrying a preview failure creates one complete menu item', async ({ page, context }) => {
  const name = `QA_RUN_${process.env.QA_RUN_ID}_PreviewRetry_${Date.now()}`;
  const image = await readFile(resolve(process.cwd(), 'public/pwa-192.png'));
  const requests: string[] = [];
  let attempts = 0;
  page.on('dialog', (dialog) => dialog.accept());
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && /^\/api\/dishes(?:\/\d+\/assets)?$/.test(path)) {
      requests.push(path);
    }
  });
  await page.route('**/api/**', async (route) => {
    if (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/dishes') {
      expect(route.request().postData()).toContain('name="preview_file"');
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'QA_RUN preview temporarily unavailable' }) });
        return;
      }
    }
    await route.continue();
  });

  await page.goto('/admin/login');
  expect(new URL(page.url()).hostname).toMatch(/^(127\.0\.0\.1|localhost|.*\.localhost)$/);
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  await Promise.all([expect(page).toHaveURL(/\/admin\/dashboard$/), page.getByRole('button', { name: /login/i }).click()]);
  await page.goto('/admin/dishes/create');
  await page.getByRole('button', { name: 'Select Packaged Drink' }).click();
  await page.locator('select[name="category"]').selectOption('Drinks');
  await page.getByPlaceholder('12.99').fill('3.50');
  await page.getByPlaceholder('Pepsi / Coca-Cola').fill(name);
  await page.getByPlaceholder('0', { exact: true }).fill('10');
  await page.locator('input[name="preview_file"]').setInputFiles({ name: 'QA_RUN_preview.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Create Menu Item', exact: true }).click();
  await expect(page.getByText('QA_RUN preview temporarily unavailable').first()).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/dishes\/create$/);
  await expect(page.getByPlaceholder('Pepsi / Coca-Cola')).toHaveValue(name);

  await Promise.all([
    expect(page).toHaveURL(/\/admin\/dashboard$/),
    page.getByRole('button', { name: 'Create Menu Item', exact: true }).click(),
  ]);
  expect(requests).toEqual(['/api/dishes', '/api/dishes']);
  const saved = await page.evaluate(async (itemName) => {
    const response = await fetch('/api/dishes?per_page=200', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` },
    });
    const body = await response.json();
    const dishes = Array.isArray(body) ? body : body.data;
    return { status: response.status, items: dishes.filter((dish: { name: string }) => dish.name === itemName) };
  }, name);
  expect(saved.status).toBe(200);
  expect(saved.items).toHaveLength(1);
  expect(saved.items[0].assets).toHaveLength(1);
  expect(saved.items[0].assets[0].asset_type).toBe('preview_image');
  const preview = await context.request.get(saved.items[0].assets[0].file_url);
  expect(preview.status()).toBe(200);
  expect(preview.headers()['content-type']).toContain('image/png');
  expect(await preview.body()).toEqual(image);

  await page.evaluate(async (id) => {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
    for (const endpoint of [`/api/dishes/${id}`, `/api/dishes/${id}/force`]) {
      const response = await fetch(endpoint, { method: 'DELETE', headers });
      if (!response.ok) throw new Error(`QA fixture cleanup failed: ${response.status}`);
    }
  }, saved.items[0].id);
});
