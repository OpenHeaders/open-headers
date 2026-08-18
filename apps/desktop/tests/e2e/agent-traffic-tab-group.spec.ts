/**
 * Agent traffic S13 E2E — in-browser tab-group capture feedback against
 * the real dual-app stack (the agent-traffic plan §4, the capture-
 * transparency law made visible in the tab strip). Since S30 the badge
 * rides the desktop's pushed capture state (the tap's armed sources),
 * not the extension's stream sessions — so these legs prove the whole
 * push path: arm RPC → tap transition → capture-state frame → reactor.
 *
 *   1. Launch the built desktop app isolated on a fresh daemon port;
 *      launch Chromium with the built extension and open two playground
 *      tabs. Capture-arming the first puts it in a blue tab group
 *      titled "OpenHeaders AI".
 *   2. Arming the second tab joins it to the SAME group — one group per
 *      window, never one per tab.
 *   3. Disarming the first tab ungroups exactly it; the still-armed
 *      second tab stays grouped.
 *   4. Disarming the last tab ungroups it and the group dissolves —
 *      the badge never outlives the capture.
 *
 * The inverse law — a workbench live-view watch never badges — is
 * structural now (the stream host feeds no ledger) and pinned at the
 * unit layer (capture-feedback-host + tab-group-reactor tests).
 *
 * Group state is read through the extension PAGE (popup-page evaluate
 * law — never the service worker): `chrome.tabs.get(...).groupId` plus
 * `chrome.tabGroups.get(...)` for title/color.
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
// Port etiquette: fresh port off every prior suite (ledger through 20737).
const DAEMON_PORT = 20837;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/known-shape.html';
const PAGE_A_URL = `${PAGE_URL}?tab=a`;
const PAGE_B_URL = `${PAGE_URL}?tab=b`;

const GROUP_TITLE = 'OpenHeaders AI';
const NO_GROUP = -1;

interface GroupInfo {
  groupId: number;
  title?: string;
  color?: string;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let userData: string;
let peerNodeId: string;
let tabIdA: number;
let tabIdB: number;
let uidA: string;
let uidB: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-tab-group-e2e-backend',
  recordLabel: 'agent-traffic tab-group e2e desktop',
  logTag: 'agent-traffic-tab-group setup',
});

/** Invoke one operator-plane RPC through the Workbench bridge. */
async function invoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as Record<string, unknown>;
  }, message);
}

/** Read a tab's live group membership through the extension page. */
async function groupInfoOf(tabId: number): Promise<GroupInfo> {
  const page = await harness.extensionPage();
  return page.evaluate(async (id) => {
    const tab = await chrome.tabs.get(id);
    const groupId = tab.groupId ?? -1;
    if (groupId === -1) return { groupId };
    try {
      const group = await chrome.tabGroups.get(groupId);
      return { groupId, title: group.title, color: group.color as string };
    } catch {
      // The group dissolved between the two reads.
      return { groupId };
    }
  }, tabId);
}

async function armTab(tabId: number): Promise<string> {
  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  return armed.uid ?? '';
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-tab-group-e2e-'));
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-tab-group-e2e' })) as {
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

  const pageA = await context.newPage();
  await pageA.goto(PAGE_A_URL);
  const pageB = await context.newPage();
  await pageB.goto(PAGE_B_URL);
  // Background the playground tabs so the spec drives arm state only.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Arm → the blue "OpenHeaders AI" group appears ───────────────────

test('capture-arming a tab puts it in a blue tab group titled "OpenHeaders AI"', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        for (const peer of peers ?? []) {
          const tabA = peer.tabs.find((t) => t.url === PAGE_A_URL);
          const tabB = peer.tabs.find((t) => t.url === PAGE_B_URL);
          if (tabA && tabB) {
            peerNodeId = peer.nodeId;
            tabIdA = tabA.tabId;
            tabIdB = tabB.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);

  expect((await groupInfoOf(tabIdA)).groupId).toBe(NO_GROUP);
  uidA = await armTab(tabIdA);

  // The arm commits on the tap, the daemon pushes the capture-state
  // frame, and the reactor groups on the captured transition.
  await expect.poll(async () => (await groupInfoOf(tabIdA)).groupId, { timeout: 15000 }).not.toBe(NO_GROUP);
  const info = await groupInfoOf(tabIdA);
  expect(info.title).toBe(GROUP_TITLE);
  expect(info.color).toBe('blue');
});

// ── Second arm shares the window's group ────────────────────────────

test('arming a second tab in the same window joins the same group', async () => {
  const groupA = (await groupInfoOf(tabIdA)).groupId;
  uidB = await armTab(tabIdB);
  await expect.poll(async () => (await groupInfoOf(tabIdB)).groupId, { timeout: 15000 }).toBe(groupA);
});

// ── Disarm ungroups exactly the disarmed tab ────────────────────────

test('disarming one tab ungroups it while the still-armed tab stays grouped', async () => {
  const groupB = (await groupInfoOf(tabIdB)).groupId;
  expect(((await invoke({ type: 'oh.daemon.traffic.disarm', uid: uidA })) as { ok: boolean }).ok).toBe(true);
  await expect.poll(async () => (await groupInfoOf(tabIdA)).groupId, { timeout: 15000 }).toBe(NO_GROUP);
  expect((await groupInfoOf(tabIdB)).groupId).toBe(groupB);
});

// ── The last disarm dissolves the group ─────────────────────────────

test('disarming the last tab ungroups it and the group dissolves', async () => {
  expect(((await invoke({ type: 'oh.daemon.traffic.disarm', uid: uidB })) as { ok: boolean }).ok).toBe(true);
  await expect.poll(async () => (await groupInfoOf(tabIdB)).groupId, { timeout: 15000 }).toBe(NO_GROUP);
  // Both tabs out — no armed source remains on the operator plane.
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: Array<{ uid: string }>;
  };
  expect(sources.map((s) => s.uid)).not.toContain(uidA);
  expect(sources.map((s) => s.uid)).not.toContain(uidB);
});
