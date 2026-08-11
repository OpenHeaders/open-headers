/**
 * Agent traffic C6 E2E — the replay viewer against the real dual-app
 * stack (AGENT_TRAFFIC_PLAN.md §11.6 `agent-traffic/replay-parity` —
 * THE PHASE'S ACCEPTANCE TEST).
 *
 *   1. Launch the built desktop app isolated on a fresh daemon port;
 *      launch Chromium with the built extension and open the
 *      replay-parity generator page. Arm that tab and pin it to CDP
 *      fidelity.
 *   2. Live pass: watch the tab in the Traffic Monitor, record a
 *      session on the operator plane, fire the deterministic
 *      four-probe set (two OK gates, one 16 KiB asset that crosses the
 *      §11.4 externalize threshold, one 500), and snapshot the LIVE
 *      network view's rows.
 *   3. THE PARITY PIN: close the generator tab (the wire is gone),
 *      open the sealed session from the Traffic Monitor's SESSIONS
 *      rail section (row single-click — the S26 open affordance, a
 *      source tab on the panel strip), and assert the session tab's
 *      SAME network view folds the SAME rows — identical row set,
 *      statuses included, out of nothing but the sealed event log
 *      (§11.1 "replay is the live UI").
 *   4. Bodies resolve from the ARCHIVE, not the wire: the big asset's
 *      recorded body was withheld at stream time (the live lazy-pull
 *      idiom) and the inspect tab's Response view pulls it from the
 *      content-addressed blob store — the one pull that always
 *      succeeds, with the browser tab long gone.
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
  type Locator,
  type Page,
  test,
} from '@playwright/test';
import { createExtensionSeedHarness } from './agent-traffic-harness';

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: fresh port for a new daemon spec (ledger through 21037).
const DAEMON_PORT = 21137;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/replay-parity.html';

/** The four deterministic probes and the status each row must carry —
 *  the reducer-state fingerprint compared across live and replay. */
const PROBES: Array<{ needle: string; status: string }> = [
  { needle: 'replay-ok-1', status: '200' },
  { needle: 'replay-ok-2', status: '200' },
  { needle: 'replay-big', status: '200' },
  { needle: 'replay-parity-err', status: '500' },
];

interface CaptureSessionRow {
  sessionId: string;
  sourceUid: string;
  name: string;
  dirPath: string;
  requests: number;
  events: number;
  state: string;
  endReason?: string;
}

interface ArchivedSessionRow {
  id: string;
  sessionId: string;
  name: string;
  state: string;
  requests: number;
  errors: number;
  fidelity: string;
  partitionTabId: number;
}

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
let recorded: CaptureSessionRow;
let archivedRow: ArchivedSessionRow;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-replay-e2e-backend',
  recordLabel: 'agent-traffic replay e2e desktop',
  logTag: 'agent-traffic-replay setup',
});

/** Invoke one operator-plane RPC through the Workbench bridge. */
async function invoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as Record<string, unknown>;
  }, message);
}

async function captureSessions(): Promise<CaptureSessionRow[]> {
  const { sessions } = (await invoke({ type: 'oh.daemon.traffic.capture.status' })) as unknown as {
    sessions: CaptureSessionRow[];
  };
  return sessions ?? [];
}

async function archivedSessions(): Promise<ArchivedSessionRow[]> {
  const { sessions } = (await invoke({ type: 'oh.daemon.traffic.sessions.list' })) as unknown as {
    sessions: ArchivedSessionRow[];
  };
  return sessions ?? [];
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function openToolWindow(id: 'traffic-monitor'): Promise<void> {
  const tab = workbench.locator(`[data-tool-window="${id}"]`).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

/** State-driven SESSIONS expand — the section reloads on expand and on
 *  every trafficStatusChanged nudge. */
async function expandSessions(): Promise<void> {
  const header = workbench.locator('[data-testid="traffic-monitor-sessions-header"]');
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click();
  }
}

/** Assert one network surface (live view or replay tab) folds the
 *  deterministic probe rows — the shared parity fingerprint. */
async function expectProbeRows(surface: Page | Locator): Promise<void> {
  for (const probe of PROBES) {
    const row = surface.locator('.dt-row').filter({ hasText: probe.needle });
    await expect(row).toHaveCount(1, { timeout: 15000 });
    await expect(row.first()).toContainText(probe.status);
  }
  await expect(surface.locator('.dt-row')).toHaveCount(PROBES.length);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-replay-e2e-'));
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-replay-e2e' })) as {
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

// ── Inventory gate + arm + CDP fidelity ─────────────────────────────

test('the daemon inventories the generator page; arming and CDP-pinning it succeeds', async () => {
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

  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: generatorTabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  armedUid = armed.uid ?? '';

  // Debug fidelity: the recorder's completion-time body pulls serve
  // only on a CDP-fed (or proxy) partition — pin and wait for attach.
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'enable', enabled: true },
  });
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'pin', tabId: generatorTabId, pinned: true },
  });
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; debug: { attachedTabs: number[] } }>;
        };
        const peer = (peers ?? []).find((p) => p.nodeId === peerNodeId);
        return peer?.debug.attachedTabs.includes(generatorTabId) ?? false;
      },
      { timeout: 20000 },
    )
    .toBe(true);
});

