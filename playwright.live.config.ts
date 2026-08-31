import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174';
const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:8001/api';

for (const candidate of [baseURL, apiURL]) {
  const host = new URL(candidate).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Live E2E refuses non-loopback URL: ${candidate}`);
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'live-order-lifecycle.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-live', open: 'never' }]],
  outputDir: 'test-results/live',
  use: {
    baseURL,
    serviceWorkers: 'block',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-live', use: { ...devices['Desktop Chrome'] } }],
});
