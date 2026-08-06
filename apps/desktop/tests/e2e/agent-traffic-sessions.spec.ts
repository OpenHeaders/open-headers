/**
 * Agent traffic C5 E2E — the Traffic Sessions tool window against the
 * real dual-app stack (AGENT_TRAFFIC_PLAN.md §11.6 `agent-traffic/
 * sessions-window` + the inherited `session-gc` page the C5 delete
 * verb unlocked).
 *
 *   1. Launch the built desktop app isolated on a fresh daemon port;
 *      launch Chromium with the built extension and open the
 *      sessions-window generator page. Arm that tab and pin it to CDP
 *      fidelity.
 *   2. Auto-name + auto-placement on create (§11.1): a recorded
 *      OK/error probe mix seals with the stamped
 *      `<site> — <date time> (<n> requests, <m> errors)` name and the
 *      dominant-origin folder (the loopback host passes through the
 *      registrable-domain heuristic verbatim), and the archive-wide
 *      operator read (`sessions.list`) projects it with the
 *      directory-basename id.
 *   3. The window lists the archive: rows under their folder header,
 *      newest-first by default, sort flips the order, and search
 *      filters down to the honest empty state.
 *   4. Reorganize rewrites ONE meta only: rename and refile through
 *      the window's menu verbs change `meta.json` alone — the sealed
 *      log is byte-identical after both, and a bystander session's
 *      meta is untouched; search finds the new name; the detail strip
 *      renders for the selected row.
 *   5. Reachability GC through the delete verb (`session-gc` page):
 *      two sessions record overlapping deterministic assets; deleting
 *      one through the window sweeps its EXCLUSIVE blob and spares the
 *      shared one (§11.4 manifest-union reachability). Budget pruning
 *      stays unit-pinned — the Settings floor is 1 GiB by design, no
 *      e2e-sized knob exists.
 *   6. The rail's go-to: the Traffic Monitor SESSIONS header opens the
 *      Traffic Sessions window; a recording session's row carries the
 *      live state tag until sealed.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
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
// Port etiquette: fresh port for a new daemon spec (ledger through 20937).
const DAEMON_PORT = 21037;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const WINDOW_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/sessions-window.html';
const GC_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/session-gc.html';

/** The loopback host passes through the registrable-domain heuristic
 *  verbatim — the deterministic auto-placement folder for every
 *  playground-origin session. */
const LOOPBACK_SITE = '127.0.0.1';

interface CaptureSessionRow {
  sessionId: string;
  sourceUid: string;
  name: string;
  dirPath: string;
  requests: number;
  state: string;
  endReason?: string;
}

interface ArchivedSessionRow {
  id: string;
  sessionId: string;
  name: string;
  folder?: string;
  sourceKind: string;
  state: string;
  requests: number;
  errors: number;
  sizeBytes: number;
  encrypted: boolean;
  fidelity: string;
  origins: string[];
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let windowPage: Page;
let gcPage: Page | undefined;
let userData: string;
let archiveDir: string;
let peerNodeId: string;
let windowTabId: number;
let armedUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-sessions-e2e-backend',
  recordLabel: 'agent-traffic sessions e2e desktop',
  logTag: 'agent-traffic-sessions setup',
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

/** Digest lines of one session's blob manifest. */
async function manifestDigests(dirPath: string): Promise<string[]> {
  const raw = await readFile(path.join(dirPath, 'blobs.manifest'), 'utf8');
  return raw
    .split('\n')
    .map((line) => line.split(' ')[0] ?? '')
    .filter((digest) => digest.length === 64);
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function openToolWindow(id: 'traffic-monitor' | 'traffic-sessions'): Promise<void> {
  const tab = workbench.locator(`[data-tool-window="${id}"]`).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

/** The window's poll cadence is 15 s — the specs converge via clicks. */
async function refreshWindow(): Promise<void> {
  await workbench.locator('[data-testid="traffic-sessions-refresh"]').first().click();
}

function windowRow(id: string): ReturnType<Page['locator']> {
  return workbench.locator(`[data-testid="traffic-sessions-row"][data-session-id="${id}"]`);
}

/** antd Input renders the testid on the input OR an affix wrapper —
 *  the dual selector covers both (the login-gate idiom). */
function windowSearch(): ReturnType<Page['locator']> {
  return workbench
    .locator('input[data-testid="traffic-sessions-search"], [data-testid="traffic-sessions-search"] input')
    .first();
}

async function openRowMenu(id: string): Promise<void> {
  await windowRow(id).locator('[data-testid="traffic-sessions-row-menu"]').click();
}

async function fireSessionTraffic(ok: number, errors: number): Promise<void> {
  await windowPage.evaluate(
    async (options) => {
      await (
        window as unknown as { __ohFireSessionTraffic(o: { ok: number; errors: number }): Promise<number> }
      ).__ohFireSessionTraffic(options);
    },
    { ok, errors },
  );
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

/** Record one probe-mix session on the armed source and seal it. */
async function recordMixSession(name: string, ok: number, errors: number): Promise<CaptureSessionRow> {
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name,
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);
  await fireSessionTraffic(ok, errors);
  await expect
    .poll(
      async () => (await captureSessions()).find((s) => s.sessionId === started.session?.sessionId)?.requests ?? 0,
      { timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(ok + errors);
  await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid });
  return waitSealed(started.session?.sessionId ?? '');
}

/** The archive row for a per-run sessionId (poll until listed sealed). */
async function archivedRowOf(sessionId: string): Promise<ArchivedSessionRow> {
  await expect
    .poll(async () => (await archivedSessions()).find((r) => r.sessionId === sessionId)?.state, { timeout: 15000 })
    .toBe('sealed');
  const row = (await archivedSessions()).find((r) => r.sessionId === sessionId);
  if (row === undefined) throw new Error(`session ${sessionId} missing from the archive index`);
  return row;
}

let sessionOne: ArchivedSessionRow;
let sessionTwo: ArchivedSessionRow;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-sessions-e2e-'));
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-sessions-e2e' })) as {
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

  windowPage = await context.newPage();
  await windowPage.goto(WINDOW_PAGE_URL);
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
          const tab = peer.tabs.find((t) => t.url.startsWith(WINDOW_PAGE_URL));
          if (tab) {
            peerNodeId = peer.nodeId;
            windowTabId = tab.tabId;
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
    tabId: windowTabId,
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
    command: { kind: 'pin', tabId: windowTabId, pinned: true },
  });
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; debug: { attachedTabs: number[] } }>;
        };
        const peer = (peers ?? []).find((p) => p.nodeId === peerNodeId);
        return peer?.debug.attachedTabs.includes(windowTabId) ?? false;
      },
      { timeout: 20000 },
    )
    .toBe(true);
});

