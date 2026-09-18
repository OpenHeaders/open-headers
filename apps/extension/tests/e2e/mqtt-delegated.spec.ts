/**
 * Delegated MQTT session — the Execution Place epic's extension gate,
 * the reporter's case as a permanent leg: an `mqtt://` dial (raw TCP,
 * which no browser page can open) RUNS from the extension once a place
 * that can dial it is connected. On the daemon-join harness (the
 * grpc-forwarded idiom): real Chromium with the built extension, a
 * spawned headless daemon joined as the workspace's server, and the
 * playground's REAL aedes broker on its TCP listener (the Playwright
 * webServer boots the playground).
 *
 *   D1  the chip beside Connect names the server place ("Runs on
 *       <place>", the delegated row) and Connect is ENABLED on the tcp
 *       scheme — the honesty gate that named the scheme as a limit
 *       is gone once a leg exists; the popover words the resolved-here
 *       / socket-there contract.
 *   D2  opt-in OFF → the delegated open renders the host-aware refusal
 *       notice inside the timeline, naming the setting.
 *   D3  opt-in ON → the session walk over the delegated socket: the
 *       server's CONNACK (3.1.1, Connection Accepted), the pre-seeded
 *       retained message on subscribe, Send echoing through the probe's
 *       reply topic; the Before connect script ran IN THE CONTEXT (the
 *       page realm) — the CONNECT the server dialled carries the
 *       scripted client id; Disconnect settles clean and the timeline
 *       header attributes the run to the answering host ("Sent from").
 *   D4  daemon gone → the chip falls back to the honest companion
 *       state ("Needs the desktop app") and Connect disables with the
 *       tcp-scheme copy — never a silent downgrade to ws.
 *
 * Requires builds: extension `dist/chrome` and
 * `pnpm turbo build --filter=@openheaders/daemon`.
 *
 * Seeding: the daemon boots once to mint its default workspace (MCP
 * write, the daemon-join recipe), then its storage.json gains the
 * collection + the MQTT request (built and schema-validated by
 * `fixtures/mqtt-delegated-seed.ts` under tsx) and the daemon reboots
 * on them. The extension joins consume-only and the entities replicate
 * down the WS pipe — the production shape.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { seedEncryptedBackendRegistry } from './fixtures/backend-seed';
import { WorkbenchPage } from './pages/workbench-page';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXT_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Off every other suite's ports (daemon 8137/18137/18238/18438; the
// manual live-pass rig rides 3130/3131 — 3131 IS the playground's MQTT
// TCP listener this suite dials).
const DAEMON_PORT = 18838;
const MQTT_PORT = Number(process.env.OH_PLAYGROUND_MQTT_PORT ?? 3131);
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
// The record's label is the place's name (the place law: the user's
// own label first) — what the chip and the picker read.
const BACKEND_LABEL = 'mqtt e2e daemon';
const CONNECT_TCP_SCHEME_COPY = 'mqtt:// and mqtts:// open a raw TCP socket the browser cannot';

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-mqtt-delegated-e2e', version: '0.0.0' },
};

let daemon: ChildProcess | undefined;
let daemonExited: Promise<number | null> | undefined;
let dataDir: string;
let token: string;
let workspaceId: string;
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
      { timeout: 20_000 },
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
  settings['backend.allowLocalPeerExecute'] = enabled;
  envelope.values['oh.settings.user'] = settings;
  await writeFile(storagePath, JSON.stringify(envelope));
}

// ── MQTT editor locators (visible-scoped — background tabs stay mounted) ──

function connectButton() {
  return page.getByTestId('mqtt-connect-button').filter({ visible: true }).first();
}

function urlInput() {
  return page.getByTestId('mqtt-url-input').filter({ visible: true }).first();
}

function placeChip() {
  return page.getByTestId('execution-place-chip').filter({ visible: true }).first();
}

function sendButton() {
  return page.getByTestId('mqtt-send-message').filter({ visible: true }).first();
}

function liveBadge() {
  return page.getByTestId('mqtt-session-live-badge').filter({ visible: true }).first();
}

function endTag() {
  return page.getByTestId('mqtt-session-end-tag').filter({ visible: true }).first();
}

function timelineMessageRows() {
  return page.getByTestId('mqtt-timeline-message-row').filter({ visible: true });
}

function sessionPane() {
  return page.getByTestId('mqtt-session-pane').filter({ visible: true }).first();
}

async function openMqttRequest(uid: string): Promise<void> {
  const row = page.locator(`[data-item-id="mqtt-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = page.locator('[data-item-id="req-col-e2emqc01"]');
    await collection.waitFor({ state: 'visible', timeout: 5_000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  await row.click();
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
}

/** The chip reads the live wire: the server leg exists only while the
 *  joined record's sync slot is green, so a boot or a restart settles
 *  on the delegated row after the reconnect. */
