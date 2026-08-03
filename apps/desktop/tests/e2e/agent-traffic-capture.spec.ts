/**
 * Agent traffic S7 E2E — opt-in disk capture sessions against the real
 * dual-app stack (AGENT_TRAFFIC_PLAN.md §7.2 `agent-traffic/capture-session`).
 *
 *   1. Launch the built desktop app isolated on a fresh daemon port;
 *      launch Chromium with the built extension and open the
 *      capture-session generator page. Arm that tab.
 *   2. Refusal: a capture start WITHOUT a redaction policy is refused —
 *      and no session file exists afterwards (the captures directory
 *      was never even created).
 *   3. Start + retention indicator: an explicit `redaction: 'standard'`
 *      starts the session; the operator status lists it active; the
 *      Traffic Monitor UI shows "capturing to disk" — header badge and
 *      per-row mark — the whole time it runs.
 *   4. Secrets nowhere ON DISK (the slice's highest-value assertion):
 *      the armed tab fires a burst carrying a bearer JWT in the header
 *      AND as a token query parameter; after stop, the session file
 *      parses (header → record lines → honest trailer), carries the
 *      burst's projections with ONE stable marker across both
 *      positions, and the raw JWT appears NOWHERE in the file bytes.
 *   5. Bound trip: a session with a tiny byte bound STOPS itself
 *      (`size-bound` in its status and trailer) — never a silent
 *      truncate-and-continue — and the indicator converges off.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
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
// Port etiquette: fresh port off every prior suite (ledger through 20637).
const DAEMON_PORT = 20737;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/capture-session.html';

// The planted secret: the SAME JWT rides the Authorization header of
// every probe and the final probe's token query parameter — one value,
// two positions, so the on-disk marker algebra can be asserted.
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtY2FwdHVyZSIsIm5hbWUiOiJPcGVuIEhlYWRlcnMifQ.ZTJlLWNhcHR1cmUtc2lnbmF0dXJlLTAxMjM0NTY3ODlhYmNkZWY';
const MARKER = /\[redacted:[0-9a-f]{8}\]/;

interface CaptureSessionRow {
  sessionId: string;
  sourceUid: string;
  name: string;
  redaction: string;
  filePath: string;
  bounds: { maxBytes: number; maxDurationMs: number };
  recordLines: number;
  bytesWritten: number;
  state: string;
  endReason?: string;
}

interface CaptureLine {
  kind: string;
  reason?: string;
  redaction?: string;
  recordFold?: string;
  record?: {
    requestId: string;
    url: string;
    requestHeaders?: Array<{ name: string; value: string }>;
  };
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let capturePage: Page;
let userData: string;
let capturesDir: string;
let peerNodeId: string;
let captureTabId: number;
let armedUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-capture-e2e-backend',
  recordLabel: 'agent-traffic capture e2e desktop',
  logTag: 'agent-traffic-capture setup',
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

async function parseSessionFile(filePath: string): Promise<CaptureLine[]> {
  const raw = await readFile(filePath, 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CaptureLine);
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function openTrafficMonitor(): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

/** The rail refresh re-reads the tab inventory AND the armed/capture
 *  state — the poll cadence is 15 s, so the specs converge via clicks. */
async function refreshRail(): Promise<void> {
  await workbench.locator('[data-testid="traffic-monitor-refresh"]').first().click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-capture-e2e-'));
  capturesDir = path.join(userData, 'data', 'traffic-captures');
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-capture-e2e' })) as {
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

  capturePage = await context.newPage();
  await capturePage.goto(PAGE_URL);
  // Background the playground tab so every request in the watched
  // partition is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory gate + arm ────────────────────────────────────────────

test('the daemon inventories the capture page; arming it succeeds', async () => {
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
            captureTabId = tab.tabId;
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
    tabId: captureTabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  armedUid = armed.uid ?? '';

  // The subscribe round-trips through the extension; wait for the row.
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
});

// ── Refusal: no redaction policy, no file ───────────────────────────

test('a capture start without a redaction policy is refused and writes nothing', async () => {
  const refused = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'no-policy attempt',
  })) as { ok: boolean; error?: string };
  expect(refused.ok).toBe(false);
  expect(refused.error ?? '').toContain('redaction');

  expect(await captureSessions()).toEqual([]);
  // The captures directory was never even created — refusal happens
  // before any disk touch.
  await expect(readdir(capturesDir)).rejects.toThrow();
});

// ── Start + the retention indicator ─────────────────────────────────