// ── Auto-name + auto-placement on create (§11.1) ────────────────────

test('a sealed session carries the stamped auto-name and dominant-origin folder in the archive index', async () => {
  const first = await recordMixSession('raw start name one', 3, 1);
  sessionOne = await archivedRowOf(first.sessionId);

  // The §11.1 stamp: `<site> — <date time> (<n> requests, <m> errors)`
  // — the operator's start name is superseded at seal, and the folder
  // is the dominant origin's registrable domain.
  expect(sessionOne.folder).toBe(LOOPBACK_SITE);
  expect(sessionOne.name).toMatch(
    new RegExp(
      `^${LOOPBACK_SITE.replaceAll('.', '\\.')} — \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2} \\(\\d+ requests, \\d+ errors\\)$`,
    ),
  );
  expect(sessionOne.errors).toBeGreaterThanOrEqual(1);
  expect(sessionOne.requests).toBeGreaterThanOrEqual(4);
  expect(sessionOne.state).toBe('sealed');
  expect(sessionOne.sourceKind).toBe('browser-tab');
  expect(sessionOne.fidelity).toBe('cdp');
  expect(sessionOne.origins).toContain('http://127.0.0.1:3000');
  expect(sessionOne.sizeBytes).toBeGreaterThan(0);
  // The archive-wide identity is the directory basename — stamp-first
  // and collision-proof across runs, unlike the per-run `cap-<seq>`.
  expect(sessionOne.id.endsWith(`-${sessionOne.sessionId}`)).toBe(true);
  const meta = JSON.parse(await readFile(path.join(archiveDir, 'sessions', sessionOne.id, 'meta.json'), 'utf8')) as {
    name: string;
    folder?: string;
    errors: number;
  };
  expect(meta.name).toBe(sessionOne.name);
  expect(meta.folder).toBe(LOOPBACK_SITE);
  expect(meta.errors).toBe(sessionOne.errors);

  // A second, error-free session — the bystander for the organize leg
  // and the second row the sort/search pins need.
  const second = await recordMixSession('raw start name two', 2, 0);
  sessionTwo = await archivedRowOf(second.sessionId);
  expect(sessionTwo.folder).toBe(LOOPBACK_SITE);
});

// ── The window lists the archive: folders, sort, search ─────────────

