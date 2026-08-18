/**
 * Traffic Monitor Debug-mode Live E2E — the S8 per-tab Debug-mode
 * affordance against the real dual-app stack (the observability plan §7
 * actuation over the telemetry control verb), on the proxy-live chassis:
 *
 *   1. The rail lists the connected Chrome peer with the Debug-mode
 *      master switch on its header row and the per-tab bug affordance on
 *      its tab rows.
 *   2. Pinning a tab with Debug mode OFF records the pin (pushpin
 *      state) without flipping the master switch — the reconciler
 *      carries pins while disabled.
 *   3. Flipping the master switch from the rail writes the extension's
 *      `inspection.cdpEnabled` SETTING (single-effector path — the
 *      popup pill follows), and the pinned tab attaches: the rail
 *      converges to the filled-bug state.
 *   4. The watched tab's traffic upgrades to CDP fidelity — the
 *      Response tab serves the body over the lazy pull, which the
 *      heuristic plane cannot.
 *   5. Un-pinning from the rail detaches and returns the row to the
 *      hover-ghost state.
 *   6. The demoted routing popover still drives `routing.set`: the
 *      switch inside the popover flips routing, the trigger grows the
 *      "On" tag, and the ack alert renders.
 *
 * Phase 3 storage legs (S10): the stacked storage pane observes the
 * watched tab's localStorage over the relay, a row opens as a
 * storage-document editor tab, a desktop-side delete actuates in the
 * page (the extension executes — the actuator model), and the pane's
 * collapse state survives dock switches.
 *
 * Phase 6 wire-join legs (S16): routing + scope flipped over the bridge
 * RPC route a mapped host's traffic through the capture proxy, where a
 * mock rule serves the exchange (the desktop cannot resolve the
 * browser-mapped name — serving AT the proxy is what completes the
 * wire twin). The watched tab's heuristic row then joins the wire row:
 * the ℹ join glyph lands on the annotation rail, the Response tab
 * serves the body over the wire pull WITHOUT Debug mode (the heuristic
 * plane has no body path of its own — the money proof), and the Wire
 * source's twin row wears the seen-on-tab annotation whose popover
 * jumps back to the tab source with the twin row selected.
 *
 * Phase 6 perf legs (PLAN §6): blind-tunnel throughput direct vs
 * spliced, capture-path per-request latency direct vs absolute-form,
 * and the S3-pattern 300-burst with the join seam active — numbers
 * logged for the status ledger's budget pins.
 *
 * Deliberately NOT covered (manual live-pass items): the debugger
 * banner's look and its Cancel fall-back (browser chrome, unreachable
 * from Playwright), tooltip copy on hover, and the Firefox peer's
 * affordance ABSENCE (Playwright cannot load our extension in Firefox).
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import * as http from 'node:http';
import * as net from 'node:net';
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
// Port etiquette: fresh ports off every prior suite (ledger through 19939).
const DAEMON_PORT = 19940;
const PROXY_PORT = 19941;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';
// Mapped in the BROWSER only (--host-resolver-rules): the desktop can't
// resolve it (`.test` is reserved-NXDOMAIN), so the wire-join legs serve
// the exchange AT the proxy with a mock rule.
const WIRE_JOIN_HOST = 'wire-join.oh-e2e.test';

interface ProxyRoutingPeerAck {
  nodeId: string;
  agent: string;
  applied: boolean;
  mode: string;
  error?: string;
}

interface ProxyRoutingStatusWire {
  enabled: boolean;
  active: boolean;
  peers: ProxyRoutingPeerAck[];
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
let playground: Page;

/** Invoke a daemon admin channel through the Workbench bridge. */
async function bridgeInvoke<T>(message: Record<string, unknown>): Promise<T> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as never;
  }, message) as Promise<T>;
}

/** Live routing projection from the daemon. */
async function routingStatus(): Promise<ProxyRoutingStatusWire> {
  return bridgeInvoke<ProxyRoutingStatusWire>({ type: 'oh.daemon.proxy.routing.status' });
}

/** Minimal MCP tools/call — how the wire-join legs mint the mock rule. */
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

