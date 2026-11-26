/**
 * Live Network frames E2E — what a watched tab does to the browser's
 * wire when its history outgrows one frame, against the real dual-app
 * stack (the built desktop app, Chromium with the built extension, a
 * playground tab):
 *
 *   1. A watched tab accumulates a history larger than the host's inbound
 *      frame limit. A wire flap makes the extension replay it: the replay
 *      crosses as several frames, the rows come back, and the browser
 *      stays connected — sync and every other plane with it.
 *   2. With Debug mode on, a response body larger than the limit is
 *      pulled into the watched tab: its row stays, Response says the
 *      content is too large to show, and the browser stays connected —
 *      through the pull and through the next replay, which now carries
 *      that row.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { type BrowserContext, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchExtensionContext } from '../../../extension/tests/e2e/fixtures/launch-extension';
import { createExtensionSeedHarness } from './agent-traffic-harness';
import { launchDesktopApp } from './fixtures/launch-app';

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: fresh port off every prior suite (ledger through 21937).
const DAEMON_PORT = 22137;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';
// 1,200 rows of 8 KB each are over the host's 8 MiB inbound limit.
const HEAVY_ROWS = 1_200;
const HEAVY_PAD_CHARS = 8_000;
// One body over the limit, under the 10 M characters Debug mode captures.
const BIG_BODY_CHARS = 9_000_000;

interface DebugStateWire {
  attachedTabs: number[];
}

interface TabsListResponse {
  peers?: Array<{ nodeId: string; debug: DebugStateWire; tabs: Array<{ tabId: number; url: string }> }>;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token = '';
let context: BrowserContext | undefined;
let extensionId = '';
let playground: Page;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'live-network-frames-e2e-backend',
  recordLabel: 'live-network frames e2e desktop',
  logTag: 'live-network-frames setup',
});

async function bridgeInvoke<T>(message: Record<string, unknown>): Promise<T> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as never;
  }, message) as Promise<T>;
}

async function listTabs(): Promise<TabsListResponse> {
  return bridgeInvoke<TabsListResponse>({ type: 'oh.daemon.telemetry.tabs.list' });
}

async function peerCount(): Promise<number> {
  return ((await listTabs()).peers ?? []).length;
}

async function playgroundTarget(): Promise<{ nodeId: string; tabId: number; attached: boolean }> {
  for (const peer of (await listTabs()).peers ?? []) {
    const tab = peer.tabs.find((t) => t.url.startsWith(PLAYGROUND_URL));
    if (tab) return { nodeId: peer.nodeId, tabId: tab.tabId, attached: peer.debug.attachedTabs.includes(tab.tabId) };
  }
  throw new Error('playground tab not in the inventory');
}

/** State-driven dock-strip toggle — the live-network idiom. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

async function pickPlaygroundTab(): Promise<void> {
  await workbench
    .locator('[data-testid="traffic-monitor-source-tab"]')
    .filter({ hasText: PLAYGROUND_TITLE })
    .first()
    .click();
}

function gridFilter() {
  return workbench.locator('.rules-bottom-panel input[placeholder="Filter"]').first();
}

/** The browser reads as connected at every one of `seconds` reads. */
async function expectConnectedFor(seconds: number): Promise<void> {
  for (let i = 0; i < seconds; i++) {
    await workbench.waitForTimeout(1_000);
    expect(await peerCount(), `connected browsers, read ${i + 1} of ${seconds}`).toBe(1);
  }
}

/**
 * Drop the wire, fire `missedProbe` in the watched tab while it is down,
 * and bring the wire back. The relay re-subscribes and the extension
 * replays: the missed request can reach the grid ONLY through that
 * replay, so its row is the proof the replay crossed.
 */