test('the Traffic Sessions window groups rows by folder, sorts, and searches', async () => {
  await openToolWindow('traffic-sessions');
  await refreshWindow();

  // Both sealed sessions render under their auto-placement folder.
  await expect(
    workbench.locator(`[data-testid="traffic-sessions-folder"][data-folder="${LOOPBACK_SITE}"]`),
  ).toBeVisible({ timeout: 10000 });
  await expect(windowRow(sessionOne.id)).toBeVisible();
  await expect(windowRow(sessionTwo.id)).toBeVisible();

  // Newest first by default; oldest-first flips the order.
  const rowIds = async (): Promise<string[]> =>
    workbench
      .locator('[data-testid="traffic-sessions-row"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-session-id') ?? ''));
  expect((await rowIds())[0]).toBe(sessionTwo.id);
  await workbench.locator('[data-testid="traffic-sessions-sort"]').click();
  await workbench
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="Oldest first"]')
    .click();
  expect((await rowIds())[0]).toBe(sessionOne.id);

  // Search: a non-matching needle answers the honest filtered-empty
  // state, never a bare void; clearing restores the rows.
  await windowSearch().fill('no-such-session-zzz');
  await expect(workbench.locator('[data-testid="traffic-sessions-empty-filtered"]')).toBeVisible();
  await expect(workbench.locator('[data-testid="traffic-sessions-row"]')).toHaveCount(0);
  await windowSearch().fill('');
  await expect(workbench.locator('[data-testid="traffic-sessions-row"]')).toHaveCount(2);
});

// ── Organize verbs rewrite ONE meta only ────────────────────────────