/** Open a CONNECT tunnel through the capture proxy to the playground —
 *  an UN-scoped target, so the proxy splices the bytes blind. */
function openTunnel(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PROXY_PORT, '127.0.0.1', () => {
      socket.write('CONNECT 127.0.0.1:3000 HTTP/1.1\r\nHost: 127.0.0.1:3000\r\n\r\n');
    });
    socket.once('error', reject);
    socket.once('data', (chunk: Buffer) => {
      if (chunk.toString('latin1').startsWith('HTTP/1.1 200')) resolve(socket);
      else reject(new Error(`CONNECT refused: ${chunk.toString('latin1').split('\r\n')[0]}`));
    });
  });
}

/** POST `body` at the echo and drain the reply — direct, or over a
 *  supplied socket (the established tunnel). Returns wall ms + bytes
 *  received, the two facts a throughput pin needs. */
function timedEcho(probe: string, body: Buffer, connection?: net.Socket): Promise<{ ms: number; bytes: number }> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const request = http.request(
      {
        host: '127.0.0.1',
        port: 3000,
        method: 'POST',
        path: `/api/echo?probe=${probe}`,
        headers: { 'content-type': 'text/plain', 'content-length': body.length },
        agent: false,
        ...(connection !== undefined ? { createConnection: () => connection } : {}),
      },
      (response) => {
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
        });
        response.on('end', () => {
          const ms = performance.now() - startedAt;
          response.destroy();
          resolve({ ms, bytes });
        });
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

/** One small GET, timed — direct to the playground, or absolute-form
 *  through the capture port (the parse + enforce + tee path). */
function timedGet(pathAndQuery: string, throughProxy: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const request = http.request(
      throughProxy
        ? {
            host: '127.0.0.1',
            port: PROXY_PORT,
            path: `http://127.0.0.1:3000${pathAndQuery}`,
            headers: { host: '127.0.0.1:3000' },
            agent: false,
          }
        : { host: '127.0.0.1', port: 3000, path: pathAndQuery, agent: false },
      (response) => {
        response.resume();
        response.on('end', () => resolve(performance.now() - startedAt));
      },
    );
    request.on('error', reject);
    request.end();
  });
}

function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

/** The playground tab's rail row, identified by the page title. */
function playgroundRow() {
  return workbench.locator('[data-testid="traffic-monitor-source-tab"]').filter({ hasText: PLAYGROUND_TITLE }).first();
}

/** The playground row's Debug-mode affordance span. */
function playgroundDebugAffordance() {
  return playgroundRow().locator('[data-testid="traffic-monitor-tab-debug"]');
}

/** Launch the extension profile. */
async function launchExtensionPeer(): Promise<ExtensionPeer> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      `--host-resolver-rules=MAP ${WIRE_JOIN_HOST} 127.0.0.1`,
    ],
  });
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  const peer: ExtensionPeer = { context, popup: null, extensionId };
  await peerPage(peer);
  return peer;
}

/**
 * The peer's live extension page — created on demand, recreated when the
 * app kills it (no extension page is immortal; nothing ever evaluates in
 * the WORKER context — the live-network harness law).
 */
async function peerPage(peer: ExtensionPeer): Promise<Page> {
  if (peer.popup && !peer.popup.isClosed()) return peer.popup;
  const page = await peer.context.newPage();
  await page.goto(`chrome-extension://${peer.extensionId}/merge-showcase.html`);
  await page.waitForLoadState('load');
  peer.popup = page;
  return page;
}

/** The extension's persisted user-settings dict (`oh.settings.user`). */
async function extensionUserSettings(peer: ExtensionPeer): Promise<Record<string, unknown>> {
  const page = await peerPage(peer);
  return page.evaluate(
    async () =>
      new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get('oh.settings.user', (items) => {
          resolve((items?.['oh.settings.user'] as Record<string, unknown>) ?? {});
        });
      }),
  );
}

/**
 * (Re-)seed the peer's backend registry record — same encrypted blob
 * format and page-context posture as the live-network suite.
 */
