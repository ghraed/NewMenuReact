import { expect, test } from '../setup/qaBrowser';

test('profile changes persist after reload and the new password works', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_PROFILE_EMAIL!;
  const password = process.env.PLAYWRIGHT_PROFILE_PASSWORD!;
  const name = `QA_RUN_${process.env.QA_RUN_ID}_Profile_${Date.now()}`;
  const phone = '+15550001009';
  const newPassword = ` QA_RUN_password_${Date.now()} `;

  await page.goto('/admin/login');
  expect(new URL(page.url()).hostname).toMatch(/^(127\.0\.0\.1|localhost|.*\.localhost)$/);
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    expect(page).toHaveURL(/\/admin\/dashboard$/),
    page.getByRole('button', { name: /login/i }).click(),
  ]);

  await page.goto('/admin/user-profile');
  const originalName = await page.getByPlaceholder('Enter your full name').inputValue();
  const originalPhone = await page.getByPlaceholder('Enter your phone number').inputValue();
  await page.getByPlaceholder('Enter your full name').fill(name);
  await page.getByPlaceholder('Enter your phone number').fill(phone);
  await page.getByPlaceholder('Minimum 8 characters').fill(newPassword);
  await page.getByPlaceholder('Re-enter password').fill(newPassword);
  const [savedResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'PATCH' && /\/api\/auth\/me$/.test(response.url())),
    page.getByRole('button', { name: 'Save Profile' }).click(),
  ]);
  expect(savedResponse.status()).toBe(200);
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();
  await expect(page.getByPlaceholder('Minimum 8 characters')).toHaveValue('');

  await page.reload();
  await expect(page.getByPlaceholder('Enter your full name')).toHaveValue(name);
  await expect(page.getByPlaceholder('Enter your phone number')).toHaveValue(phone);

  await page.getByRole('button', { name: /^(Logout|⎋)$/ }).first().click();
  await expect(page.getByText('Confirm Logout', { exact: true })).toBeVisible();
  await Promise.all([
    page.waitForURL('**/admin/login'),
    page.getByRole('button', { name: 'Logout', exact: true }).last().click(),
  ]);
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password').fill(password);
  const [rejectedLogin] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/auth\/login$/.test(response.url())),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  expect(rejectedLogin.status()).toBe(401);

  await page.getByLabel('Password').fill(newPassword);
  await Promise.all([
    expect(page).toHaveURL(/\/admin\/dashboard$/),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  await page.goto('/admin/user-profile');
  await expect(page.getByPlaceholder('Enter your full name')).toHaveValue(name);

  // Restore the disposable fixture so other browser scenarios can reuse it.
  await page.getByPlaceholder('Enter your full name').fill(originalName);
  await page.getByPlaceholder('Enter your phone number').fill(originalPhone);
  await page.getByPlaceholder('Minimum 8 characters').fill(password);
  await page.getByPlaceholder('Re-enter password').fill(password);
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();
});
