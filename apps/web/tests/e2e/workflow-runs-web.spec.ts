/**
 * Workflow runs in the served tab — a workflow runs IN the browser tab
 * its server serves: the runner, the session a `listen` step holds, the
 * window an `expect` reads and the scripts are the tab's, and only the
 * sockets move to the serving daemon. A spawned headless daemon serves
 * the built web app; a headless browser signs in to it; the playground's
 * device scenario stands behind both (a backend's HTTP api beside the
 * aedes probe broker: a reboot is commanded over HTTP and the device
 * answers on its status topic with the command's id).
 *
 *   W1  A workflow of one call runs on a press: the tab's first run of
 *       any workflow, its row and its verdict in the Run view.
 *   W2  A reboot commanded over HTTP, acknowledged over MQTT on the
 *       broker's raw TCP listener — the socket the daemon opens for the
 *       tab: the answer matched by the id of THIS run's command.
 *   W3  A listen that runs its request's scripts, on the tab's sandbox:
 *       the run passes, and the Listen row says what the hooks did not do
 *       cleanly.
 *   W4  A message that never comes fails its step at the deadline, by
 *       the address and the wait.
 *
 * Every call goes to the playground's one origin, and the tab holds a
 * sixth start to an origin inside a minute: W1, W2 and W3 are the three
 * that call. A leg added here that calls counts against the five.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon` and
 * `pnpm turbo build --filter=@openheaders/web`. The daemon runs under the
 * repo's electron binary with ELECTRON_RUN_AS_NODE (the monorepo's
 * better-sqlite3 is compiled for Electron's ABI). The playground is
 * started here when its origin does not answer, and only then stopped —
 * the other web specs need none, so the config boots none.
 *
 * Seeding: the daemon boots once to mint its workspace (a marker MCP
 * write), then its storage.json gains the collection, the requests and
 * the workflows (built and schema-validated by
 * `fixtures/workflow-runs-web-seed.ts` under tsx) and the daemon reboots
 * on them; the tab's sign-in replicates them down.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, expect, type Locator, type Page, test } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const WEB_ROOT = path.resolve(HERE, '../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');
const PLAYGROUND_DIR = path.join(REPO_ROOT, 'playground');
const SEED_SCRIPT = path.join(HERE, 'fixtures/workflow-runs-web-seed.ts');

const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: off every other suite's daemon port.
const DAEMON_PORT = 22637;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;
// The playground: the device api and the probe broker's TCP listener.
const DEVICES_ORIGIN = 'http://127.0.0.1:3000';
const MQTT_PROBE_PORT = 3131;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-workflow-runs-web-client', version: '0.0.0' },
};

const EMAIL_INPUT = 'input[data-testid=login-gate-email], [data-testid=login-gate-email] input';
const PASSWORD_INPUT = 'input[data-testid=login-gate-password], [data-testid=login-gate-password] input';
const USER_EMAIL = 'john@openheaders.io';
const USER_PASSWORD = 'workflow-runs-web-2026';

let daemon: ChildProcess | undefined;
let daemonExited: Promise<number | null>;
let playground: ChildProcess | undefined;
let dataDir: string;
let token: string;
let workspaceId: string;
let browser: Browser;
let page: Page;
const daemonLog: string[] = [];

function spawnDaemon(): void {
  daemon = spawn(
    electronBinary,
    [
      DAEMON_MAIN,
      '--data-dir',
      dataDir,
      '--bind-address',
      '127.0.0.1',
      '--bind-port',
      String(DAEMON_PORT),
      '--web-root',
      WEB_DIST,
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemon.stdout, daemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  const child = daemon;
  daemonExited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

async function statusOf(url: string): Promise<number> {
  try {
    return (await fetch(url)).status;
  } catch {
    return 0;
  }
}

async function waitDaemonHealthy(): Promise<void> {
  await expect.poll(() => statusOf(`${ORIGIN}/healthz`), { timeout: 20_000 }).toBe(200);
}

async function stopDaemon(): Promise<void> {
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  daemon = undefined;
}

/** Start the playground unless its origin already answers; the one started here is the one stopped. */
async function ensurePlayground(): Promise<void> {
  if ((await statusOf(DEVICES_ORIGIN)) !== 0) return;
  // Its own process group: the dev server is a child of the package runner.
  playground = spawn('pnpm', ['--dir', PLAYGROUND_DIR, 'dev'], { detached: true, stdio: 'ignore' });
  await expect.poll(() => statusOf(DEVICES_ORIGIN), { timeout: 30_000 }).not.toBe(0);
}

