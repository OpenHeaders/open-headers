/**
 * gRPC forwarded posture — the combined live-pass E-legs (E1–E8) as a
 * permanent gate, on the daemon-join harness: real Chromium with the
 * built extension, a spawned headless daemon as the real backend, and
 * the real playground gRPC probe (own tsx child on its own port, so a
 * stale reused playground can't skew the legs) plus a self-signed TLS
 * terminator for the verify-off leg.
 *
 *   E2  opt-in OFF → the forwarded Invoke renders the honest refusal
 *       naming the setting; the wire stays intact.
 *   E3  opt-in ON → forwarded unary round-trips 0 OK with the decoded
 *       message and the probe's metadata/trailers.
 *   E7  bearer auth reaches the wire (the probe mirrors the received
 *       `authorization` back as `x-echo-authorization`); an explicit
 *       authorization metadata row wins over the auth tab.
 *   E8  default TLS verify rejects the self-signed target; flipping
 *       SSL verification off round-trips through the terminator.
 *   E4  forwarded server stream fans `grpcStreamEvent` frames back
 *       into the timeline live, with session timestamps, and settles.
 *   E6  Stop mid-stream keeps the arrived frames, shows the Stopped
 *       badge, and the pill reads 1 CANCELLED (display-side law).
 *   E5  client/bidi: the timeline mounts INSTANTLY on invoke (the S12
 *       seeded-live-state law), the corner Send/End controls drive the
 *       FORWARDED stream by sendId, a strict-encode mismatch fails the
 *       rider alone (stream intact), and the echo/summary settle 0 OK.
 *   E1  daemon gone → Invoke disables with the connect-the-desktop-app
 *       copy while composing stays usable.
 *
 * Deliberately NOT here (covered elsewhere): `executedOn` stamping and
 * template-token resolution (daemon handler unit matrices), the
 * ⌘⇧↵/⌘⇧E chords (jsdom editor matrix — platform-modifier dispatch is
 * not portable under Playwright), and the D-legs (desktop in-process).
 *
 * Requires builds: extension `dist/chrome` and
 * `pnpm turbo build --filter=@openheaders/daemon`.
 *
 * Seeding: the daemon boots once to mint its default workspace (MCP
 * write, the daemon-join recipe), then its storage.json gains the
 * BookService spec + a collection + eight gRPC requests (built and
 * schema-validated by `fixtures/grpc-seed.ts` under tsx) and the
 * daemon reboots on them. The extension joins consume-only and the
 * entities replicate down the WS pipe — the production shape.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import type tls from 'node:tls';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { startGrpcTlsTerminator } from './fixtures/grpc-tls-terminator';
import { WorkbenchPage } from './pages/workbench-page';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXT_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Off every other suite's ports (daemon 8137/18137/18238; the manual
// live-pass rig rides 3130/3131).
const DAEMON_PORT = 18438;
const GRPC_PORT = 3230;
const GRPC_TLS_PORT = 3231;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-grpc-e2e', version: '0.0.0' },
};

let daemon: ChildProcess | undefined;
let daemonExited: Promise<number | null> | undefined;
let probe: ChildProcess | undefined;
let tlsTerminator: tls.Server | undefined;
let dataDir: string;
let token: string;
let workspaceId: string;
let workspaceName: string;
let extensionContext: BrowserContext | undefined;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
const daemonLog: string[] = [];

async function rpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const json = await rpc('tools/call', { name, arguments: args });
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

function spawnDaemon(): void {
  daemon = spawn(
    electronBinary,
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(DAEMON_PORT)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemon.stdout, daemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  const child = daemon;
  daemonExited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

async function waitDaemonHealthy(): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`http://127.0.0.1:${DAEMON_PORT}/healthz`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
}

async function stopDaemon(): Promise<void> {
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  daemon = undefined;
}

/** Merge `patch` into storage.json's `values` (daemon must be stopped). */
async function patchStorageValues(patch: Record<string, unknown>): Promise<void> {
  const storagePath = path.join(dataDir, 'storage.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, patch);
  await writeFile(storagePath, JSON.stringify(envelope));
}

async function setPeerExecute(enabled: boolean): Promise<void> {
  const storagePath = path.join(dataDir, 'storage.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  const settings = (envelope.values['oh.settings.user'] as Record<string, unknown>) ?? {};
  settings['backend.allowPeerExecute'] = enabled;
  envelope.values['oh.settings.user'] = settings;
  await writeFile(storagePath, JSON.stringify(envelope));
}

// ── gRPC editor locators (visible-scoped — background tabs stay mounted) ──

function invokeButton() {
  return page.getByTestId('grpc-invoke-button').filter({ visible: true }).first();
}

function statusTag() {
  return page.getByTestId('grpc-status-tag').filter({ visible: true }).first();
}

function streamPane() {
  return page.getByTestId('grpc-stream-pane').filter({ visible: true }).first();
}

function timelineMessageRows() {
  return page.getByTestId('grpc-timeline-message-row').filter({ visible: true });
}

async function openGrpcRequest(uid: string): Promise<void> {
  const row = page.locator(`[data-item-id="grpc-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = page.locator('[data-item-id="req-col-e2ecol01"]');
    await collection.waitFor({ state: 'visible', timeout: 10000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await invokeButton().waitFor({ state: 'visible', timeout: 10000 });
}

/** Wait until the live invoke gate settles on the expected enablement. */
async function waitInvokeEnabled(enabled: boolean): Promise<void> {
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 30000 }).toBe(enabled);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Real probe on its own port — a tsx child because the probe imports
  // core TS source the Playwright loader can't resolve in-process.
  probe = spawn('pnpm', ['exec', 'tsx', path.join(__dirname, 'fixtures/grpc-probe-launch.ts')], {
    cwd: EXT_ROOT,
    env: { ...process.env, OH_E2E_GRPC_PORT: String(GRPC_PORT) },
  });
  const probeReady = new Promise<void>((resolve, reject) => {
    probe?.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('grpc-probe-ready')) resolve();
    });
    probe?.once('exit', (code) => reject(new Error(`grpc probe exited early (${code})`)));
  });
  await probeReady;

  tlsTerminator = await startGrpcTlsTerminator(GRPC_TLS_PORT, GRPC_PORT);

  // Offline admin bootstrap — the daemon-join recipe.
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-grpc-e2e-'));
  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        // backend.allowPeerExecute deliberately ABSENT — default OFF,
        // the E2 refusal leg. Flipped ON between legs via storage edit
        // + daemon restart (the setting is re-read per frame).
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: 'grpc-e2e-token',
            tokenHash,
            label: 'grpc forwarded e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
});

test.afterAll(async () => {
  await extensionContext?.close();
  await stopDaemon();
  if (probe && probe.exitCode === null) probe.kill('SIGTERM');
  await new Promise<void>((resolve) => (tlsTerminator ? tlsTerminator.close(() => resolve()) : resolve()));
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

// ── Boot + seed ─────────────────────────────────────────────────────

test('the daemon mints its workspace and reboots on the seeded gRPC entities', async () => {
  spawnDaemon();
  await waitDaemonHealthy();

  // Force the default workspace into existence (MCP write — the
  // daemon-join recipe), then learn its identity.
  await rpc('initialize', INITIALIZE_PARAMS);
  await callTool('rules_create', {
    rule: {
      name: 'gRPC e2e marker rule',
      type: 'header',
      enabled: false,
      published: false,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Grpc-E2E', value: 'marker' }],
        responseHeaders: [],
      },
    },
  });
  const workspaces = await callTool('workspaces_list', {});
  const first = (workspaces.workspaces as Array<{ id: string; name: string }>)[0];
  expect(first).toBeTruthy();
  workspaceId = first.id;
  workspaceName = first.name;

  // Seed the workspace slots with schema-validated entities and reboot.
  await stopDaemon();
  const seeded = spawnSync('pnpm', ['exec', 'tsx', path.join(__dirname, 'fixtures/grpc-seed.ts')], {
    cwd: EXT_ROOT,
    env: {
      ...process.env,
      OH_E2E_GRPC_PORT: String(GRPC_PORT),
      OH_E2E_GRPC_TLS_PORT: String(GRPC_TLS_PORT),
      OH_E2E_WORKSPACE_ID: workspaceId,
    },
    encoding: 'utf-8',
  });
  expect(seeded.status, seeded.stderr).toBe(0);
  await patchStorageValues(JSON.parse(seeded.stdout) as Record<string, unknown>);
  spawnDaemon();
  await waitDaemonHealthy();
});

test('the extension joins and the gRPC entities replicate down', async () => {
  test.setTimeout(150000);
  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2];

  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // Keep a client page attached so the MV3 SW never idles out mid-test.
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Point the extension at the daemon — the daemon-join seed recipe
  // (registry record encrypted with the SW's own at-rest key; the SW
  // can restart between acquire and evaluate, so retry).
  const seedBackend = async (): Promise<void> => {
    const worker = extensionContext?.serviceWorkers().at(-1) ?? (await extensionContext?.waitForEvent('serviceworker'));
    if (!worker) throw new Error('no extension service worker');
    await worker.evaluate(
      async ({ backendUrl, authToken }: { backendUrl: string; authToken: string }) => {
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
          id: 'grpc-e2e-backend',
          label: 'grpc e2e daemon',
          url: backendUrl,
          authToken,
          autoConnect: true,
          enabled: true,
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
      },
      { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token },
    );
  };
  let seedError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await seedBackend();
      seedError = undefined;
      break;
    } catch (err) {
      seedError = err;
      await popup.waitForTimeout(1000);
    }
  }
  expect(seedError, String(seedError)).toBeUndefined();

  // Every replicated key of the joined workspace, with a content marker
  // per slot of interest — one readback drives both polls below and
  // makes a replication gap legible in the failure message.
  const replicatedState = async (): Promise<{ keys: string[]; hasRule: boolean; hasGrpc: boolean }> => {
    const worker = extensionContext?.serviceWorkers().at(-1);
    if (!worker) return { keys: [], hasRule: false, hasGrpc: false };
    return worker.evaluate(
      async (wsId: string) =>
        new Promise<{ keys: string[]; hasRule: boolean; hasGrpc: boolean }>((resolve) => {
          chrome.storage.local.get(null, (items) => {
            const keys = Object.keys(items).filter((k) => k.startsWith('oh.ws.'));
            resolve({
              keys,
              hasRule: JSON.stringify(items[`oh.ws.${wsId}.rules`] ?? '').includes('gRPC e2e marker rule'),
              hasGrpc: JSON.stringify(items[`oh.ws.${wsId}.grpcRequests`] ?? '').includes('e2egrpc1'),
            });
          });
        }),
      workspaceId,
    );
  };

  // The join itself: the daemon's marker rule replicates (daemon-join's
  // proven leg) — its absence means the WS pipe never came up.
  await expect
    .poll(async () => (await replicatedState()).hasRule, {
      timeout: 45000,
      message: 'the daemon workspace never replicated — the extension did not join the WS backend',
    })
    .toBe(true);

  // The seeded gRPC entities ride the same pipe.
  const finalState = await replicatedState();
  await expect
    .poll(async () => (await replicatedState()).hasGrpc, {
      timeout: 30000,
      message: `grpcRequests slot missing from replication; replicated keys: ${finalState.keys.join(', ')}`,
    })
    .toBe(true);
});

test('the workbench opens on the joined workspace', async () => {
  page = await extensionContext?.newPage();

  // Pin the tab to the daemon workspace via the URL hash — the per-tab
  // binding contract (`#/ws/<wsId>`), deterministic where driving the
  // switcher dropdown is not (the daemon's default workspace shares the
  // local one's name).
  await page.goto(`chrome-extension://${extensionId}/workbench.html#/ws/${workspaceId}`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  workbench = new WorkbenchPage(page);

  try {
    await workbench.showRequestsView();
    await workbench.collapseDocsPanel();
    await page.locator('[data-item-id="req-col-e2ecol01"]').waitFor({ state: 'visible', timeout: 15000 });
  } catch (err) {
    const active = await workbench.rpc<{ workspace?: { id: string; name: string } }>('getActiveWorkspace');
    const sidebar = await page
      .locator('[data-item-id]')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-item-id')));
    const slots = await page.evaluate(
      async (wsId: string) =>
        new Promise<string>((resolve) => {
          chrome.storage.local.get(null, (items) => {
            const summary = Object.entries(items)
              .filter(([k]) => k.startsWith(`oh.ws.${wsId}.`))
              .map(([k, v]) => `${k}=${JSON.stringify(v).length}b`);
            resolve(summary.join(', '));
          });
        }),
      workspaceId,
    );
    await page.screenshot({ path: test.info().outputPath('joined-workspace-tree.png'), fullPage: true });
    throw new Error(
      `joined-workspace tree missing (expected ws ${workspaceId} "${workspaceName}"); ` +
        `url=${page.url()}; active=${JSON.stringify(active)}; ` +
        `visible item ids: ${sidebar.join(', ')}; slots: ${slots}`,
      { cause: err },
    );
  }
});

// ── E2: opt-in refusal ──────────────────────────────────────────────

test('opt-in OFF: the forwarded Invoke renders the refusal naming the setting', async () => {
  await openGrpcRequest('e2egrpc1');
  await waitInvokeEnabled(true);
  await invokeButton().click();
  const errorState = page.getByTestId('grpc-response-error-state').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 15000 });
  await expect(errorState).toContainText(/disabled on this host/);
});

// ── E3: forwarded unary OK ──────────────────────────────────────────

test('flipping backend.allowPeerExecute on lets the same Invoke round-trip 0 OK', async () => {
  test.setTimeout(150000);
  await stopDaemon();
  await setPeerExecute(true);
  spawnDaemon();
  await waitDaemonHealthy();

  // The gate reads the live connection — wait for the reconnect.
  await waitInvokeEnabled(true);
  await expect
    .poll(
      async () => {
        await invokeButton().click();
        const ok = await statusTag()
          .filter({ hasText: '0 OK' })
          .isVisible()
          .catch(() => false);
        if (ok) return true;
        // First attempts can race the WS reconnect; retry on the error state.
        await page.waitForTimeout(2000);
        return statusTag()
          .filter({ hasText: '0 OK' })
          .isVisible()
          .catch(() => false);
      },
      { timeout: 60000 },
    )
    .toBe(true);

  // Decoded message + probe metadata prove the real wire round-trip.
  const responsePane = page.getByTestId('grpc-response-pane').filter({ visible: true }).first();
  await expect(responsePane).toContainText('The Open Headers Field Guide');
  await workbench.openResponseTab(/Metadata/);
  await expect(responsePane).toContainText('x-probe');
  await workbench.openResponseTab(/Trailers/);
  await expect(responsePane).toContainText('x-probe-region');
});

// ── E7: bearer auth on the forwarded wire ───────────────────────────

test('bearer auth reaches the wire as authorization metadata', async () => {
  await openGrpcRequest('e2egrpc6');
  await invokeButton().click();
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 20000 });
  await workbench.openResponseTab(/Metadata/);
  const responsePane = page.getByTestId('grpc-response-pane').filter({ visible: true }).first();
  await expect(responsePane).toContainText('x-echo-authorization');
  await expect(responsePane).toContainText('Bearer e2e-secret-token');
});

