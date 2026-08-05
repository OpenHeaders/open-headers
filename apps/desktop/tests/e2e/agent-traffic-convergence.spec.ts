/**
 * Agent traffic C2 E2E — single-store convergence against the real
 * dual-app stack (AGENT_TRAFFIC_PLAN.md §11.2).
 *
 *   1. Inventory the generator tab.
 *   2. A workbench watch opens ONE extension stream session (the
 *      popup ledger's `oh.desktopWatchActivity` count is the witness)
 *      and the panel renders rows served through the partition mirror.
 *   3. THE CONVERGENCE PIN: arming the already-watched tab joins the
 *      SAME session — the extension-side count stays 1 where the
 *      pre-C2 fan-out ran 2 — while both readers keep their own
 *      posture: the tap starts EMPTY at the synthesized arm floor
 *      (the panel's earlier rows never leak into retention), and new
 *      traffic reaches panel and tap through the one fold.
 *   4. Readers release independently: the panel switching away leaves
 *      the armed tap streaming on the held session; disarm releases
 *      the wire and the extension count converges to zero.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev
 * server is started by the playwright `webServer` block.
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
// Port etiquette: fresh port off every prior suite (ledger through 20837).
const DAEMON_PORT = 20937;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/retention-bounds.html';

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let generatorPage: Page;
let userData: string;
let peerNodeId: string;
let generatorTabId: number;
let armedUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-convergence-e2e-backend',
  recordLabel: 'agent-traffic convergence e2e desktop',
  logTag: 'agent-traffic-convergence setup',
});

/** Invoke one operator-plane RPC through the Workbench bridge. */
async function invoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as Record<string, unknown>;
  }, message);
}

/** The extension-side session count — the popup privacy pill's ledger,
 *  raised once per open desktop stream session. THE convergence
 *  observable: panel watch + agent arm on one tab must read 1. */
async function watchSessions(): Promise<number> {
  const page = await harness.extensionPage();
  return page.evaluate(async () => {
    const stored = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.local.get('oh.desktopWatchActivity', resolve);
    });
    const value = stored['oh.desktopWatchActivity'] as { sessions?: number } | undefined;
    return value?.sessions ?? 0;
  });
}

async function tapRecordUrls(): Promise<string[]> {
  const { records } = (await invoke({ type: 'oh.daemon.traffic.records', uid: armedUid })) as unknown as {
    records: Array<{ url: string }> | null;
  };
  return (records ?? []).map((r) => r.url);
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function openTrafficMonitor(): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

async function refreshRail(): Promise<void> {
  await workbench.locator('[data-testid="traffic-monitor-refresh"]').first().click();
}

async function fireBurst(tag: string, count: number): Promise<void> {
  await generatorPage.evaluate(
    async (opts) => {
      await (window as unknown as { __ohFireBurst(o: { count: number; tag: string }): Promise<number> }).__ohFireBurst(
        opts,
      );
    },
    { count, tag },
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-convergence-e2e-'));
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-convergence-e2e' })) as {
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

  generatorPage = await context.newPage();
  await generatorPage.goto(PAGE_URL);
  // Background the playground tab so every request in the watched
  // partition is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory ───────────────────────────────────────────────────────

test('the daemon inventories the generator page', async () => {
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
            generatorTabId = tab.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  expect(await watchSessions()).toBe(0);
});

// ── Panel watch through the mirror ──────────────────────────────────

test('a workbench watch opens ONE stream session and the panel renders through the mirror', async () => {
  await openTrafficMonitor();
  await refreshRail();
  const row = workbench.locator('[data-testid="traffic-monitor-source-tab"]', { hasText: 'Retention bounds' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();

  await expect.poll(watchSessions, { timeout: 15000 }).toBe(1);

  await fireBurst('panel-only', 2);
  await expect(workbench.locator('.dt-row').filter({ hasText: 'panel-only' })).toHaveCount(2, { timeout: 15000 });
});

// ── THE CONVERGENCE PIN ─────────────────────────────────────────────

test('arming the watched tab joins the SAME session; the tap starts empty at the floor', async () => {
  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: generatorTabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  armedUid = armed.uid ?? '';

  await expect
    .poll(
      async () => {
        const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
          sources: Array<{ uid: string }>;
        };
        return sources.some((s) => s.uid === armedUid);
      },
      { timeout: 15000 },
    )
    .toBe(true);

  // Pre-C2 this read 2 (panel session + tap session). One store, one
  // wire session, one extension-side stream: it must stay 1.
  expect(await watchSessions()).toBe(1);

  // Per-reader floors on the shared session: the panel's earlier rows
  // are NOT in retention — the tap armed later and starts empty.
  expect((await tapRecordUrls()).filter((url) => url.includes('panel-only'))).toEqual([]);

  // New traffic reaches BOTH readers through the one fold.
  await fireBurst('shared-view', 3);
  await expect
    .poll(async () => (await tapRecordUrls()).filter((url) => url.includes('shared-view')).length, { timeout: 15000 })
    .toBe(3);
  await expect(workbench.locator('.dt-row').filter({ hasText: 'shared-view' })).toHaveCount(3, { timeout: 15000 });
  expect(await watchSessions()).toBe(1);
});

// ── Independent release ─────────────────────────────────────────────

test('the panel leaving keeps the armed tap streaming; disarm releases the wire', async () => {
  // Switch the panel to the wire source — the tab viewer port closes,
  // but the tap holds the partition's one session open.
  await workbench.locator('[data-testid="traffic-monitor-source-wire"]').first().click();
  await expect.poll(watchSessions, { timeout: 15000 }).toBe(1);

  // The tap still hears the tab through the held session.
  await fireBurst('after-panel', 1);
  await expect
    .poll(async () => (await tapRecordUrls()).filter((url) => url.includes('after-panel')).length, { timeout: 15000 })
    .toBe(1);

  const disarmed = (await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid })) as { ok: boolean };
  expect(disarmed.ok).toBe(true);
  await expect.poll(watchSessions, { timeout: 15000 }).toBe(0);
});
