/**
 * Live Network shared store E2E — every surface that shows a watched
 * tab reads ONE store in the window, against the real dual-app stack
 * (the built desktop app, Chromium with the built extension, a
 * playground tab):
 *
 *   1. The Traffic list watches the playground tab and three of its
 *      requests are opened as editor tabs. Opening them replays nothing,
 *      and a request made afterwards reaches the window on one lifeline.
 *   2. The list's source tab is closed. The inspect tabs alone keep the
 *      watch: a new request still reaches the window, on one lifeline.
 *      With the last inspect tab closed, nothing reaches it any more.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
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
// Port etiquette: fresh port off every prior suite (ledger through 22237).
const DAEMON_PORT = 22337;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';
const INSPECTED = ['one', 'two', 'three'];

interface TabsListResponse {
  peers?: Array<{ nodeId: string }>;
}

/** One frame main handed the window: its lifeline, and what it carried. */
interface WindowFrame {
  portId: string;
  kind: string;
  text: string;
}

interface WindowFrameRecord {
  ohWindowFrames?: WindowFrame[];
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
  recordId: 'live-network-shared-store-e2e-backend',
  recordLabel: 'live-network shared store e2e desktop',
  logTag: 'live-network-shared-store setup',
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

/**
 * Record every lifeline frame main hands the window from now on. Called
 * again, it starts the record over.
 */
async function startWindowFrameRecord(): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const record = globalThis as unknown as WindowFrameRecord;
    if (record.ohWindowFrames !== undefined) {
      record.ohWindowFrames = [];
      return;
    }
    record.ohWindowFrames = [];
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    const send = contents.send.bind(contents);
    contents.send = (channel: string, ...args: unknown[]) => {
      if (channel === 'oh:lifeline:host-message') {
        const envelope = args[0] as { portId: string; message: { kind?: unknown } | null };
        const kind = envelope.message?.kind;
        record.ohWindowFrames?.push({
          portId: envelope.portId,
          kind: typeof kind === 'string' ? kind : '',
          text: JSON.stringify(envelope.message),
        });
      }
      send(channel, ...args);
    };
  });
}

async function windowFrames(): Promise<WindowFrame[]> {
  return electronApp.evaluate(() => (globalThis as unknown as WindowFrameRecord).ohWindowFrames ?? []);
}

/** The lifelines that carried the request tagged `probe=<probe>`. */
async function lifelinesThatCarried(probe: string): Promise<string[]> {
  const carried = (await windowFrames()).filter((frame) => frame.text.includes(`probe=${probe}`));
  return [...new Set(carried.map((frame) => frame.portId))];
}

async function fireProbe(probe: string): Promise<void> {
  await playground.evaluate((name) => fetch(`/api/echo?probe=${name}`).then((r) => r.text()), probe);
}

/** State-driven dock-strip toggle — the live-network idiom. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

function gridFilter() {
  return workbench.locator('.rules-bottom-panel input[placeholder="Filter"]').first();
}

function probeRow(probe: string) {
  return workbench.locator('.dt-row').filter({ hasText: `probe=${probe}` });
}

function inspectTabs() {
  return workbench.locator('[data-tab-id^="live-net-req-"]');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-live-network-shared-store-e2e-'));
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
    label: 'live-network-shared-store-e2e',
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

test('inspected requests read the watched tab’s one store', async () => {
  await setToolWindowOpen(true);
  await workbench
    .locator('[data-testid="traffic-monitor-source-tab"]')
    .filter({ hasText: PLAYGROUND_TITLE })
    .first()
    .click();

  await gridFilter().fill('probe=');
  for (const probe of INSPECTED) await fireProbe(probe);
  await expect(workbench.locator('.dt-row')).toHaveCount(INSPECTED.length);

  // Each inspected request opens as its own editor tab, on the row the
  // list already holds: no new watch, so no history is replayed.
  await startWindowFrameRecord();
  for (const probe of INSPECTED) await probeRow(probe).click();
  await expect(inspectTabs()).toHaveCount(INSPECTED.length);
  await workbench.waitForTimeout(500);
  expect((await windowFrames()).filter((frame) => frame.kind === 'ready')).toEqual([]);

  // A request made now reaches the window once, whoever shows it.
  await fireProbe('after-inspect');
  await expect(probeRow('after-inspect')).toHaveCount(1);
  expect(await lifelinesThatCarried('after-inspect')).toHaveLength(1);
});

test('an inspect tab alone keeps the watch, and the last one out ends it', async () => {
  await workbench.locator('[data-testid="traffic-monitor-tab-close"]').first().click();
  await expect(workbench.locator('[data-testid="traffic-monitor-empty-hero"]')).toBeVisible();

  await startWindowFrameRecord();
  await fireProbe('list-closed');
  await expect.poll(() => lifelinesThatCarried('list-closed')).toHaveLength(1);

  for (let open = INSPECTED.length; open > 0; open--) {
    const tab = inspectTabs().first();
    await tab.hover();
    await tab.locator('.rules-tab-close').click();
    await expect(inspectTabs()).toHaveCount(open - 1);
  }

  await startWindowFrameRecord();
  await fireProbe('all-closed');
  await workbench.waitForTimeout(1_500);
  expect(await lifelinesThatCarried('all-closed')).toEqual([]);
});
