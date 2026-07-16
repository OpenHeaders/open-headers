/**
 * SW network e2e (SW_NETWORK_PLAN.md Phase C) — the three worker-traffic
 * row families side by side, over the playground SW page and the pin +
 * `panel.html?ohInspectTabId=N` recipe (a real DevTools window is
 * unreachable from Playwright):
 *
 *   1. a synthetic SW-served fetch renders ONE page row marked
 *      "(ServiceWorker)" and no worker row (no network was hit);
 *   2. a cache-miss probe renders the page row AND the worker's real
 *      pass-through fetch as a gear-prefixed ⚙ row;
 *   3. an `oh-fetch` (the worker fetches a URL no page ever requested)
 *      renders a pure ⚙ row with status/headers and a fetchable body —
 *      the on-demand body pull rides the composite router's `target:` leg;
 *   4. unpinning stops the plane (attachment-scoped): minted rows persist
 *      as history, new worker fetches mint nothing;
 *   5. extension-self plane: a request-editor Send appears as a ⚙ row in
 *      the panel inspecting the WORKBENCH tab (webRequest plane — no pin),
 *      and the workbench's own bundle worker-script loads (Monaco) read a
 *      status-less "Finished" via the own-bundle terminal floor. The
 *      devtools-HAR enrichment of self rows (sizes / response bodies) is
 *      NOT assertable here: the relay rides `chrome.devtools.network`,
 *      which exists only in a real DevTools context — live-pass only.
 *
 * SW-target discovery is a poll + attach epochs, so the setup drives
 * warm-up worker fetches until the first ⚙ row proves the Network stream
 * converged (rows exist only from `Network.enable` forward — no replay).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';
import { SW_PAGE_URL } from './pages/sw-page';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let swPage: Page;
let panelPage: Page;
let tabId: number;

/** Traffic rows carrying the given marker text (the Name cell keeps the
 *  query string, so a unique query value pins a row family). */
function rows(marker: string): Locator {
  return panelPage.locator('.dt-row').filter({ hasText: marker });
}

/** The subset of {@link rows} carrying the worker gear glyph. */
function gearRows(marker: string): Locator {
  return rows(marker).filter({ has: panelPage.locator('.dt-col-name-gear') });
}

/** The subset of {@link rows} WITHOUT the gear — the page-side family. */
function pageRows(marker: string): Locator {
  return rows(marker).filter({ hasNot: panelPage.locator('.dt-col-name-gear') });
}

interface CdpSnapshotEntry {
  context?: { tabs?: Array<{ tabId: number }> };
}

