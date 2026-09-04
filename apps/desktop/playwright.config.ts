import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from '@playwright/test';

// The MCP execute-tier tests send real requests at the playground —
// local-only infrastructure symlinked at the repo root, absent from the
// public tree. Without it those specs fail honestly on their own
// requests; everything else runs serverless.
const playgroundDir = path.resolve(__dirname, '../../playground');

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 90000,
  retries: 0,
  workers: 1, // Electron tests must run serially
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
  ...(existsSync(playgroundDir)
    ? {
        webServer: {
          command: `pnpm --dir ${playgroundDir} dev`,
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          stdout: 'ignore' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