test('rename and refile rewrite the session meta alone; search finds the new name; the detail strip renders', async () => {
  const sealPath = path.join(archiveDir, 'sessions', sessionOne.id, 'events.seal');
  const bystanderMetaPath = path.join(archiveDir, 'sessions', sessionTwo.id, 'meta.json');
  const sealBefore = await readFile(sealPath);
  const bystanderBefore = await readFile(bystanderMetaPath, 'utf8');

  // Rename through the row menu.
  await openRowMenu(sessionOne.id);
  await workbench.locator('[data-testid="traffic-sessions-menu-rename"]').click();
  await workbench.locator('[data-testid="traffic-sessions-rename-input"]').fill('Checkout repro');
  await workbench.locator('[data-testid="traffic-sessions-rename-ok"]').click();
  await expect(windowRow(sessionOne.id)).toContainText('Checkout repro', { timeout: 10000 });

  // Refile into a new folder. Open the submenu by CLICKING its title
  // (antd toggles parent items on click) — hover-opening flaps shut
  // while the pointer traverses to the child now that the C6 Open verb
  // sits above it — and wait for the child before clicking it.
  await openRowMenu(sessionOne.id);
  await workbench.locator('[data-testid="traffic-sessions-menu-move"]').click();
  const moveNew = workbench.locator('[data-testid="traffic-sessions-menu-move-new"]');
  await expect(moveNew).toBeVisible({ timeout: 10000 });
  await moveNew.click();
  await workbench.locator('[data-testid="traffic-sessions-new-folder-input"]').fill('investigations');
  await workbench.locator('[data-testid="traffic-sessions-new-folder-ok"]').click();
  await expect(workbench.locator('[data-testid="traffic-sessions-folder"][data-folder="investigations"]')).toBeVisible({
    timeout: 10000,
  });

  // §11.4: organizing rewrote ONE meta atomically — the sealed log is
  // byte-identical and the bystander session's meta is untouched.
  const meta = JSON.parse(await readFile(path.join(archiveDir, 'sessions', sessionOne.id, 'meta.json'), 'utf8')) as {
    name: string;
    folder?: string;
  };
  expect(meta.name).toBe('Checkout repro');
  expect(meta.folder).toBe('investigations');
  expect((await readFile(sealPath)).equals(sealBefore)).toBe(true);
  expect(await readFile(bystanderMetaPath, 'utf8')).toBe(bystanderBefore);

  // Search matches the operator's new name.
  await windowSearch().fill('Checkout');
  await expect(workbench.locator('[data-testid="traffic-sessions-row"]')).toHaveCount(1);
  await windowSearch().fill('');

  // Row select → the detail strip renders the index facts.
  await windowRow(sessionOne.id).click();
  const detail = workbench.locator('[data-testid="traffic-sessions-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('requests');
});

// ── Reachability GC through the window's delete verb ────────────────

test('deleting a session sweeps its exclusive blobs and spares shared ones', async () => {
  // The GC generator page in its own armed + CDP-pinned tab.
  gcPage = await context?.newPage();
  if (gcPage === undefined) throw new Error('gc page failed to open');
  await gcPage.goto(GC_PAGE_URL);
  await (await harness.extensionPage()).bringToFront();
  let gcTabId = 0;
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        const tab = (peers ?? []).find((p) => p.nodeId === peerNodeId)?.tabs.find((t) => t.url.startsWith(GC_PAGE_URL));
        gcTabId = tab?.tabId ?? 0;
        return gcTabId !== 0;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: gcTabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  const gcUid = armed.uid ?? '';
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'pin', tabId: gcTabId, pinned: true },
  });
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; debug: { attachedTabs: number[] } }>;
        };
        return (peers ?? []).find((p) => p.nodeId === peerNodeId)?.debug.attachedTabs.includes(gcTabId) ?? false;
      },
      { timeout: 20000 },
    )
    .toBe(true);

  // Two sessions with overlapping asset sets: `shared` rides both
  // manifests, each `exclusive-*` rides exactly one.
  const fetchAssets = async (names: string[]): Promise<void> => {
    await gcPage?.evaluate(
      async (options) => {
        await (
          window as unknown as { __ohFetchAssets(o: { names: string[]; bytes: number }): Promise<number> }
        ).__ohFetchAssets(options);
      },
      { names, bytes: 16_384 },
    );
  };
  const recordAssetSession = async (names: string[]): Promise<CaptureSessionRow> => {
    const started = (await invoke({
      type: 'oh.daemon.traffic.capture.start',
      uid: gcUid,
      name: `gc ${names.join('+')}`,
    })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
    expect(started.ok, started.error).toBe(true);
    await fetchAssets(names);
    await expect
      .poll(async () => (await manifestDigests(started.session?.dirPath ?? '').catch(() => [])).length, {
        timeout: 15000,
      })
      .toBeGreaterThanOrEqual(names.length);
    await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: gcUid });
    return waitSealed(started.session?.sessionId ?? '');
  };

  const keeper = await recordAssetSession(['shared', 'exclusive-keep']);
  const victim = await recordAssetSession(['shared', 'exclusive-victim']);
  const keeperDigests = await manifestDigests(keeper.dirPath);
  const victimDigests = await manifestDigests(victim.dirPath);
  const sharedDigests = keeperDigests.filter((d) => victimDigests.includes(d));
  const exclusiveVictim = victimDigests.filter((d) => !keeperDigests.includes(d));
  expect(sharedDigests.length).toBeGreaterThanOrEqual(1);
  expect(exclusiveVictim.length).toBeGreaterThanOrEqual(1);

  const blobPath = (digest: string): string => path.join(archiveDir, 'blobs', digest.slice(0, 2), digest);
  const exists = async (p: string): Promise<boolean> =>
    stat(p).then(
      () => true,
      () => false,
    );
  for (const digest of [...sharedDigests, ...exclusiveVictim]) {
    expect(await exists(blobPath(digest))).toBe(true);
  }

  // Delete the victim through the window: menu → danger confirm.
  const victimRow = await archivedRowOf(victim.sessionId);
  await openToolWindow('traffic-sessions');
  await refreshWindow();
  await expect(windowRow(victimRow.id)).toBeVisible({ timeout: 10000 });
  await openRowMenu(victimRow.id);
  await workbench.locator('[data-testid="traffic-sessions-menu-delete"]').click();
  await workbench.locator('[data-testid="traffic-sessions-delete-ok"]').click();

  // §11.4 reachability: the exclusive blob sweeps with its session;
  // the shared blob survives through the keeper's manifest.
  await expect
    .poll(async () => (await archivedSessions()).some((r) => r.id === victimRow.id), { timeout: 15000 })
    .toBe(false);
  for (const digest of exclusiveVictim) {
    await expect.poll(async () => exists(blobPath(digest)), { timeout: 10000 }).toBe(false);
  }
  for (const digest of sharedDigests) {
    expect(await exists(blobPath(digest))).toBe(true);
  }
  expect(await exists(path.join(archiveDir, 'sessions', victimRow.id))).toBe(false);
  await refreshWindow();
  await expect(windowRow(victimRow.id)).toHaveCount(0, { timeout: 10000 });
});

// ── The rail's go-to + the live row posture ─────────────────────────

test('the SESSIONS header go-to opens the window, and a recording row carries the live tag until sealed', async () => {
  await openToolWindow('traffic-monitor');
  await workbench.locator('[data-testid="traffic-monitor-sessions-goto"]').click();
  await expect(workbench.locator('[data-tool-window="traffic-sessions"]').first()).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 10000 },
  );

  // A recording session's archive row is visible with the live state
  // tag (its meta rides the recorder's slow persist cadence).
  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'live row',
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);
  await refreshWindow();
  await expect(workbench.locator('[data-testid="traffic-sessions-row-state"]')).toBeVisible({ timeout: 10000 });
  await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid });
  await waitSealed(started.session?.sessionId ?? '');
  await refreshWindow();
  await expect(workbench.locator('[data-testid="traffic-sessions-row-state"]')).toHaveCount(0, { timeout: 10000 });
});
