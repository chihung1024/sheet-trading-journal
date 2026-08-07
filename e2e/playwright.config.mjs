import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(
  readFileSync(new URL('../config/deployment-environments.json', import.meta.url), 'utf8'),
);

const baseURL = String(process.env.STAGING_E2E_BASE_URL || '').trim();
if (!baseURL) throw new Error('STAGING_E2E_BASE_URL is required');
if (baseURL !== contract.staging.frontend_origin) {
  throw new Error('STAGING_E2E_BASE_URL must equal the fixed staging frontend origin');
}

export default defineConfig({
  testDir: '.',
  testMatch: /staging-smoke\.spec\.mjs$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['line']],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
