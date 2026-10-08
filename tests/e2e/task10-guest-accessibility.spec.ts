import { resolve } from 'node:path';
import { test, expect } from '../setup/qaBrowser';

for (const theme of ['light', 'dark']) {
  test(`guest related-dish modal keeps keyboard focus and restores it in ${theme}`, async ({ page }, testInfo) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
    await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your Menu Items', exact: true })).toBeVisible();
    const statuses = await page.evaluate(async ({ run, mode }) => {
      localStorage.setItem('guest_menu_theme', mode);
      const results = [];
      for (const stock of [0, 5]) {
        const response = await fetch('/api/dishes', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` }, body: JSON.stringify({ name: `QA_RUN_${run}_stock_${stock}`, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: stock, status: 'published' }) });
        results.push(response.status);
      }
      return results;
    }, { run: process.env.QA_RUN_ID, mode: theme });
    expect(statuses).toEqual([201, 201]);
    await page.goto('/menu');
    const trigger = page.getByRole('button', { name: 'Try Similar Favorites', exact: true });
    await trigger.focus();
    await page.keyboard.press('Space');
    const dialog = page.getByRole('dialog', { name: /Order related dishes/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `task10-guest-keyboard-${theme}-${testInfo.project.name}.png`), fullPage: true });
  });
}

test('paid bilingual receipt stays readable with toolbar hidden in print media', async ({ page }, testInfo) => {
  await page.addInitScript(() => { window.print = () => {}; });
  await page.goto('/admin/login');
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your Menu Items', exact: true })).toBeVisible();
  const statuses = await page.evaluate(async (run) => {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_auth_token')}` };
    const created = await fetch('/api/dishes', { method: 'POST', headers, body: JSON.stringify({ name: `QA_RUN_${run}_قهوة Coffee`, price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 5, status: 'published' }) });
    const dish = await created.json();
    const checkout = await fetch('/api/pos/checkout', { method: 'POST', headers, body: JSON.stringify({ payment_method: 'cash', items: [{ dish_id: dish.id, quantity: 1 }] }) });
    const sale = await checkout.json();
    const identityResponse = await fetch('/api/auth/me', { headers });
    const { user } = await identityResponse.json();
    // A rendering fixture derived from the real paid snapshot. Storage writing UI
    // is covered by the earlier accounting/tenant suites, preserved unchanged.
    const payload = { restaurantName: user.restaurant.name, tableName: 'QA_RUN_print', invoiceNumber: sale.order.invoice_number,
      generatedAt: '8 October 2026', notes: [], includedOrders: [sale.order.order_number],
      items: [{ key: 'QA_RUN_print_line', dishName: dish.name, quantity: 1, unitPrice: '$10.00', lineSubtotal: '$10.00' }],
      summary: { subtotal: '$10.00', discountLabel: 'Discount', discountAmount: '$0.00', taxableSubtotal: '$10.00', vatLabel: 'VAT', vatAmount: '$0.00', total: `$${sale.payment.total}` } };
    localStorage.setItem(`protected_v2:restaurant:${user.restaurant.id}:user:${user.id}:printable_invoice_payload`, JSON.stringify(payload));
    localStorage.setItem('menu_locale', 'ar');
    return [created.status, checkout.status, identityResponse.status, sale.payment.total];
  }, process.env.QA_RUN_ID);
  expect(statuses).toEqual([201, 201, 200, '10.00']);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((mode) => localStorage.setItem('guest_menu_theme', mode), theme);
    await page.goto('/invoice/print');
    await expect(page.getByText(/قهوة Coffee/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.invoice-print-toolbar')).toBeHidden();
    expect(await page.locator('main').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(page.locator('main')).toContainText('$10.00');
    await page.screenshot({ path: resolve(process.env.QA_EVIDENCE_DIR!, `task10-print-${theme}-${testInfo.project.name}.png`), fullPage: true });
    await page.emulateMedia({ media: 'screen' });
  }
});
