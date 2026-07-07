import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 90000,
  retries: 0,
  workers: 1, // Electron tests must run serially
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  // The MCP execute-tier tests send real requests at the playground.
  webServer: {
    command: 'pnpm --filter @openheaders/playground dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
