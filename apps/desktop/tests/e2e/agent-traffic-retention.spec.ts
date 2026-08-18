/**
 * Agent traffic S1 E2E — the retention seam against the real dual-app
 * stack (the agent-traffic plan §7.2 `agent-traffic/retention-bounds`):
 * frames crossing the browser live-relay land as bounded retention
 * records in the daemon's traffic tap.
 *
 *   1. Launch the built desktop app isolated (OPENHEADERS_USER_DATA_DIR)
 *      on a fresh daemon port; launch Chromium with the built extension
 *      (`dist/chrome`, user-built) and open the retention-bounds
 *      playground page.
 *   2. Arm the tab through the operator RPC plane
 *      (`oh.daemon.traffic.arm`) with small ring bounds. Retention
 *      starts at arm time: the page-load traffic from before the arm
 *      never lands in the ring.
 *   3. A known burst streams into exactly that many records (the seam
 *      pin: frames → records).
 *   4. Overflowing the count bound evicts FIFO and counts honestly.
 *   5. A wire flap (backend record disabled → re-enabled) triggers the
 *      relay's re-subscribe + full replay; the ring absorbs the replay
 *      without double-counting and without resurrecting evicted rows.
 *   6. Re-arming with a tiny byte ceiling trips the byte bound first on
 *      header-fat requests; disarming leaves the source ABSENT from the
 *      status surface (unarmed = absent, not unreadable).
 *
 * Assertions ride the content-free counters (`oh.daemon.traffic.status`)
 * — no retained record crosses the wire in S1.
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
// Port etiquette: fresh port off every prior suite (ledger through 19938).
const DAEMON_PORT = 20037;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/retention-bounds.html';

interface TrafficStats {
  recordCount: number;
  byteSize: number;
  maxRecords: number;
  maxBytes: number;
  evictedCount: number;
  droppedPreArm: number;
  droppedEvictedReplay: number;
  readyEpochs: number;
}

interface TrafficSourceStatus {
  uid: string;
  kind: string;
  state: string;
  stats: TrafficStats;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let playground: Page;
let peerNodeId: string;
let playgroundTabId: number;
let armedUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-e2e-backend',
  recordLabel: 'agent-traffic e2e desktop',
  logTag: 'agent-traffic setup',
});

/** Invoke one operator-plane RPC through the Workbench bridge. */
async function invoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as Record<string, unknown>;
  }, message);
}

async function trafficSources(): Promise<TrafficSourceStatus[]> {
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: TrafficSourceStatus[];
  };
  return sources ?? [];
}

async function armedStats(): Promise<TrafficStats | null> {
  const sources = await trafficSources();
  return sources.find((s) => s.uid === armedUid)?.stats ?? null;
}

/** Peers currently answering the telemetry inventory. */
async function peerCount(): Promise<number> {
  const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
    peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
  };
  return (peers ?? []).length;
}

