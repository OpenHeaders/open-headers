/**
 * Live Network E2E — the observability Phase-1 stream against the real
 * dual-app stack (OBSERVABILITY_PLAN.md Phase 1):
 *
 *   1. Launch the built desktop app with an isolated userData dir
 *      (OPENHEADERS_USER_DATA_DIR) on a non-default daemon port bound
 *      wide (`0.0.0.0`, for the off-device leg); mint a daemon token
 *      through the Workbench bridge.
 *   2. Launch Chromium with the built browser extension, point its
 *      backend registry at the app's daemon socket (loopback, so the
 *      telemetry privacy gate admits the wire) and open a playground
 *      tab.
 *   3. The `oh.daemon.telemetry.tabs.list` inventory reports the peer's
 *      tabs — the relay's request/response round-trip over the
 *      telemetry channels.
 *   4. The Live Network tool window watches the playground tab: traffic
 *      generated AFTER the pick streams live into the workbench grid
 *      (the first watch pins the session floor, so pre-watch history
 *      stays below it), and keeps streaming while watched.
 *   5. Closing and reopening the tool window rebuilds the view from the
 *      engine's replay — no fresh traffic needed.
 *   6. Row inspection opens a main editor tab that survives the tool
 *      window closing.
 *   7. A wire flap (backend record disabled → re-enabled) drops the
 *      stream but not the session floor: the relay's re-subscribe on
 *      reconnect rebuilds the view from replay INCLUDING the traffic
 *      the wire was down for — a flap degrades liveness, never
 *      fidelity.
 *   8. Terminating the extension service worker outright (CDP) and
 *      reviving it re-joins the wire and the live stream resumes.
 *   9. A second browser profile is a second peer: both inventories are
 *      listed, and its traffic never bleeds into the watched partition
 *      (peer-qualified partitions).
 *  10. Re-pointing the second peer at the machine's LAN address makes
 *      its wire non-loopback: telemetry frames are claimed and dropped
 *      (peer absent from the inventory) while the sync plane on the
 *      same wire keeps replicating — the privacy gate is telemetry-
 *      scoped, not a disconnect.
 *  11. Perf pin: a 300-request burst streams to the workbench (wall
 *      time logged for the STATUS ledger) and the grid stays
 *      virtualized (DOM row count bounded while data rows exceed it).
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

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: fresh port off every prior suite (ledger through 19738).
const DAEMON_PORT = 19837;
// MCP serves two jobs here: the engine-ready gate (401 poll) and the
// wire-alive proof of the privacy leg (a write that must still sync).
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';
const BURST_SIZE = 300;

interface TabsListResponse {
  peers?: Array<{ nodeId: string; agent: string; tabs: Array<{ tabId: number; url: string; title: string }> }>;
}

interface ExtensionPeer {
  context: BrowserContext;
  /** Lazily-(re)created extension page — always reach it via {@link peerPage}. */
  popup: Page | null;
  extensionId: string;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let peerA: ExtensionPeer | undefined;
let peerB: ExtensionPeer | undefined;
let playground: Page;
let playgroundB: Page;

/** First non-internal IPv4 — the honest off-device leg. Loopback
 * fallback keeps airgapped machines green (the privacy test skips). */
function lanIpv4(): string {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

/** The daemon-side tab inventory, read through the Workbench bridge. */
async function listTabs(): Promise<TabsListResponse> {
  return workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as {
      peers?: Array<{ nodeId: string; agent: string; tabs: Array<{ tabId: number; url: string; title: string }> }>;
    };
  });
}

/** Peers currently answering the telemetry inventory. */
async function peerCount(): Promise<number> {
  const { peers } = await listTabs();
  return (peers ?? []).length;
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

/** Pick the playground tab in the Traffic Monitor's source rail. */
async function pickPlaygroundTab(): Promise<void> {
  await workbench
    .locator('[data-testid="traffic-monitor-source-tab"]')
    .filter({ hasText: PLAYGROUND_TITLE })
    .first()
    .click();
}

/** Rows currently rendered for the echo probes. */
function echoRows() {
  return workbench.locator('.dt-row').filter({ hasText: 'echo' });
}

/** Launch a fresh extension profile — a distinct peer (fresh install
 * identity ⇒ fresh HELLO nodeId). */
async function launchExtensionPeer(): Promise<ExtensionPeer> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  const peer: ExtensionPeer = { context, popup: null, extensionId };
  await peerPage(peer);
  return peer;
}