test('an explicit policy starts the session and the Traffic Monitor shows "capturing to disk"', async () => {
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'e2e capture',
    redaction: 'standard',
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);
  expect(started.session?.state).toBe('active');
  expect(started.session?.redaction).toBe('standard');
  expect(started.session?.filePath.startsWith(capturesDir)).toBe(true);

  // The operator status lists the active session; the source status
  // row carries it for the UI.
  const sessions = await captureSessions();
  expect(sessions.map((s) => s.sessionId)).toEqual([started.session?.sessionId]);
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: Array<{ uid: string; capture?: { sessionId: string } }>;
  };
  expect(sources.find((s) => s.uid === armedUid)?.capture?.sessionId).toBe(started.session?.sessionId);

  // The retention indicator: visible in the Traffic Monitor the whole
  // time the session runs — header badge + per-row mark (PLAN §3).
  await openTrafficMonitor();
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-capturing"]')).toBeVisible({ timeout: 10000 });
  await expect(workbench.locator('[data-testid="traffic-monitor-source-capturing"]').first()).toBeVisible({
    timeout: 10000,
  });
});

// ── Secrets nowhere ON DISK — the slice's highest-value assertion ───

test('the session file holds redacted projections only; the raw secret appears nowhere in its bytes', async () => {
  await capturePage.evaluate(
    async (options) => {
      await (
        window as unknown as { __ohFireCaptureBurst(o: { jwt: string; count: number }): Promise<number> }
      ).__ohFireCaptureBurst(options);
    },
    { jwt: JWT, count: 4 },
  );

  // The burst's seam events land as appended lines.
  await expect
    .poll(async () => (await captureSessions())[0]?.recordLines ?? 0, { timeout: 15000 })
    .toBeGreaterThanOrEqual(4);

  const stopped = (await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid })) as unknown as {
    ok: boolean;
    session: CaptureSessionRow | null;
  };
  expect(stopped.ok).toBe(true);
  expect(stopped.session?.state).toBe('stopped');
  expect(stopped.session?.endReason).toBe('stopped');

  const raw = await readFile(stopped.session?.filePath ?? '', 'utf8');
  // THE assertion: the planted secret appears NOWHERE on disk.
  expect(raw).not.toContain(JWT);
  expect(raw).toMatch(MARKER);

  const lines = await parseSessionFile(stopped.session?.filePath ?? '');
  expect(lines[0]?.kind).toBe('header');
  expect(lines[0]?.redaction).toBe('standard');
  expect(lines[0]?.recordFold).toContain('last-wins');
  const trailer = lines[lines.length - 1];
  expect(trailer?.kind).toBe('end');
  expect(trailer?.reason).toBe('stopped');

  const records = lines.filter((l) => l.kind === 'record');
  expect(records.length).toBe(stopped.session?.recordLines);
  const probeRecords = records.filter((l) => l.record?.url.includes('/echo/capture'));
  expect(probeRecords.length).toBeGreaterThanOrEqual(4);

  // Marker algebra inside the file: the Authorization header's marker
  // is the SAME marker the query position carries — one value, one
  // marker, across positions, without the secret.
  const authValue = probeRecords
    .flatMap((l) => l.record?.requestHeaders ?? [])
    .find((h) => h.name.toLowerCase() === 'authorization')?.value;
  expect(authValue).toBeDefined();
  const marker = (authValue ?? '').replace(/^Bearer /, '');
  expect(marker).toMatch(/^\[redacted:[0-9a-f]{8}\]$/);
  const queryRecord = probeRecords.find((l) => l.record?.url.includes('access_token='));
  expect(queryRecord?.record?.url).toContain(`access_token=${marker}`);

  // A stopped session drops off the source row; the ended list keeps it.
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: Array<{ uid: string; capture?: unknown }>;
  };
  expect(sources.find((s) => s.uid === armedUid)?.capture).toBeUndefined();
});

// ── Bound trip: the session stops itself, honestly ──────────────────

test('a tripped byte bound stops the session with the honest reason and the indicator converges off', async () => {
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'tiny bound',
    redaction: 'standard',
    maxBytes: 2048,
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);

  await capturePage.evaluate(
    async (options) => {
      await (
        window as unknown as { __ohFireCaptureBurst(o: { jwt: string; count: number }): Promise<number> }
      ).__ohFireCaptureBurst(options);
    },
    { jwt: JWT, count: 4 },
  );

  await expect
    .poll(async () => (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId)?.state, {
      timeout: 15000,
    })
    .toBe('stopped');
  const session = (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId);
  expect(session?.endReason).toBe('size-bound');
  // Record lines never cross the bound; only the honest trailer may.
  expect(session?.bytesWritten).toBeLessThanOrEqual(2048 + 256);

  const lines = await parseSessionFile(session?.filePath ?? '');
  const trailer = lines[lines.length - 1];
  expect(trailer?.kind).toBe('end');
  expect(trailer?.reason).toBe('size-bound');
  const raw = await readFile(session?.filePath ?? '', 'utf8');
  expect(raw).not.toContain(JWT);

  // The indicator converges off once nothing captures.
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-capturing"]')).toHaveCount(0, { timeout: 10000 });
});
