/**
 * JS contexts console e2e (JS_CONTEXTS_PLAN.md Phase E) — the context
 * selector, per-context console attribution, the REPL, and the
 * "Selected context only" filter, exercised over the playground contexts
 * page, which hosts every context shape at once: top frame, same-origin
 * iframe, cross-origin iframe (localhost vs 127.0.0.1), a named dedicated
 * worker, and the playground service worker.
 *
 * Panel recipe: `panel.html?ohInspectTabId=N` + the CDP tab pin — a real
 * DevTools window is unreachable from Playwright. Popover trap: the
 * selector menu stays open on inside clicks and the trigger TOGGLES, so
 * every pick is one open → one row click → Escape.
 *
 * Label assertions stay at the level the spine guarantees (`top` first at
 * depth 0, SW row top-level, cross-origin host visible); exact iframe /
 * worker label text is pinned by the manual side-by-side parity pass, not
 * here.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';
import { CONTEXTS_PAGE_URL } from './pages/contexts-page';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let contextsPage: Page;
let panelPage: Page;
let tabId: number;

/** The context-selector trigger in the Console header. */
function selectorTrigger(): Locator {
  return panelPage.locator('.dt-console-context .dt-toolbar-dropdown');
}

/** The rows of the OPEN selector menu. */
function selectorRows(): Locator {
  return panelPage.locator('.dt-console-context-item').filter({ visible: true });
}

/** Open the selector menu, toggle-safe: a click while a stale menu is open
 *  CLOSES it (the trigger toggles), so retry until rows are visible. */
