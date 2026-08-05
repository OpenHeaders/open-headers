/**
 * Agent traffic C3 E2E — the sessions archive against the real
 * dual-app stack (AGENT_TRAFFIC_PLAN.md §11.6 `agent-traffic/
 * session-archive`; supersedes the retired v1 `capture-session` page
 * and its "no raw on disk" pin — §11.5 inverted that law).
 *
 *   1. Launch the built desktop app isolated on a fresh daemon port;
 *      launch Chromium with the built extension and open the
 *      session-archive generator page. Arm that tab and pin it to CDP
 *      fidelity (eager body pulls need a debug-fed partition).
 *   2. Start + retention indicator: the start gesture alone opens the
 *      session (no write-time redaction policy exists in v2 — the
 *      gesture IS the durable-capture consent); the operator status
 *      lists it `recording`; the Traffic Monitor shows the indicator
 *      the whole time it runs.
 *   3. Raw at rest, ciphertext on disk (the slice's highest-value
 *      assertion): the armed tab fires a burst carrying a bearer JWT
 *      in the header AND as a token query parameter; after stop the
 *      session seals — `meta.json` is honest (formatVersion 2,
 *      encrypted, lifecycle plane, cdp fidelity), the plain log is
 *      gone, and the planted JWT appears NOWHERE in the archive's
 *      on-disk bytes (§9.5 encryption at seal), while the session
 *      projection proves the requests were recorded at full count.
 *   4. CAS dedup (§11.4): two sessions record the SAME 16 KB
 *      deterministic asset — the blob store holds ONE artifact, both
 *      session manifests reference the same digest.
 *   5. Bound trip: a session with a tiny log bound STOPS itself
 *      (`size-bound`) — never a silent truncate-and-continue — and
 *      the indicator converges off.
 *   6. Workbench gesture (C4 — one gesture, one bundle): from a cold
 *      posture the popover's single start verb arms, attaches CDP
 *      debug, and opens a recording session per the Advanced toggles
 *      (seeded from their Settings defaults); the single stop verb
 *      seals the session 'stopped', disarms, and restores the debug
 *      state the start gesture found.
 *   7. Sessions section (C4 — live state only): sealed sessions leave
 *      the rail (no rows, no reveal-in-folder — disk location is an
 *      abstraction); an active session shows one live row whose stop
 *      seals it, after which the row retires.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
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
// Port etiquette: this spec keeps its S7 port (ledger through 20937).
const DAEMON_PORT = 20737;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/session-archive.html';

// The planted secret: the SAME JWT rides the Authorization header of
// every probe and the final probe's token query parameter — one value,
// two positions. In v2 it IS recorded (raw at rest) — the disk-level
// assertion is that no archive file ever carries it as plaintext.
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtY2FwdHVyZSIsIm5hbWUiOiJPcGVuIEhlYWRlcnMifQ.ZTJlLWNhcHR1cmUtc2lnbmF0dXJlLTAxMjM0NTY3ODlhYmNkZWY';

interface CaptureSessionRow {
  sessionId: string;
  sourceUid: string;
  name: string;
  dirPath: string;
  bounds: { maxBytes: number; maxDurationMs: number };
  planes: string[];
  requests: number;
  events: number;
  bytesWritten: number;
  encrypted: boolean;
  state: string;
  endReason?: string;
}

interface SessionMetaFile {
  formatVersion: number;
  sessionId: string;
  state: string;
  encrypted: boolean;
  planes: string[];
  fidelity: string;
  requests: number;
  events: number;
  endReason?: string;
  origins: string[];
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let archivePage: Page;
let userData: string;
let archiveDir: string;
let peerNodeId: string;
let archiveTabId: number;
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

async function readSessionMeta(dirPath: string): Promise<SessionMetaFile> {
  return JSON.parse(await readFile(path.join(dirPath, 'meta.json'), 'utf8')) as SessionMetaFile;
}

/** Every file under the archive root, recursively. */
async function archiveFiles(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    const full = path.join(dir, name);
    if ((await stat(full)).isDirectory()) out.push(...(await archiveFiles(full)));
    else out.push(full);
  }
  return out;
}

