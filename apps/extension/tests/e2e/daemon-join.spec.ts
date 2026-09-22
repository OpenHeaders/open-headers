/**
 * T3 acceptance — the standalone headless daemon as a real backend
 * (the daemon plan §7 Phase 1):
 *
 *   1. Spawn the built `apps/daemon` bundle headless on a LAN bind
 *      (`0.0.0.0`, non-default port) with an isolated data dir. The
 *      token ledger is pre-seeded in `storage.json` — the offline
 *      equivalent of the Phase-2 `oh-daemon show-token` bootstrap,
 *      since the headless daemon has no admin surface yet.
 *   2. Drive the daemon's `/mcp` endpoint like an agent client:
 *      admission chain (401/403), initialize, rules_create.
 *   3. The administrator admits a person over the operator wire in ONE
 *      act — a name, an email, a workspace grant and an initial
 *      password (the client sign-in plan D5) — and tells them the
 *      server address, the email and the password. Nothing is minted
 *      for their devices.
 *   4. Launch Chromium with the built extension and join the daemon
 *      through the REAL wizard on the machine's LAN address — the
 *      person's own sign-in (the client sign-in plan §9): "Sign in on …"
 *      opens the server's device page in a new tab, the person signs in
 *      there with the email + password and approves the device, the
 *      wizard reads "Signed in as <person>" off a real handshake,
 *      Connect, and the daemon's workspace + rule sync down
 *      (consume-only join, ADR-9). No credential is ever seeded into
 *      the extension: the secret rides the poll handle only.
 *   5. Mutate through MCP while the extension is connected — the
 *      rename must replicate live over the WS pipe.
 *   6. Assert nothing pollutes upward: the extension's own local
 *      workspace never appears on the daemon.
 *   7. The secondary path still pairs from a real extension page — an
 *      admin-issued six-cell code confirms from the extension's own
 *      origin (the F0-a proof).
 *   8. The ledger carries the person's device session; SIGTERM shuts
 *      the daemon down clean.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon`
 * and the extension `dist/chrome`. The daemon runs under the repo's
 * electron binary with ELECTRON_RUN_AS_NODE (the monorepo's
 * better-sqlite3 is compiled for Electron's ABI — plain-Node
 * distribution is a Phase 2 packaging concern).
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
// The repo's electron binary doubles as the daemon's Node runtime
// (better-sqlite3 ABI); resolve it from the package that declares it.
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Off the default 8137 AND off mcp.spec's 18137 so suites never collide.
const DAEMON_PORT = 18238;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

// The person the administrator invites — what they are told, verbatim.
const PERSON = { name: 'Pia', email: 'pia@openheaders.io', password: 'pia-first-password' };
const F0A_DEVICE_LABEL = 'f0a admin-issued code';

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-t3-client', version: '0.0.0' },
};

/** First non-internal IPv4 — the honest LAN leg. Loopback fallback keeps
 * the suite green on airgapped machines (token admission is identical). */
function lanIpv4(): string {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

let daemon: ChildProcess;
let daemonExited: Promise<number | null>;
let dataDir: string;
let token: string;
let extensionContext: BrowserContext | undefined;
let extensionId: string;
let workbench: Page;
let personId: string;
const daemonLog: string[] = [];

async function rpc(
  method: string,
  params: Record<string, unknown>,
  overrides: { token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${overrides.token ?? token}`,
      ...overrides.headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { status, json } = await rpc('tools/call', { name, arguments: args });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

/**
 * The operator's admin plane over a real socket — the same idiom the web
 * join spec uses: HELLO with the bootstrap token, one request frame per
 * call, its `:response` awaited in order. The admission itself carries
 * the grant and the initial password (D5), so an invite is one call.
 */
async function adminOverWire(calls: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  const socket = new WebSocket(`ws://127.0.0.1:${DAEMON_PORT}`);
  const inbox = new Map<string, Array<Record<string, unknown>>>();
  const waiters = new Map<string, (frame: Record<string, unknown>) => void>();
  socket.addEventListener('message', (event) => {
    const frame = JSON.parse(String(event.data)) as Record<string, unknown> & { type: string };
    const waiter = waiters.get(frame.type);
    if (waiter) {
      waiters.delete(frame.type);
      waiter(frame);
      return;
    }
    const queue = inbox.get(frame.type) ?? [];
    queue.push(frame);
    inbox.set(frame.type, queue);
  });
  const awaitFrame = (type: string): Promise<Record<string, unknown>> => {
    const queued = inbox.get(type)?.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => waiters.set(type, resolve));
  };
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('admin wire failed to open')), { once: true });
  });
  const welcomePromise = awaitFrame('oh.sync.welcome');
  socket.send(
    JSON.stringify({
      type: 'oh.sync.hello',
      protocolVersion: 1,
      role: 'web',
      nodeId: 't3-admin-wire',
      workspaceId: 't3-admin-wire',
      agent: '@openheaders/extension@e2e',
      authToken: token,
    }),
  );
  const welcome = (await welcomePromise) as { accepted?: boolean };
  expect(welcome.accepted).toBe(true);
  const responses: Array<Record<string, unknown>> = [];
  for (const call of calls) {
    const responsePromise = awaitFrame(`${String(call.type)}:response`);
    socket.send(JSON.stringify(call));
    responses.push(await responsePromise);
  }
  socket.close();
  return responses;
}

