/**
 * Request-editor UI e2e — the DOM-level counterpart to
 * `request-executor.spec.ts`.
 *
 * Where the RPC spec proves all 49 auth × body wire paths through the
 * executor directly, this one proves the *UI wiring* the RPC spec can't
 * touch: for every combo, open the request in the editor by clicking it
 * in the sidebar → click Send → assert the response panel renders a 200
 * (deep auth/body parity stays in the RPC spec).
 *
 * Requests are seeded via the real CRUD RPC (fast, hermetic). The import
 * UI — a Monaco merge editor — is a separate subsystem and gets its own
 * spec; coupling it into the executor-UI flow would chain this test to
 * the entire merge stack.
 *
 * Selectors are semantic-first (getByRole / existing data-item-id) with a
 * single data-testid on the response status chip. Playwright boots the
 * playground webServer, so `/api/echo` is up at 127.0.0.1:3000.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_CLIENT_COMBOS, API_ECHO_URL, OAUTH2_SEED_AUTH } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** The full 7×7 = 49 cross, driven through the UI. */
const COMBOS = API_CLIENT_COMBOS;

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
const seededUids = new Map<string, string>();

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  const page: Page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  // Seed the oauth2 token once via the real client-credentials flow so the
  // oauth2 sends carry a genuine bearer (the response still 200s either
  // way — this keeps the UI path faithful to the RPC spec).
  const seed = await workbench.rpc<{ success: boolean; error?: string }>('oauthClientCredentials', {
    config: OAUTH2_SEED_AUTH,
  });
  expect(seed.success, seed.error).toBe(true);

  // Seed every combo through the real CRUD path, then reload so the
  // sidebar renders them deterministically.
  for (const combo of COMBOS) {
    const uid = await workbench.seedRequest({
      name: combo.name,
      method: combo.method,
      url: API_ECHO_URL,
      auth: combo.auth,
      body: combo.body,
    });
    seededUids.set(combo.name, uid);
  }
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
});

test.afterAll(async () => {
  await context.close();
});

test.describe('Request editor — open → Send → response renders (UI)', () => {
  for (const combo of COMBOS) {
    test(combo.name, async () => {
      const uid = seededUids.get(combo.name);
      expect(uid, `no seeded uid for ${combo.name}`).toBeTruthy();

      await workbench.openRequest(uid!);
      await workbench.send();
      const status = await workbench.responseStatusText();
      expect(status).toContain('200');
    });
  }
});
