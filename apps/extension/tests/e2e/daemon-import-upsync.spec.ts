/**
 * Extension→backend import-propagation gate — the SW-host leg of the
 * import local-mutation emission (REQUEST_SETTINGS_STATUS.md S19; the
 * web-tab and desktop-spine directions are gated by
 * `request-settings-web.spec.ts` legs 10 + 14):
 *
 *   1. Spawn the built headless daemon with a pre-seeded token ledger
 *      (the T3 offline bootstrap) and MCP enabled.
 *   2. Launch Chromium with the built extension, seed its backend
 *      registry at the daemon, and wait for the first-join adoption —
 *      the daemon's active workspace becomes the extension's.
 *   3. Drive `importWorkspace` in the SW host through the popup-page
 *      RPC with a foreign-workspace envelope carrying one environment,
 *      target `current` (= the adopted, backend-bound workspace).
 *   4. The daemon's own MCP `environments_list` is the materialization
 *      authority: the entity must appear there, adopted by NAME — the
 *      `new-uid` strategy re-mints the envelope's uid on landing, so a
 *      uid-keyed poll can never match.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon` and
 * the extension `dist/chrome` (user-built). The daemon runs under the
 * repo's electron binary with ELECTRON_RUN_AS_NODE (better-sqlite3 ABI).
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Off every other suite's bind (8137 default, 18137 mcp, 18238 join,
// 18337 cli, 18338/9 wan, 18537 live, 19137 serve, 19237 web, 19537/8
// multi-backend, 19737/8 desktop-client).
const DAEMON_PORT = 18438;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-import-upsync-client', version: '0.0.0' },
};

let daemon: ChildProcess;
let daemonExited: Promise<number | null>;
let token: string;
let extensionContext: BrowserContext | undefined;
let rpcPage: Page;
const daemonLog: string[] = [];

async function mcpRpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
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
  const json = await mcpRpc('tools/call', { name, arguments: args });
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

/** SW RPC through the popup page — the client-page path every UI call takes. */
async function extensionRpc<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return rpcPage.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }) as Promise<unknown>,
    { type, payload },
  ) as Promise<T>;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-import-upsync-'));

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
            id: 'import-upsync-token',
            tokenHash,
            label: 'import-upsync e2e',
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
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(DAEMON_PORT)],
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

let daemonWorkspaceId: string;

test('the daemon answers initialize and names its workspace', async () => {
  const json = await mcpRpc('initialize', INITIALIZE_PARAMS);
  const result = json.result as { serverInfo: { name: string } };
  expect(result.serverInfo.name).toBe('open-headers');

  const workspaces = await callTool('workspaces_list', {});
  const ids = (workspaces.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  expect(ids.length).toBeGreaterThan(0);
  daemonWorkspaceId = ids[0]!;
});

test('the extension joins and adopts the daemon workspace as active', async () => {
  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // Keep a client page attached so the MV3 service worker never idles
  // out mid-test; it doubles as the RPC page.
  rpcPage = await extensionContext.newPage();
  await rpcPage.goto(`chrome-extension://${extensionId}/popup.html`);

  // Point the extension at the daemon with the bootstrap token — same
  // encrypted registry seed as daemon-join.spec.ts (the record is a
  // sensitive slot; encrypt with the SW's own at-rest key). The SW can
  // restart between acquire and evaluate, so re-acquire + retry.
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
        id: 'import-upsync-backend',
        label: 'import-upsync daemon',
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
      await seedBackend({ backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token });
      seedError = undefined;
      break;
    } catch (err) {
      seedError = err;
      await rpcPage.waitForTimeout(1000);
    }
  }
  expect(seedError, String(seedError)).toBeUndefined();

  // First-join adoption: the daemon's WELCOME carries its active
  // workspace; once that workspace syncs down the extension promotes it
  // to active — the precondition for a `current`-target import to hit
  // the backend-bound workspace.
  await expect
    .poll(
      async () => {
        const res = await extensionRpc<{ activeWorkspaceId?: string }>('listWorkspaces');
        return res?.activeWorkspaceId ?? '';
      },
      { timeout: 30000 },
    )
    .toBe(daemonWorkspaceId);
});

test('an SW-host import propagates upstream — the daemon sees the environment', async () => {
  const imported = await extensionRpc<{ success: boolean; error?: string }>('importWorkspace', {
    incoming: {
      schemaVersion: 5,
      kind: 'workspace-export',
      exportFormatVersion: 1,
      exportId: 'e2e0ext1',
      exportedAt: '2026-07-13T00:00:00.000Z',
      source: { app: 'extension', appVersion: '0.0.0', platform: 'chrome', workspaceLabel: 'Import Upsync Rig' },
      scope: 'workspace',
      workspace: { uid: '01905000-0000-7000-8000-00000000e2e3', name: 'Import Upsync Rig' },
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests: [],
        templates: [],
        environments: [
          {
            schemaVersion: 5,
            uid: 'e2eexte1',
            name: 'extension: imported env',
            variables: [{ uid: 'e2eextv1', name: 'EXTENSION_IMPORTED', value: 'yes', type: 'default' }],
          },
        ],
        workspaceVars: { schemaVersion: 5, variables: [] },
        liveWorkflows: [],
        liveVariables: [],
      },
      meta: {
        redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
        counts: {
          rules: 0,
          requests: 0,
          environments: 1,
          liveWorkflows: 0,
          liveVariables: 0,
          templates: 0,
          secrets: 0,
        },
      },
    },
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:import-upsync-probe',
  });
  expect(imported?.success, imported?.error).toBe(true);

  // The daemon's own MCP view is the materialization authority; adopt
  // the landed uid by NAME — `new-uid` re-mints the envelope's.
  await expect
    .poll(
      async () => {
        const payload = await callTool('environments_list', {});
        const environments = payload.environments as Array<{ uid: string; name: string }>;
        return environments.some((e) => e.name === 'extension: imported env');
      },
      { timeout: 30000 },
    )
    .toBe(true);
});
