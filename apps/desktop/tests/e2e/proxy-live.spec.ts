/**
 * Proxy Live E2E — the observability Phase-2 wire plane against the real
 * dual-app stack (OBSERVABILITY_PLAN.md §5.1 routing + the S6 body
 * plane), the same chassis as `live-network.spec.ts`:
 *
 *   1. Launch the built desktop app with an isolated userData dir, mint
 *      a daemon token, start the capture proxy over the admin bridge and
 *      scope it, then launch Chromium with the built extension pointed
 *      at the daemon socket.
 *   2. Routing: flipping `oh.daemon.proxy.routing.set` pushes the folded
 *      verdict to the peer; the extension answers a `pac` ack and the
 *      browser's proxy settings hold a generated PAC that carries the
 *      scoped host AND the DIRECT failover leg.
 *   3. A scoped host's traffic ARRIVES at the proxy (the row is minted
 *      even though the upstream name never resolves — routed-arrival is
 *      the proof); an un-scoped host stays direct and mints nothing.
 *   4. A wire flap never clears the browser's routing config (explicit
 *      disable does) — the survive-flaps law.
 *   5. Body plane, driven as a plain HTTP client through the capture
 *      port (wire-truth needs no browser): out-of-row retention + the
 *      lazy Response-tab pull, mock without re-origination, network
 *      substitution over the real wire, request-body substitution
 *      proven by the echo, and the >512 KiB tee truncation that never
 *      touches the wire.
 *
 * Chromium never proxies loopback (implicit bypass), so the browser
 * legs ride `--host-resolver-rules`-mapped hostnames; loopback legs go
 * through the proxy as absolute-form plain HTTP, which the MITM path
 * enforces and captures without any CA trust.
 *
 * Deliberately NOT covered (manual live-pass items): both Firefox legs
 * (`proxy.onRequest` routing and the enterprise_roots empirical trust
 * gate need a real Firefox with the extension + system keychain), the
 * second-extension proxy conflict path, and the trust-pane rendering.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import * as http from 'node:http';
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
// Port etiquette: fresh ports off every prior suite (ledger through 19837).
const DAEMON_PORT = 19938;
const PROXY_PORT = 19939;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
// Mapped in the BROWSER only (--host-resolver-rules): the scoped one
// proves routed-arrival at the proxy (the desktop can't resolve it —
// `.test` is reserved-NXDOMAIN); the direct one proves scoped-only
// routing by succeeding without ever minting a row.
const SCOPED_HOST = 'proxy-scope.oh-e2e.test';
const DIRECT_HOST = 'direct.oh-e2e.test';
// Mirrors BODY_CAP_BYTES in daemon/proxy/body-store.ts.
const BODY_CAP_BYTES = 512 * 1024;

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

interface ChromeProxySettings {
  levelOfControl: string;
  value: { mode: string; pacScript?: { data?: string } };
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

/** The peer browser's applied proxy settings, read from an extension page. */
async function browserProxySettings(peer: ExtensionPeer): Promise<ChromeProxySettings> {
  const page = await peerPage(peer);
  return page.evaluate(
    async () =>
      new Promise<{ levelOfControl: string; value: { mode: string; pacScript?: { data?: string } } }>((resolve) => {
        chrome.proxy.settings.get({}, (details) =>
          resolve(
            details as unknown as { levelOfControl: string; value: { mode: string; pacScript?: { data?: string } } },
          ),
        );
      }),
  );
}

/**
 * A plain HTTP client through the capture port — absolute-form request
 * URL, the wire-truth posture (any app, not just browsers). Loopback
 * targets resolve fine from the desktop, so upstream legs are real.
 */
