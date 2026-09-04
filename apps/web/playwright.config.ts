import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  // A locator action or assertion that cannot complete is a failing
  // read, not a hang: it names itself within five seconds instead of
  // waiting out the whole test budget.
  expect: { timeout: 5_000 },
  use: {
    trace: 'on-first-retry',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