test('an explicit authorization metadata row wins over the auth tab', async () => {
  await openGrpcRequest('e2egrpc7');
  await invokeButton().click();
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 20000 });
  await workbench.openResponseTab(/Metadata/);
  const responsePane = page.getByTestId('grpc-response-pane').filter({ visible: true }).first();
  await expect(responsePane).toContainText('Bearer explicit-row-wins');
});

// ── E8: TLS verify-off ──────────────────────────────────────────────

test('default TLS verify rejects the self-signed target; verify-off round-trips', async () => {
  await openGrpcRequest('e2egrpc8');
  await invokeButton().click();
  const errorState = page.getByTestId('grpc-response-error-state').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20000 });

  // Flip SSL verification off in the Settings tab — a draft edit; the
  // Invoke sends the current compose state.
  await workbench.openEditorTab(/Settings/);
  await page.getByTestId('grpc-ssl-verify').filter({ visible: true }).first().click();
  await invokeButton().click();
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 20000 });
});

// ── E4: forwarded server stream ─────────────────────────────────────

test('a forwarded server stream fans frames back into the timeline live', async () => {
  await openGrpcRequest('e2egrpc2');
  await invokeButton().click();
  await streamPane().waitFor({ state: 'visible', timeout: 15000 });
  // The ↑ composed request frame plus three ↓ books (capture records
  // BOTH directions) arrive over the backend wire and the call settles.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20000 }).toBe(4);
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15000 });
  // Live-session frames carry timestamps (the session-only law).
  expect(await page.getByTestId('grpc-timeline-message-time').filter({ visible: true }).count()).toBeGreaterThan(0);
});