function viaProxy(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = http.request(
      {
        host: '127.0.0.1',
        port: PROXY_PORT,
        method: init?.method ?? 'GET',
        path: url,
        headers: { host: target.host, ...init?.headers },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    if (init?.body !== undefined) request.write(init.body);
    request.end();
  });
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

/** Open the Traffic Monitor and select the wire-capture source. */
async function openWireSource(): Promise<void> {
  await setToolWindowOpen(true);
  const wire = workbench.locator('[data-testid="traffic-monitor-source-wire"]').first();
  if ((await wire.getAttribute('aria-pressed')) !== 'true') {
    await wire.click();
  }
}

/** Captured rows carrying the given probe marker. */
function probeRows(marker: string) {
  return workbench.locator('.dt-row').filter({ hasText: marker });
}

/** Launch the extension profile with the browser-side host mappings. */
async function launchExtensionPeer(): Promise<ExtensionPeer> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      `--host-resolver-rules=MAP ${SCOPED_HOST} 127.0.0.1, MAP ${DIRECT_HOST} 127.0.0.1`,
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
    const key = await new Promise<CryptoKey>((resolve, reject) => {
      const open = indexedDB.open('oh-secret-cipher', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as CryptoKey);
      };
    });
    const record = {
      id: 'proxy-live-e2e-backend',
      label: 'proxy-live e2e desktop',
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
      console.log(`[proxy-live setup] seed attempt ${attempt} failed: ${String(err).split('\n')[0]}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const landed = await backendsSeeded(peer).catch(() => false);
      if (landed) return;
    }
  }
  throw new Error(`seedBackend failed: ${String(seedError)}`);
}

/** Minimal MCP tools/call — how the suite mints enforcement rules. */
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

function setupStep(message: string): void {
  console.log(`[proxy-live setup ${new Date().toISOString()}] ${message}`);
}

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-proxy-live-e2e-'));
  await writeFile(
    path.join(userData, 'storage.json'),
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

  const minted = await bridgeInvoke<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'proxy-live-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  setupStep('daemon token minted');

  const started = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.start',
    port: PROXY_PORT,
  });
  expect(started.ok, started.error).toBe(true);
  const scoped = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.scope.set',
    patterns: [SCOPED_HOST],
  });
  expect(scoped.ok, scoped.error).toBe(true);
  setupStep('capture proxy started + scoped');

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

// ── Panel reflects the running capture ──────────────────────────────

test('the Traffic Monitor shows the wire capture running on its port', async () => {
  await openWireSource();
  await expect(workbench.locator('.rules-bottom-panel').getByText(String(PROXY_PORT)).first()).toBeVisible();
});

// ── Routing push: PAC ack + browser config ──────────────────────────

test('enabling routing pushes a scoped PAC with DIRECT failover to the browser', async () => {
  if (!peerA) throw new Error('peer A not launched');
  const flipped = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.routing.set',
    enabled: true,
  });
  expect(flipped.ok, flipped.error).toBe(true);

  // The peer acks with its applied mode — Chromium applies a PAC.
  await expect
    .poll(
      async () => {
        const status = await routingStatus();
        return status.active && status.peers.some((peer) => peer.applied && peer.mode === 'pac');
      },
      { timeout: 15000 },
    )
    .toBe(true);

  // Browser-truth: the extension controls the proxy settings, the PAC
  // routes the scoped host to the capture port, and every leg carries
  // the DIRECT failover (a dead capture port degrades to a capture gap,
  // never broken browsing).
  const settings = await browserProxySettings(peerA);
  expect(settings.levelOfControl).toBe('controlled_by_this_extension');
  expect(settings.value.mode).toBe('pac_script');
  const pac = settings.value.pacScript?.data ?? '';
  expect(pac).toContain(SCOPED_HOST);
  expect(pac).toContain(`PROXY 127.0.0.1:${PROXY_PORT}`);
  expect(pac).toContain('DIRECT');
});

// ── Scoped-only routing, proven on the wire ─────────────────────────

test('a scoped host arrives at the proxy; an un-scoped host stays direct', async () => {
  // The scoped fetch fails upstream (the desktop cannot resolve the
  // mapped name) — irrelevant: the row minted at the proxy IS the
  // routed-arrival proof, end to end through the browser's PAC.
  await playground
    .evaluate(
      (url) =>
        fetch(url)
          .then((r) => r.text())
          .catch(() => 'routed-fetch-failed'),
      `http://${SCOPED_HOST}:3000/api/echo?probe=routed-1`,
    )
    .catch(() => undefined);
  await openWireSource();
  await expect(probeRows('routed-1').first()).toBeVisible({ timeout: 15000 });

  // The un-scoped mapped host resolves IN the browser and succeeds
  // direct — and the proxy never sees it.
  const directBody = await playground.evaluate(
    (url) => fetch(url).then((r) => r.text()),
    `http://${DIRECT_HOST}:3000/api/echo?probe=direct-1`,
  );
  expect(directBody).toContain('direct-1');
  await workbench.waitForTimeout(1500);
  await expect(probeRows('direct-1')).toHaveCount(0);
});

// ── Survive-flaps vs explicit disable ───────────────────────────────

test('routing survives a wire flap and clears only on explicit disable', async () => {
  if (!peerA) throw new Error('peer A not launched');

  // Flap the wire: disable the backend record — the browser keeps the
  // routing config (only an explicit disabled PUSH clears it).
  await seedBackend(peerA, { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token, enabled: false });
  await expect.poll(async () => (await routingStatus()).peers.length, { timeout: 15000 }).toBe(0);
  const duringFlap = await browserProxySettings(peerA);
  expect(duringFlap.value.mode).toBe('pac_script');

  // Wire back: the peer re-acks.
  await seedBackend(peerA, { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token, enabled: true });
  await expect
    .poll(
      async () => {
        const status = await routingStatus();
        return status.peers.some((peer) => peer.applied && peer.mode === 'pac');
      },
      { timeout: 20000 },
    )
    .toBe(true);

  // Explicit disable clears the browser config.
  const flipped = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.routing.set',
    enabled: false,
  });
  expect(flipped.ok, flipped.error).toBe(true);
  await expect
    .poll(async () => (await browserProxySettings(peerA as ExtensionPeer)).value.mode, { timeout: 15000 })
    .not.toBe('pac_script');
});