// ── The live pass: watch + record + snapshot ────────────────────────

test('the live pass records the probe set and the live view folds the fingerprint rows', async () => {
  // Watch the tab in the Traffic Monitor — the LIVE half of the parity
  // comparison renders through the partition mirror.
  await openToolWindow('traffic-monitor');
  const sourceRow = workbench
    .locator('[data-testid="traffic-monitor-source-tab"]', { hasText: 'Replay parity' })
    .first();
  await expect(sourceRow).toBeVisible({ timeout: 15000 });
  await sourceRow.click();

  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'replay parity run',
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);

  await generatorPage.evaluate(async () => {
    await (window as unknown as { __ohFireReplayTraffic(): Promise<number> }).__ohFireReplayTraffic();
  });

  // The live network view folds the four probes — the fingerprint the
  // replayed session must reproduce.
  await expectProbeRows(workbench);

  await expect
    .poll(
      async () => (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId)?.requests ?? 0,
      { timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(PROBES.length);

  // Let the event stream settle before stopping: the recorder's eager
  // completion pulls answer over the wire, and a body-attached arriving
  // after the stop is (correctly) not recorded — the body leg needs
  // them IN the sealed log.
  let lastEvents = -1;
  await expect
    .poll(
      async () => {
        const events = (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId)?.events ?? 0;
        const stable = events > 0 && events === lastEvents;
        lastEvents = events;
        return stable;
      },
      { timeout: 20000, intervals: [1500] },
    )
    .toBe(true);
  await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid });
  await expect
    .poll(async () => (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId)?.state, {
      timeout: 20000,
    })
    .toBe('sealed');
  const sealed = (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId);
  if (sealed === undefined) throw new Error('recorded session vanished from the status surface');
  recorded = sealed;
});

// ── THE PARITY PIN: the sealed log replays into the same rows ───────

test('opening the sealed session replays the SAME rows with the browser tab gone', async () => {
  // The wire is gone: the generator tab closes and the source disarms.
  // Whatever renders from here on comes from the sealed event log.
  await generatorPage.close();
  await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid });

  await expect
    .poll(async () => (await archivedSessions()).find((r) => r.sessionId === recorded.sessionId)?.state, {
      timeout: 15000,
    })
    .toBe('sealed');
  const row = (await archivedSessions()).find((r) => r.sessionId === recorded.sessionId);
  if (row === undefined) throw new Error('sealed session missing from the archive index');
  archivedRow = row;
  expect(archivedRow.fidelity).toBe('cdp');
  expect(archivedRow.partitionTabId).toBe(generatorTabId);

  // Open through the S26 affordance: the SESSIONS rail section's row,
  // single click — the session becomes a source tab on the strip.
  await openToolWindow('traffic-monitor');
  await expandSessions();
  const sessionRow = workbench.locator(`[data-item-id="session:${archivedRow.id}"]`);
  await expect(sessionRow).toBeVisible({ timeout: 15000 });
  await sessionRow.click();

  // The session tab drives the SAME network view — same rows, same
  // statuses, same count: parity by construction, proven end to end.
  const replayPlane = workbench.locator('[data-testid="traffic-monitor-session-plane"]');
  await expect(replayPlane).toBeVisible({ timeout: 10000 });
  await expectProbeRows(replayPlane);
});

// ── Bodies resolve from the archive, not the wire ───────────────────

test('the big asset body serves from the blob store through the inspect tab', async () => {
  // The 16 KiB asset crossed the externalize threshold — its recorded
  // body lives in the CAS, was withheld from the replay stream (the
  // live lazy-pull idiom), and answers the Response tab's pull now,
  // with the browser tab closed and the source disarmed.
  // Click the Name cell — the row's initiator column is a button of its
  // own and a row-center click can land on it instead of selecting.
  await workbench
    .locator('[data-testid="traffic-monitor-session-plane"] .dt-row')
    .filter({ hasText: 'replay-big' })
    .first()
    .getByText('replay-big?bytes=16384')
    .click();
  // The editor-tab label ellipsizes mid-string — match the surviving tail.
  const editorTab = workbench.getByRole('tab', { name: /6384/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  await workbench.getByRole('tab', { name: 'Response', exact: true }).first().click();
  await expect(workbench.locator('.view-line').filter({ hasText: 'asset' }).first()).toBeVisible({ timeout: 15000 });
});