async function waitChipRunsOnServer(): Promise<void> {
  await expect.poll(async () => placeChip().textContent(), { timeout: 20_000 }).toBe(`Runs on ${BACKEND_LABEL}`);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Offline admin bootstrap — the daemon-join recipe.
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-mqtt-delegated-e2e-'));
  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        // The loopback tier's opt-in seeded OFF (its default is ON —
        // pairing is the consent), the D2 refusal leg. Flipped ON
        // between legs via storage edit + daemon restart (the setting
        // is re-read per frame).
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true, 'backend.allowLocalPeerExecute': false },
        'oh.daemonAuthTokens': [
          {
            id: 'mqtt-delegated-e2e-token',
            tokenHash,
            label: 'mqtt delegated e2e',
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
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

// ── Boot + seed ─────────────────────────────────────────────────────

test('the daemon mints its workspace and reboots on the seeded MQTT entities', async () => {
  spawnDaemon();
  await waitDaemonHealthy();

  await rpc('initialize', INITIALIZE_PARAMS);
  await callTool('rules_create', {
    rule: {
      name: 'MQTT e2e marker rule',
      type: 'header',
      enabled: false,
      published: false,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Mqtt-E2E', value: 'marker' }],
        responseHeaders: [],
      },
    },
  });
  const workspaces = await callTool('workspaces_list', {});
  const first = (workspaces.workspaces as Array<{ id: string; name: string }>)[0];
  expect(first).toBeTruthy();
  workspaceId = first.id;

  await stopDaemon();
  const seeded = spawnSync('pnpm', ['exec', 'tsx', path.join(__dirname, 'fixtures/mqtt-delegated-seed.ts')], {
    cwd: EXT_ROOT,
    env: { ...process.env, OH_E2E_MQTT_PORT: String(MQTT_PORT), OH_E2E_WORKSPACE_ID: workspaceId },
    encoding: 'utf-8',
  });
  expect(seeded.status, seeded.stderr).toBe(0);
  await patchStorageValues(JSON.parse(seeded.stdout) as Record<string, unknown>);
  spawnDaemon();
  await waitDaemonHealthy();
});

test('the extension joins and the MQTT entities replicate down', async () => {
  test.setTimeout(60_000);
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

  const seedBackend = async (): Promise<void> => {
    const worker = extensionContext?.serviceWorkers().at(-1) ?? (await extensionContext?.waitForEvent('serviceworker'));
    if (!worker) throw new Error('no extension service worker');
    await seedEncryptedBackendRegistry(worker, {
      backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`,
      authToken: token,
      recordId: 'mqtt-e2e-backend',
      recordLabel: BACKEND_LABEL,
    });
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

  const replicatedState = async (): Promise<{ hasRule: boolean; hasMqtt: boolean }> => {
    const worker = extensionContext?.serviceWorkers().at(-1);
    if (!worker) return { hasRule: false, hasMqtt: false };
    return worker.evaluate(
      async (wsId: string) =>
        new Promise<{ hasRule: boolean; hasMqtt: boolean }>((resolve) => {
          chrome.storage.local.get(null, (items) => {
            resolve({
              hasRule: JSON.stringify(items[`oh.ws.${wsId}.rules`] ?? '').includes('MQTT e2e marker rule'),
              hasMqtt: JSON.stringify(items[`oh.ws.${wsId}.mqttRequests`] ?? '').includes('e2emqtt1'),
            });
          });
        }),
      workspaceId,
    );
  };

  await expect
    .poll(async () => (await replicatedState()).hasRule, {
      timeout: 20_000,
      message: 'the daemon workspace never replicated — the extension did not join the WS backend',
    })
    .toBe(true);
  await expect
    .poll(async () => (await replicatedState()).hasMqtt, {
      timeout: 5_000,
      message: 'mqttRequests slot missing from replication',
    })
    .toBe(true);
});

test('the workbench opens on the joined workspace', async () => {
  if (!extensionContext) throw new Error('extension context missing');
  page = await extensionContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/workbench.html#/ws/${workspaceId}`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 5_000 },
  );
  workbench = new WorkbenchPage(page);
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
  await page.locator('[data-item-id="req-col-e2emqc01"]').waitFor({ state: 'visible', timeout: 5_000 });
});

// ── D1: the tcp dial is runnable — the chip names the server ────────

test('D1 — the chip names the server place and Connect is enabled on the tcp scheme', async () => {
  await openMqttRequest('e2emqtt1');
  await expect(urlInput()).toHaveValue(`mqtt://127.0.0.1:${MQTT_PORT}`);
  await waitChipRunsOnServer();
  await expect(placeChip()).toHaveAttribute('data-place', 'workspace-server');
  await expect(placeChip()).toHaveAttribute('data-state', 'ready');
  await expect(connectButton()).toBeEnabled();

  await placeChip().click();
  const popover = page.getByTestId('execution-place-popover').filter({ visible: true });
  await expect(popover).toContainText(`Resolved here; ${BACKEND_LABEL} opens the connection on this request's behalf.`);
  await expect(popover).toContainText('The resolved values, secrets included, travel to it.');
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
});

// ── D2: opt-in refusal ──────────────────────────────────────────────

test('D2 — opt-in OFF: the delegated open renders the host-aware refusal notice in the timeline', async () => {
  await connectButton().click();
  const notice = page.getByTestId('peer-execute-disabled-notice').filter({ visible: true }).first();
  await notice.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(notice).toContainText(/turned off/);
  // The refused open settles the session — the pane is idle again.
  await expect(connectButton()).toHaveText(/Connect/, { timeout: 5_000 });
});

// ── D3: the delegated session walk ──────────────────────────────────

test('D3 — opt-in ON: the session runs over the delegated socket, scripted in the context, attributed to the host', async () => {
  test.setTimeout(60_000);
  await stopDaemon();
  await setPeerExecute(true);
  spawnDaemon();
  await waitDaemonHealthy();
  // The leg reads the live wire — wait for the reconnect.
  await waitChipRunsOnServer();

  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  await liveBadge().filter({ hasText: 'Connected' }).waitFor({ state: 'visible', timeout: 5_000 });
  await expect(connectButton()).toHaveText(/Disconnect/);

  // The server dialled the raw socket and relayed the broker's CONNACK
  // verbatim — the executor in the page realm decoded it.
  const connectedRow = page
    .getByTestId('mqtt-timeline-connected-row')
    .filter({ visible: true })
    .filter({ hasText: 'Connected' })
    .first();
  await connectedRow.waitFor({ state: 'visible', timeout: 5_000 });
  await connectedRow.click();
  const connackDetails = page.getByTestId('mqtt-timeline-connack-details').filter({ visible: true }).first();
  await connackDetails.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(connackDetails).toContainText('reasonCode: 0 (Connection Accepted)');
  await connectedRow.click();
  await connackDetails.waitFor({ state: 'hidden', timeout: 5_000 });

  // The Before connect script ran here, in the context: the timeline
  // mark, and the CONNECT the server sent carried its client id.
  const mark = page.getByTestId('mqtt-timeline-script-row').filter({ visible: true }).first();
  await mark.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(mark).toContainText('Before connect');
  await sessionPane().getByRole('tab', { name: 'Connection', exact: true }).click();
  await expect(page.getByTestId('mqtt-connection-tab').filter({ visible: true }).first()).toContainText(
    'context-scripted',
  );
  await sessionPane().getByRole('tab', { name: 'Timeline', exact: true }).click();

  // The pre-seeded retained message arrives on subscribe over the
  // relayed events.
  await timelineMessageRows()
    .filter({ hasText: 'retained-hello' })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });

  // Send rides the write rider: the ↑ publish and the probe's ↓
  // republish both land.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await expect
    .poll(async () => timelineMessageRows().filter({ hasText: 'echo-me-delegated' }).count(), { timeout: 5_000 })
    .toBe(2);

  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await endTag().filter({ hasText: 'Disconnected' }).waitFor({ state: 'visible', timeout: 5_000 });

  // Attribution: the answering host stamped the snapshot.
  const expectedLabel = os.hostname().split('.')[0]?.trim().toLowerCase() ?? '';
  const tag = page.getByTestId('oh-response-executed-on').filter({ visible: true }).first();
  await tag.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(tag).toContainText(`Sent from ${expectedLabel}`);
});

// ── D4: no place left ───────────────────────────────────────────────

test('D4 — daemon gone: the chip falls back to the companion state and Connect disables with the tcp copy', async () => {
  await stopDaemon();
  await expect.poll(async () => placeChip().textContent(), { timeout: 20_000 }).toBe('Needs the desktop app');
  await expect(placeChip()).toHaveAttribute('data-state', 'needs-companion');
  await expect(connectButton()).toBeDisabled();
  await page.mouse.move(0, 0);
  await connectButton().hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(CONNECT_TCP_SCHEME_COPY)
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.mouse.move(0, 0);
});