async function seedBackend(
  peer: ExtensionPeer,
  seed: { backendUrl: string; authToken: string; enabled: boolean },
): Promise<void> {
  const page = await peerPage(peer);
  await page.evaluate(async ({ backendUrl, authToken, enabled }) => {
    // Existence probe first — an eager indexedDB.open would CREATE an
    // empty schema-less DB and race the extension's cipher init.
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
      id: 'debug-live-e2e-backend',
      label: 'debug-live e2e desktop',
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

/** Seed with retry + read-back verification (the write can land even
 *  when the evaluate context dies to the app's own reaction). */
async function seedBackendRetrying(
  peer: ExtensionPeer,
  seed: { backendUrl: string; authToken: string; enabled: boolean },
): Promise<void> {
  let seedError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await seedBackend(peer, seed);
      return;
    } catch (err) {
      seedError = err;
      console.log(`[debug-live setup] seed attempt ${attempt} failed: ${String(err).split('\n')[0]}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const landed = await backendsSeeded(peer).catch(() => false);
      if (landed) return;
    }
  }
  throw new Error(`seedBackend failed: ${String(seedError)}`);
}

test.describe.configure({ mode: 'serial' });

function setupStep(message: string): void {
  console.log(`[debug-live setup ${new Date().toISOString()}] ${message}`);
}

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-debug-live-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
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

  // The daemon's WS/HTTP port answers (401 on a bare POST) once up.
  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/mcp`, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .not.toBe(0);

  const minted = await bridgeInvoke<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'debug-live-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  setupStep('daemon token minted');

  // The wire partition runs so the routing popover leg acts on a live
  // capture (routing without a proxy has nothing to route to).
  const started = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.start',
    port: PROXY_PORT,
  });
  expect(started.ok, started.error).toBe(true);
  setupStep('capture proxy started');

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
  await (await peerPage(peerA)).bringToFront();
});

test.afterAll(async () => {
  await peerA?.context.close();
  await electronApp?.close();
});

// ── Leg 1: rail inventory + affordances ─────────────────────────────

test('the rail lists the Chrome peer with the Debug-mode switch and per-tab bug affordance', async () => {
  await setToolWindowOpen(true);

  // The peer lands in the inventory once its wire is up — the panel's
  // tabs watch pushes it into the rail.
  await expect
    .poll(async () => await workbench.locator('[data-testid="traffic-monitor-peer"]').count(), { timeout: 30000 })
    .toBeGreaterThan(0);

  // Chrome reports `debug.available` — the master switch renders on the
  // peer header, OFF (attaching the debugging protocol shows the
  // browser's banner, so it is an explicit user choice everywhere).
  const masterSwitch = workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first();
  await expect(masterSwitch).toBeVisible();
  await expect(masterSwitch).toHaveAttribute('aria-checked', 'false');

  // The playground tab row carries the hover affordance, un-pressed.
  await expect(playgroundRow()).toBeVisible();
  await playgroundRow().hover();
  const affordance = playgroundDebugAffordance();
  await expect(affordance).toBeVisible();
  await expect(affordance).toHaveAttribute('aria-pressed', 'false');

  // The pin-while-off leg starts from this default-OFF posture; the
  // persisted setting stays unwritten until a surface flips it.
  const settings = await extensionUserSettings(peerA as ExtensionPeer);
  expect(settings['inspection.cdpEnabled'] ?? false).toBe(false);
});

// ── Leg 2: pin with Debug mode OFF ──────────────────────────────────

test('pinning a tab with Debug mode off records the pin without enabling', async () => {
  if (!peerA) throw new Error('peer A not launched');
  await playgroundRow().hover();
  await playgroundDebugAffordance().click();

  // The control reply's snapshot patches the rail immediately: pinned,
  // not attached (the master switch is off).
  const affordance = playgroundDebugAffordance();
  await expect(affordance).toHaveAttribute('aria-pressed', 'true');
  await expect(affordance.locator('.anticon-pushpin')).toBeVisible();

  // The master switch stayed off — on the rail AND in the extension's
  // persisted setting.
  await expect(workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first()).toHaveAttribute(
    'aria-checked',
    'false',
  );
  const settings = await extensionUserSettings(peerA);
  expect(settings['inspection.cdpEnabled'] ?? false).toBe(false);
});

// ── Leg 3: master switch from the rail — single-effector + attach ───

test('flipping Debug mode from the rail writes the extension setting and attaches the pin', async () => {
  if (!peerA) throw new Error('peer A not launched');
  await workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first().click();
  await expect(workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first()).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Single-effector proof: the relayed command wrote the SETTING, so the
  // extension's persisted `inspection.cdpEnabled` flips (the popup pill
  // reads the same key).
  await expect
    .poll(async () => (await extensionUserSettings(peerA as ExtensionPeer))['inspection.cdpEnabled'] === true, {
      timeout: 10000,
    })
    .toBe(true);

  // The popup pill follows: its footer switch reads checked.
  const pill = await (peerA as ExtensionPeer).context.newPage();
  await pill.goto(`chrome-extension://${(peerA as ExtensionPeer).extensionId}/popup.html`);
  await expect(pill.locator('[aria-label="Toggle debug mode"]').first()).toHaveAttribute('aria-checked', 'true', {
    timeout: 10000,
  });
  await pill.close();

  // The pinned tab attaches (banner handshake commits async) — the
  // reconciler's change push converges the rail to the filled-bug state.
  await expect
    .poll(
      async () =>
        await playgroundDebugAffordance()
          .locator('.anticon-bug')
          .count()
          .catch(() => 0),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
  await expect(playgroundDebugAffordance()).toHaveAttribute('aria-pressed', 'true');
});

// ── Leg 4: CDP fidelity on the watched tab ──────────────────────────

test('the attached tab serves response bodies — CDP fidelity end to end', async () => {
  // Select the playground tab source — the watch itself turns ingestion on.
  await playgroundRow().click();

  // Traffic minted AFTER the attach carries CDP provenance from the
  // first hop; the body is read so the lifecycle completes.
  const echoed = await playground.evaluate(
    (url) => fetch(url).then((r) => r.text()),
    `${PLAYGROUND_URL}api/echo?probe=debug-live-1`,
  );
  expect(echoed).toContain('debug-live-1');

  await expect(workbench.locator('.dt-row').filter({ hasText: 'debug-live-1' }).first()).toBeVisible({
    timeout: 15000,
  });

  // Inspect the row; the Response tab pulls the body lazily — a serve
  // only the CDP plane can answer (the heuristic plane has no bodies).
  await workbench.locator('.dt-row').filter({ hasText: 'debug-live-1' }).first().click();
  // The editor-tab label ellipsizes mid-string ("GET echo?…ug-live-1") —
  // match the surviving tail, the proxy-live suite's idiom.
  const editorTab = workbench.getByRole('tab', { name: /ug-live-1/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await workbench.getByRole('tab', { name: 'Response', exact: true }).first().click();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await expect(workbench.locator('.view-line').filter({ hasText: 'debug-live-1' }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ── Inspect-tab CTAs hand off in-place on the desktop ───────────────

test('inspect-tab CTAs hand off locally: rule draft + Create API request', async () => {
  // The inspect tab from the previous leg is focused; its breadcrumb
  // names the Traffic Monitor origin, not the Rules default.
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'Traffic' }).first()).toBeVisible();

  // The Headers tab hosts the CTAs.
  await workbench.getByRole('tab', { name: 'Headers', exact: true }).first().click();

  // Rule-draft handoff: the quick-editor popover's workspace link
  // stashes the draft (`createRuleDraft`) and routes the intent through
  // the local loop — a pre-filled rule-create tab opens.
  await workbench.getByRole('button', { name: 'Override query params' }).first().click();
  await workbench.getByText('Open in workspace').first().click();
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'Rules' }).first()).toBeVisible({
    timeout: 10000,
  });
  // The draft seeded the captured URL into the rule form's URL-pattern
  // editor. Keep-alive editor tabs hold the same URL text hidden, so
  // match the VISIBLE occurrence only.
  await expect(
    workbench.getByText('http://127.0.0.1:3000/api/echo?probe=debug-live-1').filter({ visible: true }).first(),
  ).toBeVisible();

  // Back on the inspect tab: Create API request opens a scratch
  // request tab seeded from the capture (`createRequestDraft`).
  await workbench
    .getByRole('tab', { name: /ug-live-1/ })
    .first()
    .click();
  await workbench.getByRole('tab', { name: 'Headers', exact: true }).first().click();
  await workbench.getByRole('button', { name: 'Create API request' }).first().click();
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'API Requests' }).first()).toBeVisible({
    timeout: 10000,
  });
});

