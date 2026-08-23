/**
 * Phase 4b B2 acceptance — the web tab joins its serving daemon:
 *
 *   1. Spawn the built `apps/daemon` bundle on `0.0.0.0` with an
 *      isolated data dir, serving the built `apps/web` bundle
 *      (`--web-root`). The token ledger + MCP settings are pre-seeded
 *      in `storage.json` (the offline `ohd show-token`
 *      equivalent, same idiom as the extension T3 gate). That token
 *      is the OPERATOR plane every wire/MCP probe below rides; the
 *      browser legs never touch it, because a browser no longer can.
 *   2. A fresh origin renders the LOGIN GATE (no stored session). On
 *      the unclaimed server it is the SETUP card — no pairing token is
 *      ever asked of a browser — and once a directory admin exists it
 *      is the sign-in card: a wrong password is refused in band, the
 *      right one joins and mounts the Workbench.
 *   3. A daemon-side rule (seeded via MCP before the join) replicates
 *      DOWN into the tab's origin IDB; an MCP rename lands in the OPEN
 *      tab live.
 *   4. Join → adopt promotes the daemon's workspace before the first
 *      mount, so a rule created through the real editor flow syncs UP
 *      (visible via MCP `rules_list`).
 *   5. Consume-only: the tab's local workspace never appears on the
 *      daemon.
 *   6. A reload skips the gate (token persisted origin-scoped) and
 *      rejoins; a non-loopback (LAN IP) origin gates and joins too.
 *   7. The operator administers the daemon FROM the tab (settings CTA →
 *      admin console → user admitted; token minted in the UI with its
 *      show-once secret, then revoked — evicting the live peer riding
 *      it); a directory user joining with a bound token sees no admin
 *      affordance (probe-gated), while the server-side gate stands
 *      regardless.
 *   8. The claim itself, on a throwaway daemon of its own: the first
 *      browser creates the admin from loopback with no setup code,
 *      hears which paired devices that unpaired, and lands joined.
 *   9. Zero console errors across every leg; SIGTERM exits clean.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon`
 * and `pnpm turbo build --filter=@openheaders/web`. The daemon runs
 * under the repo's electron binary with ELECTRON_RUN_AS_NODE (the
 * monorepo's better-sqlite3 is compiled for Electron's ABI).
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');

// The repo's electron binary doubles as the daemon's Node runtime
// (better-sqlite3 ABI); resolve it from the package that declares it.
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: off every prior suite's ports (18337–18339, 18443,
// 18537, 18637, 18737, 18747, plus this session's 18937 smoke).
const DAEMON_PORT = 19037;
const PROXY_PORT = 19039;
// The claim leg's throwaway daemon — a box it is allowed to take over.
const CLAIM_PORT = 19041;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;
const DAEMON_RIG = path.join(REPO_ROOT, 'playground/daemon-rig');

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-web-join-client', version: '0.0.0' },
};

const EMAIL_INPUT = 'input[data-testid=login-gate-email], [data-testid=login-gate-email] input';
const PASSWORD_INPUT = 'input[data-testid=login-gate-password], [data-testid=login-gate-password] input';
const setupInput = (field: string): string =>
  `input[data-testid=login-gate-setup-${field}], [data-testid=login-gate-setup-${field}] input`;

// The admin this run signs in as. Admitted over the wire rather than
// by claiming the box, so the seeded operator token survives to drive
// every MCP and raw-wire probe; the claim gets a daemon of its own at
// the end, which it is free to take over.
const ADMIN_EMAIL = 'john@openheaders.io';
const ADMIN_PASSWORD = 'web-join-admin-2026';

/** First non-internal IPv4 — the honest non-loopback leg. Null on airgapped machines (leg skips). */
function lanIpv4(): string | null {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

let daemon: ChildProcess;
let proxy: ChildProcess;
let daemonExited: Promise<number | null>;
let dataDir: string;
let token: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;
const daemonLog: string[] = [];
const consoleErrors: string[] = [];

async function rpc(
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
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

function watchConsole(target: Page, label: string): void {
  target.on('console', (msg) => {
    // The browser logs every non-2xx resource load; the password leg's
    // deliberate wrong-credential probe answers a uniform 401 by design.
    if (msg.type() === 'error' && !msg.text().includes('status of 401')) {
      consoleErrors.push(`[${label}] ${msg.text()}`);
    }
  });
  target.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));
}

