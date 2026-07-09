/**
 * Phase 4b B2 acceptance — the web tab joins its serving daemon:
 *
 *   1. Spawn the built `apps/daemon` bundle on `0.0.0.0` with an
 *      isolated data dir, serving the built `apps/web` bundle
 *      (`--web-root`). The token ledger + MCP settings are pre-seeded
 *      in `storage.json` (the offline `oh daemon show-token`
 *      equivalent, same idiom as the extension T3 gate).
 *   2. A fresh origin renders the LOGIN GATE (no stored token); a bad
 *      token is rejected in-band by a real HELLO; the minted token
 *      joins and mounts the Workbench.
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
 *   7. Zero console errors across every leg; SIGTERM exits clean.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon`
 * and `pnpm turbo build --filter=@openheaders/web`. The daemon runs
 * under the repo's electron binary with ELECTRON_RUN_AS_NODE (the
 * monorepo's better-sqlite3 is compiled for Electron's ABI).
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;
const DAEMON_RIG = path.join(REPO_ROOT, 'playground/daemon-rig');

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-web-join-client', version: '0.0.0' },
};

const TOKEN_INPUT = 'input[data-testid=login-gate-token], [data-testid=login-gate-token] input';

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
    if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`);
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

/** Drive the login gate with `value` and wait for the submit round-trip. */
async function submitGateToken(target: Page, value: string): Promise<void> {
  await target.fill(TOKEN_INPUT, value);
  await target.click('[data-testid=login-gate-submit]');
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

// ── The login gate + token pairing (a real HELLO both ways) ─────────

test('a fresh origin gates; a bad token is rejected in-band; the minted token joins', async () => {
  context = await browser.newContext();
  page = await context.newPage();
  watchConsole(page, 'loopback');
  await page.goto(`${ORIGIN}/`);

  await page.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });

  await submitGateToken(page, 'oh_definitely-wrong-token');
  await page.waitForSelector('[data-testid=login-gate-error]', { timeout: 15_000 });
  await expect(page.locator('[data-testid=login-gate-error]')).toContainText('rejected this token');

  await submitGateToken(page, token);
  await page.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });

  // Persisted origin-scoped, only after the WELCOME accepted it.
  await expect.poll(() => readHostSlot(page, 'oh.webBackendToken')).toBe(token);
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
  // Every inbound envelope the daemon applies stamps a workspace.write
  // audit line. A couple of lines are legitimate — the tab's
  // post-adoption bookkeeping (per-workspace singleton seeds) are local
  // mints that sync up. Before origin-aware forwarding, the tab also
  // re-uploaded the ENTIRE catch-up stream (snapshot re-seed + delta
  // echo) — 15+ lines in a burst right after the join. The bound
  // catches that class of regression without pinning the exact
  // bookkeeping count, which varies with hydration timing.
  await page.waitForTimeout(500);
  const audits = daemonLog
    .join('')
    .split('\n')
    .filter((line) => line.includes('workspace.write'));
  expect(audits.length, audits.join('\n')).toBeLessThan(5);
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
  await page.getByText('Block Requests', { exact: false }).first().click();
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
  await lanContext.close();
});

test('a TLS non-loopback origin gates and joins over wss through the rig proxy', async () => {
  // A dedicated browser instance so oh.test resolves to loopback
  // without touching DNS; the rig cert is self-signed, so the context
  // bypasses cert validation (the origin is still a secure context).
  const tlsBrowser = await chromium.launch({
    args: ['--host-resolver-rules=MAP oh.test 127.0.0.1'],
  });
  const tlsContext = await tlsBrowser.newContext({ ignoreHTTPSErrors: true });
  const tlsPage = await tlsContext.newPage();
  watchConsole(tlsPage, 'tls');
  await tlsPage.goto(`https://oh.test:${PROXY_PORT}/`);
  await tlsPage.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });
  await submitGateToken(tlsPage, token);
  await tlsPage.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
  await expect.poll(() => ruleInTabIdb(tlsPage, 'Daemon web rule v2'), { timeout: 30_000 }).toBe(true);
  await tlsBrowser.close();
});

// ── Hygiene: console silence, ledger stamp, clean shutdown ──────────

test('zero console errors across every leg', () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});

test('token validation stamped the persisted ledger; SIGTERM exits clean', async () => {
  const envelope = JSON.parse(await readFile(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
  };
  const ledger = envelope.values['oh.daemonAuthTokens'] as Array<{ id: string; lastUsedAt: number | null }>;
  expect(ledger[0].id).toBe('web-join-bootstrap-token');
  expect(ledger[0].lastUsedAt).toBeGreaterThan(0);

  daemon.kill('SIGTERM');
  expect(await daemonExited).toBe(0);
});