/** Digest lines of one session's blob manifest. */
async function manifestDigests(dirPath: string): Promise<string[]> {
  const raw = await readFile(path.join(dirPath, 'blobs.manifest'), 'utf8');
  return raw
    .split('\n')
    .map((line) => line.split(' ')[0] ?? '')
    .filter((digest) => digest.length === 64);
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

async function fireSecretBurst(count: number): Promise<void> {
  await archivePage.evaluate(
    async (options) => {
      await (
        window as unknown as { __ohFireSecretBurst(o: { jwt: string; count: number }): Promise<number> }
      ).__ohFireSecretBurst(options);
    },
    { jwt: JWT, count },
  );
}

async function fetchFixedAsset(): Promise<void> {
  await archivePage.evaluate(async () => {
    await (
      window as unknown as { __ohFetchFixedAsset(o: { name: string; bytes: number }): Promise<number> }
    ).__ohFetchFixedAsset({ name: 'bundle', bytes: 16_384 });
  });
}

/** Poll one session row until it reports `sealed`. */
async function waitSealed(sessionId: string): Promise<CaptureSessionRow> {
  await expect
    .poll(async () => (await captureSessions()).find((s) => s.sessionId === sessionId)?.state, { timeout: 20000 })
    .toBe('sealed');
  const session = (await captureSessions()).find((s) => s.sessionId === sessionId);
  if (session === undefined) throw new Error(`session ${sessionId} vanished from the status surface`);
  return session;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-capture-e2e-'));
  archiveDir = path.join(userData, 'data', 'traffic-sessions');
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

  archivePage = await context.newPage();
  await archivePage.goto(PAGE_URL);
  // Background the playground tab so every request in the watched
  // partition is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory gate + arm + CDP fidelity ─────────────────────────────

test('the daemon inventories the archive page; arming and CDP-pinning it succeeds', async () => {
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
            archiveTabId = tab.tabId;
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
    tabId: archiveTabId,
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
    command: { kind: 'pin', tabId: archiveTabId, pinned: true },
  });
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; debug: { attachedTabs: number[] } }>;
        };
        const peer = (peers ?? []).find((p) => p.nodeId === peerNodeId);
        return peer?.debug.attachedTabs.includes(archiveTabId) ?? false;
      },
      { timeout: 20000 },
    )
    .toBe(true);
});

// ── Start + the retention indicator ─────────────────────────────────

test('the start gesture opens the session and the Traffic Monitor shows the recording indicator', async () => {
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'e2e archive',
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);
  expect(started.session?.state).toBe('recording');
  expect(started.session?.planes).toEqual(['lifecycle']);
  expect(started.session?.dirPath.startsWith(archiveDir)).toBe(true);

  // The operator status lists the recording session; the source status
  // row carries it for the UI.
  const sessions = await captureSessions();
  expect(sessions.map((s) => s.sessionId)).toEqual([started.session?.sessionId]);
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: Array<{ uid: string; capture?: { sessionId: string } }>;
  };
  expect(sources.find((s) => s.uid === armedUid)?.capture?.sessionId).toBe(started.session?.sessionId);

  // The retention indicator: visible in the Traffic Monitor the whole
  // time the session runs — the per-row red eye (PLAN §3; the header
  // chip retired in C4, transparency lives in the row state).
  await openTrafficMonitor();
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-source-capturing"]').first()).toBeVisible({
    timeout: 10000,
  });
});

// ── Raw at rest, ciphertext on disk — the slice's highest-value pin ─

test('the sealed archive records full fidelity yet the planted secret is plaintext nowhere on disk', async () => {
  await fireSecretBurst(4);

  // The burst lands as recorded requests (started events).
  await expect
    .poll(async () => (await captureSessions())[0]?.requests ?? 0, { timeout: 15000 })
    .toBeGreaterThanOrEqual(4);

  const stopped = (await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid })) as unknown as {
    ok: boolean;
    session: CaptureSessionRow | null;
  };
  expect(stopped.ok).toBe(true);
  expect(stopped.session?.endReason).toBe('stopped');

  // The seal completes in the background; the ended list projects it.
  const sealed = await waitSealed(stopped.session?.sessionId ?? '');
  expect(sealed.encrypted).toBe(true);
  expect(sealed.requests).toBeGreaterThanOrEqual(4);

  // meta.json is the honest boot-scan row.
  const meta = await readSessionMeta(sealed.dirPath);
  expect(meta.formatVersion).toBe(2);
  expect(meta.state).toBe('sealed');
  expect(meta.encrypted).toBe(true);
  expect(meta.planes).toEqual(['lifecycle']);
  expect(meta.fidelity).toBe('cdp');
  expect(meta.endReason).toBe('stopped');
  expect(meta.origins).toContain('http://127.0.0.1:3000');

  // The plain log retired with the seal; the sealed artifact stands.
  const files = await archiveFiles(sealed.dirPath);
  expect(files.some((f) => f.endsWith('events.seal'))).toBe(true);
  expect(files.some((f) => f.endsWith('events.jsonl'))).toBe(false);

  // THE assertion, inverted from v1: the secret IS recorded (raw at
  // rest — the projection above counted its requests), yet no file
  // anywhere in the archive carries it as plaintext (§9.5).
  for (const file of await archiveFiles(archiveDir)) {
    const bytes = await readFile(file);
    expect(bytes.includes(Buffer.from(JWT, 'utf8')), `plaintext secret leaked into ${file}`).toBe(false);
  }

  // A stopped session drops off the source row; the ended list keeps it.
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: Array<{ uid: string; capture?: unknown }>;
  };
  expect(sources.find((s) => s.uid === armedUid)?.capture).toBeUndefined();
});