async function openSelectorMenu(): Promise<void> {
  await expect(async () => {
    await selectorTrigger().click();
    await expect(selectorRows().first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

/** Close via Escape, falling back to the trigger toggle. */
async function closeSelectorMenu(): Promise<void> {
  const first = selectorRows().first();
  await panelPage.keyboard.press('Escape');
  try {
    await expect(first).toBeHidden({ timeout: 1_000 });
  } catch {
    await selectorTrigger().click();
    await expect(first).toBeHidden({ timeout: 5_000 });
  }
}

/** One open → one row click → close (the menu stays open on inside clicks). */
async function pickContext(rowText: string | RegExp): Promise<void> {
  await openSelectorMenu();
  const row = selectorRows().filter({ hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await closeSelectorMenu();
}

/** Console rows whose message carries the given text. */
function rowsWithText(text: string): Locator {
  return panelPage.locator('.dt-console-row').filter({ has: panelPage.locator('.dt-console-msg', { hasText: text }) });
}

/** Submit an expression through the REPL prompt. */
async function evaluate(expression: string): Promise<void> {
  const input = panelPage.locator('.dt-console-prompt-input');
  await expect(input).toBeEnabled({ timeout: 10_000 });
  await input.fill(expression);
  await input.press('Enter');
}

let tagSeq = 0;

function nextTag(): string {
  tagSeq++;
  return `e2e-ctx-${Date.now().toString(36)}-${tagSeq}`;
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      // Suppress the debugging infobar so attach commits without layout shifts.
      '--silent-debugger-extension-api',
    ],
  });
  sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  workbenchPage = await context.newPage();
  workbench = await WorkbenchPage.open(workbenchPage, extensionId);

  contextsPage = await context.newPage();
  await contextsPage.goto(CONTEXTS_PAGE_URL);
  const status = await contextsPage.evaluate(() => window.ohContexts.setup());
  expect(status.sameFrame).toBe(true);
  expect(status.crossFrame).toBe(true);
  expect(status.worker).toBe(true);
  expect(status.swState).toBe('activated');

  tabId = await workbench.tabIdForUrl(CONTEXTS_PAGE_URL);
  const pin = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned: true });
  expect(pin.success).toBe(true);

  panelPage = await context.newPage();
  panelPage.on('pageerror', (err) => console.error('[panel pageerror]', err.stack ?? err.message));
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${tabId}`);
  await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

  const consoleTab = panelPage.locator('[data-tool-window="console"]').first();
  if ((await consoleTab.getAttribute('aria-selected')) !== 'true') {
    await consoleTab.click();
  }

  // The registry fills async after attach; the selector renders only once
  // contexts exist. The SW target rides a discovery epoch on tab attach.
  await expect(selectorTrigger()).toBeVisible({ timeout: 20_000 });
});

test.afterAll(async () => {
  await context.close();
});

test('selector lists every context shape: top first at depth 0, cross-origin frame, top-level SW', async () => {
  // Fresh attach auto-selects `top` — no warning tint.
  await expect(selectorTrigger()).toContainText('top');
  await expect(panelPage.locator('.dt-console-context--warn')).toHaveCount(0);

  // The SW context arrives via the discovery poll — re-open until listed,
  // then keep THIS menu open for the shape assertions (no close/reopen seam).
  await expect(async () => {
    await openSelectorMenu();
    await expect(selectorRows().filter({ hasText: 'oh-sw.js' }).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const rows = selectorRows();

  // Top frame + two iframes + worker + SW at minimum (the rig may add
  // extension isolated worlds on top).
  expect(await rows.count()).toBeGreaterThanOrEqual(5);

  // `top` is pinned first at depth 0 and checked (it is the selection).
  const first = rows.first();
  await expect(first).toContainText('top');
  await expect(first).toHaveAttribute('data-depth', '0');
  await expect(first.locator('.dt-sortmode-item-check')).toBeVisible();

  // The cross-origin frame surfaces its sibling host.
  await expect(rows.filter({ hasText: 'localhost:3000' }).first()).toBeVisible();

  // The service worker is special-cased top-level (depth 0).
  const swRow = rows.filter({ hasText: 'oh-sw.js' }).first();
  await expect(swRow).toHaveAttribute('data-depth', '0');

  // Frame contexts indent below top.
  const frameRow = rows.filter({ hasText: 'localhost:3000' }).first();
  await expect(frameRow).toHaveAttribute('data-depth', '1');

  // The dedicated worker is one target hop from top — its auxData-less
  // context is its MAIN world, not an isolated-world hop.
  const workerRow = rows.filter({ hasText: 'oh-context-worker' }).first();
  await expect(workerRow).toHaveAttribute('data-depth', '1');

  // Frame contexts title by the frame URL's last path segment — the
  // browser's frame label — with the host as subtitle (both playground
  // frames load `frame.html`, on the two sibling origins).
  const titles = await rows.locator('.dt-sortmode-item-title').allTextContents();
  expect(titles.filter((t) => t === 'frame.html')).toHaveLength(2);

  // Browser display order: page group, then iframe sessions, then service
  // workers, then dedicated workers.
  const rowTexts = await rows.allTextContents();
  const frameAt = rowTexts.findIndex((t) => t.includes('localhost:3000'));
  const swAt = rowTexts.findIndex((t) => t.includes('oh-sw.js'));
  const workerAt = rowTexts.findIndex((t) => t.includes('oh-context-worker'));
  expect(frameAt).toBeLessThan(swAt);
  expect(swAt).toBeLessThan(workerAt);

  // Extension worlds subtitle as the literal "Extension", not the URL.
  const extensionWorld = rows.filter({ hasText: 'Open Headers' }).first();
  await expect(extensionWorld.locator('.dt-sortmode-item-subtitle')).toHaveText('Extension');

  await closeSelectorMenu();
});

test('console attribution: one identifiable row per context after logAll', async () => {
  const tag = nextTag();
  const prefixes = await contextsPage.evaluate((t) => window.ohContexts.logAll(t), tag);
  expect(prefixes).toHaveLength(5);

  await expect(rowsWithText(tag)).toHaveCount(5, { timeout: 15_000 });
  for (const prefix of [
    '[top 127.0.0.1:3000]',
    '[frame 127.0.0.1:3000]',
    '[frame localhost:3000]',
    '[worker oh-context-worker]',
    '[oh-sw v1]',
  ]) {
    await expect(rowsWithText(tag).filter({ hasText: prefix })).toHaveCount(1);
  }
});

test('REPL evaluates in the selected context: top, cross-origin frame, service worker', async () => {
  // top — the page document answers.
  await evaluate('document.title');
  const topEcho = rowsWithText('document.title').last();
  await expect(topEcho).toHaveAttribute('data-source', 'command');
  await expect(rowsWithText('JS contexts · Open Headers Playground').last()).toHaveAttribute('data-source', 'result', {
    timeout: 10_000,
  });

  // Cross-origin frame — a different document, and the non-top warning tint.
  await pickContext('localhost:3000');
  await expect(panelPage.locator('.dt-console-context--warn')).toHaveCount(1);
  await evaluate('document.title');
  await expect(rowsWithText('OH context frame · localhost:3000').last()).toHaveAttribute('data-source', 'result', {
    timeout: 10_000,
  });

  // Service worker — no document, its own registration scope.
  await pickContext('oh-sw.js');
  await evaluate('[typeof document, self.registration.scope]');
  const swResult = rowsWithText('/src/contexts/').last();
  await expect(swResult).toHaveAttribute('data-source', 'result', { timeout: 10_000 });
  await expect(swResult).toContainText('undefined');

  // Errors render as error-level results, never silently.
  await evaluate('ohNoSuchGlobal.probe');
  await expect(rowsWithText('ReferenceError').last()).toHaveAttribute('data-level', 'error', { timeout: 10_000 });

  // Back to top clears the warning tint. (Row text concatenates title +
  // subtitle, so anchor on the title prefix rather than exact-matching.)
  await pickContext(/^top/);
  await expect(panelPage.locator('.dt-console-context--warn')).toHaveCount(0);
});

test('"Selected context only" hides other contexts\' rows and restores on toggle-off', async () => {
  const tag = nextTag();
  await contextsPage.evaluate((t) => window.ohContexts.logAll(t), tag);
  await expect(rowsWithText(tag)).toHaveCount(5, { timeout: 15_000 });

  // The toggle lives in the Console settings pane behind the gear; the pane
  // stays open across toggles, so open it once and click the checkbox.
  await panelPage.getByRole('button', { name: 'Console settings' }).click();
  const toggle = async (): Promise<void> => {
    await panelPage.getByRole('checkbox', { name: 'Selected context only' }).click();
  };

  // top selected → only the top-context row with this tag survives.
  await toggle();
  await expect(rowsWithText(tag)).toHaveCount(1);
  await expect(rowsWithText(tag).first()).toContainText('[top 127.0.0.1:3000]');

  await toggle();
  await expect(rowsWithText(tag)).toHaveCount(5);
});

test('history ring: ArrowUp recalls, ArrowDown returns to the draft', async () => {
  const input = panelPage.locator('.dt-console-prompt-input');
  await expect(input).toBeEnabled();
  await evaluate('1 + 1');
  await input.fill('draft-in-progress');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('1 + 1');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('draft-in-progress');
  await input.fill('');
});

/** Open the gear's settings pane if a prior test left it closed. */
async function openSettingsPane(): Promise<void> {
  const pane = panelPage.getByRole('group', { name: 'Console settings' });
  if (!(await pane.isVisible().catch(() => false))) {
    await panelPage.getByRole('button', { name: 'Console settings' }).click();
    await expect(pane).toBeVisible();
  }
}

test('settings pane lists all nine settings in the browser order', async () => {
  await openSettingsPane();
  const labels = await panelPage
    .getByRole('group', { name: 'Console settings' })
    .locator('.dt-console-setting')
    .allTextContents();
  expect(labels.map((t) => t.trim())).toEqual([
    'Hide network',
    'Log XMLHttpRequests',
    'Preserve log',
    'Eager evaluation',
    'Selected context only',
    'Autocomplete from history',
    'Group similar messages in console',
    'Treat code evaluation as user action',
    'Show CORS errors in console',
  ]);
});

test('"Log XMLHttpRequests" synthesizes finished-loading rows for page fetches, gated live', async () => {
  await openSettingsPane();
  const checkbox = panelPage.getByRole('checkbox', { name: 'Log XMLHttpRequests' });
  await checkbox.click();

  // A page fetch of this page's own document — an XHR-category request.
  await contextsPage.evaluate(() => fetch('/src/contexts/index.html?oh-xhr-log').then((r) => r.text()));
  const xhrRow = rowsWithText('Fetch finished loading: GET').filter({ hasText: 'oh-xhr-log' });
  await expect(xhrRow.first()).toBeVisible({ timeout: 15_000 });
  // The URL is a live link into the Network plane.
  await expect(xhrRow.first().locator('.dt-console-req-link')).toBeVisible();

  // The gate is render-time: toggling off hides the synthesized rows again.
  await checkbox.click();
  await expect(xhrRow).toHaveCount(0);
});

test('eager evaluation previews the prompt text and obeys its setting', async () => {
  const input = panelPage.locator('.dt-console-prompt-input');
  await expect(input).toBeEnabled();
  await input.fill('40 + 2');
  await expect(panelPage.locator('.dt-console-prompt-preview-text')).toHaveText('42', { timeout: 10_000 });

  await openSettingsPane();
  await panelPage.getByRole('checkbox', { name: 'Eager evaluation' }).click();
  await expect(panelPage.locator('.dt-console-prompt-preview')).toHaveCount(0);
  await panelPage.getByRole('checkbox', { name: 'Eager evaluation' }).click();
  await input.fill('');
});

test('autocomplete from history ghosts the matching command and Tab accepts it', async () => {
  const input = panelPage.locator('.dt-console-prompt-input');
  await evaluate('globalThis.location.origin');
  await input.fill('globalThis.loc');
  const ghost = panelPage.locator('.dt-console-prompt-ghost');
  await expect(ghost).toHaveText('globalThis.location.origin');
  await input.press('Tab');
  await expect(input).toHaveValue('globalThis.location.origin');
  await expect(ghost).toHaveCount(0);

  // The setting suspends the ghost.
  await openSettingsPane();
  await panelPage.getByRole('checkbox', { name: 'Autocomplete from history' }).click();
  await input.fill('globalThis.loc');
  await expect(ghost).toHaveCount(0);
  await panelPage.getByRole('checkbox', { name: 'Autocomplete from history' }).click();
  await input.fill('');
});
