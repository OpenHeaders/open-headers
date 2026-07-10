/**
 * Request-body decoder UI e2e — the in-buffer value-detection plane of
 * the raw body editor (`valueDetection` on the Body tab's CodeEditor).
 *
 * In-body scanning is JWT-only BY DESIGN: base64/url-encoded/other
 * registry types never get a buffer affordance (they'd be noise on
 * every encoded blob), so this spec pins both halves — a JWT typed
 * into the body gets the underline decoration and nothing else does.
 *
 * The edit loop it drives end-to-end: cmd/ctrl+click the decorated
 * token → JWT Editor modal opens with the decoded claims → Cancel
 * leaves the buffer untouched → an edited payload re-encodes with the
 * ORIGINAL signature carried over and writes back into the buffer in
 * place → Send → the `/api/echo` reflection proves the edited token
 * rode the wire.
 *
 * The buffer is one long line and Monaco may split it — decoration
 * spans chunk on tokenization/wrap boundaries and `.view-lines` text
 * gains newlines when soft wrap is on — so decorated text is
 * reassembled by joining spans and buffer text is compared with
 * newlines stripped. Both hold under either `editor.wordWrap` setting.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let requestUid: string;

const MODIFIER: 'Meta' | 'Control' = process.platform === 'darwin' ? 'Meta' : 'Control';

// Token built the same way the modal's encoder re-assembles one
// (compact JSON → base64url, no padding), so the header segment is
// byte-stable across a decode-edit-reencode round trip.
const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const JWT_PAYLOAD = { sub: 'user@openheaders.io', exp: 4000000000 };
const SIGNATURE = 'original-sig-bytes';
const TOKEN = `${b64url(JWT_HEADER)}.${b64url(JWT_PAYLOAD)}.${SIGNATURE}`;

const EDITED_PAYLOAD = { sub: 'admin@openheaders.io', role: 'admin' };
const EDITED_TOKEN = `${b64url(JWT_HEADER)}.${b64url(EDITED_PAYLOAD)}.${SIGNATURE}`;

// Negative material: a non-JWT dotted run and a clean base64 blob —
// both detectable elsewhere (grids / panel), neither may decorate here.
const BODY = `{"auth":"${TOKEN}","plain":"window.location.href","blob":"${Buffer.from(
  'hello world hello world',
).toString('base64')}"}`;

/** The raw body editor — first visible Monaco (the modal's editors
 *  render later in a portal, so `.first()` stays the body). */
function bodyEditor(): Locator {
  return page.locator('.monaco-editor').filter({ visible: true }).first();
}

/** JWT underline decorations inside the body editor. */
function jwtLinks(): Locator {
  return bodyEditor().locator('.oh-jwt-token-link');
}

/** The body buffer's text with Monaco's soft-wrap newlines stripped —
 *  the buffer itself is a single line. */
async function bodyText(): Promise<string> {
  return (await workbench.monacoText(0)).replace(/\n/g, '');
}

function jwtModal(): Locator {
  return page.getByRole('dialog').filter({ hasText: 'JWT Editor' });
}

/** Cmd/ctrl+click the decorated token to open the JWT editor.
 *
 * The buffer is one long unwrapped line, so after a fill the view sits
 * scrolled to the line's end and the first decoration span's CENTER
 * (Playwright's default click point) can land under the workbench's
 * right dock strip, which intercepts the click. Scroll back to the
 * buffer start first (cursor-to-start keybinding), then click just
 * inside the span's left edge — always over real token text.
 */
async function openJwtEditor(): Promise<void> {
  await bodyEditor().click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home');
  await jwtLinks()
    .first()
    .click({ position: { x: 10, y: 5 }, modifiers: [MODIFIER] });
  await expect(jwtModal()).toBeVisible();
}

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
  requestUid = await workbench.seedRequest({
    name: 'body-decoders-jwt',
    method: 'POST',
    url: API_ECHO_URL,
    auth: { type: 'none' },
    body: { type: 'none' },
  });
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();

  await workbench.openRequest(requestUid);
  await workbench.openEditorTab(/Body/);
  await workbench.selectBodyRadio('raw');
  await workbench.selectRawFormat('JSON');
  await workbench.fillMonaco(0, BODY);
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  body: { kind: string; contentType: string | null; parsed?: unknown };
}

test.describe('Request body — in-buffer JWT decoder', () => {
  test('the JWT gets the edit decoration; dotted text and base64 do not', async () => {
    // Decorations refresh on a 300ms debounce after the fill.
    await expect(jwtLinks().first()).toBeVisible();
    // Reassembled decorated text is exactly the token — proving the
    // decoration covers the whole JWT and NOTHING else in the buffer
    // (the `window.location.href` run and the base64 blob stay bare).
    await expect(async () => {
      expect((await jwtLinks().allInnerTexts()).join('')).toBe(TOKEN);
    }).toPass();
  });

  test('cmd/ctrl+click opens the JWT editor; Cancel leaves the buffer untouched', async () => {
    await openJwtEditor();
    const modal = jwtModal();

    // Decoded view: payload pane (header pane is the modal's first
    // Monaco) carries the token's claims, expiry reads as valid, and
    // Save is disabled while nothing is dirty.
    expect(await workbench.monacoTextWithin(modal, 1)).toContain('"sub": "user@openheaders.io"');
    await expect(modal.getByText('Token not expired')).toBeVisible();
    await expect(modal.getByRole('button', { name: /Save$/ })).toBeDisabled();

    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toBeHidden();
    expect(await bodyText()).toBe(BODY);
  });

  test('an edited payload re-encodes over the original signature and writes back in place', async () => {
    await openJwtEditor();
    const modal = jwtModal();

    await workbench.fillMonacoWithin(modal, 1, JSON.stringify(EDITED_PAYLOAD));
    const save = modal.getByRole('button', { name: /Save$/ });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(modal).toBeHidden();

    // Only the token changed — same position, same signature segment,
    // surrounding JSON untouched.
    expect(await bodyText()).toBe(BODY.replace(TOKEN, EDITED_TOKEN));
  });

  test('the edited token rides the wire', async () => {
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.body.kind).toBe('json');
    expect(echo.body.contentType).toContain('application/json');
    expect(echo.body.parsed).toEqual({
      auth: EDITED_TOKEN,
      plain: 'window.location.href',
      blob: Buffer.from('hello world hello world').toString('base64'),
    });
  });
});