/**
 * The peer's live extension page — created on demand, recreated when
 * the app kills it. It doubles as the MV3 keep-alive client and the
 * evaluation surface for every storage read/write. Nothing ever
 * evaluates in the WORKER context (MV3 restarts it at will; a dead
 * worker context can hang an evaluate forever), and no page is assumed
 * immortal: the extension NAVIGATES or CLOSES its own surfaces in
 * reaction to the very writes the seeding makes (view-mode redirect,
 * join → adopt tab re-key). merge-showcase.html is the least-wired
 * surface (extension origin, only sandbox.html is sandboxed), but on
 * fast reactions even it can be gone before an evaluate returns —
 * hence lazy recreation instead of a stored immortal Page.
 */
async function peerPage(peer: ExtensionPeer): Promise<Page> {
  if (peer.popup && !peer.popup.isClosed()) return peer.popup;
  console.log(`[live-network setup] (re)creating peer page; open pages: ${peer.context.pages().map((p) => p.url())}`);
  const page = await peer.context.newPage();
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) console.log(`[live-network setup] peer page nav: ${f.url()}`);
  });
  page.on('close', () => console.log('[live-network setup] peer page closed'));
  await page.goto(`chrome-extension://${peer.extensionId}/merge-showcase.html`);
  await page.waitForLoadState('load');
  peer.popup = page;
  return page;
}

/**
 * (Re-)seed a peer's backend registry record. The record is a sensitive
 * slot, so the seed encrypts with the extension's at-rest key — same
 * blob format as `browser-secret-cipher`; the registry mirror's storage
 * subscription dials (or drops) the wire live. Runs in the POPUP page
 * context — MV3 restarts the service worker at will and destroy worker
 * evaluation contexts; page contexts share the same storage partition.
 */
async function seedBackend(
  peer: ExtensionPeer,
  seed: { backendUrl: string; authToken: string; enabled: boolean },
): Promise<void> {
  const page = await peerPage(peer);
  await page.evaluate(async ({ backendUrl, authToken, enabled }) => {
    // Existence probe first — an eager indexedDB.open would CREATE an
    // empty schema-less DB and race the extension's cipher init; the
    // guarded read (probe → husk heal → bounded wait) is the
    // agent-traffic harness idiom, lifted here per its standing rider.
    const databases = await indexedDB.databases();
    if (!databases.some((d) => d.name === 'oh-secret-cipher')) {
      throw new Error('cipher db not yet created');
    }
    const key = await Promise.race([
      new Promise<CryptoKey>((resolve, reject) => {
        const open = indexedDB.open('oh-secret-cipher');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keys')) {
            // A schema-less husk (e.g. from an earlier eager open)
            // blocks the extension's init — heal by deleting it.
            db.close();
            const drop = indexedDB.deleteDatabase('oh-secret-cipher');
            drop.onsuccess = drop.onerror = () => reject(new Error('cipher db was empty — healed, retrying'));
            return;
          }
          const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
          request.onerror = () => reject(request.error);
          request.onsuccess = () =>
            request.result ? resolve(request.result as CryptoKey) : reject(new Error('cipher key not yet minted'));
        };
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('cipher read timed out')), 4000)),
    ]);
    const record = {
      id: 'live-network-e2e-backend',
      label: 'live-network e2e desktop',
      url: backendUrl,
      authToken,
      autoConnect: true,
      enabled,
      addedAt: new Date().toISOString(),
      lastConnectedAt: null,
    };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify([record])),
    );
    const packed = new Uint8Array(iv.length + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), iv.length);
    let binary = '';
    for (const byte of packed) binary += String.fromCharCode(byte);
    await new Promise<void>((resolve) => {
      // `onboardingCompleted` rides along so the tour's modal mask never
      // covers the popup — same write, no worker-context evaluate.
      chrome.storage.local.set({ onboardingCompleted: true, 'oh.backends': `v1:${btoa(binary)}` }, () => resolve());
    });
  }, seed);
}