/** The newest extension service worker — MV3 restarts invalidate older handles. */
async function latestWorker(): Promise<Worker> {
  const context = extensionContext;
  if (!context) throw new Error('no extension context');
  const existing = context.serviceWorkers().at(-1);
  if (existing) return existing;
  const waiter = context.waitForEvent('serviceworker', { timeout: 5_000 }).catch(() => null);
  await workbench
    .evaluate(() => {
      void chrome.runtime.sendMessage({ type: 'oh-e2e-wake' }).catch(() => undefined);
    })
    .catch(() => undefined);
  const woken = context.serviceWorkers().at(-1) ?? (await waiter);
  if (!woken) throw new Error('no extension service worker');
  return woken;
}

/** Deliver a workspace intent to the open workbench tab (the settings opener). */
async function deliverIntent(intent: object): Promise<void> {
  await (await latestWorker()).evaluate(
    async ({ url, intent }: { url: string; intent: object }) => {
      const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
        chrome.tabs.query({ url: `${url}*` }, (found) => resolve(found));
      });
      const tabId = tabs[0]?.id;
      if (typeof tabId !== 'number') return;
      try {
        await new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'workspace-intent', intent }, () => {
            void chrome.runtime.lastError;
            resolve();
          });
        });
      } catch {
        // Listener doesn't respond; the message was delivered.
      }
    },
    { url: `chrome-extension://${extensionId}/workbench.html`, intent },
  );
}

async function openBackendSettings(): Promise<void> {
  await deliverIntent({ kind: 'open-settings', target: { categoryId: 'backendConnections' } });
  await expect(workbench.getByRole('button', { name: 'Sign in to a server…' })).toBeVisible();
}

/**
 * Open the server wizard and walk its address step to the sign-in step
 * on the daemon's LAN address. Returns the modal.
 */
async function openWizardAtSignInStep(label: string): Promise<Locator> {
  await workbench.getByRole('button', { name: 'Sign in to a server…' }).click();
  const modal = workbench.getByRole('dialog', { name: 'Sign in to a server' });
  await expect(modal).toBeVisible();
  const nameField = modal.getByRole('textbox', { name: 'Connection name', exact: true });
  await nameField.fill(label);
  await nameField.press('Enter');
  // One string, as the admin would say it: host:port.
  const addressField = modal.getByRole('textbox', { name: 'Server address', exact: true });
  await addressField.fill(`${lanIpv4()}:${DAEMON_PORT}`);
  await addressField.press('Enter');
  await modal.getByRole('button', { name: 'Next' }).click();
  // The probe's verdict without a credential: the daemon asks this
  // device to sign in.
  await expect(modal.getByText(/asks this device to sign in/)).toBeVisible();
  return modal;
}

/**
 * Whether any replicated `oh.ws.<id>.rules` record in the extension's
 * chrome.storage carries the given rule name. Re-acquires the newest
 * service worker per call — MV3 restarts invalidate older handles.
 */
