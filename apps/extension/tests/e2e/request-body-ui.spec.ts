/**
 * Request-body UI e2e — the DOM counterpart to the body coverage in
 * `request-executor.spec.ts` / `request-body-extras.spec.ts`.
 *
 * Drives the body picker (radio group + raw-format Select) and types
 * the content into the Monaco editor → Send → reads the `/api/echo`
 * reflection back from the response panel → asserts the body shape +
 * Content-Type the user composed in the DOM rode the wire.
 *
 * Monaco content goes in via `insertText` (a single bulk insert) so the
 * editor's auto-closing brackets don't mangle the JSON.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
const uids = new Map<string, string>();

const SEEDS = ['body-ui-text', 'body-ui-json', 'body-ui-js', 'body-ui-graphql'];

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
        method: 'POST',
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
  body: { kind: string; contentType: string | null; parsed?: unknown; raw?: string };
}

test.describe('Request editor — body composed in the DOM reaches the wire', () => {
  test('raw → Text ships text/plain', async () => {
    await workbench.openRequest(uids.get('body-ui-text')!);
    await workbench.openEditorTab(/Body/);
    await workbench.selectBodyRadio('raw');
    await workbench.fillMonaco(0, 'plain words from the editor');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.body.kind).toBe('text');
    expect(echo.body.contentType).toContain('text/plain');
    expect(echo.body.raw).toBe('plain words from the editor');
  });

  test('raw → JSON ships application/json with the typed object', async () => {
    await workbench.openRequest(uids.get('body-ui-json')!);
    await workbench.openEditorTab(/Body/);
    await workbench.selectBodyRadio('raw');
    await workbench.selectRawFormat('JSON');
    await workbench.fillMonaco(0, '{"hello":"world","n":42}');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.body.kind).toBe('json');
    expect(echo.body.contentType).toContain('application/json');
    expect(echo.body.parsed).toEqual({ hello: 'world', n: 42 });
  });

  test('raw → JavaScript ships text/javascript', async () => {
    await workbench.openRequest(uids.get('body-ui-js')!);
    await workbench.openEditorTab(/Body/);
    await workbench.selectBodyRadio('raw');
    await workbench.selectRawFormat('JavaScript');
    await workbench.fillMonaco(0, 'const x = 1;');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.body.kind).toBe('text');
    expect(echo.body.contentType).toContain('text/javascript');
  });

  test('GraphQL ships {"query":…} as application/json', async () => {
    await workbench.openRequest(uids.get('body-ui-graphql')!);
    await workbench.openEditorTab(/Body/);
    await workbench.selectBodyRadio('GraphQL');
    // Query editor is the first Monaco pane; leave the variables pane empty.
    await workbench.fillMonaco(0, '{ viewer { id } }');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.body.kind).toBe('json');
    expect(echo.body.parsed).toEqual({ query: '{ viewer { id } }' });
  });
});
