import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import budgets from '../fixtures/performance-budgets.json' with { type: 'json' };
import { test, expect } from '../setup/qaBrowser';

test('throttled phone measures guest catalog and admin deep links', async ({ page, context, request }, testInfo) => {
  test.setTimeout(180_000);
  const authenticated = await request.post('/api/auth/login', { data: { email: process.env.PLAYWRIGHT_PROFILE_EMAIL, password: process.env.PLAYWRIGHT_PROFILE_PASSWORD } });
  expect(authenticated.status()).toBe(200);
  const { token } = await authenticated.json();
  const firstDishName = `QA_RUN_${process.env.QA_RUN_ID}_menu_0`;
  for (let index = 0; index < 12; index++) {
    const created = await request.post('/api/dishes', { headers: { Authorization: `Bearer ${token}` }, data: {
      name: `QA_RUN_${process.env.QA_RUN_ID}_menu_${index}`, description: 'QA_RUN synthetic catalog description',
      price: 10, category: 'Drinks', item_type: 'packaged_drink', packaged_stock_quantity: 50, status: 'published',
    } });
    expect(created.status()).toBe(201);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    (window as unknown as { qaLcp: number }).qaLcp = 0;
    new PerformanceObserver((list) => {
      (window as unknown as { qaLcp: number }).qaLcp = list.getEntries().at(-1)?.startTime || 0;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const samples: Record<string, unknown>[] = [];
  const measure = async (path: string, ready: () => Promise<void>) => {
    const started = Date.now();
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await ready();
    await page.waitForTimeout(500);
    samples.push({ path, readyMs: Date.now() - started, ...await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return { lcpMs: (window as unknown as { qaLcp: number }).qaLcp,
        jsBytes: resources.filter((r) => /\.js(?:\?|$)/.test(r.name)).reduce((sum, r) => sum + r.encodedBodySize, 0),
        scripts: resources.filter((r) => /\.js(?:\?|$)/.test(r.name)).map((r) => new URL(r.name).pathname),
        overflow: document.documentElement.scrollWidth > innerWidth };
    }) });
    writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, `task10-performance-${testInfo.project.name}.json`), JSON.stringify({ profile: { viewport: '390x844', cpuSlowdown: 4, latencyMs: 150, downloadBytesPerSecond: 200000, cache: 'disabled' }, samples }, null, 2));
  };
  for (let repeat = 0; repeat < 3; repeat++) await measure('/menu', async () => { await expect(page.getByRole('heading', { name: firstDishName, exact: true })).toBeVisible(); });
  for (let repeat = 0; repeat < 3; repeat++) await measure('/admin/login', async () => { await expect(page.getByLabel('Password')).toBeVisible(); });
  await page.getByLabel('Email or phone').fill(process.env.PLAYWRIGHT_PROFILE_EMAIL!);
  await page.getByLabel('Password').fill(process.env.PLAYWRIGHT_PROFILE_PASSWORD!);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your Menu Items', exact: true })).toBeVisible();
  for (let repeat = 0; repeat < 3; repeat++) await measure('/staff/pos', async () => { await expect(page.getByText('Waived Revenue', { exact: true })).toBeVisible(); });
  for (let repeat = 0; repeat < 3; repeat++) await measure('/admin/finance', async () => { await expect(page.getByRole('heading', { name: 'Luxury Financial Overview' }).first()).toBeVisible(); });
  writeFileSync(resolve(process.env.QA_EVIDENCE_DIR!, `task10-performance-${testInfo.project.name}.json`), JSON.stringify({ profile: { viewport: '390x844', cpuSlowdown: 4, latencyMs: 150, downloadBytesPerSecond: 200000, cache: 'disabled' }, samples }, null, 2));
  for (const sample of samples) {
    const budget = budgets[sample.path as keyof typeof budgets];
    expect(sample.jsBytes).toBeLessThanOrEqual(budget.jsBytes);
    expect(sample.readyMs).toBeLessThanOrEqual(budget.readyMs);
    expect(sample.lcpMs).toBeGreaterThan(0);
    expect(sample.lcpMs).toBeLessThanOrEqual(budget.lcpMs);
    expect(sample.overflow).toBe(false);
    const scripts = sample.scripts as string[];
    expect(scripts.some((script) => /financeReportWorkbook|eventPlanPdf/.test(script))).toBe(false);
    if (sample.path === '/menu' || sample.path === '/admin/login') {
      expect(scripts.some((script) => /charts-|model-viewer-|three-/.test(script))).toBe(false);
    }
  }
});
