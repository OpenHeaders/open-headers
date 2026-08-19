/**
 * Query-params UI e2e — the DOM counterpart to `request-params.spec.ts`.
 *
 * The RPC spec proves the executor folds a params list onto the wire.
 * This one proves the EDITOR WIRING the RPC spec can't touch: type rows
 * into the Params table (via its Bulk Edit textarea) → Send → read the
 * `/api/echo` reflection back out of the response panel → assert the
 * params the user entered in the DOM actually rode the wire.
 *
 * Requests are seeded empty via the CRUD RPC, then edited entirely
 * through the UI. Selectors are semantic-first (getByRole / the table's
 * own controls) with the single `oh-response-status` data-testid.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Matches the Params bulk-edit textarea placeholder (`param1:value1…`). */
const PARAMS_BULK = /param1:value1/;

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
const uids = new Map<string, string>();

const SEEDS = ['params-ui-subset', 'params-ui-repeat', 'params-ui-encode'];

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
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  query: Record<string, string | string[]>;
}

test.describe('Request editor — query params entered in the DOM reach the wire', () => {
  test('enabled + disabled rows: only enabled ones are sent', async () => {
    await workbench.openRequest(uids.get('params-ui-subset')!);
    await workbench.openEditorTab(/Params/);
    // `//` disables a row; the third row omits the prefix ⇒ enabled.
    await workbench.fillBulkEdit(PARAMS_BULK, 'alpha:1\n//beta:2\ngamma:3');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.query).toEqual({ alpha: '1', gamma: '3' });
  });

  test('repeated key rides the wire as an ordered array', async () => {
    await workbench.openRequest(uids.get('params-ui-repeat')!);
    await workbench.openEditorTab(/Params/);
    await workbench.fillBulkEdit(PARAMS_BULK, 'tag:a\ntag:b\ntag:c');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.query.tag).toEqual(['a', 'b', 'c']);
  });

  test('special characters are percent-encoded then decoded back intact', async () => {
    await workbench.openRequest(uids.get('params-ui-encode')!);
    await workbench.openEditorTab(/Params/);
    await workbench.fillBulkEdit(PARAMS_BULK, 'q:a b&c=d');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.query.q).toBe('a b&c=d');
  });
});
