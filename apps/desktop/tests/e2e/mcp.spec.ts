/**
 * MCP server E2E — the full agent-control loop against the real stack:
 *
 *   1. Launch the built desktop app with an isolated userData dir
 *      (OPENHEADERS_USER_DATA_DIR) on a non-default daemon port, with
 *      `mcp.enabled` + `mcp.allowWrite` pre-seeded in storage.json.
 *   2. Mint a daemon token through the real `oh.daemon.tokens.mint`
 *      RPC from the Workbench renderer.
 *   3. Drive the streamable-HTTP MCP endpoint like an agent client:
 *      admission chain, initialize, tools/list, read + write tools.
 *   4. Assert an MCP-driven mutation lands LIVE in the open Workbench
 *      window (no reload) — the roadmap's "mutates → Workbench" arrow.
 *   5. Launch Chromium with the built browser extension, point its
 *      backend at the app's daemon socket, and assert the same rule
 *      syncs into the browser — the extension round-trip.
 *
 * Requires both builds: `pnpm --filter @openheaders/desktop build` and
 * the extension `dist/chrome` (built separately).
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
// Off the default 8137 so the suite never collides with a real install.
const DAEMON_PORT = 18137;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-e2e-client', version: '0.0.0' },
};

interface McpToolResult {
  isError?: boolean;
  payload: Record<string, unknown>;
  text: string;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let extensionContext: BrowserContext | undefined;

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

/** tools/call wrapper — unwraps the JSON text content block. */
async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const { status, json } = await rpc('tools/call', { name, arguments: args });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  const text = result.content[0]?.text ?? '';
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // error results carry plain text — callers assert on `text`.
  }
  return { isError: result.isError, payload, text };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-mcp-e2e-'));
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

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData },
  });
  workbench = await electronApp.firstWindow();

  // Engine-ready gate: the endpoint answers 401 (bound + enabled, token
  // missing) once the daemon bind is up.
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

  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'mcp-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
});

test.afterAll(async () => {
  await extensionContext?.close();
  await electronApp?.close();
});

// ── Admission ───────────────────────────────────────────────────────

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

test('lists the read + write catalog with the write tier enabled', async () => {
  const { json } = await rpc('tools/list', {});
  const names = (json.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
  expect(names).toEqual([
    'workspaces_list',
    'rules_list',
    'rules_get',
    'requests_list',
    'requests_get',
    'environments_list',
    'variables_list',
    'workflows_list',
    'activity_list',
    'rules_toggle',
    'rules_create',
    'rules_update',
    'rules_delete',
    'environments_create',
    'environments_edit',
    'variables_set',
    'requests_save',
  ]);
});

// ── Reads on the fresh workspace ────────────────────────────────────

test('lists the bootstrap workspace as active and loaded', async () => {
  const { payload } = await callTool('workspaces_list', {});
  const workspaces = payload.workspaces as Array<{ id: string; active: boolean; loaded: boolean }>;
  expect(workspaces.length).toBeGreaterThan(0);
  expect(payload.activeWorkspaceId).toBeTruthy();
  expect(workspaces.find((ws) => ws.active)?.loaded).toBe(true);
});

test('surfaces agent-readable errors for bad uids and unknown workspaces', async () => {
  const badUid = await callTool('rules_get', { uid: 'not-a-rule' });
  expect(badUid.isError).toBe(true);
  expect(badUid.text).toContain('see rules_list');

  const badWorkspace = await callTool('rules_list', { workspaceId: 'not-a-workspace' });
  expect(badWorkspace.isError).toBe(true);
  expect(badWorkspace.text).toContain('workspaces_list');
});

// ── Write path + live Workbench reflection ──────────────────────────

let ruleUid: string;

test('creates a published rule through the canonical write path', async () => {
  const { isError, payload } = await callTool('rules_create', {
    rule: {
      name: 'Agent header rule',
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Agent', value: 'mcp-e2e' }],
        responseHeaders: [],
      },
    },
  });
  expect(isError).toBeFalsy();
  const rule = payload.rule as { uid: string; path: string; published: boolean };
  ruleUid = rule.uid;
  expect(rule.published).toBe(true);
  expect(rule.path).toContain('rules/');

  const list = await callTool('rules_list', {});
  const rows = list.payload.rules as Array<{ uid: string; name: string }>;
  expect(rows.map((r) => r.name)).toContain('Agent header rule');
});

test('the created rule appears live in the open Workbench window', async () => {
  await workbench.getByLabel('HTTP Rules').click();
  // Sidebar sections start collapsed on a fresh profile ("▶ RULES" /
  // "▶ TEMPLATES" section-header buttons).
  await workbench.getByRole('button', { name: /\bRULES\b/ }).click();
  await workbench.getByText('My Rules', { exact: true }).click();
  await expect(workbench.getByText('Agent header rule').first()).toBeVisible();
});

test('rules_toggle flips enabled and keeps the rule published', async () => {
  const { isError, payload } = await callTool('rules_toggle', { uid: ruleUid, enabled: false });
  expect(isError).toBeFalsy();
  expect(payload.enabled).toBe(false);
  expect(payload.published).toBe(true);

  const get = await callTool('rules_get', { uid: ruleUid });
  const rule = get.payload.rule as { enabled: boolean; published: boolean };
  expect(rule.enabled).toBe(false);
  expect(rule.published).toBe(true);
});

