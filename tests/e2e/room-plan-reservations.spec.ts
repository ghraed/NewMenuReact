import { test, expect } from '@playwright/test';

test.describe('Room plan editor + reservations', () => {
  test.skip(true, 'Requires running backend APIs and seeded admin credentials in the target environment.');

  test('admin creates plan, saves layout, and public reservation reflects availability', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Password').fill('password');
    await page.getByRole('button', { name: /login/i }).click();

    await page.goto('/admin/room-plans');
    await expect(page.getByText('Room Plan Editor')).toBeVisible();

    await page.getByPlaceholder('Plan name').fill('E2E Main Plan');
    await page.getByRole('button', { name: /Create Plan/i }).click();

    await page.getByRole('button', { name: /Add Item/i }).click();
    await page.getByRole('button', { name: /Save Layout/i }).click();

    await page.goto('/reservations');
    await expect(page.getByText('Book A Table')).toBeVisible();

    await page.getByRole('button', { name: /Reserve Selected Table/i }).click();
  });
});
