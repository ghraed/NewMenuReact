import { test, expect } from '../setup/qaBrowser';

test.describe('Room plan editor + reservations', () => {
  test('admin creates plan, saves layout, and public reservation reflects availability', async ({ page }) => {
    const planName = `QA_RUN_${process.env.QA_RUN_ID}_Plan_${Date.now()}`;

    await page.goto('/admin/login');

    await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
    await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
    await Promise.all([
      expect(page).toHaveURL(/\/admin\/dashboard$/),
      page.getByRole('button', { name: /login/i }).click(),
    ]);

    await page.goto('/admin/room-plans');
    await expect(page.getByText('Room Plan Editor')).toBeVisible();

    await page.getByPlaceholder('Plan name').fill(planName);
    await page.getByRole('button', { name: /Create Plan/i }).click();
    await expect(page.getByText(planName)).toBeVisible();

    await page.getByRole('button', { name: /Add Item/i }).click();
    await expect(page.getByRole('button', { name: /Table 1/i })).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => (
        response.request().method() === 'PUT'
        && /\/api\/room-plans\/\d+\/items\/bulk$/.test(response.url())
        && response.ok()
      )),
      page.getByRole('button', { name: /Save Layout/i }).click(),
    ]);

    await page.goto('/reservations');
    await expect(page.getByText('Book A Table')).toBeVisible();
    await page.getByRole('combobox').first().selectOption({ label: planName });
    await page.getByRole('button', { name: /free$/i }).click();
    await page.getByPlaceholder('e.g. Maya Hassan').fill(`QA_RUN_${process.env.QA_RUN_ID}_Guest`);
    await page.getByPlaceholder('e.g. +961 70 000 000').fill('+96170000000');

    await page.getByRole('button', { name: /Reserve Selected Table/i }).click();
    await expect(page.locator('#root').getByText('Reservation confirmed successfully.')).toBeVisible();
    await expect(page.getByRole('button', { name: /reserved$/i })).toBeVisible();
  });
});
