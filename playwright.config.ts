import { defineConfig, devices } from '@playwright/test';
import { validateQaBrowserEnvironment } from './tests/setup/qaSafety';

validateQaBrowserEnvironment(process.env);
const evidence = process.env.QA_EVIDENCE_DIR!;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['junit', { outputFile: `${evidence}/browser-junit.xml` }], ['html', { outputFolder: `${evidence}/browser-report`, open: 'never' }]],
  outputDir: `${evidence}/browser-results`,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE },
      },
    },
  ],
});