async function ruleVisibleInExtension(name: string): Promise<boolean> {
  const worker = extensionContext?.serviceWorkers().at(-1);
  if (!worker) return false;
  return worker.evaluate(
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

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-t3-'));

  // Offline admin bootstrap: a known secret, its hash on the ledger.
  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: 't3-bootstrap-token',
            tokenHash,
            label: 't3 e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );

  daemon = spawn(
    electronBinary,
    [
      DAEMON_MAIN,
      '--data-dir',
      dataDir,
      '--bind-address',
      '0.0.0.0',
      '--bind-port',
      String(DAEMON_PORT),
      '--allow-insecure-lan',
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemon.stdout, daemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  daemonExited = new Promise((resolve) => daemon.once('exit', (code) => resolve(code)));

  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/healthz`);
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 20_000 },
    )
    .toBe(200);
});

test.afterAll(async () => {
  await extensionContext?.close();
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

// ── MCP admission on the standalone daemon ──────────────────────────

test('rejects a missing or unknown bearer token with 401', async () => {
  const missing = await fetch(MCP_URL, { method: 'POST', body: '{}' });
  expect(missing.status).toBe(401);
  expect(missing.headers.get('www-authenticate')).toBe('Bearer');

  const unknown = await rpc('initialize', INITIALIZE_PARAMS, { token: 'oh_not-a-real-token' });
  expect(unknown.status).toBe(401);
});

test('rejects any browser-originated request with 403', async () => {
  const { status } = await rpc('initialize', INITIALIZE_PARAMS, {
    headers: { origin: 'https://openheaders.io' },
  });
  expect(status).toBe(403);
});

test('answers initialize with the server identity', async () => {
  const { status, json } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);
  const result = json.result as { serverInfo: { name: string } };
  expect(result.serverInfo.name).toBe('open-headers');
});

// ── MCP writes land on the headless engine ──────────────────────────

let ruleUid: string;
let daemonWorkspaceIds: string[];

test('rules_create lands on the daemon workspace', async () => {
  const payload = await callTool('rules_create', {
    rule: {
      name: 'Daemon header rule',
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Daemon', value: 't3' }],
        responseHeaders: [],
      },
    },
  });
  ruleUid = (payload.rule as { uid: string }).uid;
  expect(ruleUid).toBeTruthy();

  const workspaces = await callTool('workspaces_list', {});
  daemonWorkspaceIds = (workspaces.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  expect(daemonWorkspaceIds.length).toBeGreaterThan(0);
});

// ── The invite: one act over the operator wire ──────────────────────

test('the administrator admits the person in one act — name, email, workspace grant, initial password', async () => {
  const [created] = await adminOverWire([
    {
      type: 'oh.daemon.users.create',
      displayName: PERSON.name,
      email: PERSON.email,
      password: PERSON.password,
      grants: [{ workspaceId: daemonWorkspaceIds[0], role: 'owner' }],
    },
  ]);
  const payload = created.payload as { ok: boolean; userId?: string; error?: string };
  expect(payload.ok, payload.error).toBe(true);
  personId = payload.userId as string;

  // A password holder exists, so the server's login is the password:
  // the device page will draw the email + password form.
  const meta = (await (await fetch(`http://127.0.0.1:${DAEMON_PORT}/auth/password/meta`)).json()) as {
    enabled: boolean;
  };
  expect(meta.enabled).toBe(true);
});

// ── The extension signs the person in on the server's own page ──────

test('the extension signs the person in on the device page over the LAN bind and the rule syncs down', async () => {
  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2];

  // Mark the onboarding tour completed BEFORE opening the workbench — on
  // a fresh profile the tour's modal mask covers the whole page.
  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  workbench = await extensionContext.newPage();
  workbench.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[workbench console.error] ${msg.text()}`);
  });
  workbench.on('pageerror', (err) => console.log(`[workbench pageerror] ${err.message}`));
  await workbench.goto(`chrome-extension://${extensionId}/workbench.html`);
  await workbench.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });

  await openBackendSettings();
  const modal = await openWizardAtSignInStep('t3 daemon');

  // The primary stays loading until the three meta reads (from the
  // extension's own origin — the auth-meta admission row) resolve the
  // gate; a loading button ignores clicks.
  const primary = modal.getByRole('button', { name: /^Sign in on / });
  await expect(primary).not.toHaveClass(/ant-btn-loading/);
  const [devicePage] = await Promise.all([extensionContext.waitForEvent('page'), primary.click()]);

  // The wizard shows the code; the page the SW opened is the server's
  // own device page on that same code — it names the client kind and
  // asks the person to approve it.
  const code = (await modal.getByTestId('backend-sign-in-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^\d{6}$/);
  await devicePage.waitForLoadState();
  expect(new URL(devicePage.url()).pathname).toBe(`/pair/${code}`);
  await expect(devicePage.getByRole('heading', { name: 'Approve this device?' })).toBeVisible();
  await expect(devicePage.getByText('the browser extension')).toBeVisible();
  await expect(devicePage.getByText(code).first()).toBeVisible();

  // The person signs in on the SERVER'S page — the extension never sees
  // the password. Approve lands on the approved page, which carries no
  // secret.
  await devicePage.fill('input[name=email]', PERSON.email);
  await devicePage.fill('input[name=password]', PERSON.password);
  await devicePage.getByRole('button', { name: 'Approve' }).click();
  await expect(devicePage.getByRole('heading', { name: 'Device approved' })).toBeVisible();
  expect(await devicePage.content()).not.toContain('oh_');
  await devicePage.close();

  // The poll (every 2 s) hands the bound secret to the extension, which
  // writes it onto the record like a pasted token; the wizard's probe
  // re-runs and the REAL handshake names the person.
  await expect(modal.getByText(new RegExp(`^Signed in as ${PERSON.name}`))).toBeVisible({ timeout: 10_000 });
  await modal.getByRole('button', { name: 'Next' }).click();
  await modal.getByRole('button', { name: /^Connect$/ }).click();
  // Probe + enable + join-adopt dwell; the modal closes on commit.
  await expect(modal).toBeHidden({ timeout: 20_000 });

  // Consume-only join: the daemon's workspace (and the MCP-created rule
  // inside it) replicates into chrome.storage under oh.ws.<id>.rules.
  await expect.poll(() => ruleVisibleInExtension('Daemon header rule'), { timeout: 20_000 }).toBe(true);
});

