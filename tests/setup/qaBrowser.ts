import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { validateQaBrowserEnvironment } from './qaSafety';

export { expect };
export const test = base.extend<{ qaFixture: void }>({
  qaFixture: [async ({ request }, runFixture, testInfo) => {
    validateQaBrowserEnvironment(process.env);
    // Verify the effective API behind BOTH origins before any fixture can mutate data.
    for (const origin of [process.env.QA_API_URL!, process.env.PLAYWRIGHT_BASE_URL!]) {
      const response = await request.get(`${origin}/api/__qa/environment`);
      expect(response.status()).toBe(200);
      const target = await response.json();
      expect(target.run_id).toBe(process.env.QA_RUN_ID);
      expect(target.environment).toBe('testing');
      expect(target.database).toBe(process.env.DB_DATABASE);
      expect(target.host).toBe('127.0.0.1');
      expect(String(target.port)).toBe(process.env.DB_PORT);
    }
    process.env.QA_SCENARIO_ID = createHash('sha256').update(testInfo.testId).digest('hex').slice(0, 10);
    process.env.PLAYWRIGHT_PROFILE_EMAIL = `QA_RUN_${process.env.QA_RUN_ID}_${process.env.QA_SCENARIO_ID}@example.invalid`;
    process.env.PLAYWRIGHT_PROFILE_PASSWORD = `QA_RUN_${randomUUID()}`;
    execFileSync('php', [join(process.env.QA_API_ROOT!, 'scripts/qa/fixtures.php')], {
      cwd: process.env.QA_API_ROOT, env: process.env, stdio: 'pipe',
    });
    try {
      await runFixture();
    } finally {
      // Reset even after a failed assertion/password change. The runner removes the DB on exit.
      execFileSync('php', [join(process.env.QA_API_ROOT!, 'scripts/qa/fixtures.php'), '--clean'], {
        cwd: process.env.QA_API_ROOT, env: process.env, stdio: 'pipe',
      });
    }
  }, { auto: true }],
  context: async ({ context }, runFixture) => {
    await context.route((url) => ['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2'
        && route.request().resourceType() === 'stylesheet' && route.request().method() === 'GET') {
        // Optional third-party typography uses local fallback fonts during isolated QA.
        await route.fulfill({ status: 200, contentType: 'text/css', body: '/* QA local fallback fonts */' });
        return;
      }
      if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') {
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    await runFixture(context);
  },
});
