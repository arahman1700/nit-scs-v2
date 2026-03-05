import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Admin tests: gotoAuth injects fresh tokens via API (no storageState needed)
    {
      name: 'admin-tests',
      testMatch: [
        /admin-dashboard\.spec\.ts/,
        /navigation\.spec\.ts/,
        /sections\.spec\.ts/,
        /forms\.spec\.ts/,
        /material\.spec\.ts/,
        /advanced-features\.spec\.ts/,
      ],
    },
    // Auth & role tests: need fresh browser context for login flow testing
    {
      name: 'auth-tests',
      dependencies: ['admin-tests'],
      testMatch: [/auth\.spec\.ts/, /roles\.spec\.ts/],
    },
  ],
  webServer: undefined,
});
