// Compatibility entrypoint for the older explicit live command. It uses the
// same fail-closed runtime verification, real fixture lifecycle and reporters.
import config from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...config,
  testMatch: '**/live-order-lifecycle.spec.ts',
  projects: config.projects?.filter((project) => project.name === 'chromium'),
});
