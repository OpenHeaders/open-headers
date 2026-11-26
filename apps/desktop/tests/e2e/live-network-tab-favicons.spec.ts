/**
 * Live Network tab favicons E2E — the tab list carries a key per icon
 * and the window pulls each icon once, against the real dual-app stack
 * (the built desktop app, Chromium with the built extension, playground
 * tabs):
 *
 *   1. The Traffic rail lists the browser's tabs with their icons, while
 *      no tab-list frame main hands the window carries an icon's bytes —
 *      only its key.
 *   2. The browser grows to thirty tabs. Every snapshot stays keyed, the
 *      thirtieth is a fraction of what the icons alone weighed, and every
 *      listed tab still shows its icon.
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
// Port etiquette: fresh port off every prior suite (ledger through 22337).
const DAEMON_PORT = 22437;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';
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
  recordId: 'live-network-tab-favicons-e2e-backend',
  recordLabel: 'live-network tab favicons e2e desktop',
  logTag: 'live-network-tab-favicons setup',
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

/** State-driven dock-strip toggle — the live-network idiom. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-live-network-tab-favicons-e2e-'));
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
    label: 'live-network-tab-favicons-e2e',
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

const TABS_AT_THE_END = 30;
// What thirty tabs' icons alone weighed in one snapshot before they
// crossed apart (measured on this rig) — the keyed snapshot must be
// well under it.
const THIRTY_TABS_OF_ICONS_CHARS = 26_000;

/** The tab-list snapshots main handed the window, oldest first. */
async function tabSnapshots(): Promise<string[]> {
  return (await windowFrames()).filter((frame) => frame.kind === 'peer-tabs').map((frame) => frame.text);
}

function sourceTabs() {
  return workbench.locator('[data-testid="traffic-monitor-source-tab"]');
}

/** Every listed tab the playground serves shows an icon, read from bytes the window holds. */
async function expectPlaygroundTabsShowIcons(count: number): Promise<void> {
  const rows = sourceTabs().filter({ hasText: PLAYGROUND_TITLE });
  await expect(rows).toHaveCount(count);
  await expect(rows.locator('img[src^="data:image/"]')).toHaveCount(count);
}

test('the rail shows each tab’s icon while the tab list carries only its key', async () => {
  await startWindowFrameRecord();
  await setToolWindowOpen(true);

  await expectPlaygroundTabsShowIcons(1);

  const snapshots = await tabSnapshots();
  expect(snapshots.length).toBeGreaterThan(0);
  for (const snapshot of snapshots) {
    expect(snapshot).toContain('"favIconKey"');
    expect(snapshot).not.toContain('data:image');
  }
});

test('thirty tabs stay keyed, light, and all with their icons', async () => {
  test.setTimeout(120_000);
  await startWindowFrameRecord();
  const open = context?.pages().length ?? 0;
  for (let index = open; index < TABS_AT_THE_END; index++) {
    const page = await context?.newPage();
    await page?.goto(`${PLAYGROUND_URL}?tab=${index}`);
  }
  await expect(sourceTabs()).toHaveCount(TABS_AT_THE_END, { timeout: 10_000 });

  // The other tabs are the seed harness's extension page and the
  // browser's own blank tab.
  await expectPlaygroundTabsShowIcons(TABS_AT_THE_END - 2);

  const snapshots = await tabSnapshots();
  for (const snapshot of snapshots) expect(snapshot).not.toContain('data:image');
  const last = snapshots[snapshots.length - 1] ?? '';
  const total = snapshots.reduce((chars, snapshot) => chars + snapshot.length, 0);
  console.log(
    `[live-network-tab-favicons] ${snapshots.length} snapshots while opening tabs, ${total} characters in all; ` +
      `the last, at ${TABS_AT_THE_END} tabs, ${last.length} characters`,
  );
  expect(last.length).toBeLessThan(THIRTY_TABS_OF_ICONS_CHARS / 2);
});