/** Read one `oh.host-storage` kv slot from the page's origin IDB. */
function readHostSlot(target: Page, key: string): Promise<unknown> {
  return target.evaluate(
    (k) =>
      new Promise((resolve) => {
        const open = indexedDB.open('oh.host-storage');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('kv', 'readonly').objectStore('kv').get(k);
          req.onsuccess = () => resolve(req.result?.value ?? null);
          req.onerror = () => resolve(null);
        };
        open.onerror = () => resolve(null);
      }),
    key,
  );
}

/** Whether any per-workspace rule slot in the page's origin IDB carries `name`. */
function ruleInTabIdb(target: Page, name: string): Promise<boolean> {
  return target.evaluate(
    (n) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('oh.host-storage');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('kv', 'readonly').objectStore('kv').getAll();
          req.onsuccess = () =>
            resolve(
              JSON.stringify(
                (req.result as Array<{ key: string }>).filter((r) => /^oh\.ws\..*\.rules$/.test(r.key)),
              ).includes(n),
            );
          req.onerror = () => resolve(false);
        };
        open.onerror = () => resolve(false);
      }),
    name,
  );
}

/** Drive the gate's sign-in form. */
async function signInAtGate(target: Page, email: string, password: string): Promise<void> {
  await target.fill(EMAIL_INPUT, email);
  await target.fill(PASSWORD_INPUT, password);
  await target.click('[data-testid=login-gate-password-submit]');
}

/** Sign a fresh context in and wait for the Workbench to mount. */
async function openSignedIn(label: string, email: string, password: string): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext();
  const target = await ctx.newPage();
  watchConsole(target, label);
  await target.goto(ORIGIN);
  await target.waitForSelector(EMAIL_INPUT, { timeout: 30_000 });
  await signInAtGate(target, email, password);
  await target.waitForSelector('[aria-label="Settings menu"]', { timeout: 30_000 });
  return [ctx, target];
}

/**
 * Admit a directory user over the operator wire with everything a
 * browser sign-in needs: an email to key on, a password, and a grant
 * so join → adopt lands somewhere. Returns the new user's id.
 */
async function admitPasswordUser(
  displayName: string,
  email: string,
  password: string,
  workspaceId: string,
  role: 'owner' | 'editor' | 'viewer',
): Promise<string> {
  const [created] = await adminOverWire([{ type: 'oh.daemon.users.create', displayName, email }]);
  const userId = (created.payload as { ok: true; userId: string }).userId;
  const [passworded, granted] = await adminOverWire([
    { type: 'oh.daemon.users.setPassword', userId, password },
    { type: 'oh.daemon.users.grant', userId, workspaceId, role },
  ]);
  expect((passworded.payload as { ok: boolean }).ok).toBe(true);
  expect((granted.payload as { ok: boolean }).ok).toBe(true);
  return userId;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-web-join-'));

  // Offline admin bootstrap: a known secret, its hash on the ledger,
  // MCP enabled for the acceptance probes.
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
            id: 'web-join-bootstrap-token',
            tokenHash,
            label: 'web-join e2e',
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
      '--web-root',
      WEB_DIST,
      // The TLS leg fronts this daemon with the rig proxy as oh.test.
      '--trusted-proxy',
      '--allowed-host',
      'oh.test',
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
          const res = await fetch(`${ORIGIN}/healthz`);
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200);

  // The rig's TLS-terminating proxy (self-signed oh.test cert, WS
  // upgrade forwarding) — the same fixture the WAN gate uses. It gives
  // the non-loopback leg a SECURE origin, which the web app requires
  // (crypto is withheld on plain-http origins off loopback).
  proxy = spawn(process.execPath, [path.join(DAEMON_RIG, 'tls-proxy.mjs')], {
    env: { ...process.env, PROXY_PORT: String(PROXY_PORT), DAEMON_PORT: String(DAEMON_PORT) },
  });
  let proxyOut = '';
  proxy.stdout?.on('data', (chunk: Buffer) => {
    proxyOut += chunk.toString();
  });
  proxy.stderr?.on('data', (chunk: Buffer) => {
    proxyOut += chunk.toString();
  });
  await expect.poll(() => proxyOut.includes('listening'), { timeout: 15_000 }).toBe(true);

  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
  proxy?.kill('SIGTERM');
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

// ── Daemon-side seed (before any tab joins) ─────────────────────────

let ruleUid: string;
let daemonWorkspaceIds: string[];