async function flapWire(missedProbe: string): Promise<void> {
  await harness.seedBackend({ enabled: false });
  await expect.poll(peerCount, { timeout: 5_000 }).toBe(0);
  await playground.evaluate((probe) => fetch(`/api/echo?probe=${probe}`).then((r) => r.text()), missedProbe);
  await harness.seedBackend({ enabled: true });
  await expect.poll(peerCount, { timeout: 5_000 }).toBe(1);
  await gridFilter().fill(`probe=${missedProbe}`);
  await expect(workbench.locator('.dt-row').filter({ hasText: `probe=${missedProbe}` })).toHaveCount(1, {
    timeout: 10_000,
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-live-network-frames-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'mcp.enabled': true, 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );
  electronApp = await launchDesktopApp(APP_ROOT, userData);
  workbench = await electronApp.firstWindow();

  // Engine-ready gate: the endpoint answers 401 once the daemon bind is up.
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(MCP_URL, { method: 'POST', body: '{}' })).status;
        } catch {
          return 0;
        }
      },
      { timeout: 20_000 },
    )
    .toBe(401);

  const minted = await bridgeInvoke<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'live-network-frames-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  context = await launchExtensionContext('', EXTENSION_PATH);
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2];
  await harness.seedBackendRetrying({ enabled: true });

  playground = await context.newPage();
  await playground.goto(PLAYGROUND_URL);
  // Background the playground tab so the watched tab carries only this
  // spec's own probes.
  await (await harness.extensionPage()).bringToFront();
  await expect.poll(peerCount, { timeout: 5_000 }).toBe(1);
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

test('a history over the frame limit replays in frames and the browser stays connected', async () => {
  test.setTimeout(120_000);
  await setToolWindowOpen(true);
  await pickPlaygroundTab();

  // Filter to the run's LAST probe before firing, so its appearance marks
  // end-to-end completion — the live-network burst idiom.
  await gridFilter().fill(`heavy=${HEAVY_ROWS - 1}&`);
  await playground.evaluate(
    async ({ rows, pad }) => {
      const padding = 'p'.repeat(pad);
      const CHUNK = 50;
      for (let i = 0; i < rows; i += CHUNK) {
        await Promise.all(
          Array.from({ length: Math.min(CHUNK, rows - i) }, (_, j) => fetch(`/api/echo?heavy=${i + j}&pad=${padding}`)),
        );
      }
    },
    { rows: HEAVY_ROWS, pad: HEAVY_PAD_CHARS },
  );
  const lastRow = workbench.locator('.dt-row').filter({ hasText: `heavy=${HEAVY_ROWS - 1}&` });
  await expect(lastRow).toHaveCount(1, { timeout: 30_000 });

  // The replay of that history: one frame of it would close the wire.
  await flapWire('missed-heavy');
  await gridFilter().fill(`heavy=${HEAVY_ROWS - 1}&`);
  await expect(lastRow).toHaveCount(1, { timeout: 5_000 });
  await gridFilter().fill('heavy=0&');
  await expect(workbench.locator('.dt-row').filter({ hasText: 'heavy=0&' })).toHaveCount(1, { timeout: 5_000 });
  await expectConnectedFor(5);

  // And the stream is live again.
  await gridFilter().fill('probe=after-heavy');
  await playground.evaluate(() => fetch('/api/echo?probe=after-heavy').then((r) => r.text()));
  await expect(workbench.locator('.dt-row').filter({ hasText: 'probe=after-heavy' })).toHaveCount(1, {
    timeout: 5_000,
  });
});

test('a response body over the frame limit reads too large and the browser stays connected', async () => {
  test.setTimeout(120_000);
  const target = await playgroundTarget();
  await bridgeInvoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: target.nodeId,
    command: { kind: 'pin', tabId: target.tabId, pinned: true },
  });
  await bridgeInvoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: target.nodeId,
    command: { kind: 'enable', enabled: true },
  });
  await expect.poll(async () => (await playgroundTarget()).attached, { timeout: 5_000 }).toBe(true);

  await gridFilter().fill('probe=bigbody');
  const echoedChars = await playground.evaluate(async (chars) => {
    const response = await fetch('/api/echo?probe=bigbody', { method: 'POST', body: 'x'.repeat(chars) });
    return (await response.text()).length;
  }, BIG_BODY_CHARS);
  expect(echoedChars).toBeGreaterThan(BIG_BODY_CHARS);

  const row = workbench.locator('.dt-row').filter({ hasText: 'probe=bigbody' }).first();
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await workbench.getByRole('tab', { name: 'Response', exact: true }).first().click();

  // The pull's answer is one message over the limit: the row keeps its
  // place and says its content did not cross.
  await expect(workbench.getByText('Content is too large to show here.').first()).toBeVisible({ timeout: 10_000 });
  await expectConnectedFor(5);

  // The next replay carries that row — still without closing the wire.
  await flapWire('missed-bigbody');
  await gridFilter().fill('probe=bigbody');
  await expect(row).toBeVisible({ timeout: 5_000 });
  await expectConnectedFor(5);
});