// ── E6: cancel mid-stream ───────────────────────────────────────────

test('Stop mid-stream keeps arrived frames and reads 1 CANCELLED', async () => {
  await openGrpcRequest('e2egrpc3');
  await invokeButton().click();
  await streamPane().waitFor({ state: 'visible', timeout: 15000 });
  // The ↑ request frame plus at least two ↓ books mid-stream.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20000 }).toBeGreaterThanOrEqual(3);
  // Invoke has morphed into Stop.
  await invokeButton().click();
  await page
    .getByTestId('grpc-stopped-tag')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });
  await expect(statusTag()).toContainText('1 CANCELLED');
  expect(await timelineMessageRows().count()).toBeGreaterThanOrEqual(3);
});

// ── E5: client stream + riders ──────────────────────────────────────

test('client stream: the timeline mounts instantly and the riders drive the forwarded stream', async () => {
  await openGrpcRequest('e2egrpc4');
  await invokeButton().click();

  // S12 law: the seeded live state mounts the timeline immediately —
  // no wire event has arrived yet on a client stream.
  const sentRow = page.getByTestId('grpc-timeline-sent-row').filter({ visible: true }).first();
  await sentRow.waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('grpc-streaming-badge').filter({ visible: true }).first().waitFor({ state: 'visible' });

  // Two upstream sends through the corner control (rider → daemon).
  const sendButton = page.getByTestId('grpc-stream-send').filter({ visible: true }).first();
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15000 }).toBe(1);
  await sendButton.click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15000 }).toBe(2);

  // Strict encode: a buffer that doesn't match the input type fails
  // the RIDER alone — toast, stream intact.
  await workbench.openEditorTab(/Message/);
  await workbench.fillMonaco(0, '{"nope":1}');
  await sendButton.click();
  // The toast carries the rider's EXACT encode error (the fallback copy
  // appears only when the RPC dies without one).
  await page
    .locator('.ant-message')
    .getByText(/Unknown field `nope`/)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('grpc-streaming-badge').filter({ visible: true }).first().waitFor({ state: 'visible' });

  // Restore a valid buffer, send, half-close → summary ↓ + 0 OK.
  await workbench.fillMonaco(0, '{"book":{"name":"books/e2e-3"}}');
  await sendButton.click();
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15000 }).toBe(3);
  await page.getByTestId('grpc-stream-end').filter({ visible: true }).first().click();
  // The summary ↓ frame joins the three ↑ frames.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15000 }).toBe(4);
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15000 });
  await expect(streamPane()).toContainText('bookCount');
});

// ── E5 (bidi): echo through the forwarded stream ────────────────────

test('bidi: a sent message echoes back through the forwarded stream', async () => {
  await openGrpcRequest('e2egrpc5');
  await invokeButton().click();
  await page
    .getByTestId('grpc-timeline-sent-row')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });

  const sendButton = page.getByTestId('grpc-stream-send').filter({ visible: true }).first();
  await sendButton.click();
  // The ↑ frame and the probe's echo ↓ both land in the timeline.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15000 }).toBe(2);
  await expect(streamPane()).toContainText('echo: hello');

  await page.getByTestId('grpc-stream-end').filter({ visible: true }).first().click();
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15000 });
});

// ── E1: no-companion affordance ─────────────────────────────────────

test('daemon gone: Invoke disables with the connect copy while composing stays usable', async () => {
  await stopDaemon();
  await openGrpcRequest('e2egrpc1');
  await waitInvokeEnabled(false);

  // The honest tooltip on the disabled Invoke.
  await invokeButton().hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(/Connect the desktop app to invoke/)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  // Compose stays usable — the method selector still opens and lists
  // the linked spec's rpcs.
  await page.getByTestId('grpc-method-select').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .getByText('WatchBooks', { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.keyboard.press('Escape');
});