// ── Phase 3: the stacked storage pane ───────────────────────────────

test("the storage pane lists the watched tab's localStorage over the relay", async () => {
  await setToolWindowOpen(true);
  await playgroundRow().click();

  // Seed an entry in the WATCHED page — the pane must observe it
  // through the relayed reads (never a desktop-side derivation).
  await playground.evaluate(() => localStorage.setItem('oh-e2e-storage-key', 'oh-e2e-storage-value'));

  const pane = workbench.locator('[data-testid="traffic-monitor-storage-pane"]');
  await expect(pane).toBeVisible();
  const row = pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText('oh-e2e-storage-value');
});

test('a storage row opens as an editor tab and a desktop delete actuates in the page', async () => {
  const pane = workbench.locator('[data-testid="traffic-monitor-storage-pane"]');

  // Row click → storage-document editor tab: Traffic Monitor
  // breadcrumb, live value in the document body.
  await pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' }).first().click();
  const editorTab = workbench.getByRole('tab', { name: /storage-key/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'Traffic' }).first()).toBeVisible();
  await expect(workbench.locator('.view-line').filter({ hasText: 'oh-e2e-storage-value' }).first()).toBeVisible({
    timeout: 20000,
  });

  // Delete the row from the desktop — the verb executes IN the
  // extension (the actuator model), so the page's own localStorage
  // loses the key and the grid refetch drops the row.
  await setToolWindowOpen(true);
  const row = pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' }).first();
  await row.hover();
  await row.getByRole('button', { name: 'Delete oh-e2e-storage-key' }).click();
  await expect
    .poll(() => playground.evaluate(() => localStorage.getItem('oh-e2e-storage-key')), { timeout: 20000 })
    .toBeNull();
  await expect(pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' })).toHaveCount(0, {
    timeout: 20000,
  });
});

