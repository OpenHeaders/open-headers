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
 *   3. Launch Chromium with the built extension, point its backend
 *      registry at the daemon over the machine's LAN address, and
 *      assert the daemon's workspace + rule sync down (consume-only
 *      join, ADR-9).
 *   4. Mutate through MCP while the extension is connected — the
 *      rename must replicate live over the WS pipe.
 *   5. Assert nothing pollutes upward: the extension's own local
 *      workspace never appears on the daemon.
 *   6. SIGTERM shuts the daemon down clean.
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
import { type BrowserContext, chromium, expect, test } from '@playwright/test';

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
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '0.0.0.0', '--bind-port', String(DAEMON_PORT)],
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
      { timeout: 30000 },
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

// ── Extension joins the daemon on the LAN address ───────────────────

test('the extension joins over the LAN bind and the rule syncs down', async () => {
  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  // Mark the onboarding tour completed BEFORE opening the popup — on a
  // fresh profile the tour's modal mask covers the whole popup.
  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // Keep a client page attached so the MV3 service worker never idles
  // out mid-test.
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Point the extension at the daemon's LAN address with the bootstrap
  // token. The registry record is a sensitive slot, so the seed encrypts
  // with the SW's own at-rest key — same blob format as
  // `browser-secret-cipher`; the registry mirror's storage subscription
  // dials it live. The SW can restart between acquire and evaluate
  // ("execution context destroyed"), so re-acquire + retry.
  const seedBackend = async (seed: { backendUrl: string; authToken: string }): Promise<void> => {
    const worker =
      extensionContext?.serviceWorkers().at(-1) ?? (await extensionContext?.waitForEvent('serviceworker'));
    if (!worker) throw new Error('no extension service worker');
    await worker.evaluate(async ({ backendUrl, authToken }) => {
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
        id: 't3-daemon-backend',
        label: 't3 daemon',
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
    }, seed);
  };

  let seedError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await seedBackend({ backendUrl: `ws://${lanIpv4()}:${DAEMON_PORT}`, authToken: token });
      seedError = undefined;
      break;
    } catch (err) {
      seedError = err;
      await popup.waitForTimeout(1000);
    }
  }
  expect(seedError, String(seedError)).toBeUndefined();

  // Consume-only join: the daemon's workspace (and the MCP-created rule
  // inside it) replicates into chrome.storage under oh.ws.<id>.rules.
  await expect.poll(() => ruleVisibleInExtension('Daemon header rule'), { timeout: 30000 }).toBe(true);
});

test('an MCP mutation replicates live into the connected extension', async () => {
  await callTool('rules_update', { uid: ruleUid, updates: { name: 'Daemon header rule v2' } });

  await expect.poll(() => ruleVisibleInExtension('Daemon header rule v2'), { timeout: 30000 }).toBe(true);
});

// ── Consume-only upward semantics ───────────────────────────────────

test('the extension local workspace never pollutes the daemon', async () => {
  const workspaces = await callTool('workspaces_list', {});
  const ids = (workspaces.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  expect(ids.sort()).toEqual([...daemonWorkspaceIds].sort());

  const rules = await callTool('rules_list', {});
  expect((rules.rules as Array<{ name: string }>).map((r) => r.name)).toEqual(['Daemon header rule v2']);
});

// ── Ledger + clean shutdown ─────────────────────────────────────────

test('token validation stamped the persisted ledger', async () => {
  const envelope = JSON.parse(await readFile(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
    secrets: Record<string, string>;
  };
  const ledger = envelope.values['oh.daemonAuthTokens'] as Array<{ id: string; lastUsedAt: number | null }>;
  expect(ledger[0].id).toBe('t3-bootstrap-token');
  expect(ledger[0].lastUsedAt).toBeGreaterThan(0);
  expect(envelope.secrets['oh.daemonAuthTokens']).toBeUndefined();
});

test('SIGTERM shuts the daemon down clean', async () => {
  await extensionContext?.close();
  extensionContext = undefined;
  daemon.kill('SIGTERM');
  expect(await daemonExited).toBe(0);
});
