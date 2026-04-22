import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  /*
   * Boots the playground's Vite dev server before any spec runs. The
   * playground is the single source of truth for "test HTTP backend" —
   * specs that need a real network endpoint from the extension's
   * service worker (e.g. `live-orchestration.spec.ts` runtime-branching
   * scenarios) point requests at http://127.0.0.1:3000/<path>.
   *
   * `reuseExistingServer` stays true locally so running the playground
   * manually during dev (`pnpm --filter @openheaders/playground dev`)
   * is reused instead of starting a second instance. Specs that don't
   * need the playground pay only the one-time startup cost.
   */
  webServer: {
    command: 'pnpm --filter @openheaders/playground dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