test('rules_update renames the rule and the Workbench follows live', async () => {
  const { isError } = await callTool('rules_update', {
    uid: ruleUid,
    updates: { name: 'Agent header rule v2', enabled: true },
  });
  expect(isError).toBeFalsy();
  await expect(workbench.getByText('Agent header rule v2').first()).toBeVisible();
});

test('rejects a patch that breaks the canonical rule schema', async () => {
  const result = await callTool('rules_update', { uid: ruleUid, updates: { enabled: 'yes' } });
  expect(result.isError).toBe(true);
  expect(result.text).toContain('invalid rule');
});

// ── Environments / variables / requests ─────────────────────────────

test('creates and edits an environment by variable name', async () => {
  const created = await callTool('environments_create', {
    name: 'Staging',
    variables: [{ name: 'baseUrl', value: 'https://staging.openheaders.io' }],
  });
  expect(created.isError).toBeFalsy();
  const envUid = (created.payload.environment as { uid: string }).uid;

  const edited = await callTool('environments_edit', {
    uid: envUid,
    setVariables: [{ name: 'apiKey', value: 's3cret', type: 'secret' }],
  });
  expect(edited.isError).toBeFalsy();

  const list = await callTool('environments_list', {});
  const env = (list.payload.environments as Array<{ name: string; variables: Array<Record<string, unknown>> }>)[0];
  expect(env.name).toBe('Staging');
  const secret = env.variables.find((row) => row.name === 'apiKey');
  expect(secret?.masked).toBe(true);
  expect(secret?.value).toBeUndefined();
});

test('upserts a workspace variable', async () => {
  const first = await callTool('variables_set', { name: 'region', value: 'eu-west' });
  expect(first.isError).toBeFalsy();
  const second = await callTool('variables_set', { name: 'region', value: 'us-east' });
  expect((second.payload.variable as { updated: boolean }).updated).toBe(true);

  const list = await callTool('variables_list', {});
  const rows = list.payload.workspace as Array<{ name: string; value?: string }>;
  expect(rows.filter((row) => row.name === 'region')).toHaveLength(1);
  expect(rows.find((row) => row.name === 'region')?.value).toBe('us-east');
});

test('creates and patches a saved request against the playground', async () => {
  const created = await callTool('requests_save', {
    request: { name: 'Echo', method: 'POST', url: 'http://127.0.0.1:3000/api/echo' },
  });
  expect(created.isError).toBeFalsy();
  const requestUid = (created.payload.request as { uid: string }).uid;

  const patched = await callTool('requests_save', {
    uid: requestUid,
    request: { headers: [{ key: 'X-Trace', value: 'on', enabled: true }] },
  });
  expect(patched.isError).toBeFalsy();

  const get = await callTool('requests_get', { uid: requestUid });
  const request = get.payload.request as { headers: Array<{ key: string }>; method: string };
  expect(request.method).toBe('POST');
  expect(request.headers.map((h) => h.key)).toContain('X-Trace');
});

test('records every mutation in the activity feed', async () => {
  const { payload } = await callTool('activity_list', {});
  expect((payload.entries as unknown[]).length).toBeGreaterThan(0);
});

// ── Extension round-trip ────────────────────────────────────────────

test('the MCP-created rule syncs into a connected browser extension', async () => {
  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  // Keep a client page attached so the MV3 service worker never idles
  // out mid-test (and the context window shows real UI, not about:blank).
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const serviceWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));

  // Point the extension's backend at the e2e app's daemon socket with
  // the minted token (the daemon requires a token even on loopback).
  // The settings store subscribes to these keys, so the SW redials live.
  await serviceWorker.evaluate(
    async ({ backendUrl, authToken }) =>
      new Promise<void>((resolve) => {
        chrome.storage.local.get(['oh.settings.user'], (items) => {
          const current = (items['oh.settings.user'] as Record<string, unknown> | undefined) ?? {};
          chrome.storage.local.set(
            {
              onboardingCompleted: true,
              'oh.settings.user': {
                ...current,
                'backend.mode': 'desktop-app',
                'backend.url': backendUrl,
                'backend.authToken': authToken,
                'backend.autoConnect': true,
              },
            },
            () => resolve(),
          );
        });
      }),
    { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token },
  );

  // The desktop workspace (and the rule inside it) replicates into
  // chrome.storage under the same oh.ws.<id>.rules key family.
  await expect
    .poll(
      async () =>
        serviceWorker.evaluate(
          async () =>
            new Promise<boolean>((resolve) => {
              chrome.storage.local.get(null, (items) => {
                const serialized = JSON.stringify(
                  Object.entries(items).filter(([key]) => /^oh\.ws\..*\.rules$/.test(key)),
                );
                resolve(serialized.includes('Agent header rule v2'));
              });
            }),
        ),
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Delete + live removal ───────────────────────────────────────────

test('rules_delete tombstones the rule and the Workbench drops it live', async () => {
  const { isError, payload } = await callTool('rules_delete', { uid: ruleUid });
  expect(isError).toBeFalsy();
  expect(payload.deleted).toBe(true);

  const list = await callTool('rules_list', {});
  expect(list.payload.rules as unknown[]).toHaveLength(0);
  await expect(workbench.getByText('Agent header rule v2')).toHaveCount(0);
});
