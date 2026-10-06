import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('packaged drink temperature survives creation, editing, clearing, and reload', async ({ page }) => {
  const name = `QA_RUN_20261006_Temperature_${Date.now()}`;
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/admin/login');
  expect(new URL(page.url()).hostname).toMatch(/^(127\.0\.0\.1|localhost|.*\.localhost)$/);
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL || 'test@example.com');
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD || 'password');
  await Promise.all([page.waitForURL('**/admin/dashboard'), page.getByRole('button', { name: /login/i }).click()]);
  await page.goto('/admin/dishes/create');
  await page.getByRole('button', { name: 'Select Packaged Drink' }).click();
  await page.locator('select[name="category"]').selectOption('Drinks');
  await page.getByPlaceholder('12.99').fill('3.50');
  await page.getByPlaceholder('Pepsi / Coca-Cola').fill(name);
  await page.getByPlaceholder('0', { exact: true }).fill('10');
  await page.locator('select[name="serving_temperature"]').selectOption('cold');
  await page.locator('input[name="preview_file"]').setInputFiles({ name: 'QA_RUN_preview.png', mimeType: 'image/png', buffer: await readFile(resolve(process.cwd(), 'public/pwa-192.png')) });
  const [created] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/dishes'),
    page.getByRole('button', { name: 'Create Menu Item', exact: true }).click(),
  ]);
  expect(created.status()).toBe(201);
  const dish = await created.json();
  expect(dish.serving_temperature).toBe('cold');
  await page.waitForURL('**/admin/dashboard');
  const editUrl = `/admin/dishes/${dish.id}/edit`;
  await page.goto(editUrl);
  await expect(page.locator('select[name="serving_temperature"]')).toHaveValue('cold');

  for (const value of ['room', '']) {
    await page.locator('select[name="serving_temperature"]').selectOption(value);
    const [saved] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/dishes/${dish.id}`),
      page.locator('form').getByRole('button', { name: /update/i }).click(),
    ]);
    expect(saved.status()).toBe(200);
    expect((await saved.json()).serving_temperature).toBe(value || null);
    await page.waitForURL('**/admin/dashboard');
    await page.goto(editUrl);
    await expect(page.locator('select[name="serving_temperature"]')).toHaveValue(value);
    await page.reload();
    await expect(page.locator('select[name="serving_temperature"]')).toHaveValue(value);
  }
  await page.evaluate(async (id) => {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
    for (const endpoint of [`/api/dishes/${id}`, `/api/dishes/${id}/force`]) {
      const response = await fetch(endpoint, { method: 'DELETE', headers });
      if (!response.ok) throw new Error(`QA fixture cleanup failed: ${response.status}`);
    }
  }, dish.id);
});
