import { textContrast } from '../setup/contrast';
import { resolve } from 'node:path';
import { test, expect } from '../setup/qaBrowser';

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your Menu Items', exact: true })).toBeVisible();
};

test('login keyboard skips decoration and announces real authentication errors', async ({ page }, testInfo) => {
  await page.goto('/admin/login');
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `task10-login-${testInfo.project.name}.png`) });
  await expect(page.locator('button[aria-hidden="true"]')).toHaveCount(0);
  expect(await textContrast(page.getByRole('button', { name: /^Login$/ }))).toBeGreaterThanOrEqual(4.5);
  await page.getByLabel('Email or phone').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.getByLabel('Email or phone').fill(`QA_RUN_${process.env.QA_RUN_ID}_missing@example.invalid`);
  await page.getByLabel('Password').fill('QA_RUN_wrong_password');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /^Login$/ }).click(),
  ]);
  expect(response.status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-describedby', 'login-error');
});

for (const theme of ['light', 'dark']) {
  test(`Arabic POS complaint and settled report remain localized in ${theme}`, async ({ page }, testInfo) => {
    await login(page);
    const dish = await page.evaluate(async (name) => {
      const response = await fetch('/api/dishes', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` }, body: JSON.stringify({ name, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 5, status: 'published' }) });
      return { status: response.status, body: await response.json() };
    }, `QA_RUN_${process.env.QA_RUN_ID}_Arabic`);
    expect(dish.status).toBe(201);
    await page.evaluate((mode) => { localStorage.setItem('menu_locale', 'ar'); localStorage.setItem('guest_menu_theme', mode); }, theme);
    await page.goto('/staff/pos');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'شكوى / هدية بعد البيع' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'لوحة الشكاوى والتعويضات' })).toBeVisible();
    await expect(page.getByLabel('من تاريخ التقرير')).toBeVisible();
    await page.getByRole('button', { name: 'مجاني', exact: true }).click();
    await page.getByRole('button', { name: 'تعديل المشكلة / التعويض', exact: true }).click();
    await expect(page.getByRole('option', { name: 'مشكلة في الجودة', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'حفظ التعويض', exact: true }).click();
    const [checkout] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/pos/checkout') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'الدفع (Ctrl+Enter)' }).click(),
    ]);
    expect(checkout.status()).toBe(201);
    const settled = await checkout.json();
    expect(Number(settled.order.invoice.total)).toBe(0);
    await expect(page.getByText('الإيراد المتنازل عنه', { exact: true }).locator('..')).toContainText('10.00');
    for (const name of ['الإيراد المتنازل عنه', 'الإيراد المسترد', 'قيمة هدايا الكتالوج']) {
      const label = page.getByText(name, { exact: true });
      expect(await textContrast(label)).toBeGreaterThanOrEqual(4.5);
      expect(await textContrast(label.locator('..').locator('p').last())).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `task10-pos-ar-${theme}-${testInfo.project.name}.png`), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  });
}

test('room plan can be positioned without dragging and persists coordinates', async ({ page }, testInfo) => {
  await login(page);
  await page.goto('/admin/room-plans');
  await page.getByPlaceholder('Plan name').fill(`QA_RUN_${process.env.QA_RUN_ID}_keyboard`);
  await page.getByRole('button', { name: /Create Plan/i }).click();
  await page.getByRole('button', { name: /Add Item/i }).click();
  await page.getByRole('button', { name: /Table 1/i }).click();
  await page.getByLabel('Horizontal position').fill('120');
  await page.getByLabel('Vertical position').fill('140');
  const [saved] = await Promise.all([
    page.waitForResponse((r) => /\/room-plans\/\d+\/items\/bulk$/.test(r.url()) && r.request().method() === 'PUT'),
    page.getByRole('button', { name: /Save Layout/i }).click(),
  ]);
  expect(saved.status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: /Table 1/i }).click();
  await expect(page.getByLabel('Horizontal position')).toHaveValue('120');
  await expect(page.getByLabel('Vertical position')).toHaveValue('140');
  await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `task10-room-keyboard-${testInfo.project.name}.png`), fullPage: true });
});