/** Fire a probe burst in the playground page. */
async function fireBurst(count: number, tag: string, padBytes = 0): Promise<void> {
  await playground.evaluate(
    async (options) => {
      await (
        window as unknown as {
          __ohFireBurst(o: { count: number; tag: string; padBytes?: number }): Promise<number>;
        }
      ).__ohFireBurst(options);
    },
    { count, tag, padBytes },
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();

  // Engine-ready gate: 401 = bound + MCP enabled, token missing.
  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(MCP_URL, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .toBe(401);

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-e2e' })) as {
    ok: boolean;
    secret?: string;
  };
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2] ?? '';
  await harness.extensionPage();
  await harness.seedBackendRetrying({ enabled: true });

  playground = await context.newPage();
  await playground.goto(PAGE_URL);
  // Background the playground tab so every request in the watched
  // partition is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory gate ──────────────────────────────────────────────────

test('the daemon inventories the retention-bounds tab', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        for (const peer of peers ?? []) {
          const tab = peer.tabs.find((t) => t.url.startsWith(PAGE_URL));
          if (tab) {
            peerNodeId = peer.nodeId;
            playgroundTabId = tab.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Arm: retention starts at arm time ───────────────────────────────

test('arming the tab starts an empty ring — pre-arm history never lands', async () => {
  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: playgroundTabId,
    maxRecords: 10,
    maxBytes: 512 * 1024,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  armedUid = armed.uid ?? '';

  const sources = await trafficSources();
  expect(sources.map((s) => s.uid)).toEqual([armedUid]);
  expect(sources[0]?.state).toBe('streaming');
  // The subscribe round-trips through the extension (25ms batch tick);
  // the first ready lands shortly after the arm returns.
  await expect.poll(async () => (await armedStats())?.readyEpochs ?? 0, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  // The page-load traffic predates the arm; the ring starts empty.
  expect((await armedStats())?.recordCount).toBe(0);
});

// ── The seam pin: frames → records ──────────────────────────────────

test('a known burst lands as exactly that many retention records', async () => {
  await fireBurst(5, 'seam');
  await expect.poll(async () => (await armedStats())?.recordCount, { timeout: 15000 }).toBe(5);
  const stats = await armedStats();
  expect(stats?.evictedCount).toBe(0);
  expect(stats?.byteSize).toBeGreaterThan(0);
});

// ── Count bound: FIFO eviction ──────────────────────────────────────

test('overflowing the count bound evicts FIFO and counts honestly', async () => {
  await fireBurst(10, 'overflow');
  await expect.poll(async () => (await armedStats())?.recordCount, { timeout: 15000 }).toBe(10);
  await expect.poll(async () => (await armedStats())?.evictedCount, { timeout: 15000 }).toBe(5);
});

// ── Reconnect: replay absorbed, nothing resurrected ─────────────────

test('a wire flap replays without double-counting or resurrecting evicted rows', async () => {
  await harness.seedBackend({ enabled: false });
  await expect.poll(peerCount, { timeout: 15000 }).toBe(0);

  await harness.seedBackend({ enabled: true });
  await expect.poll(peerCount, { timeout: 15000 }).toBe(1);

  // The relay re-subscribes the live watch; the fresh ready + FULL
  // replay re-offers all 15 post-arm probes: 10 refresh in place, the
  // 5 evicted identities are refused.
  await expect.poll(async () => (await armedStats())?.readyEpochs, { timeout: 20000 }).toBeGreaterThanOrEqual(2);
  const stats = await armedStats();
  expect(stats?.recordCount).toBe(10);
  expect(stats?.evictedCount).toBe(5);
  expect(stats?.droppedEvictedReplay).toBeGreaterThanOrEqual(5);
});

// ── Byte bound + unarmed absence ────────────────────────────────────

test('the byte ceiling trips first on header-fat requests; disarming leaves absence', async () => {
  expect(((await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid })) as { ok: boolean }).ok).toBe(true);

  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: playgroundTabId,
    maxRecords: 100,
    maxBytes: 6 * 1024,
  })) as { ok: boolean; uid?: string };
  expect(armed.ok).toBe(true);
  armedUid = armed.uid ?? '';

  // 5 probes carrying 2KB of request-header padding each — the byte
  // ceiling (6KB) trips long before the count bound (100).
  await fireBurst(5, 'fat', 2_048);
  await expect.poll(async () => (await armedStats())?.evictedCount ?? 0, { timeout: 15000 }).toBeGreaterThan(0);
  const stats = await armedStats();
  expect(stats?.byteSize).toBeLessThanOrEqual(6 * 1024);
  expect(stats?.recordCount).toBeGreaterThan(0);
  expect(stats?.recordCount).toBeLessThan(5);

  // Disarm: the source is ABSENT from the status surface, not disabled.
  expect(((await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid })) as { ok: boolean }).ok).toBe(true);
  expect(await trafficSources()).toEqual([]);
});
