/**
 * Request-executor Settings UI e2e — the DOM counterpart to
 * `request-settings.spec.ts`.
 *
 * Flips the two interactive Settings-tab switches through the editor →
 * Send → reads the result back, proving the toggle wires to the wire:
 *   • "Automatically follow redirects" off → a 3xx surfaces as status 0.
 *   • "Send browser cookies" on → the seeded jar cookie rides the
 *     request and shows up in the echoed `cookie` header.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const REDIRECT_URL = 'http://127.0.0.1:3000/api/redirect';
const SET_COOKIE_URL = 'http://127.0.0.1:3000/api/set-cookie';

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
const uids = new Map<string, string>();

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

  // Seed the cookie jar once with a credentialed send (RPC — the UI test
  // then proves the SWITCH makes a later send pick it up).
  await workbench.rpc('executeRequest', {
    draft: {
      schemaVersion: 5,
      uid: 'settings-seed-cookie',
      path: 'requests/settings-e2e/seed',
      name: 'seed cookie',
      method: 'GET',
      url: SET_COOKIE_URL,
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      credentialsMode: 'include',
    },
  });

  uids.set(
    'settings-ui-redirect',
    await workbench.seedRequest({
      name: 'settings-ui-redirect',
      method: 'GET',
      url: REDIRECT_URL,
      auth: { type: 'none' },
      body: { type: 'none' },
    }),
  );
  uids.set(
    'settings-ui-cookie',
    await workbench.seedRequest({
      name: 'settings-ui-cookie',
      method: 'GET',
      url: API_ECHO_URL,
      auth: { type: 'none' },
      body: { type: 'none' },
    }),
  );
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  headers: Record<string, string | string[] | undefined>;
}

test.describe('Request editor — Settings toggles reach the wire', () => {
  test("turning 'Automatically follow redirects' off surfaces a 3xx as status 0", async () => {
    await workbench.openRequest(uids.get('settings-ui-redirect')!);
    await workbench.openEditorTab(/Settings/);
    await workbench.toggleSwitch('Automatically follow redirects'); // on → off
    await workbench.send();
    expect(await workbench.responseStatusText()).toBe('0');
  });

  test("turning 'Send browser cookies' on attaches the jar cookie", async () => {
    await workbench.openRequest(uids.get('settings-ui-cookie')!);
    await workbench.openEditorTab(/Settings/);
    await workbench.toggleSwitch('Send browser cookies'); // off → on ⇒ credentialsMode 'include'
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(String(echo.headers.cookie ?? '')).toContain('oh_cred=present');
  });
});