/** Whether the peer's storage already holds a backends blob. */
async function backendsSeeded(peer: ExtensionPeer): Promise<boolean> {
  const page = await peerPage(peer);
  return page.evaluate(
    async () =>
      new Promise<boolean>((resolve) => {
        chrome.storage.local.get('oh.backends', (items) => {
          resolve(typeof items?.['oh.backends'] === 'string' && (items['oh.backends'] as string).length > 0);
        });
      }),
  );
}

/**
 * Seed with retry. Two churn sources: the SW can restart mid-handshake
 * on fresh profiles, and the popup may NAVIGATE in reaction to the very
 * write we make — which destroys the evaluate context AFTER the write
 * landed. So a failed evaluate is verified by read-back before it
 * counts as a failure.
 */
async function seedBackendRetrying(
  peer: ExtensionPeer,
  seed: { backendUrl: string; authToken: string; enabled: boolean },
): Promise<void> {
  let seedError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await seedBackend(peer, seed);
      return;
    } catch (err) {
      seedError = err;
      console.log(`[live-network setup] seed attempt ${attempt} failed: ${String(err).split('\n')[0]}`);
      // A destroyed context/page usually means the WRITE LANDED and the
      // app reacted (join → adopt re-keys extension surfaces). Give the
      // reaction a beat, then trust the read-back on a fresh page.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const landed = await backendsSeeded(peer).catch(() => false);
      if (landed) return;
    }
  }
  throw new Error(`seedBackend failed: ${String(seedError)}`);
}

/** Whether any replicated `oh.ws.<id>.rules` record in the peer's
 * chrome.storage carries the given rule name. */
async function ruleVisibleInPeer(peer: ExtensionPeer, name: string): Promise<boolean> {
  const page = await peerPage(peer);
  return page.evaluate(
    async (ruleName) =>
      new Promise<boolean>((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const serialized = JSON.stringify(Object.entries(items).filter(([key]) => /^oh\.ws\..*\.rules$/.test(key)));
          resolve(serialized.includes(ruleName));
        });
      }),
    name,
  );
}

/** Minimal MCP tools/call — the wire-alive probe of the privacy leg. */
async function callTool(name: string, args: Record<string, unknown>): Promise<void> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  expect(response.status).toBe(200);
  const json = (await response.json()) as { result?: { isError?: boolean; content: Array<{ text: string }> } };
  expect(json.result?.isError, json.result?.content[0]?.text).toBeFalsy();
}

test.describe.configure({ mode: 'serial' });

/** Setup breadcrumbs — cheap forensics when a hook dies on a slow or
 *  unfamiliar machine (the hook-timeout error alone names no step). */