test('the storage pane collapses to the reopen strip and survives dock-tab switches', async () => {
  const pane = workbench.locator('[data-testid="traffic-monitor-storage-pane"]');
  // Collapse via the toolbar's always-visible leading caret → the slim
  // reopen strip (the − hide cluster is dropped on this surface).
  await pane.locator('[data-testid="dt-plane-collapse"]').first().click();
  await expect(pane).toHaveCount(0);
  const strip = workbench.locator('[data-testid="traffic-monitor-storage-strip"]');
  await expect(strip).toBeVisible();

  // The collapsed state survives the dispatcher unmount (dock switch).
  await workbench.locator('[data-tool-window="workflow-status"]').first().click();
  await setToolWindowOpen(true);
  await expect(workbench.locator('[data-testid="traffic-monitor-storage-strip"]')).toBeVisible();

  // Reopen from the strip.
  await workbench.locator('[data-testid="traffic-monitor-storage-strip"]').click();
  await expect(workbench.locator('[data-testid="traffic-monitor-storage-pane"]')).toBeVisible();
});

// ── Phase 4: the stacked console pane ───────────────────────────────

test("the console pane streams the watched tab's console output, view-only", async () => {
  await setToolWindowOpen(true);
  // Collapsed by default — the strip reopens the plane.
  await workbench.locator('[data-testid="traffic-monitor-console-strip"]').click();
  const pane = workbench.locator('[data-testid="traffic-monitor-console-pane"]');
  await expect(pane).toBeVisible();

  // Emit in the WATCHED page — the entry must arrive through the CDP
  // console stream relayed over the wire (never a desktop derivation).
  await playground.evaluate(() => console.log('oh-e2e-console-probe'));
  await expect(pane.locator('.dt-console-row').filter({ hasText: 'oh-e2e-console-probe' }).first()).toBeVisible({
    timeout: 20000,
  });

  // View-only law: the REPL prompt never mounts on the remote surface.
  await expect(pane.locator('.dt-console-prompt')).toHaveCount(0);
});

