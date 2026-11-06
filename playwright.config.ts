import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests. They run against a local dev server on port 3100 (started for you), or against any URL in E2E_BASE_URL.
 *
 * Careful: a local server reads .env, whose DATABASE_URL can be the PRODUCTION database. The signed-out tests never
 * touch it. The signed-in tests only run when E2E_EMAIL and E2E_PASSWORD are set, and they log in for real, so give
 * them a test account (and point DATABASE_URL at a disposable database if you can).
 */
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: base, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npx next dev -p 3100', url: `${base}/auth/signin`, reuseExistingServer: true, timeout: 180_000 },
});