function setupStep(message: string): void {
  console.log(`[live-network setup ${new Date().toISOString()}] ${message}`);
}

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-live-network-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
          'backend.bindAddress': '0.0.0.0',
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  setupStep('userData seeded');
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();
  setupStep('desktop launched');

  // Engine-ready gate: the endpoint answers 401 (bound + enabled, token
  // missing) once the daemon bind is up.
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

  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'live-network-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  setupStep('daemon token minted');

  peerA = await launchExtensionPeer();
  setupStep('peer A launched');
  await seedBackendRetrying(peerA, {
    backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`,
    authToken: token,
    enabled: true,
  });
  setupStep('peer A seeded');

  playground = await peerA.context.newPage();
  await playground.goto(PLAYGROUND_URL);
  setupStep('playground open');
  // Background the playground tab so the active tab is the popup page:
  // keeps the watched tab free of stray active-tab activity, so every
  // row the grid ever shows is one of this spec's own probes.
  await (await peerPage(peerA)).bringToFront();
});

test.afterAll(async () => {
  await peerA?.context.close();
  await peerB?.context.close();
  await electronApp?.close();
});

// ── Tab inventory over the telemetry channels ───────────────────────

test('the daemon inventories the connected browser tabs', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = await listTabs();
        return (peers ?? []).some((peer) => peer.tabs.some((tab) => tab.url.startsWith(PLAYGROUND_URL)));
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Watch + live stream ─────────────────────────────────────────────

test('the Live Network window streams a watched playground tab live', async () => {
  await setToolWindowOpen(true);
  await expect(workbench.locator('[data-testid="traffic-monitor-peers"]')).toHaveText('Connected browsers: 1', {
    timeout: 15000,
  });

  await pickPlaygroundTab();

  // Traffic generated AFTER the watch: the first watch pins the tab's
  // session floor at the current watermark, so the page-load requests
  // from the earlier goto stay below it and the grid holds EXACTLY the
  // one probe, not a replayed history.
  await playground.evaluate(() => fetch('/api/echo?probe=live-1').then((r) => r.text()));
  await expect(workbench.locator('.dt-row')).toHaveCount(1, { timeout: 15000 });

  // The stream stays live while watched.
  await playground.evaluate(() => fetch('/api/echo?probe=live-2').then((r) => r.text()));
  await expect(echoRows()).toHaveCount(2, { timeout: 15000 });
});

// ── Replay on reopen ────────────────────────────────────────────────

test('reopening the window rebuilds the view from replay', async () => {
  await setToolWindowOpen(false);
  await expect(workbench.locator('[data-testid="traffic-monitor-source-rail"]')).toHaveCount(0);

  await setToolWindowOpen(true);
  await pickPlaygroundTab();

  // No fresh traffic — both probes come back from the engine's replay.
  await expect(echoRows()).toHaveCount(2, { timeout: 15000 });
});

// ── Row inspection survives the tool window ─────────────────────────

test('row inspection opens an editor tab that outlives the tool window', async () => {
  await echoRows().first().click();
  await expect(workbench.getByText('GET echo').first()).toBeVisible();

  await setToolWindowOpen(false);
  await expect(workbench.getByText('GET echo').first()).toBeVisible();
});

// ── Wire flap ───────────────────────────────────────────────────────

test('a wire flap re-subscribes the watch and replays what the wire missed', async () => {
  if (!peerA) throw new Error('peer A not launched');
  await setToolWindowOpen(true);
  await pickPlaygroundTab();
  await expect(echoRows()).toHaveCount(2, { timeout: 15000 });

  // Drop the wire: the registry mirror tears the connection down live,
  // which tears every telemetry session down at the source.
  await seedBackend(peerA, {
    backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`,
    authToken: token,
    enabled: false,
  });
  await expect.poll(peerCount, { timeout: 15000 }).toBe(0);

  // Fired while the wire is down: the engine keeps its session floor,
  // so this request lands ABOVE it and must come back in the replay —
  // the wire flap degrades liveness, never fidelity (panel parity: the
  // in-browser view would hold this row too).
  await playground.evaluate(() => fetch('/api/echo?probe=missed').then((r) => r.text()));

  // Re-enable: the peer reconnects, the relay re-sends `subscribe` for
  // the live watch, and the fresh ready + replay rebuilds the view —
  // including the traffic the wire was down for.
  await seedBackend(peerA, {
    backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`,
    authToken: token,
    enabled: true,
  });
  await expect.poll(peerCount, { timeout: 15000 }).toBe(1);
  await expect(echoRows()).toHaveCount(3, { timeout: 15000 });

  // And the stream is live again.
  await playground.evaluate(() => fetch('/api/echo?probe=live-3').then((r) => r.text()));
  await expect(echoRows()).toHaveCount(4, { timeout: 15000 });
});

// ── Service-worker termination ──────────────────────────────────────

test('terminating the extension service worker self-heals the stream', async () => {
  if (!peerA) throw new Error('peer A not launched');
  const cdp = await peerA.context.newCDPSession(await peerPage(peerA));
  const { targetInfos } = (await cdp.send('Target.getTargets')) as {
    targetInfos: Array<{ targetId: string; type: string; url: string }>;
  };
  const swTarget = targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(peerA?.extensionId ?? ''));
  expect(swTarget, 'extension service worker target').toBeTruthy();
  await cdp.send('Target.closeTarget', { targetId: swTarget?.targetId ?? '' });
  await cdp.detach();

  // Revive: an extension page load spins the service worker back up;
  // the persisted registry redials, the relay re-subscribes the watch.
  await (await peerPage(peerA)).reload();
  await expect.poll(peerCount, { timeout: 30000 }).toBe(1);

  // The stream is live again end to end. (How much history the replay
  // carries across an SW death is engine policy — the law under test is
  // that the watch self-heals without a re-pick.)
  await playground.evaluate(() => fetch('/api/echo?probe=live-4').then((r) => r.text()));
  await expect(workbench.locator('.dt-row').filter({ hasText: 'live-4' })).toHaveCount(1, { timeout: 15000 });
});

// ── Second peer: qualified partitions ───────────────────────────────

test('a second browser peer is listed and never bleeds into the watched partition', async () => {
  peerB = await launchExtensionPeer();
  await seedBackendRetrying(peerB, {
    backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`,
    authToken: token,
    enabled: true,
  });
  playgroundB = await peerB.context.newPage();
  await playgroundB.goto(PLAYGROUND_URL);

  await expect.poll(peerCount, { timeout: 30000 }).toBe(2);

  // Traffic in peer B's playground tab — the watched partition is peer
  // A's tab, so nothing may cross (peer-qualified partition identity).
  await playgroundB.evaluate(() => fetch('/api/echo?probe=cross-1').then((r) => r.text()));
  await playgroundB.evaluate(() => fetch('/api/echo?probe=cross-2').then((r) => r.text()));
  await workbench.waitForTimeout(1500);
  await expect(workbench.locator('.dt-row').filter({ hasText: 'cross' })).toHaveCount(0);
});

