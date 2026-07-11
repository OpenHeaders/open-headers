/**
 * Panel viewer JWT affordance e2e — the detected-JWT plane on the
 * panel's Monaco viewers, both modes:
 *
 *   1. READ-ONLY surface (Payload tab's raw request body): the token
 *      gets the underline decoration, cmd/ctrl+click opens the JWT
 *      modal as a VIEWER — decoded payload visible, Close-only footer,
 *      no Save, no re-sign secret.
 *   2. EDITABLE surface (a localStorage entry opened as a document):
 *      the same activation opens the full JWT EDITOR — payload edit +
 *      HMAC re-sign write back into the document buffer, the document
 *      dirties, and its own Save commits the re-signed token to the
 *      browser's localStorage, byte-equal to an independent
 *      node:crypto HMAC.
 *
 * Panel recipe: `panel.html?ohInspectTabId=N` + the CDP tab pin — a
 * real DevTools window is unreachable from Playwright.
 */

import { createHmac } from 'node:crypto';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const ECHO_PATH = '/api/echo';
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let playgroundPage: Page;
let panelPage: Page;

const b64url = (text: string) => Buffer.from(text).toString('base64url');

/** Compact-JSON JWT — the same serialization `encodeJWT` uses. */
function makeJWT(header: object, payload: object, secret: string): string {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

const JWT_HEADER_OBJ = { alg: 'HS256', typ: 'JWT' };
const BODY_JWT = makeJWT(JWT_HEADER_OBJ, { sub: 'payload-view@openheaders.io', iss: 'openheaders.io' }, 'body-seed');

const STORAGE_KEY = 'oh-e2e-jwt';
const STORED_JWT = makeJWT(JWT_HEADER_OBJ, { sub: 'stored@openheaders.io', iss: 'openheaders.io' }, 'legacy-secret');
const EDITED_PAYLOAD_OBJ = { sub: 'rotated@openheaders.io', iss: 'openheaders.io' };
const RESIGN_SECRET = 'oh-e2e-viewer-secret';
const STORED_RESIGNED = makeJWT(JWT_HEADER_OBJ, EDITED_PAYLOAD_OBJ, RESIGN_SECRET);

/** POST /api/echo with a JSON body carrying the token — the Payload
 *  tab's raw-body Monaco is the read-only surface under test. */
function echoPost(): Promise<unknown> {
  return playgroundPage.evaluate(
    ({ path, token }: { path: string; token: string }) =>
      fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      }).then((r) => r.json() as Promise<unknown>),
    { path: ECHO_PATH, token: BODY_JWT },
  );
}

/** The visible JWT modal (viewer or editor). */
function jwtModal(): Locator {
  return panelPage.getByRole('dialog').filter({ hasText: 'Encoded preview' }).filter({ visible: true }).first();
}

/** The active storage/entry document body. */
function docRoot(): Locator {
  return panelPage.locator('.dt-storagedoc').filter({ visible: true }).first();
}

/** Cmd/ctrl+click a decorated token to activate it. Wrapped tokens
 *  split the decoration into several spans and the first span's CENTER
 *  can land past the token's last character on that row — click just
 *  inside the left edge, always over real token text. */
async function activateToken(token: Locator): Promise<void> {
  await token.click({ position: { x: 10, y: 5 }, modifiers: [MOD] });
}