// ── Body plane: retention + the lazy Response-tab pull ──────────────

test('a captured response body is retained and the Response tab pulls it lazily', async () => {
  const echoed = await viaProxy(`${PLAYGROUND_URL}api/echo?probe=retained-1`);
  expect(echoed.status).toBe(200);
  expect(echoed.body).toContain('retained-1');

  await openWireSource();
  await expect(probeRows('retained-1').first()).toBeVisible({ timeout: 15000 });

  // Inspect the row as a main editor tab, open its Response tab — the
  // body arrives over the lifeline's lazy `request-body` pull, served
  // from the out-of-row store.
  await probeRows('retained-1').first().click();
  const editorTab = workbench.getByRole('tab', { name: /etained-1/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await workbench.getByRole('tab', { name: 'Response', exact: true }).first().click();
  // The inspected tab must HOLD selection — a data update stealing it
  // would be an identity-churn bug, not a test flake.
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await expect(workbench.locator('.view-line').filter({ hasText: 'retained-1' }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ── Mock: never re-originates ───────────────────────────────────────

test('a mock rule serves without re-origination', async () => {
  await callTool('rules_create', {
    rule: {
      name: 'proxy-live mock',
      type: 'response',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['/api/none?probe=mock-1'] }],
      action: {
        responseSource: 'mock',
        bodyType: 'static',
        responseBody: '{"mocked":true,"probe":"mock-1"}',
        statusCode: 418,
        contentType: 'application/json',
        responseHeaders: {},
      },
    },
  });

  // A dead upstream port: only a mock that never re-originates answers.
  await expect
    .poll(
      async () => {
        const served = await viaProxy('http://127.0.0.1:59999/api/none?probe=mock-1');
        return served.status === 418 && served.body.includes('"mocked":true') ? 'mocked' : served.status;
      },
      { timeout: 15000 },
    )
    .toBe('mocked');
});

// ── Network substitution: real wire, replaced body ──────────────────

test('a network substitution keeps the real wire and replaces the body', async () => {
  await callTool('rules_create', {
    rule: {
      name: 'proxy-live network substitution',
      type: 'response',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['/api/echo?probe=netsub-1'] }],
      action: {
        responseSource: 'network',
        bodyType: 'static',
        responseBody: '{"substituted":true}',
        statusCode: 0,
        contentType: '',
        responseHeaders: {},
      },
    },
  });

  await expect
    .poll(
      async () => {
        const served = await viaProxy(`${PLAYGROUND_URL}api/echo?probe=netsub-1`);
        // Real wire: the echo's own status and marker header survive
        // (statusCode 0 / empty CT = keep-original sentinels); the body
        // is the literal.
        return served.status === 200 && served.headers['x-oh-echo'] === 'api' && served.body === '{"substituted":true}'
          ? 'substituted'
          : `${served.status}:${served.body.slice(0, 40)}`;
      },
      { timeout: 15000 },
    )
    .toBe('substituted');
});

// ── Request-body substitution: proven by the echo ───────────────────

test('a request-body rule rewrites the upstream body', async () => {
  await callTool('rules_create', {
    rule: {
      name: 'proxy-live request body',
      type: 'request-body',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['/api/echo?probe=reqbody-1'] }],
      action: {
        bodyType: 'static',
        requestBody: '{"rewritten":true}',
        resourceType: 'rest',
      },
    },
  });

  await expect
    .poll(
      async () => {
        const served = await viaProxy(`${PLAYGROUND_URL}api/echo?probe=reqbody-1`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"original":true}',
        });
        const parsed = JSON.parse(served.body) as { body?: { raw?: string } };
        return parsed.body?.raw === '{"rewritten":true}' ? 'rewritten' : (parsed.body?.raw ?? served.status);
      },
      { timeout: 15000 },
    )
    .toBe('rewritten');
});

// ── Tee truncation: fidelity degrades, the wire never does ──────────

test('an over-cap body truncates the capture, never the wire', async () => {
  const filler = 'x'.repeat(BODY_CAP_BYTES + 128 * 1024);
  const served = await viaProxy(`${PLAYGROUND_URL}api/echo?probe=overcap-1`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: filler,
  });
  // The echo reflects the whole body back, so the RESPONSE exceeds the
  // 512 KiB tee cap — and the client still receives every byte.
  expect(served.status).toBe(200);
  expect(served.body.length).toBeGreaterThan(BODY_CAP_BYTES);
  expect(served.body).toContain(filler.slice(0, 64));

  await openWireSource();
  await expect(probeRows('overcap-1').first()).toBeVisible({ timeout: 15000 });
});

// ── Manual-inspection hold ──────────────────────────────────────────

test('hold the stack open for manual inspection', async () => {
  test.skip(process.env.OH_E2E_HOLD !== '1', 'set OH_E2E_HOLD=1 to keep the stack open after the run');
  test.setTimeout(0);
  console.log('[proxy-live] holding the desktop + extension + playground open — stop the runner to tear down');
  await new Promise(() => {});
});