// ── CAS dedup: one payload, two sessions, ONE blob ──────────────────

test('two sessions recording the same asset share one content-addressed blob', async () => {
  const blobsDir = path.join(archiveDir, 'blobs');
  const blobsBefore = (await archiveFiles(blobsDir)).length;

  const dirs: string[] = [];
  const blobCounts: number[] = [];
  for (const name of ['dedup a', 'dedup b']) {
    const started = (await invoke({
      type: 'oh.daemon.traffic.capture.start',
      uid: armedUid,
      name,
    })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
    expect(started.ok, started.error).toBe(true);
    await fetchFixedAsset();
    // The 16 KB body externalizes only once its completion pull
    // answers — wait for the session's manifest to name the digest.
    await expect
      .poll(async () => (await manifestDigests(started.session?.dirPath ?? '').catch(() => [])).length, {
        timeout: 15000,
      })
      .toBeGreaterThanOrEqual(1);
    await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid });
    const sealed = await waitSealed(started.session?.sessionId ?? '');
    dirs.push(sealed.dirPath);
    blobCounts.push((await archiveFiles(blobsDir)).length);
  }

  // Both manifests name the SAME digest, and the second session added
  // ZERO new artifacts — the §11.4 store-once claim, end to end.
  const [digestsA, digestsB] = [await manifestDigests(dirs[0] ?? ''), await manifestDigests(dirs[1] ?? '')];
  expect(digestsA.length).toBeGreaterThanOrEqual(1);
  const shared = digestsA.filter((d) => digestsB.includes(d));
  expect(shared.length).toBeGreaterThanOrEqual(1);
  expect(blobCounts[0] ?? 0).toBeGreaterThan(blobsBefore);
  expect(blobCounts[1]).toBe(blobCounts[0]);
});

// ── Bound trip: the session stops itself, honestly ──────────────────

test('a tripped log bound stops the session with the honest reason and the indicator converges off', async () => {
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'tiny bound',
    maxBytes: 2048,
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);

  await fireSecretBurst(4);

  const session = await waitSealed(started.session?.sessionId ?? '');
  expect(session.endReason).toBe('size-bound');
  // Event lines never cross the bound; only the honest trailer may.
  expect(session.bytesWritten).toBeLessThanOrEqual(2048 + 256);

  // The indicator converges off once nothing records — the eye drops
  // back to its armed (non-capturing) identity.
  await openTrafficMonitor();
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-source-capturing"]')).toHaveCount(0, {
    timeout: 10000,
  });
});

// ── The Workbench affordance: one gesture, one bundle (C4) ──────────