/** Single-line bulk replace inside one of the modal's Monaco panes. */
async function fillModalMonaco(index: number, text: string): Promise<void> {
  await jwtModal().locator('.monaco-editor').nth(index).click();
  await panelPage.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await panelPage.keyboard.press('Backspace');
  await panelPage.keyboard.insertText(text);
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  workbenchPage = await context.newPage();
  workbench = await WorkbenchPage.open(workbenchPage, extensionId);

  playgroundPage = await context.newPage();
  await playgroundPage.goto(PLAYGROUND_URL);
  await playgroundPage.evaluate(
    ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: STORED_JWT },
  );

  const tabId = await workbench.tabIdForUrl(PLAYGROUND_URL);
  const pin = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned: true });
  expect(pin.success).toBe(true);

  panelPage = await context.newPage();
  // A crashed panel fails every locator with a bare not-found — surface
  // the page error itself (this caught the ellipsis-measure loop).
  panelPage.on('pageerror', (err) => console.error('[panel pageerror]', err.stack ?? err.message));
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${tabId}`);
  await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

  // Attach is async — keep re-firing until a captured row shows up.
  await expect(async () => {
    await echoPost();
    await expect(panelPage.locator('.dt-row').filter({ hasText: 'echo' }).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
});

test.afterAll(async () => {
  await context.close();
});

test.describe('Payload tab — read-only JWT viewer', () => {
  test('the request-body token underlines, and modified-click opens the viewer modal', async () => {
    await panelPage.locator('.dt-row').filter({ hasText: 'echo' }).last().click();
    await panelPage.getByRole('tab', { name: 'Payload' }).click();

    // Decorations refresh debounced after Prettier rewrites the buffer.
    const token = panelPage.locator('.dt-payload-view .oh-jwt-token-link').first();
    await expect(token).toBeVisible({ timeout: 15_000 });

    await activateToken(token);
    const modal = jwtModal();
    await expect(modal).toBeVisible();

    // Viewer, not editor: decoded payload readable, no write path.
    await expect(modal.locator('.monaco-editor').nth(1)).toContainText('payload-view@openheaders.io');
    await expect(modal.getByRole('button', { name: /Save/ })).toHaveCount(0);
    await expect(modal.getByPlaceholder('Signing secret')).toHaveCount(0);
    const close = modal.getByText('Close', { exact: true });
    await expect(close).toBeVisible();
    await close.click();
    await expect(modal).toBeHidden();
  });
});

test.describe('localStorage entry document — editable JWT with write-back', () => {
  test('the stored token opens the full editor; re-sign writes back into the buffer', async () => {
    test.setTimeout(90_000);
    const storageTab = panelPage.locator('[data-tool-window="storage"]').first();
    if ((await storageTab.getAttribute('aria-selected')) !== 'true') {
      await storageTab.click();
    }
    await panelPage.getByRole('navigation', { name: 'Storage type' }).getByText('Local storage').click();

    const row = panelPage.locator('.dt-storage-row').filter({ hasText: STORAGE_KEY }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();

    await expect(docRoot().locator('.dt-storagedoc-crumb')).toContainText(STORAGE_KEY);
    const token = docRoot().locator('.oh-jwt-token-link').first();
    await expect(token).toBeVisible({ timeout: 15_000 });

    await activateToken(token);
    const modal = jwtModal();
    await expect(modal).toBeVisible();
    // Full editor on the editable buffer: Save + re-sign present.
    await expect(modal.getByRole('button', { name: /Save/ })).toBeVisible();

    await fillModalMonaco(1, JSON.stringify(EDITED_PAYLOAD_OBJ));
    await modal.getByPlaceholder('Signing secret').fill(RESIGN_SECRET);
    // Derived status — claimed only once the async sign landed.
    await expect(modal.getByText('Token re-signed with HS256')).toBeVisible();
    await modal.getByRole('button', { name: /Save/ }).click();
    await expect(modal).toBeHidden();

    // The write-back landed: the document is dirty (word wrap splits
    // the token across rendered lines, so the buffer itself is pinned
    // by the byte-equal localStorage readback after Save).
    await expect(docRoot().locator('.dt-storagedoc-save')).toBeEnabled({ timeout: 10_000 });
  });

  test('the dirty document Save commits the re-signed token to localStorage', async () => {
    const save = docRoot().locator('.dt-storagedoc-save');
    await expect(save).toBeEnabled();
    await save.click();

    // Byte-equal to the independent node:crypto HMAC.
    await expect
      .poll(
        () => playgroundPage.evaluate((key: string) => localStorage.getItem(key), STORAGE_KEY),
        { timeout: 15_000 },
      )
      .toBe(STORED_RESIGNED);
    await expect(save).toBeDisabled();
  });
});