test('the console pane replays the retained log across collapse/reopen', async () => {
  const pane = workbench.locator('[data-testid="traffic-monitor-console-pane"]');
  await pane.locator('[data-testid="dt-plane-collapse"]').first().click();
  await expect(pane).toHaveCount(0);
  const strip = workbench.locator('[data-testid="traffic-monitor-console-strip"]');
  await expect(strip).toBeVisible();

  // Reopen: a fresh consumer session replays the hub's retained log —
  // the earlier probe returns without re-emitting it.
  await strip.click();
  await expect(pane.locator('.dt-console-row').filter({ hasText: 'oh-e2e-console-probe' }).first()).toBeVisible({
    timeout: 20000,
  });
});

// ── Leg 5: unpin from the rail ──────────────────────────────────────

test('un-pinning from the rail detaches and returns the row to the ghost state', async () => {
  await setToolWindowOpen(true);
  await playgroundRow().hover();
  await playgroundDebugAffordance().click();

  // Snapshot patch drops the pin; the detach commits async — the change
  // push converges the affordance to the un-pressed hover-ghost state.
  await expect
    .poll(async () => await playgroundDebugAffordance().getAttribute('aria-pressed'), { timeout: 30000 })
    .toBe('false');
});

// ── Leg 6: routing under the wire control's Advanced fold ───────────

test('the wire settings popover flips routing and shows the ack tags', async () => {
  // Wire source → the row carries the always-visible capture control;
  // its chevron opens the settings popover (decrypt scope top-level,
  // port + routing under Advanced).
  const wire = workbench.locator('[data-testid="traffic-monitor-source-wire"]').first();
  await wire.click();
  const control = workbench.locator('[data-testid="traffic-monitor-wire-control"]').first();
  await expect(control).toBeVisible();

  await control.locator('[data-testid="traffic-monitor-wire-options"]').click();
  await workbench.locator('[data-testid="traffic-monitor-wire-advanced"]').click();
  const routingSwitch = workbench.locator('[data-testid="proxy-routing-switch"]').first();
  await expect(routingSwitch).toBeVisible();
  await routingSwitch.click();

  // The ack block renders once the peer acks with an applied mode.
  const acks = workbench.locator('[data-testid="traffic-monitor-wire-routing-acks"]');
  await expect(acks.filter({ hasText: 'PAC' }).first()).toBeVisible({ timeout: 20000 });

  // Off again — the ack block clears.
  await routingSwitch.click();
  await expect(acks).toHaveCount(0, { timeout: 15000 });
});

// ── Selection survives dock-tab switches ────────────────────────────

