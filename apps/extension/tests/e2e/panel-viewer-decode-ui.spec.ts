/**
 * Panel viewer whole-buffer decode affordance e2e — the corner "Decode"
 * chip on buffers whose ENTIRE content is one detected encoded value,
 * both modes, plus the headers-tab row view icon:
 *
 *   1. READ-ONLY surface (Payload tab's raw request body, wholly
 *      base64): the chip is always visible; clicking it opens the
 *      encoded-value modal as a VIEWER — decoded text readable,
 *      Close-only footer, no Save.
 *   2. EDITABLE surface (a wholly-base64 localStorage entry opened as a
 *      document): the chip opens the full editor — editing the decoded
 *      text re-encodes through the compact codec on Save, the document
 *      dirties, and its own Save commits the re-encoded value to the
 *      browser's localStorage, byte-equal to an independent Buffer
 *      encode.
 *   3. HEADERS TAB row (a request header carrying a base64 value): the
 *      hover-revealed view icon opens the same modal read-only; Close
 *      leaves everything untouched.
 *   4. JAR COOKIE row (Storage tool window's Cookies section, a cookie
 *      carrying a base64 value): hint glyph inline, hover view icon
 *      opens the same modal read-only.
 *
 * Panel recipe: `panel.html?ohInspectTabId=N` + the CDP tab pin — a
 * real DevTools window is unreachable from Playwright.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const ECHO_PATH = '/api/echo';

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let playgroundPage: Page;
let panelPage: Page;

const b64 = (text: string) => Buffer.from(text).toString('base64');

const BODY_DECODED = 'payload-view@openheaders.io wants the decoded text readable';
const BODY_B64 = b64(BODY_DECODED);

const STORAGE_KEY = 'oh-e2e-b64';
const STORED_DECODED = 'user@openheaders.io:hunter2!!';
const STORED_B64 = b64(STORED_DECODED);
const EDITED_DECODED = 'user@openheaders.io:rotated';
const EDITED_B64 = b64(EDITED_DECODED);

const HEADER_NAME = 'x-oh-token';
const HEADER_DECODED = 'header-view@openheaders.io wants the row icon';
const HEADER_B64 = b64(HEADER_DECODED);

const JAR_COOKIE_NAME = 'oh_e2e_jar_b64';
// Length divisible by 3 — padding-free base64, safe as a cookie value.
const JAR_COOKIE_DECODED = 'jar-view@openheaders.io wants!';
const JAR_COOKIE_B64 = b64(JAR_COOKIE_DECODED);

/** POST /api/echo with a raw base64 body under a JSON content type —
 *  the Payload tab's raw-body viewer is the read-only surface under
 *  test, and its whole buffer is the one detected value. */
function echoPost(): Promise<unknown> {
  return playgroundPage.evaluate(
    ({ path, body, headerName, headerValue }: { path: string; body: string; headerName: string; headerValue: string }) =>
      fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [headerName]: headerValue },
        body,
      }).then((r) => r.text()),
    { path: ECHO_PATH, body: BODY_B64, headerName: HEADER_NAME, headerValue: HEADER_B64 },
  );
}

/** The visible encoded-value modal (viewer or editor). */
function decodeModal(): Locator {
  return panelPage.getByRole('dialog').filter({ hasText: 'Encoded preview' }).filter({ visible: true }).first();
}

/** The active storage/entry document body. */
function docRoot(): Locator {
  return panelPage.locator('.dt-storagedoc').filter({ visible: true }).first();
}

/** Single-line bulk replace inside the modal's decoded Monaco pane. */
async function fillModalMonaco(text: string): Promise<void> {
  await decodeModal().locator('.monaco-editor').first().click();
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
  await playgroundPage.evaluate(({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: STORED_B64,
  });

  const tabId = await workbench.tabIdForUrl(PLAYGROUND_URL);
  const pin = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned: true });
  expect(pin.success).toBe(true);

  panelPage = await context.newPage();
  // A crashed panel fails every locator with a bare not-found — surface
  // the page error itself.
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

test.describe('Payload tab — read-only whole-buffer decode viewer', () => {
  test('the base64 body shows the Decode chip, and clicking opens the viewer modal', async () => {
    await panelPage.locator('.dt-row').filter({ hasText: 'echo' }).last().click();
    await panelPage.getByRole('tab', { name: 'Payload' }).click();

    const chip = panelPage.locator('.dt-payload-view .dt-codeviewer-decode').first();
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveAttribute('title', /Base64 value/);

    await chip.click();
    const modal = decodeModal();
    await expect(modal).toBeVisible();

    // Viewer, not editor: decoded text readable, no write path.
    await expect(modal.locator('.monaco-editor').first()).toContainText('payload-view@openheaders.io');
    await expect(modal.getByRole('button', { name: /Save/ })).toHaveCount(0);
    const close = modal.getByText('Close', { exact: true });
    await expect(close).toBeVisible();
    await close.click();
    await expect(modal).toBeHidden();
  });
});