test('MCP seeds a daemon-side rule before any tab joins', async () => {
  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);

  const payload = await callTool('rules_create', {
    rule: {
      name: 'Daemon web rule',
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Daemon', value: 'web-join' }],
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

// ── The front door's states (the front door plan §4.1) ──────────────

test('an unclaimed server draws the setup card and asks a browser for no machine credential', async () => {
  const firstContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  watchConsole(firstPage, 'unclaimed');
  await firstPage.goto(`${ORIGIN}/`);
  await firstPage.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });

  const gate = firstPage.locator('[data-testid=login-gate]');
  await expect(gate).toContainText('Set up this server');
  // Signing in is the only way past: no local-only bypass on any
  // posture, no pairing-token field anywhere, and no `ohd` command
  // shown to a visitor who has not proved anything yet.
  expect(await firstPage.$('[data-testid=login-gate-skip]')).toBeNull();
  expect(await firstPage.$('[data-testid=login-gate-token]')).toBeNull();
  await expect(gate).not.toContainText('ohd ');
  // The setup code is offered with its reason, never demanded — this
  // browser is on the box, and the dominant first run needs no code.
  await expect(firstPage.locator('[data-testid=login-gate-setup-code]')).toBeVisible();
  await expect(gate).toContainText('not running on the server itself');
  // Chromium under Playwright resolves to the Chrome Web Store listing
  // and one desktop download named for this machine's OS.
  await expect(firstPage.locator('[data-testid=login-gate-client-extension]')).toHaveCount(1);
  await expect(firstPage.locator('[data-testid=login-gate-client-extension]')).toContainText('Chrome');
  await expect(firstPage.locator('[data-testid=login-gate-client-desktop]')).toHaveCount(1);

  // The daemon's own minimum, mirrored client-side: a password too
  // short to be accepted never leaves the browser.
  await firstPage.fill(setupInput('name'), 'John Doe');
  await firstPage.fill(setupInput('email'), ADMIN_EMAIL);
  await firstPage.fill(setupInput('password'), 'short');
  await firstPage.fill(setupInput('confirm'), 'short');
  await expect(firstPage.locator('[data-testid=login-gate-setup-submit]')).toBeDisabled();

  await firstContext.close();
});

test('a claimed server signs the admin in; a wrong password is refused in band', async () => {
  await admitPasswordUser('John Doe', ADMIN_EMAIL, ADMIN_PASSWORD, daemonWorkspaceIds[0], 'owner');
  const [adminIsAdmin] = await adminOverWire([{ type: 'oh.daemon.users.list' }]);
  const adminRow = (adminIsAdmin.payload as { users: Array<{ userId: string; email?: string }> }).users.find(
    (u) => u.email === ADMIN_EMAIL,
  );
  expect(adminRow).toBeDefined();
  await adminOverWire([{ type: 'oh.daemon.users.setDaemonAdmin', userId: adminRow?.userId, isAdmin: true }]);

  context = await browser.newContext();
  page = await context.newPage();
  watchConsole(page, 'loopback');
  await page.goto(`${ORIGIN}/`);
  await page.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });
  await expect(page.locator('[data-testid=login-gate]')).toContainText('Sign in to this server');
  expect(await page.$('[data-testid=login-gate-token]')).toBeNull();

  await signInAtGate(page, ADMIN_EMAIL, 'not-the-password');
  await page.waitForSelector('[data-testid=login-gate-error]', { timeout: 15_000 });
  await expect(page.locator('[data-testid=login-gate-error]')).toContainText('Sign-in failed');

  await signInAtGate(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });

  // A session persisted origin-scoped, only after the WELCOME accepted
  // it — and it is NOT the operator's bootstrap token.
  const session = (await readHostSlot(page, 'oh.webBackendToken')) as string | null;
  expect(session).toBeTruthy();
  expect(session).not.toBe(token);
  const joined = (await readHostSlot(page, 'oh.joinedOrgs')) as Array<{ backendId: string }> | null;
  expect(joined?.map((row) => row.backendId)).toEqual(['web-serving-daemon']);
});

// ── Down-sync + live replication ────────────────────────────────────

test('the daemon rule synced down and an MCP rename replicates live', async () => {
  await expect.poll(() => ruleInTabIdb(page, 'Daemon web rule'), { timeout: 30_000 }).toBe(true);

  await callTool('rules_update', { uid: ruleUid, updates: { name: 'Daemon web rule v2' } });
  await expect.poll(() => ruleInTabIdb(page, 'Daemon web rule v2'), { timeout: 30_000 }).toBe(true);
});

// ── No inbound echo of the catch-up stream ──────────────────────────