test('the panel keeps its source selection across dock-tab switches', async () => {
  // The wire source is selected from the routing leg. Switch the dock
  // to a sibling tool window and back — the dispatcher unmounts the
  // panel; the remount must re-seed the last selection instead of the
  // empty no-source hero.
  await workbench.locator('[data-tool-window="workflow-status"]').first().click();
  await setToolWindowOpen(true);
  await expect(workbench.locator('[data-testid="traffic-monitor-source-wire"]').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(workbench.locator('[data-testid="traffic-monitor-wire-control"]').first()).toBeVisible();
});

// ── Phase 6: the wire-join ──────────────────────────────────────────

test("a scoped routed exchange joins the watched tab's row to the wire capture", async () => {
  // Scope the capture to the mapped host and flip routing over the
  // bridge RPC — the peer acks with an applied PAC.
  const scoped = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.scope.set',
    patterns: [WIRE_JOIN_HOST],
  });
  expect(scoped.ok, scoped.error).toBe(true);
  const flipped = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.routing.set',
    enabled: true,
  });
  expect(flipped.ok, flipped.error).toBe(true);
  await expect
    .poll(
      async () => {
        const status = await routingStatus();
        return status.active && status.peers.some((peer) => peer.applied && peer.mode === 'pac');
      },
      { timeout: 15000 },
    )
    .toBe(true);

  // The desktop cannot resolve the browser-mapped name, so a mock rule
  // serves the exchange AT the proxy — the browser still witnesses the
  // request, the wire holds the full exchange including the body. The
  // CORS header keeps the cross-origin page fetch readable.
  await callTool('rules_create', {
    rule: {
      name: 'debug-live wire-join mock',
      type: 'response',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['/api/echo?probe=wirejoin-1'] }],
      action: {
        responseSource: 'mock',
        bodyType: 'static',
        responseBody: '{"wire-served":true,"probe":"wirejoin-1"}',
        statusCode: 200,
        contentType: 'application/json',
        responseHeaders: { 'access-control-allow-origin': '*' },
      },
    },
  });

  // Watch the tab source, then issue the fetch FROM the page — through
  // the PAC, into the proxy, answered by the mock.
  await setToolWindowOpen(true);
  await playgroundRow().click();
  const served = await playground.evaluate(
    (url) => fetch(url).then((r) => r.text()),
    `http://${WIRE_JOIN_HOST}:3000/api/echo?probe=wirejoin-1`,
  );
  expect(served).toContain('wire-served');

  // The tab view's row upgrades IN PLACE: the ℹ join glyph lands on the
  // annotation rail once the derive-at-consume join matches the twins.
  const row = workbench.locator('.dt-row').filter({ hasText: 'wirejoin-1' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row.locator('.dt-annot-glyph')).toHaveAttribute('aria-label', 'System Proxy joined', {
    timeout: 15000,
  });
});