/** Poll until the tab shows in the CDP attach roster. */
async function waitAttached(id: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await workbench.rpc<{ snapshot?: { cdp?: CdpSnapshotEntry } }>('getStatusSnapshot');
        return (res.snapshot?.cdp?.context?.tabs ?? []).some((t) => t.tabId === id);
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

async function pin(id: number, pinned: boolean): Promise<void> {
  const res = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId: id, pinned });
  expect(res.success).toBe(true);
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
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
  await workbenchPage.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // Register the playground SW and wait until it is activated AND controls
  // the page (activate runs clients.claim, so no reload is needed).
  swPage = await context.newPage();
  await swPage.goto(SW_PAGE_URL);
  await swPage.evaluate(() => window.ohSw.register(1));
  await expect
    .poll(
      async () => {
        const s = await swPage.evaluate(() => window.ohSw.status());
        return s.active === 'activated' && s.controlled;
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  tabId = await workbench.tabIdForUrl(SW_PAGE_URL);
  await pin(tabId, true);
  await waitAttached(tabId);

  panelPage = await context.newPage();
  panelPage.on('pageerror', (err) => console.error('[panel pageerror]', err.stack ?? err.message));
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${tabId}`);
  await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

  // SW-target attach convergence: the worker target rides a discovery poll,
  // and its Network stream has no replay — keep firing warm-up worker
  // fetches until the first gear row lands.
  let warm = 0;
  await expect(async () => {
    warm += 1;
    const marker = `oh-sw-warm-${warm}`;
    const res = await swPage.evaluate((m) => window.ohSw.fetchFromWorker(`/probe/text?oh-case=${m}`), marker);
    expect(res.ok).toBe(true);
    await expect(gearRows(marker).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
});

test.afterAll(async () => {
  await context.close();
});

test('a synthetic SW-served fetch renders one page row marked (ServiceWorker) and NO worker row', async () => {
  const result = await swPage.evaluate(() => window.ohSw.fetchSynthetic());
  expect(result.servedBy).toBe('oh-sw');

  // The synthetic route's Name cell reads "probe" (no query) — unique to
  // this leg (the worker-fetch probes carry query-suffixed names).
  const synthetic = rows('probe');
  await expect(synthetic.first()).toBeVisible({ timeout: 15_000 });
  await expect(synthetic.first()).toContainText('(ServiceWorker)');

  // No network was hit — the worker minted the response — so no ⚙ row may
  // exist. Give a would-be worker row a beat to land before counting.
  await panelPage.waitForTimeout(1_500);
  await expect(synthetic).toHaveCount(1);
  await expect(gearRows('probe')).toHaveCount(0);
});

test("a cache-miss probe renders the page row AND the worker's ⚙ pass-through row", async () => {
  const marker = 'oh-sw-miss-1';
  // The sw-precache query family is cache-first in the worker; a query
  // combination outside the install-time precache list misses, and the
  // fallback fetch(event.request) is the worker's own network request.
  const status = await swPage.evaluate(
    async (m) => (await fetch(`/probe/text?sw-precache=1&oh-case=${m}`)).status,
    marker,
  );
  expect(status).toBe(200);

  await expect(rows(marker)).toHaveCount(2, { timeout: 15_000 });
  await expect(gearRows(marker)).toHaveCount(1);
  await expect(pageRows(marker)).toHaveCount(1);
  // The page-side row was answered by the worker's respondWith.
  await expect(pageRows(marker).first()).toContainText('(ServiceWorker)');
});

test('an oh-fetch renders a pure ⚙ row with status, headers, and a fetchable body', async () => {
  const marker = 'oh-sw-fetch-1';
  const res = await swPage.evaluate((m) => window.ohSw.fetchFromWorker(`/probe/json?oh-case=${m}`), marker);
  expect(res.ok).toBe(true);
  expect(res.status).toBe(200);

  const row = gearRows(marker).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  // No page ever requested this URL — the worker row is the only one.
  await panelPage.waitForTimeout(1_500);
  await expect(rows(marker)).toHaveCount(1);

  // Click the NAME cell, not the row center — the row spans interactive
  // cells (the Initiator link stopPropagations and jumps to Sources), so a
  // center click can miss the row-select entirely.
  await row.locator('.dt-col-name-text').click();

  // Headers pane: the General section carries URL + status, the response
  // section the served content type.
  const headersTab = panelPage.getByRole('tab', { name: 'Headers' });
  if ((await headersTab.getAttribute('aria-selected')) !== 'true') {
    await headersTab.click();
  }
  const headersPane = panelPage.locator('.dt-headers-pane');
  await expect(headersPane).toBeVisible({ timeout: 10_000 });
  await expect(headersPane).toContainText(marker);
  await expect(headersPane).toContainText('200');
  await expect(headersPane).toContainText('application/json');

  // Response pane: the body rides the on-demand pull through the composite
  // router's `target:` leg (Network.getResponseBody on the worker target).
  await panelPage.getByRole('tab', { name: 'Response' }).click();
  await expect(panelPage.getByText('OH_PROBE_JSON_OK').first()).toBeVisible({ timeout: 15_000 });
});

test('unpinning stops the plane: history rows persist, new worker fetches mint nothing', async () => {
  await pin(tabId, false);

  // Rows already minted persist as history (the store outlives the attach).
  await expect(gearRows('oh-sw-fetch-1').first()).toBeVisible();

  // The capture is attachment-scoped: once the detach converges, a fresh
  // worker fetch (which still succeeds — the worker is untouched) mints no
  // row. Each probe uses a fresh marker so a pre-convergence row can't
  // fail a later attempt.
  let seq = 0;
  await expect(async () => {
    seq += 1;
    const marker = `oh-sw-unpinned-${seq}`;
    const res = await swPage.evaluate((m) => window.ohSw.fetchFromWorker(`/probe/text?oh-case=${m}`), marker);
    expect(res.ok).toBe(true);
    await panelPage.waitForTimeout(2_000);
    await expect(rows(marker)).toHaveCount(0);
  }).toPass({ timeout: 45_000 });
});

test("extension-self plane: a request-editor Send appears as a row in the workbench tab's panel", async () => {
  test.setTimeout(120_000);
  // The workbench resolves its OWN tab id — extension pages are outside
  // `chrome.tabs.query` url-pattern matching.
  const workbenchTabId = await workbenchPage.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        chrome.tabs.getCurrent((tab) => resolve(tab?.id ?? null));
      }),
  );
  expect(typeof workbenchTabId).toBe('number');

  // The panel inspecting the WORKBENCH tab opens BEFORE the send — the
  // epic's gap report scenario (webRequest ingestion is panel-watching
  // gated, so rows exist while a panel observes the tab). No CDP pin:
  // this is the webRequest-fed extension-self plane.
  const selfPanel = await context.newPage();
  selfPanel.on('pageerror', (err) => console.error('[self-panel pageerror]', err.stack ?? err.message));
  await selfPanel.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${workbenchTabId}`);
  await selfPanel.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

  // Same drive recipe as the request-editor UI specs: seed, reload so the
  // sidebar renders deterministically, requests view + docs collapsed,
  // open, Send.
  const marker = 'oh-self-send-1';
  const uid = await workbench.seedRequest({
    name: 'SW network self-send',
    method: 'GET',
    url: `http://127.0.0.1:3000/probe/json?oh-case=${marker}`,
    auth: { type: 'none' },
    body: { type: 'none' },
  });
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
  await workbench.openRequest(uid);
  await workbench.send();
  expect(await workbench.responseStatusText()).toContain('200');

  // The executor's fetch ran in the extension's OWN service worker — the
  // re-keyed row must land in the workbench tab's traffic, carrying the
  // worker-issued ⚙ provenance the plane stamps on every mint.
  const sendRow = selfPanel.locator('.dt-row').filter({ hasText: marker }).first();
  await expect(sendRow).toBeVisible({ timeout: 20_000 });
  await expect(sendRow.locator('.dt-col-name-gear')).toBeVisible();

  // Own-bundle terminal floor: the request editor spawned Monaco's worker,
  // whose main-script load is a tab-bound bundle load webRequest never
  // completes — the floor must resolve it to the browser's status-less
  // "Finished" instead of an eternal "(pending)".
  const workerRow = selfPanel.locator('.dt-row').filter({ hasText: 'editor.worker' }).first();
  await expect(workerRow).toBeVisible({ timeout: 20_000 });
  await expect(workerRow).toContainText('Finished', { timeout: 10_000 });
  await expect(workerRow).not.toContainText('(pending)');

  await selfPanel.close();
});