test.describe('Headers tab — row view icon opens the read-only modal', () => {
  test('a base64 request header gets the hover view icon; the modal decodes read-only and Close is inert', async () => {
    await panelPage.locator('.dt-row').filter({ hasText: 'echo' }).last().click();
    await panelPage.getByRole('tab', { name: 'Headers' }).click();

    const row = panelPage
      .locator('.dt-kv-row')
      .filter({ hasText: new RegExp(HEADER_NAME, 'i') })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // The action lane is hover-revealed (rail law) — hover first, then
    // the per-type tooltip is the aria contract.
    await row.hover();
    const icon = row.getByRole('button', { name: 'View decoded — Base64 value' });
    await expect(icon).toBeVisible();
    await icon.click();

    const modal = decodeModal();
    await expect(modal).toBeVisible();
    // Viewer: decoded text readable, encoded preview round-trips the
    // exact header value, no write path.
    await expect(modal.locator('.monaco-editor').first()).toContainText('header-view@openheaders.io');
    await expect(modal.getByText(HEADER_B64, { exact: true })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Save/ })).toHaveCount(0);
    const close = modal.getByText('Close', { exact: true });
    await close.click();
    await expect(modal).toBeHidden();

    // Close left the row untouched — the raw value still renders.
    await expect(row).toContainText(HEADER_B64);
  });
});

test.describe('Jar cookie row — hint glyph and read-only view icon', () => {
  test('a base64 cookie in the Cookies section carries the glyph and the hover view icon', async () => {
    await playgroundPage.evaluate(
      ({ name, value }: { name: string; value: string }) => {
        document.cookie = `${name}=${value}; path=/`;
      },
      { name: JAR_COOKIE_NAME, value: JAR_COOKIE_B64 },
    );

    const storageTab = panelPage.locator('[data-tool-window="storage"]').first();
    if ((await storageTab.getAttribute('aria-selected')) !== 'true') {
      await storageTab.click();
    }
    await panelPage.getByRole('navigation', { name: 'Storage type' }).getByText('Cookies').click();

    const row = panelPage.locator('.dt-storage-row').filter({ hasText: JAR_COOKIE_NAME }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Hint glyph rides the value cell inline (parity with the cookies tab).
    await expect(row.locator('.dt-cookie-value-hint')).toHaveText('b64');

    await row.hover();
    const icon = row.getByRole('button', { name: 'View decoded — Base64 value' });
    await expect(icon).toBeVisible();
    await icon.click();

    const modal = decodeModal();
    await expect(modal).toBeVisible();
    // Viewer: decoded text readable, encoded preview round-trips the
    // exact cookie value, no write path.
    await expect(modal.locator('.monaco-editor').first()).toContainText('jar-view@openheaders.io');
    await expect(modal.getByText(JAR_COOKIE_B64, { exact: true })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Save/ })).toHaveCount(0);
    const close = modal.getByText('Close', { exact: true });
    await close.click();
    await expect(modal).toBeHidden();

    // Close left the row untouched — the raw value still renders.
    await expect(row).toContainText(JAR_COOKIE_B64);
  });
});

test.describe('localStorage entry document — editable whole-buffer decode with write-back', () => {
  test('the stored base64 value opens the full editor; Save re-encodes into the buffer', async () => {
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
    const chip = docRoot().locator('.dt-codeviewer-decode').first();
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveAttribute('title', /Base64 value/);

    await chip.click();
    const modal = decodeModal();
    await expect(modal).toBeVisible();
    // Full editor on the editable buffer: decoded text + Save present.
    await expect(modal.locator('.monaco-editor').first()).toContainText(STORED_DECODED);
    const save = modal.getByRole('button', { name: /Save/ });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();

    await fillModalMonaco(EDITED_DECODED);
    // The live preview is the exact re-encode Save writes.
    await expect(modal.getByText(EDITED_B64, { exact: true })).toBeVisible();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(modal).toBeHidden();

    // The write-back landed: the document buffer holds the re-encoded
    // value and the document is dirty.
    await expect(docRoot().locator('.monaco-editor').first()).toContainText(EDITED_B64);
    await expect(docRoot().locator('.dt-storagedoc-save')).toBeEnabled({ timeout: 10_000 });
  });

  test('the dirty document Save commits the re-encoded value to localStorage', async () => {
    const save = docRoot().locator('.dt-storagedoc-save');
    await expect(save).toBeEnabled();
    await save.click();

    // Byte-equal to the independent Buffer encode.
    await expect
      .poll(() => playgroundPage.evaluate((key: string) => localStorage.getItem(key), STORAGE_KEY), { timeout: 15_000 })
      .toBe(EDITED_B64);
    await expect(save).toBeDisabled();
  });
});
