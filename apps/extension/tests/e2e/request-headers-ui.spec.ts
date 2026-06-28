/**
 * Request-headers UI e2e — the DOM counterpart to
 * `request-headers.spec.ts`.
 *
 * Types header rows into the Headers table (via its Bulk Edit textarea)
 * → Send → reads the `/api/echo` reflection back from the response
 * panel → asserts the headers the user entered in the DOM rode the
 * actual wire (Node lowercases the names; repeated rows collapse to one
 * comma-joined value at the browser's Headers layer).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Matches the Headers bulk-edit textarea placeholder. */
const HEADERS_BULK = /Content-Type: application/;

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
const uids = new Map<string, string>();

const SEEDS = ['headers-ui-subset', 'headers-ui-repeat'];

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

  for (const name of SEEDS) {
    uids.set(
      name,
      await workbench.seedRequest({
        name,
        method: 'GET',
        url: API_ECHO_URL,
        auth: { type: 'none' },
        body: { type: 'none' },
      }),
    );
  }
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  headers: Record<string, string | string[] | undefined>;
}

test.describe('Request editor — headers entered in the DOM reach the wire', () => {
  test('enabled + disabled rows: only enabled ones are sent', async () => {
    await workbench.openRequest(uids.get('headers-ui-subset')!);
    await workbench.openEditorTab(/Headers/);
    await workbench.fillBulkEdit(HEADERS_BULK, 'X-Enabled: yes\n//X-Disabled: no\nX-Implicit: on');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-enabled']).toBe('yes');
    expect(echo.headers['x-implicit']).toBe('on');
    expect(echo.headers['x-disabled']).toBeUndefined();
  });

  test('repeated header names collapse to one comma-joined value', async () => {
    await workbench.openRequest(uids.get('headers-ui-repeat')!);
    await workbench.openEditorTab(/Headers/);
    await workbench.fillBulkEdit(HEADERS_BULK, 'X-Repeat: a\nX-Repeat: b\nX-Repeat: c');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-repeat']).toBe('a, b, c');
  });
});