test('the joined row serves the response body over the wire — without Debug mode', async () => {
  // The tab is un-pinned (leg 5): the heuristic plane has no body path
  // of its own, so a served body can only arrive over the wire pull.
  await playgroundRow().hover();
  await expect(playgroundDebugAffordance()).toHaveAttribute('aria-pressed', 'false');

  await workbench.locator('.dt-row').filter({ hasText: 'wirejoin-1' }).first().click();
  const editorTab = workbench.getByRole('tab', { name: /irejoin-1/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await workbench.getByRole('tab', { name: 'Response', exact: true }).first().click();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await expect(workbench.locator('.view-line').filter({ hasText: 'wire-served' }).first()).toBeVisible({
    timeout: 15000,
  });
});

test('the wire twin wears the seen-on-tab annotation and jumps back to the tab source', async () => {
  await setToolWindowOpen(true);
  await workbench.locator('[data-testid="traffic-monitor-source-wire"]').first().click();

  // The twin row carries the seen annotation from the historical record
  // the tab view wrote at join time.
  const wireRow = workbench.locator('.dt-row').filter({ hasText: 'wirejoin-1' }).first();
  await expect(wireRow).toBeVisible({ timeout: 15000 });
  const glyph = wireRow.locator('.dt-annot-glyph');
  await expect(glyph).toHaveAttribute('aria-label', 'Seen on a browser tab', { timeout: 15000 });

  // The popover names the witnessing tab and offers the jump back.
  await glyph.hover();
  const popover = workbench.locator('.ant-popover').filter({ hasText: PLAYGROUND_TITLE }).first();
  await expect(popover).toBeVisible({ timeout: 10000 });
  await popover.getByRole('button', { name: 'Show in tab source' }).click();

  // Back on the tab source with the twin row selected.
  await expect(playgroundRow()).toHaveAttribute('aria-pressed', 'true');
  await expect(
    workbench.locator('.dt-row[data-selected="true"]').filter({ hasText: 'wirejoin-1' }).first(),
  ).toBeVisible({ timeout: 15000 });
});

// ── Phase 6 perf pins (PLAN §6 budgets) ─────────────────────────────

test('perf: the blind CONNECT tunnel splices near line rate', async () => {
  test.setTimeout(180000);
  // 32 MiB up + ~32 MiB echoed back per iteration; the tunnel target is
  // un-scoped, so the proxy leg is the pure `socket.pipe` splice. On
  // loopback the relative overhead is a WORST CASE — real networks are
  // orders of magnitude slower than the splice.
  const body = Buffer.alloc(32 * 1024 * 1024, 120);
  await timedEcho('tunnel-warm-direct', Buffer.alloc(1024, 120));
  await timedEcho('tunnel-warm-splice', Buffer.alloc(1024, 120), await openTunnel());

  const throughput = (r: { ms: number; bytes: number }) => (body.length + r.bytes) / 1024 / 1024 / (r.ms / 1000);
  const direct: number[] = [];
  const tunnel: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    direct.push(throughput(await timedEcho(`tunnel-direct-${i}`, body)));
    tunnel.push(throughput(await timedEcho(`tunnel-splice-${i}`, body, await openTunnel())));
  }
  const bestDirect = Math.max(...direct);
  const bestTunnel = Math.max(...tunnel);
  const deltaPct = ((bestDirect - bestTunnel) / bestDirect) * 100;

  console.log(
    `[debug-live perf] blind tunnel: direct ${bestDirect.toFixed(0)} MB/s, ` +
      `spliced ${bestTunnel.toFixed(0)} MB/s, delta ${deltaPct.toFixed(1)}% (loopback worst case)`,
  );
  // Gross-regression bound only — the ~1% PLAN budget is a real-network
  // budget; the ledger pins the measured loopback numbers.
  expect(bestTunnel).toBeGreaterThan(bestDirect * 0.5);
});

test('perf: the capture path adds low-single-digit ms per request', async () => {
  test.setTimeout(180000);
  // Absolute-form plain HTTP through the capture port rides the full
  // parse + enforce + tee path (the scoped-MITM cost minus TLS, which
  // rides the leaf cache). Fresh connection per request on both sides.
  for (let i = 0; i < 10; i += 1) {
    await timedGet(`/api/echo?warm-direct=${i}`, false);
    await timedGet(`/api/echo?warm-captured=${i}`, true);
  }
  const N = 120;
  const direct: number[] = [];
  const captured: number[] = [];
  for (let i = 0; i < N; i += 1) direct.push(await timedGet(`/api/echo?seq-direct=${i}`, false));
  for (let i = 0; i < N; i += 1) captured.push(await timedGet(`/api/echo?seq-captured=${i}`, true));
  const deltaMs = median(captured) - median(direct);
  // A page ≈ 50 requests riding ~6-way connection parallelism.
  const pageMs = deltaMs * Math.ceil(50 / 6);

  console.log(
    `[debug-live perf] capture path: direct ${median(direct).toFixed(2)}ms, ` +
      `captured ${median(captured).toFixed(2)}ms, delta ${deltaMs.toFixed(2)}ms/request ` +
      `(~${pageMs.toFixed(0)}ms per 50-request page)`,
  );
  expect(deltaMs).toBeLessThan(50);
});

test('perf: a 300-burst on the watched tab stays in budget with the join active', async () => {
  await setToolWindowOpen(true);
  // The tab source is selected (the jump-back leg) — the join seam is
  // live over the wire partition the earlier legs populated.
  const BURST_SIZE = 300;
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

  // Virtualization law: the DOM renders the viewport, not the stream.
  await filter.fill('');
  await workbench.waitForTimeout(500);
  const domRows = await workbench.locator('.dt-row').count();
  expect(domRows).toBeLessThan(150);

  // The join stayed derived through the burst's recomputes.
  await filter.fill('wirejoin-1');
  await expect(
    workbench.locator('.dt-row').filter({ hasText: 'wirejoin-1' }).first().locator('.dt-annot-glyph'),
  ).toHaveAttribute('aria-label', 'System Proxy joined');
  await filter.fill('');

  console.log(
    `[debug-live perf] ${BURST_SIZE}-burst with wire-join active: ${wallMs}ms ` +
      `(~${Math.round((BURST_SIZE / wallMs) * 1000)} req/s); DOM rows: ${domRows}`,
  );
});

// ── Manual-inspection hold ──────────────────────────────────────────

test('hold the stack open for manual inspection', async () => {
  test.skip(process.env.OH_E2E_HOLD !== '1', 'set OH_E2E_HOLD=1 to keep the stack open after the run');
  test.setTimeout(0);
  console.log('[debug-live] holding the desktop + extension + playground open — stop the runner to tear down');
  await new Promise(() => {});
});
