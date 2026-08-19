/**
 * Request-executor error-path UI e2e — the DOM-level counterpart to
 * `request-executor-errors.spec.ts`.
 *
 * The RPC spec proves every status / redirect / net-failure snapshot;
 * this one proves what the USER actually sees for a representative case
 * per family: open the seeded request in the editor, click Send, and
 * assert the response panel — the status chip for HTTP results, the
 * "Could not send request" error state (with the classified message
 * leading with the real net code) for net-stack failures.
 *
 * Deliberately one scenario per family, not the full matrix — deep
 * message/snapshot coverage stays in the RPC spec; duplicating it here
 * would only re-test the same executor through a slower channel.
 *
 * Doubles as the manual demo set: after a run the requests remain
 * seeded, and `SLOW_MO=500 pnpm exec playwright test
 * tests/e2e/request-executor-errors-ui.spec.ts` replays every scenario
 * watchably (the rig already runs headed).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const BASE = 'http://127.0.0.1:3000';

interface ErrorUiScenario {
  name: string;
  url: string;
  /** Substrings the error state's message must contain. */
  expectError: string[];
}

/** One per net-failure family the playground can mint. */
const ERROR_SCENARIOS: ErrorUiScenario[] = [
  {
    name: 'DNS failure',
    url: 'https://does-not-exist.invalid/',
    expectError: ['net::ERR_NAME_NOT_RESOLVED', 'Could not resolve does-not-exist.invalid'],
  },
  {
    name: 'connection refused',
    url: 'http://127.0.0.1:59117/echo',
    expectError: ['net::ERR_CONNECTION_REFUSED', 'refused the connection on port 59117'],
  },
  {
    name: 'empty response',
    url: `${BASE}/net/abort-headers`,
    expectError: ['net::ERR_EMPTY_RESPONSE', 'closed the connection without a response'],
  },
  {
    name: 'HTTPS against plain-HTTP port',
    url: 'https://127.0.0.1:3000/api/echo',
    expectError: ['net::ERR_SSL_PROTOCOL_ERROR', 'try http://127.0.0.1:3000'],
  },
  {
    name: 'redirect loop',
    url: `${BASE}/net/redirect-loop`,
    expectError: ['net::ERR_TOO_MANY_REDIRECTS'],
  },
];

const STATUS_SCENARIOS = [
  { name: 'HTTP 404', url: `${BASE}/net/status/404`, expectStatus: '404' },
  { name: 'HTTP 500', url: `${BASE}/net/status/500`, expectStatus: '500' },
];

let context: BrowserContext;
let workbench: WorkbenchPage;
const seededUids = new Map<string, string>();

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;

  const page: Page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  for (const scenario of [...STATUS_SCENARIOS, ...ERROR_SCENARIOS]) {
    const uid = await workbench.seedRequest({
      name: `err-ui: ${scenario.name}`,
      method: 'GET',
      url: scenario.url,
      auth: { type: 'none' },
      body: { type: 'none' },
    });
    seededUids.set(scenario.name, uid);
  }
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

async function openAndSend(name: string): Promise<void> {
  const uid = seededUids.get(name);
  expect(uid, `no seeded uid for ${name}`).toBeTruthy();
  await workbench.openRequest(uid!);
  await workbench.send();
}

test.describe('Response panel — HTTP statuses render as responses', () => {
  for (const scenario of STATUS_SCENARIOS) {
    test(scenario.name, async () => {
      await openAndSend(scenario.name);
      const status = await workbench.responseStatusText();
      expect(status).toContain(scenario.expectStatus);
    });
  }
});

test.describe('Response panel — net failures render the classified error', () => {
  for (const scenario of ERROR_SCENARIOS) {
    test(scenario.name, async () => {
      await openAndSend(scenario.name);
      const message = await workbench.responseErrorText();
      for (const fragment of scenario.expectError) {
        expect(message).toContain(fragment);
      }
      // None of these families carries the open-in-tab hint (that is
      // the certificate family, which the plain-HTTP playground cannot
      // mint) — the recovery button must NOT appear for them.
      await expect(workbench.responseErrorOpenTabButton()).toHaveCount(0);
    });
  }
});