test('the popover start bundles arm + debug + record, and the single stop unwinds it', async () => {
  // Reset to a COLD posture: disarm the operator-plane arm and drop
  // the leg-1 debug enable/pin — the auto-debug proof needs the start
  // gesture to be what re-creates all of it.
  await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid });
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'pin', tabId: archiveTabId, pinned: false },
  });
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'enable', enabled: false },
  });
  const debugState = async (): Promise<{ enabled: boolean; attached: boolean }> => {
    const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
      peers?: Array<{ nodeId: string; debug: { enabled: boolean; attachedTabs: number[] } }>;
    };
    const peer = (peers ?? []).find((p) => p.nodeId === peerNodeId);
    return {
      enabled: peer?.debug.enabled ?? false,
      attached: peer?.debug.attachedTabs.includes(archiveTabId) ?? false,
    };
  };
  await expect
    .poll(async () => JSON.stringify(await debugState()), { timeout: 20000 })
    .toBe(JSON.stringify({ enabled: false, attached: false }));

  await openTrafficMonitor();
  await refreshRail();
  const before = (await captureSessions()).length;

  // The idle eye opens the popover: ONE primary verb, with the two
  // bundled toggles under Advanced, seeded ON from their Settings
  // defaults (`trafficMonitor.observe{Debug,Save}Default`).
  const row = workbench.locator('[data-testid="traffic-monitor-source-tab"]', { hasText: 'Session archive' }).first();
  await row.hover();
  await row.locator('[data-testid="traffic-monitor-source-observe"]').click();
  await expect(workbench.locator('[data-testid="traffic-monitor-observe-start"]')).toBeVisible({ timeout: 10000 });
  await workbench.locator('[data-testid="traffic-monitor-observe-advanced"]').click();
  await expect(workbench.locator('[data-testid="traffic-monitor-observe-debug"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(workbench.locator('[data-testid="traffic-monitor-observe-save"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Start: the bundle arms the source, attaches the browser debugger,
  // and opens a recording session — the gesture IS the consent.
  await workbench.locator('[data-testid="traffic-monitor-observe-start"]').click();
  await expect
    .poll(async () => (await captureSessions()).find((s) => s.state === 'recording')?.sessionId ?? '', {
      timeout: 20000,
    })
    .not.toBe('');
  const active = (await captureSessions()).find((s) => s.state === 'recording');
  expect(active?.name.length).toBeGreaterThan(0);
  await expect.poll(async () => (await debugState()).attached, { timeout: 20000 }).toBe(true);

  // The eye became the always-visible retention indicator (red state).
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-source-capturing"]').first()).toBeVisible({
    timeout: 10000,
  });

  // The single stop unwinds the whole bundle: the session seals with
  // the honest 'stopped' (stop BEFORE disarm), the source disarms, and
  // the debug state restores to the cold posture the start found.
  await workbench.locator('[data-testid="traffic-monitor-source-capturing"]').first().click();
  await workbench.locator('[data-testid="traffic-monitor-observe-stop"]').click();
  const ended = await waitSealed(active?.sessionId ?? '');
  expect(ended.endReason).toBe('stopped');
  expect((await captureSessions()).length).toBe(before + 1);
  await expect(workbench.locator('[data-testid="traffic-monitor-source-observe"][aria-pressed="true"]')).toHaveCount(
    0,
    { timeout: 10000 },
  );
  await expect
    .poll(async () => JSON.stringify(await debugState()), { timeout: 20000 })
    .toBe(JSON.stringify({ enabled: false, attached: false }));

  // Re-arm for the legs that follow (the sessions section stops a
  // session on this uid).
  const rearmed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: archiveTabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(rearmed.ok, rearmed.error).toBe(true);
  armedUid = rearmed.uid ?? '';
});

// ── The SESSIONS rail section: live state only (C4) ─────────────────

test('the Sessions section shows live recordings only and its stop retires the row', async () => {
  await openTrafficMonitor();
  await refreshRail();

  // Every prior leg's session is sealed — sealed sessions leave the
  // rail (live state only; browsing the archive is the C5 window),
  // and the reveal-in-folder affordance retired with the chip (disk
  // location is an abstraction).
  const sessions = await captureSessions();
  expect(sessions.length).toBeGreaterThanOrEqual(4);
  expect(sessions.every((s) => s.state === 'sealed')).toBe(true);
  await expect(workbench.locator('[data-testid="traffic-monitor-session-row"]')).toHaveCount(0, { timeout: 10000 });
  expect(await workbench.locator('[data-testid="traffic-monitor-session-reveal"]').count()).toBe(0);
  await expect(workbench.locator('[data-testid="traffic-monitor-sessions-empty"]')).toBeVisible();

  // An active session appears as the one live row; its stop seals it
  // and the row retires once sealed.
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'sessions-section stop',
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-session-row"]')).toHaveCount(1, { timeout: 10000 });
  const stop = workbench.locator('[data-testid="traffic-monitor-session-stop"]');
  await expect(stop).toBeVisible({ timeout: 10000 });
  await stop.click();
  const ended = await waitSealed(started.session?.sessionId ?? '');
  expect(ended.endReason).toBe('stopped');
  await refreshRail();
  await expect(workbench.locator('[data-testid="traffic-monitor-session-row"]')).toHaveCount(0, { timeout: 10000 });
});