function stopPlayground(): void {
  if (playground?.pid === undefined) return;
  process.kill(-playground.pid, 'SIGTERM');
  playground = undefined;
}

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

/** Merge `patch` into storage.json's `values` (daemon must be stopped). */
async function patchStorageValues(patch: Record<string, unknown>): Promise<void> {
  const storagePath = path.join(dataDir, 'storage.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, patch);
  await writeFile(storagePath, JSON.stringify(envelope));
}

/**
 * Drive the daemon's gated peer admin plane over a raw operator wire
 * (Node's global WebSocket): HELLO with the pre-seeded operator token,
 * then request/response on the `<type>:response` idiom.
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
      nodeId: 'e2e-admin-wire',
      workspaceId: 'e2e-admin-wire',
      agent: '@openheaders/web@e2e',
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

// ── Workbench locators (visible-scoped — background tabs stay mounted) ──

/** Open the Workflows tool window, state-driven: the strip's tab, then its section. */
async function showWorkflowsView(): Promise<void> {
  const viewTab = page.locator('[data-tool-window="workflows"][role="tab"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') await viewTab.click();
  const sectionHeader = page
    .getByRole('button', { name: /WORKFLOWS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') await sectionHeader.click();
}

/** Collapse the right sidebar until it stays collapsed — its layout hydrates after first paint. */
async function collapseRightSidebar(): Promise<void> {
  const region = page.locator('[data-region="right"]');
  const toggle = page.getByRole('button', { name: 'Right sidebar' });
  let settled = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await region.isVisible().catch(() => false)) {
      settled = 0;
      await toggle.click();
    } else if (++settled >= 2) return;
    await page.waitForTimeout(500);
  }
}

function runView(): Locator {
  return page.getByTestId('wf-run-view').filter({ visible: true }).first();
}

function runRow(stepId: string): Locator {
  return page.getByTestId(`wf-run-row-${stepId}`).filter({ visible: true }).first();
}

/** Open a workflow's tab on its Run view and press the header's Refresh. */
async function runWorkflow(uid: string): Promise<void> {
  await page.locator(`[data-item-id="workflow-${uid}"]`).click();
  await page.getByText('Run', { exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('wf-run-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await page
    .getByRole('button', { name: /Refresh$/ })
    .filter({ visible: true })
    .first()
    .click();
}

async function expectVerdict(verdict: 'passed' | 'failed' | 'cannot-run'): Promise<void> {
  await expect(runView()).toHaveAttribute('data-run-verdict', verdict, { timeout: 10_000 });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(20_000);

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await ensurePlayground();

  // Offline admin bootstrap — the daemon-join recipe.
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-workflow-runs-web-e2e-'));
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
            id: 'workflow-runs-web-e2e-token',
            tokenHash,
            label: 'workflow runs web e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );

  // Boot once to mint the workspace and learn its id.
  spawnDaemon();
  await waitDaemonHealthy();
  await rpc('initialize', INITIALIZE_PARAMS);
  await callTool('rules_create', {
    rule: {
      name: 'Workflow runs web marker rule',
      type: 'header',
      enabled: false,
      published: false,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Workflow-Runs-Web', value: 'marker' }],
        responseHeaders: [],
      },
    },
  });
  const workspaces = await callTool('workspaces_list', {});
  const first = (workspaces.workspaces as Array<{ id: string }>)[0];
  expect(first).toBeTruthy();
  workspaceId = first.id;

  // Reboot on the seeded slots.
  await stopDaemon();
  const seeded = spawnSync('pnpm', ['exec', 'tsx', SEED_SCRIPT], {
    cwd: WEB_ROOT,
    env: {
      ...process.env,
      OH_E2E_DEVICES_ORIGIN: DEVICES_ORIGIN,
      OH_E2E_MQTT_PROBE_PORT: String(MQTT_PROBE_PORT),
      OH_E2E_WORKSPACE_ID: workspaceId,
    },
    encoding: 'utf-8',
  });
  expect(seeded.status, seeded.stderr).toBe(0);
  await patchStorageValues(JSON.parse(seeded.stdout) as Record<string, unknown>);
  spawnDaemon();
  await waitDaemonHealthy();

  // A person with a grant on the workspace and a password to sign in with.
  const [created] = await adminOverWire([
    {
      type: 'oh.daemon.users.create',
      displayName: 'John Doe',
      email: USER_EMAIL,
      grants: [{ workspaceId, role: 'owner' }],
    },
  ]);
  const userId = (created.payload as { ok: true; userId: string }).userId;
  // The server's admin too: a server with none draws the setup card, not the sign-in form.
  const [passworded, promoted] = await adminOverWire([
    { type: 'oh.daemon.users.setPassword', userId, password: USER_PASSWORD },
    { type: 'oh.daemon.users.setDaemonAdmin', userId, allowed: true },
  ]);
  expect((passworded.payload as { ok: boolean }).ok).toBe(true);
  expect((promoted.payload as { ok: boolean }).ok).toBe(true);

  browser = await chromium.launch();
  page = await (await browser.newContext()).newPage();
  await page.goto(ORIGIN);
  await page.waitForSelector(EMAIL_INPUT, { timeout: 5_000 });
  await page.fill(PASSWORD_INPUT, USER_PASSWORD);
  await page.fill(EMAIL_INPUT, USER_EMAIL);
  await page.press(EMAIL_INPUT, 'Enter');
  await page.waitForSelector('[aria-label="Settings menu"]', { timeout: 10_000 });

  await showWorkflowsView();
  await collapseRightSidebar();
  await page.locator('[data-item-id="workflow-e2ewwwf1"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await browser?.close();
  await stopDaemon();
  stopPlayground();
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

test('W1 — a workflow of one call runs in the tab on a press: its row and its verdict are in the Run view', async () => {
  await runWorkflow('e2ewwwf1');
  await expectVerdict('passed');
  await expect(runRow('device')).toContainText('200');
});

test('W2 — a reboot commanded over HTTP is acknowledged over MQTT on a raw TCP broker the server dials: the answer to this run’s command is the match', async () => {
  await runWorkflow('e2ewwwf2');
  await expectVerdict('passed');
  await expect(runRow('probe')).toContainText('Ready in');
  await expect(runRow('probe')).toContainText('closed after');
  await expect(runRow('reboot')).toContainText('202');
  await expect(runRow('status')).toContainText('Matched after');

  // The step opens to its window: the one message on the address, and it matched.
  await runRow('status').click();
  const message = page.getByTestId('wf-run-message').filter({ visible: true }).first();
  await expect(message.getByTestId('wf-run-message-row-0')).toContainText('Matched');
  await expect(message.getByTestId('wf-run-message-fields')).toContainText('devices/dev-1/status');
});

test('W3 — a listen that runs its request’s scripts passes, and its row says what the hooks left', async () => {
  await runWorkflow('e2ewwwf3');
  await expectVerdict('passed');
  await expect(runRow('status')).toContainText('Matched after');
  // The failed test is a note; the refused oh.sendRequest is that one On message run erroring.
  await expect(runRow('probe')).toContainText('1 script test failed · On message script failed 1 time');
});

test('W4 — a message that never comes fails its step at the deadline, naming the address and the wait', async () => {
  await runWorkflow('e2ewwwf4');
  await expectVerdict('failed');
  await expect(runRow('health')).toContainText(
    'No message on devices/dev-1/health matched within 1.5 s of "probe" starting.',
  );
  await expect(runRow('probe')).toContainText('closed after');
});