test('the catch-up stream is not echoed back to the daemon', async () => {
  // Up to here the tab has only CONSUMED: the join's catch-up plus the
  // live rename came down, and the user created nothing in the tab.
  // Every wire-inbound envelope the daemon applies stamps a
  // workspace.write audit line — and the pin is EXACTLY ZERO of them:
  // post-adoption initialization no longer mints (the consumed-
  // workspace default-collection guard) and layout-state is host-local
  // (never crosses). Before those, the tab's post-adoption bookkeeping
  // put 1–2 lines here; before origin-aware forwarding, it re-uploaded
  // the ENTIRE catch-up stream (snapshot re-seed + delta echo) — 15+
  // lines in a burst right after the join.
  await page.waitForTimeout(500);
  const audits = daemonLog
    .join('')
    .split('\n')
    .filter((line) => line.includes('workspace.write'));
  expect(audits.length, audits.join('\n')).toBe(0);
});

// ── Join → adopt + upward sync through the real editor flow ─────────

test('join adopted the daemon workspace and a tab-created rule syncs up', async () => {
  // The gate flow mounts only after adoption promoted the daemon's
  // workspace, so the first tab's editing scope is the adopted one.
  await expect
    .poll(async () => {
      const active = await readHostSlot(page, 'oh.runtimeActive.active');
      return daemonWorkspaceIds.includes(active as string);
    })
    .toBe(true);

  await page.getByRole('button', { name: 'Create rule', exact: false }).first().click();
  // 'Block Requests' expands a template submenu; 'Blank Rule' is the
  // plain editor flow this leg drives.
  await page.getByText('Block Requests', { exact: false }).first().click();
  await page.getByRole('menuitem', { name: 'Blank Rule' }).click();
  await page.waitForSelector('input[value="New Block Rule"]', { timeout: 10_000 });
  await page
    .locator('button:visible')
    .filter({ hasText: /^Save$/ })
    .first()
    .click();

  // Save dialog: Save arms only once a target collection is chosen.
  // The adopted workspace already carries the daemon's collection —
  // pick it; fall back to creating one inline on an empty workspace.
  await page.waitForSelector('.ant-modal', { timeout: 10_000 });
  const collectionOption = page.locator('.ant-modal [role=option]').first();
  if ((await collectionOption.count()) > 0) {
    await collectionOption.click();
  } else {
    await page.locator('.ant-modal').getByText('New collection', { exact: false }).first().click();
    const collectionInput = page.locator('.ant-modal input:visible').last();
    await collectionInput.fill('Web Join');
    await collectionInput.press('Enter');
  }
  await page
    .locator('.ant-modal button:visible')
    .filter({ hasText: /^Save$/ })
    .last()
    .click();

  await expect
    .poll(
      async () => {
        const rules = await callTool('rules_list', {});
        return (rules.rules as Array<{ name: string }>).some((r) => r.name === 'New Block Rule');
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});

// ── Consume-only upward semantics ───────────────────────────────────

test('the tab local workspace never pollutes the daemon', async () => {
  const workspaces = await callTool('workspaces_list', {});
  const ids = (workspaces.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  expect(ids.sort()).toEqual([...daemonWorkspaceIds].sort());
});

// ── Reload: no gate, auto-rejoin ────────────────────────────────────

test('a reload skips the gate and rejoins with the daemon data present', async () => {
  await page.reload();
  await page.waitForTimeout(1500);
  expect(await page.$('[data-testid=login-gate]')).toBeNull();
  await expect.poll(() => ruleInTabIdb(page, 'Daemon web rule v2'), { timeout: 30_000 }).toBe(true);
  await context.close();
});

// ── The admin console (peer admin plane end-to-end) ─────────────────

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

/** Open Settings → Backend on `target` via the topbar gear menu. */
async function openBackendSettings(target: Page): Promise<void> {
  await target.click('[aria-label="Settings menu"]');
  await target.click('text=Settings…');
  await target.click('.settings-category-nav button:has-text("Backend")');
}

test('admin console: the admin manages users and devices from the tab; a directory user sees no admin CTA', async () => {
  // Admin context — fresh storage, signed in with the password. The
  // console reaches the gated plane on the `daemon.admin` role, not on
  // an operator credential the browser never sees.
  const [operatorContext, operatorPage] = await openSignedIn('admin-console', ADMIN_EMAIL, ADMIN_PASSWORD);

  // Settings → Backend → the probe-gated CTA → the console tab.
  await openBackendSettings(operatorPage);
  await operatorPage.click('[data-testid=open-daemon-admin]');
  await expect(operatorPage.locator('[data-testid=daemon-admin-console]')).toBeVisible();

  // Admit Alice through the console UI — the whole write path runs
  // over the wire into the daemon's gated plane.
  await operatorPage.fill(
    'input[data-testid=daemon-admin-add-name], [data-testid=daemon-admin-add-name] input',
    'Alice',
  );
  await operatorPage.click('[data-testid=daemon-admin-add-user]');
  await expect(operatorPage.locator('[data-testid=daemon-admin-console]')).toContainText('Alice');

  // Device management in the same console: mint a token in the UI —
  // the secret surfaces exactly once — then revoke it and watch the
  // daemon evict the live peer riding it.
  await operatorPage.fill(
    'input[data-testid=daemon-tokens-mint-label], [data-testid=daemon-tokens-mint-label] input',
    'console device',
  );
  await operatorPage.click('[data-testid=daemon-tokens-mint]');
  const secretField = operatorPage.locator('[data-testid=daemon-tokens-secret]');
  await expect(secretField).toBeVisible();
  const consoleSecret = await secretField.inputValue();
  expect(consoleSecret.length).toBeGreaterThan(0);
  await operatorPage.click('[data-testid=daemon-tokens-secret-saved]');
  await expect(secretField).not.toBeVisible();

  // The UI-minted secret admits a real peer over a raw wire.
  const [consoleTokens] = await adminOverWire([{ type: 'oh.daemon.tokens.list' }]);
  const consoleRow = (consoleTokens.payload as { tokens: Array<{ id: string; label?: string }> }).tokens.find(
    (t) => t.label === 'console device',
  );
  expect(consoleRow).toBeDefined();
  const deviceSocket = new WebSocket(`ws://127.0.0.1:${DAEMON_PORT}`);
  const deviceWelcome = new Promise<{ accepted?: boolean }>((resolve) => {
    deviceSocket.addEventListener('message', (event) => {
      const frame = JSON.parse(String(event.data)) as { type: string; accepted?: boolean };
      if (frame.type === 'oh.sync.welcome') resolve(frame);
    });
  });
  await new Promise<void>((resolve, reject) => {
    deviceSocket.addEventListener('open', () => resolve(), { once: true });
    deviceSocket.addEventListener('error', () => reject(new Error('device wire failed to open')), { once: true });
  });
  deviceSocket.send(
    JSON.stringify({
      type: 'oh.sync.hello',
      protocolVersion: 1,
      role: 'web',
      nodeId: 'e2e-console-minted-device',
      workspaceId: 'e2e-console-minted-device',
      agent: '@openheaders/web@e2e',
      authToken: consoleSecret,
    }),
  );
  expect((await deviceWelcome).accepted).toBe(true);
  const deviceClosed = new Promise<void>((resolve) => {
    deviceSocket.addEventListener('close', () => resolve(), { once: true });
  });

  // Revoke from the console — the row flips to Revoked and the live
  // socket is evicted (persist-before-evict on the daemon side).
  await operatorPage.click(`[data-testid=daemon-token-revoke-${consoleRow?.id}]`);
  await operatorPage.click('.ant-popconfirm button:has-text("Revoke")');
  await deviceClosed;
  await expect(operatorPage.locator(`[data-testid=daemon-token-row-${consoleRow?.id}]`)).toContainText('Revoked');

  // Reports below tokens: the operator's own admin calls above are
  // enforcement rows, and each gated connect (this tab's join included)
  // stamped a distinguishable Admission row.
  const reports = operatorPage.locator('[data-testid=daemon-audit-reports]');
  await operatorPage.click('[data-testid=daemon-audit-refresh]');
  await expect(reports).toContainText('daemon.admin');
  await expect(reports.locator('.ant-tag', { hasText: 'Allow' }).first()).toBeVisible();
  await expect(reports.locator('.ant-tag', { hasText: 'Admission' }).first()).toBeVisible();

  await operatorContext.close();

  // The console admitted Alice by name only, which is all its form
  // takes; a browser sign-in keys on an email, so the plain-user leg
  // rides a wire-admitted user carrying one.
  const [listed] = await adminOverWire([{ type: 'oh.daemon.users.list' }]);
  const users = (listed.payload as { users: Array<{ userId: string; displayName: string }> }).users;
  expect(users.some((u) => u.displayName === 'Alice')).toBe(true);
  await admitPasswordUser('Ada Lovelace', 'ada@openheaders.io', 'ada-first-password', daemonWorkspaceIds[0], 'viewer');

  // A plain directory user: the Workbench mounts on the granted
  // workspace, and the backend card shows NO admin CTA (the probe
  // answered false over the same wire).
  const [aliceContext, alicePage] = await openSignedIn('plain-user', 'ada@openheaders.io', 'ada-first-password');
  await openBackendSettings(alicePage);
  await expect(alicePage.locator('text=Always on').first()).toBeVisible();
  expect(await alicePage.$('[data-testid=open-daemon-admin]')).toBeNull();
  await aliceContext.close();
});

// ── The zero-grant landing (slice 3) ────────────────────────────────

test('zero-grant landing: the explained notice stands, then a live grant resolves the open tab without a reload', async () => {
  // A fresh directory user who can sign in and holds ZERO grants.
  const [created] = await adminOverWire([
    { type: 'oh.daemon.users.create', displayName: 'Zoe', email: 'zoe@openheaders.io' },
  ]);
  const zoeId = (created.payload as { ok: true; userId: string }).userId;
  const [passworded] = await adminOverWire([
    { type: 'oh.daemon.users.setPassword', userId: zoeId, password: 'zoe-first-password' },
  ]);
  expect((passworded.payload as { ok: boolean }).ok).toBe(true);

  const [zoeContext, zoePage] = await openSignedIn('zero-grant-zoe', 'zoe@openheaders.io', 'zoe-first-password');

  // Org-joined with nothing granted: the workbench mounts on a usable
  // local workspace and the persistent explained notice stands.
  await expect(zoePage.locator('[data-testid=org-zero-grant-notice]')).toBeVisible({ timeout: 30_000 });

  // Grant viewer while her tab stays open — the daemon's grant-time
  // offer re-fans the workspace row down the already-connected wire.
  const grantedWorkspaceId = daemonWorkspaceIds[0];
  const [granted] = await adminOverWire([
    { type: 'oh.daemon.users.grant', userId: zoeId, workspaceId: grantedWorkspaceId, role: 'viewer' },
  ]);
  expect((granted.payload as { ok: boolean }).ok).toBe(true);

  // The open tab resolves live: notice gone, arrival announced.
  await expect(zoePage.locator('[data-testid=org-zero-grant-notice]')).toHaveCount(0, { timeout: 30_000 });
  const openButton = zoePage.locator(`[data-testid=org-workspace-arrival-open-${grantedWorkspaceId}]`);
  await expect(openButton).toBeVisible({ timeout: 30_000 });

  // No auto-switch happened; the announcement's action switches THIS
  // tab, and the navigator now carries the granted workspace.
  const listed = await callTool('workspaces_list', {});
  const grantedName = (listed.workspaces as Array<{ id: string; name: string }>).find(
    (ws) => ws.id === grantedWorkspaceId,
  )?.name;
  expect(grantedName).toBeTruthy();
  await openButton.click();
  await expect(zoePage.locator(`[aria-label*="editing workspace: ${grantedName}"]`)).toBeVisible({
    timeout: 30_000,
  });

  await zoeContext.close();
});

// ── Local password login (enterprise Phase 3) ───────────────────────

test('password login: the operator sets a password in the console; a fresh gate signs the user in', async () => {
  // A directory user with an email (the login join key) and a grant so
  // the join adopts cleanly. No OIDC is configured on this daemon, so
  // the password routes are composed.
  const [created] = await adminOverWire([
    { type: 'oh.daemon.users.create', displayName: 'Pia', email: 'pia@openheaders.io' },
  ]);
  const piaId = (created.payload as { ok: true; userId: string }).userId;
  const [granted] = await adminOverWire([
    { type: 'oh.daemon.users.grant', userId: piaId, workspaceId: daemonWorkspaceIds[0], role: 'viewer' },
  ]);
  expect((granted.payload as { ok: boolean }).ok).toBe(true);

  // The admin already holds one, so the sign-in card is what the gate
  // draws — Pia simply has no password of her own yet.
  const meta = (await (await fetch(`${ORIGIN}/auth/password/meta`)).json()) as { enabled: boolean };
  expect(meta.enabled).toBe(true);

  // The admin sets Pia's password through the console UI — the whole
  // write path runs over the wire into the gated admin plane.
  const [operatorContext, operatorPage] = await openSignedIn('password-admin', ADMIN_EMAIL, ADMIN_PASSWORD);
  await openBackendSettings(operatorPage);
  await operatorPage.click('[data-testid=open-daemon-admin]');
  await operatorPage.click(`[data-testid=daemon-admin-password-${piaId}]`);
  await operatorPage.fill(
    'input[data-testid=daemon-admin-password-input], [data-testid=daemon-admin-password-input] input',
    'pia-first-password',
  );
  await operatorPage.click('[data-testid=daemon-admin-password-save]');
  // The projection refreshes: the row's action now offers a reset.
  await expect(operatorPage.locator(`[data-testid=daemon-admin-password-${piaId}]`)).toContainText('Reset password', {
    timeout: 15_000,
  });
  await operatorContext.close();

  // A fresh origin now gates with the password form; a wrong password
  // is refused uniformly; the right one signs Pia in.
  const piaContext = await browser.newContext();
  const piaPage = await piaContext.newPage();
  watchConsole(piaPage, 'password-pia');
  await piaPage.goto(ORIGIN);
  await piaPage.waitForSelector(EMAIL_INPUT, { timeout: 30_000 });
  // Managed login (password) — same rule, and the native clients ride
  // along here too.
  expect(await piaPage.$('[data-testid=login-gate-skip]')).toBeNull();
  expect(await piaPage.$('[data-testid=login-gate-native-clients]')).not.toBeNull();
  await signInAtGate(piaPage, 'pia@openheaders.io', 'not-her-password');
  await piaPage.waitForSelector('[data-testid=login-gate-error]', { timeout: 15_000 });
  await expect(piaPage.locator('[data-testid=login-gate-error]')).toContainText('Sign-in failed');

  await signInAtGate(piaPage, 'pia@openheaders.io', 'pia-first-password');
  await piaPage.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
  await piaPage.waitForSelector('[aria-label="Settings menu"]', { timeout: 30_000 });

  // The login minted a session-kind ledger row bound to Pia — the same
  // shape the SSO flow mints, on the same revocation surface.
  const [tokens] = await adminOverWire([{ type: 'oh.daemon.tokens.list' }]);
  const sessionRow = (
    tokens.payload as { tokens: Array<{ userId?: string; kind?: string; label?: string }> }
  ).tokens.find((t) => t.userId === piaId && t.kind === 'session');
  expect(sessionRow?.label).toBe('password:pia@openheaders.io');

  await piaContext.close();
});

// ── Non-loopback origins ────────────────────────────────────────────

test('a plain-http non-loopback origin explains the secure-context requirement', async () => {
  const lan = lanIpv4();
  test.skip(lan === null, 'no non-internal IPv4 on this machine');

  // The platform withholds crypto on insecure origins, so the tab
  // oracle can never boot here — the app must say so, not die blank.
  const lanContext = await browser.newContext();
  const lanPage = await lanContext.newPage();
  watchConsole(lanPage, 'plain-http-lan');
  await lanPage.goto(`http://${lan}:${DAEMON_PORT}/`);
  await lanPage.waitForSelector('[data-testid=insecure-context-notice]', { timeout: 15_000 });
  // Nothing in the app can resolve this from here, so every way out
  // must carry the page that explains it — on the docs site, not a
  // section name in a README the reader would have to go find.
  const notice = lanPage.locator('[data-testid=insecure-context-notice]');
  await expect(notice.getByRole('link', { name: 'docs.openheaders.com/server/lan-vs-tls' })).toHaveAttribute(
    'href',
    'https://docs.openheaders.com/server/lan-vs-tls',
  );
  await expect(notice.getByRole('link', { name: 'docs.openheaders.com/quickstart/server' })).toHaveAttribute(
    'href',
    'https://docs.openheaders.com/quickstart/server',
  );
  await lanContext.close();
});

test('a TLS non-loopback origin gates and joins over wss through the rig proxy', async () => {
  // A dedicated browser instance so oh.test resolves to loopback
  // without touching DNS; the rig cert is self-signed, so cert
  // validation is bypassed at the browser level — the context-level
  // ignoreHTTPSErrors does not reach service-worker script fetches
  // (the origin is still a secure context).
  const tlsBrowser = await chromium.launch({
    args: ['--host-resolver-rules=MAP oh.test 127.0.0.1', '--ignore-certificate-errors'],
  });
  const tlsContext = await tlsBrowser.newContext({ ignoreHTTPSErrors: true });
  const tlsPage = await tlsContext.newPage();
  watchConsole(tlsPage, 'tls');
  await tlsPage.goto(`https://oh.test:${PROXY_PORT}/`);
  await tlsPage.waitForSelector(EMAIL_INPUT, { timeout: 15_000 });
  await signInAtGate(tlsPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  await tlsPage.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
  await expect.poll(() => ruleInTabIdb(tlsPage, 'Daemon web rule v2'), { timeout: 30_000 }).toBe(true);
  await tlsBrowser.close();
});

// ── The claim, on a daemon of its own (§4.2) ────────────────────────

test('the first browser claims an unclaimed server, hears what that unpaired, and lands joined', async () => {
  // A daemon this leg is free to take over: the claim revokes every
  // unbound token, which would strand the main run's operator plane.
  const claimDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-web-claim-'));
  const claimToken = `oh_${randomBytes(32).toString('base64url')}`;
  await writeFile(
    path.join(claimDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.daemonAuthTokens': [
          {
            id: 'web-claim-bootstrap-token',
            tokenHash: createHash('sha256').update(claimToken).digest('hex'),
            label: 'web-claim e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
  const claimOrigin = `http://127.0.0.1:${CLAIM_PORT}`;
  const claimDaemon = spawn(
    electronBinary,
    [DAEMON_MAIN, '--data-dir', claimDir, '--bind-port', String(CLAIM_PORT), '--web-root', WEB_DIST],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  const claimLog: string[] = [];
  for (const stream of [claimDaemon.stdout, claimDaemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => claimLog.push(chunk.toString()));
  }
  const claimExited = new Promise<number | null>((resolve) => claimDaemon.once('exit', (code) => resolve(code)));

  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${claimOrigin}/healthz`)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 30_000 },
      )
      .toBe(200);

    // The probe the gate draws its card from.
    const meta = (await (await fetch(`${claimOrigin}/auth/setup/meta`)).json()) as {
      unclaimed: boolean;
      requiresCode: boolean;
    };
    expect(meta).toEqual({ unclaimed: true, requiresCode: true });

    const claimContext = await browser.newContext();
    const claimPage = await claimContext.newPage();
    watchConsole(claimPage, 'claim');
    await claimPage.goto(`${claimOrigin}/`);
    await claimPage.waitForSelector(setupInput('name'), { timeout: 30_000 });

    // Loopback is the proof: the code field is offered and left empty.
    await claimPage.fill(setupInput('name'), 'John Doe');
    await claimPage.fill(setupInput('email'), 'john@openheaders.io');
    await claimPage.fill(setupInput('password'), 'claim-first-password');
    await claimPage.fill(setupInput('confirm'), 'claim-first-password');
    await claimPage.click('[data-testid=login-gate-setup-submit]');

    // The claim revoked the seeded bootstrap token and says which
    // devices that costs before handing the tab over.
    await claimPage.waitForSelector('[data-testid=login-gate-setup-done]', { timeout: 30_000 });
    await expect(claimPage.locator('[data-testid=login-gate-setup-done]')).toContainText('Pair it again');
    await claimPage.click('[data-testid=login-gate-setup-continue]');
    await claimPage.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
    await claimPage.waitForSelector('[aria-label="Settings menu"]', { timeout: 30_000 });

    // The session is an ordinary password-login row, and the claim is
    // one-shot by state: the route answers its uniform refusal now.
    expect(await readHostSlot(claimPage, 'oh.webBackendToken')).toBeTruthy();
    const second = await fetch(`${claimOrigin}/auth/setup/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Jane Doe', email: 'jane@openheaders.io', password: 'second-attempt-pw' }),
    });
    expect(second.status).toBe(403);
    expect((await (await fetch(`${claimOrigin}/auth/setup/meta`)).json()) as unknown).toEqual({
      unclaimed: false,
      requiresCode: false,
    });

    await claimContext.close();
  } finally {
    if (claimDaemon.exitCode === null) {
      claimDaemon.kill('SIGTERM');
      await claimExited;
    }
    if (test.info().status !== test.info().expectedStatus) {
      console.log(`claim daemon log:\n${claimLog.join('')}`);
    }
    await rm(claimDir, { recursive: true, force: true });
  }
});

// ── Hygiene: console silence, ledger stamp, clean shutdown ──────────

test('zero console errors across every leg', () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});

test('token validation stamped the persisted ledger; SIGTERM exits clean', async () => {
  const envelope = JSON.parse(await readFile(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
  };
  const ledger = envelope.values['oh.daemonAuthTokens'] as Array<{
    id: string;
    kind?: string;
    label?: string;
    lastUsedAt: number | null;
  }>;
  const bootstrap = ledger.find((row) => row.id === 'web-join-bootstrap-token');
  expect(bootstrap?.lastUsedAt).toBeGreaterThan(0);
  // Every browser leg above rode a session minted by a password login,
  // never the operator's bootstrap secret.
  const adminSession = ledger.find((row) => row.label === `password:${ADMIN_EMAIL}`);
  expect(adminSession?.kind).toBe('session');
  expect(adminSession?.lastUsedAt).toBeGreaterThan(0);

  daemon.kill('SIGTERM');
  expect(await daemonExited).toBe(0);
});
