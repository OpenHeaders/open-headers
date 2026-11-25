/**
 * Live Network closed window E2E — a window closed to the tray is not a
 * viewer, against the real dual-app stack (the built desktop app,
 * Chromium with the built extension, a playground tab):
 *
 *   1. The Traffic window watches the playground tab and a probe streams
 *      into the grid.
 *   2. The window closes to the tray. Main releases its view channels at
 *      the door and the tab list's watch detaches from the browser. The
 *      browser then makes a request in the watched tab and opens a new
 *      tab: no view frame reaches the closed window.
 *   3. The window is opened again. The channels its renderer kept asking
 *      for are admitted, the grid comes back with the request made while
 *      it was closed, the rail lists the tab opened meanwhile, and the
 *      stream is live.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import {
  _electron,
  type BrowserContext,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { createExtensionSeedHarness } from './agent-traffic-harness';

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: fresh port off every prior suite (ledger through 22137).
const DAEMON_PORT = 22237;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';

const RELEASED_LINE = /window closed — released (\d+) view port\(s\)/;
const TABS_DETACHED_LINE = /last tab-inventory viewer left — detaching peers/;
const TABS_OPENED_LINE = /tab-inventory watch opened/;
const ADMITTED_LINE = /port "([^"]+)" was opened with its window closed — admitted/;

interface TabsListResponse {
  peers?: Array<{ nodeId: string }>;
}

interface ViewFrameProbe {
  oh: {
    invoke(message: Record<string, unknown>): Promise<unknown>;
    lifeline: { onHostMessage(handler: (envelope: { portId: string; message: unknown }) => void): () => void };
  };
  ohViewFrames?: string[];
}

let electronApp: ElectronApplication;
let workbench: Page;
let token = '';
let context: BrowserContext | undefined;
let extensionId = '';
let playground: Page;
let logPath = '';

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'live-network-closed-window-e2e-backend',
  recordLabel: 'live-network closed window e2e desktop',
  logTag: 'live-network-closed-window setup',
});

async function bridgeInvoke<T>(message: Record<string, unknown>): Promise<T> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as never;
  }, message) as Promise<T>;
}

async function peerCount(): Promise<number> {
  return ((await bridgeInvoke<TabsListResponse>({ type: 'oh.daemon.telemetry.tabs.list' })).peers ?? []).length;
}

/** The main log's lines that match, oldest first. */
async function logLines(pattern: RegExp): Promise<string[]> {
  const text = await readFile(logPath, 'utf8').catch(() => '');
  return text.split('\n').filter((line) => pattern.test(line));
}

/** State-driven dock-strip toggle — the live-network idiom. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

function playgroundSourceTabs() {
  return workbench.locator('[data-testid="traffic-monitor-source-tab"]').filter({ hasText: PLAYGROUND_TITLE });
}

function gridFilter() {
  return workbench.locator('.rules-bottom-panel input[placeholder="Filter"]').first();
}

function probeRow(probe: string) {
  return workbench.locator('.dt-row').filter({ hasText: `probe=${probe}` });
}

/**
 * Record the kind of every view frame main hands this window from now
 * on — the tab list's and a watched tab's. The renderer stays alive
 * while its window is closed, so the record reads the same either way.
 */
async function startViewFrameRecord(): Promise<void> {
  await workbench.evaluate(() => {
    const probe = window as unknown as ViewFrameProbe;
    if (probe.ohViewFrames !== undefined) {
      probe.ohViewFrames = [];
      return;
    }
    const viewKinds = new Set([
      'peers',
      'peer-tabs',
      'peer-gone',
      'ready',
      'lifecycle-update',
      'source',
      'tab-cleared',
    ]);
    probe.ohViewFrames = [];
    probe.oh.lifeline.onHostMessage(({ message }) => {
      const kind = (message as { kind?: unknown } | null)?.kind;
      if (typeof kind === 'string' && viewKinds.has(kind)) probe.ohViewFrames?.push(kind);
    });
  });
}

async function recordedViewFrames(): Promise<string[]> {
  return workbench.evaluate(() => (window as unknown as ViewFrameProbe).ohViewFrames ?? []);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-live-network-closed-window-e2e-'));
  logPath = path.join(userData, 'logs', 'main.log');
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'mcp.enabled': true, 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
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
    label: 'live-network-closed-window-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
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

test('a watched tab streams to the open window', async () => {
  await setToolWindowOpen(true);
  await expect(playgroundSourceTabs()).toHaveCount(1);
  await playgroundSourceTabs().first().click();

  await gridFilter().fill('probe=before-close');
  await playground.evaluate(() => fetch('/api/echo?probe=before-close').then((r) => r.text()));
  await expect(probeRow('before-close')).toHaveCount(1);
});

test('a window closed to the tray holds no view channel and receives no view frame', async () => {
  const tabsOpenedBefore = (await logLines(TABS_OPENED_LINE)).length;
  expect(tabsOpenedBefore).toBeGreaterThan(0);

  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].close();
  });

  // The door released the tab list's channel and the watched tab's.
  await expect.poll(async () => (await logLines(RELEASED_LINE)).length).toBe(1);
  const released = Number(RELEASED_LINE.exec((await logLines(RELEASED_LINE))[0])?.[1]);
  console.log(`[live-network-closed-window] the close released ${released} view port(s)`);
  expect(released).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await logLines(TABS_DETACHED_LINE)).length).toBe(1);

  // The browser keeps working: a request in the watched tab, a new tab.
  await startViewFrameRecord();
  await playground.evaluate(() => fetch('/api/echo?probe=while-closed').then((r) => r.text()));
  const opened = await context?.newPage();
  await opened?.goto(`${PLAYGROUND_URL}?opened=while-closed`);
  await workbench.waitForTimeout(1_500);

  expect(await recordedViewFrames()).toEqual([]);
  // Its renderer keeps asking; the door holds every ask.
  expect(await logLines(ADMITTED_LINE)).toEqual([]);
  expect((await logLines(TABS_OPENED_LINE)).length).toBe(tabsOpenedBefore);
});

test('opening the window again admits its channels and rebuilds the view', async () => {
  const tabsOpenedBefore = (await logLines(TABS_OPENED_LINE)).length;

  await electronApp.evaluate(({ app }) => {
    app.emit('activate');
  });

  await expect.poll(async () => (await logLines(TABS_OPENED_LINE)).length).toBe(tabsOpenedBefore + 1);
  const admitted = (await logLines(ADMITTED_LINE)).map((line) => ADMITTED_LINE.exec(line)?.[1] ?? '');
  console.log(`[live-network-closed-window] the reopen admitted: ${admitted.join(', ')}`);
  expect(admitted).toContain('oh-tabs');
  expect(admitted.some((name) => name.startsWith('oh-lifecycle:'))).toBe(true);

  // The tab list opens with what is true now: the tab opened meanwhile.
  await expect(playgroundSourceTabs()).toHaveCount(2);

  // The grid opens with the tab's history, the closed stretch included.
  await gridFilter().fill('probe=while-closed');
  await expect(probeRow('while-closed')).toHaveCount(1);
  await gridFilter().fill('probe=before-close');
  await expect(probeRow('before-close')).toHaveCount(1);

  // And the stream is live again.
  await gridFilter().fill('probe=after-reopen');
  await playground.evaluate(() => fetch('/api/echo?probe=after-reopen').then((r) => r.text()));
  await expect(probeRow('after-reopen')).toHaveCount(1);
});