// ── Privacy gate: off-device wires are claimed and dropped ──────────

test('a non-loopback wire keeps syncing but its telemetry is refused', async () => {
  const lan = lanIpv4();
  test.skip(lan === '127.0.0.1', 'no non-internal IPv4 on this machine');
  if (!peerB) throw new Error('peer B not launched');

  // Same daemon, dialed via the LAN address: `isLoopback()` classifies
  // the URL the wire actually dialed, so this is an honest off-device
  // posture on one machine.
  await seedBackend(peerB, { backendUrl: `ws://${lan}:${DAEMON_PORT}`, authToken: token, enabled: true });

  // The peer drops telemetry frames: it vanishes from the inventory.
  await expect.poll(peerCount, { timeout: 30000 }).toBe(1);

  // But the wire itself is alive — the sync plane still replicates: an
  // MCP-created rule lands in the peer's storage over the LAN wire.
  await callTool('rules_create', {
    rule: {
      name: 'WAN probe rule',
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-WAN-Probe', value: 'live-network-e2e' }],
        responseHeaders: [],
      },
    },
  });
  await expect
    .poll(async () => (peerB ? ruleVisibleInPeer(peerB, 'WAN probe rule') : false), { timeout: 30000 })
    .toBe(true);
});

// ── Perf pin: burst throughput + virtualization bound ───────────────

test('a burst streams within budget and the grid stays virtualized', async () => {
  // Deterministic completion signal: filter to the burst's LAST probe
  // before firing, so its appearance marks end-to-end completion.
  const filter = workbench.locator('.rules-bottom-panel input[placeholder="Filter"]').first();
  await filter.fill(`burst=${BURST_SIZE - 1}`);
  await expect(workbench.locator('.dt-row')).toHaveCount(0);

  const startedAt = Date.now();
  const burstDone = playground.evaluate(async (size) => {
    const CHUNK = 50;
    for (let i = 0; i < size; i += CHUNK) {
      await Promise.all(Array.from({ length: Math.min(CHUNK, size - i) }, (_, j) => fetch(`/api/echo?burst=${i + j}`)));
    }
  }, BURST_SIZE);
  await expect(workbench.locator('.dt-row').filter({ hasText: `burst=${BURST_SIZE - 1}` })).toHaveCount(1, {
    timeout: 60000,
  });
  const wallMs = Date.now() - startedAt;
  await burstDone;

  // Virtualization law: the DOM never holds anywhere near the full data
  // set — the row window renders the viewport, not the stream.
  await filter.fill('');
  await workbench.waitForTimeout(500);
  const domRows = await workbench.locator('.dt-row').count();
  expect(domRows).toBeLessThan(150);

  console.log(
    `[live-network perf] ${BURST_SIZE}-request burst end-to-end in ${wallMs}ms ` +
      `(~${Math.round((BURST_SIZE / wallMs) * 1000)} req/s); DOM rows rendered: ${domRows}`,
  );
});