test('an MCP mutation replicates live into the connected extension', async () => {
  await callTool('rules_update', { uid: ruleUid, updates: { name: 'Daemon header rule v2' } });

  await expect.poll(() => ruleVisibleInExtension('Daemon header rule v2'), { timeout: 5_000 }).toBe(true);
});

// ── Consume-only upward semantics ───────────────────────────────────

test('the extension local workspace never pollutes the daemon', async () => {
  const workspaces = await callTool('workspaces_list', {});
  const ids = (workspaces.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  expect(ids.sort()).toEqual([...daemonWorkspaceIds].sort());

  const rules = await callTool('rules_list', {});
  expect((rules.rules as Array<{ name: string }>).map((r) => r.name)).toEqual(['Daemon header rule v2']);
});

// ── The secondary path: an admin-issued code from a real extension page (F0-a)

test('the secondary path still pairs — an admin-issued six-cell code confirms from the extension origin', async () => {
  // The administrator issues a code for a device they set up by hand.
  const [started] = await adminOverWire([{ type: 'oh.daemon.pairing.start', deviceLabel: F0A_DEVICE_LABEL }]);
  const pair = started.payload as { ok: boolean; code?: string; error?: string };
  expect(pair.ok, pair.error).toBe(true);
  const code = pair.code as string;

  const modal = await openWizardAtSignInStep(F0A_DEVICE_LABEL);
  await modal.getByText('Have a pairing code or token from an administrator?').click();
  // The six cells advance on their own; the confirm POSTs from the
  // extension's own origin — the pairing row admits it (F0-a).
  await modal.getByTestId('backend-pair-code').locator('input').first().click();
  await workbench.keyboard.type(code);
  await modal.getByRole('button', { name: 'Pair', exact: true }).click();
  await expect(modal.getByText('Paired — access token saved')).toBeVisible();
  await expect(modal.getByText(/^Signed in/)).toBeVisible({ timeout: 10_000 });

  // Proof on the server: the confirm minted the token under the code's
  // label. A fresh add that never connected leaves no trace — Cancel.
  const [tokens] = await adminOverWire([{ type: 'oh.daemon.tokens.list' }]);
  const rows = (tokens.payload as { tokens: Array<{ label?: string; kind?: string }> }).tokens;
  expect(rows.some((row) => row.label === F0A_DEVICE_LABEL)).toBe(true);
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal).toBeHidden();
});

// ── Ledger + clean shutdown ─────────────────────────────────────────

test("the persisted ledger carries the stamped bootstrap row and the person's device session", async () => {
  const envelope = JSON.parse(await readFile(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
    secrets: Record<string, string>;
  };
  const ledger = envelope.values['oh.daemonAuthTokens'] as Array<{
    id: string;
    label?: string;
    kind?: string;
    userId?: string;
    lastUsedAt: number | null;
  }>;
  expect(ledger[0].id).toBe('t3-bootstrap-token');
  expect(ledger[0].lastUsedAt).toBeGreaterThan(0);
  expect(envelope.secrets['oh.daemonAuthTokens']).toBeUndefined();
  // The device sign-in minted a session-kind row bound to the person,
  // labelled by the client that asked — the row Paired devices lists
  // and deactivation revokes.
  const session = ledger.find((row) => row.kind === 'session' && row.userId === personId);
  expect(session?.label).toBe('device:extension');
  expect(session?.lastUsedAt).toBeGreaterThan(0);
});

test('SIGTERM shuts the daemon down clean', async () => {
  await extensionContext?.close();
  extensionContext = undefined;
  daemon.kill('SIGTERM');
  expect(await daemonExited).toBe(0);
});
