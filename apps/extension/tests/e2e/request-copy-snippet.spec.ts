/**
 * Copy as cURL / fetch e2e — both entry points, asserted against the
 * exact clipboard text.
 *
 * Requests are seeded via the real CRUD RPC (the request-editor-ui
 * idiom), then copied two ways: the sidebar row's `⋯ → Copy as` submenu
 * and the editor header's `⋯ → Copy as cURL / fetch` items. The host
 * resolves each request through the SAME `resolveRequest` a Send rides
 * (auth folded, params in the URL, default Content-Type filled), so the
 * assertions pin the full wire fidelity of the copied command per body
 * / auth combination.
 *
 * The clipboard write is captured by stubbing
 * `navigator.clipboard.writeText` in the workbench page before load —
 * Chromium refuses permission grants on `chrome-extension://` origins,
 * so reading the real clipboard back isn't an option; the stub records
 * exactly the text the app handed the platform API. `expect.poll`
 * absorbs the resolve-RPC → format → write latency.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let page: Page;
let workbench: WorkbenchPage;
const uids = new Map<string, string>();

declare global {
  interface Window {
    __ohCopiedText?: string;
  }
}

function readCapturedCopy(): Promise<string> {
  return page.evaluate(() => window.__ohCopiedText ?? '');
}

/** Poll the captured write until the copy lands (or the poll times out). */
async function expectClipboard(expected: string): Promise<void> {
  await expect.poll(readCapturedCopy, { timeout: 10000 }).toBe(expected);
  // Reset so the next test can't pass on a stale capture.
  await page.evaluate(() => {
    window.__ohCopiedText = undefined;
  });
}

const SEEDS = [
  {
    key: 'plain',
    name: 'Copy plain GET',
    method: 'GET',
    auth: { type: 'none' },
    body: { type: 'none' },
  },
  {
    key: 'bearer-json',
    name: 'Copy bearer JSON POST',
    method: 'POST',
    auth: { type: 'bearer', token: 'oh-bearer-sample-token' },
    body: { type: 'json', content: '{"hello":"world","n":42}' },
  },
  {
    key: 'apikey-query',
    name: 'Copy api-key query GET',
    method: 'GET',
    auth: { type: 'api-key', key: 'api_key', value: 'oh-apikey-query-sample', in: 'query' },
    body: { type: 'none' },
  },
  {
    key: 'form-post',
    name: 'Copy form POST',
    method: 'POST',
    auth: { type: 'none' },
    body: {
      type: 'form',
      formParts: [
        { uid: 'frmpart1', key: 'a', value: '1' },
        { uid: 'frmpart2', key: 'b c', value: '2&3' },
        { uid: 'frmpart3', key: 'off', value: 'x', enabled: false },
      ],
    },
  },
] as const;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  page = await context.newPage();
  // Capture-the-write clipboard stub — see the module doc.
  await page.addInitScript(() => {
    navigator.clipboard.writeText = (text: string) => {
      window.__ohCopiedText = text;
      return Promise.resolve();
    };
  });
  workbench = await WorkbenchPage.open(page, extensionId);
  for (const seed of SEEDS) {
    uids.set(
      seed.key,
      await workbench.seedRequest({
        name: seed.name,
        method: seed.method,
        url: API_ECHO_URL,
        auth: seed.auth,
        body: seed.body,
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

test.describe('Copy as — sidebar row menu', () => {
  test('plain GET → cURL is the bare command', async () => {
    await workbench.copyAsFromSidebar(uids.get('plain')!, 'cURL');
    await expectClipboard(`curl '${API_ECHO_URL}'`);
  });

  test('plain GET → fetch has no init object', async () => {
    await workbench.copyAsFromSidebar(uids.get('plain')!, 'fetch');
    await expectClipboard(`fetch("${API_ECHO_URL}")`);
  });

  test('api-key (query) auth folds into the copied URL', async () => {
    await workbench.copyAsFromSidebar(uids.get('apikey-query')!, 'cURL');
    await expectClipboard(`curl '${API_ECHO_URL}?api_key=oh-apikey-query-sample'`);
  });

  test('form POST → fetch serializes urlencoded with an explicit Content-Type', async () => {
    await workbench.copyAsFromSidebar(uids.get('form-post')!, 'fetch');
    await expectClipboard(
      `fetch("${API_ECHO_URL}", {\n` +
        '  "method": "POST",\n' +
        '  "headers": {\n' +
        '    "Content-Type": "application/x-www-form-urlencoded"\n' +
        '  },\n' +
        '  "body": "a=1&b+c=2%263"\n' +
        '})',
    );
  });
});

test.describe('Copy as — editor header ⋯ menu', () => {
  test('bearer + JSON POST → cURL carries auth, Content-Type, and body', async () => {
    await workbench.openRequest(uids.get('bearer-json')!);
    await workbench.copyAsFromEditor('cURL');
    await expectClipboard(
      `curl '${API_ECHO_URL}' \\\n` +
        "  -X 'POST' \\\n" +
        "  -H 'Authorization: Bearer oh-bearer-sample-token' \\\n" +
        "  -H 'Content-Type: application/json' \\\n" +
        `  --data-raw '{"hello":"world","n":42}'`,
    );
  });

  test('bearer + JSON POST → fetch mirrors the same wire shape', async () => {
    await workbench.openRequest(uids.get('bearer-json')!);
    await workbench.copyAsFromEditor('fetch');
    await expectClipboard(
      `fetch("${API_ECHO_URL}", {\n` +
        '  "method": "POST",\n' +
        '  "headers": {\n' +
        '    "Authorization": "Bearer oh-bearer-sample-token",\n' +
        '    "Content-Type": "application/json"\n' +
        '  },\n' +
        '  "body": "{\\"hello\\":\\"world\\",\\"n\\":42}"\n' +
        '})',
    );
  });

  test('form POST → cURL emits --data-urlencode per enabled row only', async () => {
    await workbench.openRequest(uids.get('form-post')!);
    await workbench.copyAsFromEditor('cURL');
    await expectClipboard(
      `curl '${API_ECHO_URL}' \\\n` +
        "  -X 'POST' \\\n" +
        "  --data-urlencode 'a=1' \\\n" +
        "  --data-urlencode 'b c=2&3'",
    );
  });

  test('editor copy reflects unsaved draft edits', async () => {
    await workbench.openRequest(uids.get('plain')!);
    // Append a query pair to the URL bar WITHOUT saving — the copied
    // command must carry the live draft, not the persisted entity. The
    // URL bar is the editor header's one TemplateInput (a contenteditable
    // combobox with no accessible name), so scope by the header class.
    const input = page.locator('.rules-editor-header .oh-template-input-editable').filter({ visible: true }).first();
    // A click lands the caret at the pointer position and `End` does not
    // reliably reach the template-input's caret handling — select-all and
    // retype the full draft value instead.
    await input.click();
    await input.press('ControlOrMeta+a');
    await input.pressSequentially(`${API_ECHO_URL}?draft=1`);
    await workbench.copyAsFromEditor('cURL');
    await expectClipboard(`curl '${API_ECHO_URL}?draft=1'`);
  });
});
