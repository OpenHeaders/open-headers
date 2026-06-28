/**
 * Request-scripts UI e2e — the DOM counterpart to
 * `request-scripts.spec.ts`.
 *
 * Types a script into the Scripts tab's Monaco editor → Send → asserts
 * the outcome surfaces through the UI: a pre-request mutation lands on
 * the wire (read back from `/api/echo`), console output shows in the
 * response Console tab, and post-response `oh.test` results show in the
 * response Assertions tab (PASS / FAIL).
 *
 * This is also the regression guard for the Send-drops-scripts bug:
 * `handleSend` must carry `preRequestScript` / `postResponseScript` into
 * the executed draft, or none of these assertions hold.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
const uids = new Map<string, string>();

const SEEDS = ['scripts-ui-pre', 'scripts-ui-console', 'scripts-ui-pass', 'scripts-ui-fail'];

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  for (const name of SEEDS) {
    uids.set(
      name,
      await workbench.seedRequest({
        name,
        method: 'POST',
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

test.describe('Request editor — scripts written in the DOM run on Send', () => {
  test('a pre-request script mutates the outgoing request', async () => {
    await workbench.openRequest(uids.get('scripts-ui-pre')!);
    await workbench.openEditorTab(/Scripts/);
    await workbench.fillMonaco(0, `oh.setHeader('X-Pre', 'from-ui-script');`);
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-pre']).toBe('from-ui-script');
  });

  test('pre-request console output shows in the response Console tab', async () => {
    await workbench.openRequest(uids.get('scripts-ui-console')!);
    await workbench.openEditorTab(/Scripts/);
    await workbench.fillMonaco(0, `console.log('hello from pre'); oh.setHeader('X-Log', 'on');`);
    await workbench.send();
    await workbench.responseStatusText(); // wait for the response to render
    await workbench.openResponseTab(/Console/);
    await expect(workbench.responseRegion().getByText('hello from pre')).toBeVisible();
  });

  test('a passing post-response assertion shows in the Assertions tab', async () => {
    await workbench.openRequest(uids.get('scripts-ui-pass')!);
    await workbench.openEditorTab(/Scripts/);
    await workbench.selectScriptRail('Post-response');
    await workbench.fillMonaco(0, `oh.test('status ok', () => oh.expect(oh.response.status).toBe(200));`);
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('PASS', { exact: true })).toBeVisible();
    await expect(workbench.responseRegion().getByText('status ok')).toBeVisible();
  });

  test('a failing post-response assertion shows in the Assertions tab', async () => {
    await workbench.openRequest(uids.get('scripts-ui-fail')!);
    await workbench.openEditorTab(/Scripts/);
    await workbench.selectScriptRail('Post-response');
    await workbench.fillMonaco(0, `oh.test('always fails', () => oh.expect(1).toBe(2));`);
    await workbench.send();
    await workbench.responseStatusText();
    await workbench.openResponseTab(/Assertions/);
    await expect(workbench.responseRegion().getByText('FAIL', { exact: true })).toBeVisible();
    await expect(workbench.responseRegion().getByText('always fails')).toBeVisible();
  });
});
