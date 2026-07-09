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
 *   5. Flip `mcp.allowExecute` live through the storage bridge and
 *      drive the execute tier against the playground (`/api/echo`):
 *      requests_send, workflows_save → workflows_run (publish-on-run),
 *      workflows_history, workspaces_diff.
 *   6. Launch Chromium with the built browser extension, point its
 *      backend at the app's daemon socket, and assert the same rule
 *      syncs into the browser — the extension round-trip.
 *
 * Requires both builds: `pnpm --filter @openheaders/desktop build` and
 * the extension `dist/chrome` (built separately). The playground dev
 * server is started by the playwright `webServer` block.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
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
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
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
    'workflows_history',
    'activity_list',
    'workspaces_diff',
    'rules_toggle',
    'rules_create',
    'rules_update',
    'rules_delete',
    'environments_create',
    'environments_edit',
    'variables_set',
    'requests_save',
    'workflows_save',
    'requests_import',
    'workspaces_create',
    'workspaces_switch',
    'environments_switch',
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

test('variables_set targets a collection scope by collectionId', async () => {
  // Collection uids come from variables_list — empty collections are
  // listed too, so the FIRST variable of a collection is reachable.
  const list = await callTool('variables_list', {});
  const collections = list.payload.collections as Array<{ uid: string; name: string; scope: string }>;
  const myRules = collections.find((c) => c.name === 'My Rules' && c.scope === 'rules');
  expect(myRules).toBeTruthy();

  const set = await callTool('variables_set', { collectionId: myRules?.uid, name: 'apiKey', value: 'abc' });
  expect(set.isError).toBeFalsy();
  expect(set.payload.scope).toBe('collection:rules');

  const after = await callTool('variables_list', {});
  const updated = (
    after.payload.collections as Array<{ uid: string; variables: Array<{ name: string; value?: string }> }>
  ).find((c) => c.uid === myRules?.uid);
  expect(updated?.variables.find((v) => v.name === 'apiKey')?.value).toBe('abc');
});

// ── Runtime tools: workspace + environment switching ────────────────

test('environments_switch flips the active environment and back to "No environment"', async () => {
  const envs = await callTool('environments_list', {});
  const staging = (envs.payload.environments as Array<{ uid: string; name: string }>).find((e) => e.name === 'Staging');
  expect(staging).toBeTruthy();

  const switched = await callTool('environments_switch', { environmentId: staging?.uid });
  expect(switched.isError).toBeFalsy();
  expect((switched.payload.environment as { name: string }).name).toBe('Staging');

  const active = await callTool('environments_list', {});
  expect(active.payload.activeEnvironmentId).toBe(staging?.uid);

  const cleared = await callTool('environments_switch', { environmentId: null });
  expect(cleared.isError).toBeFalsy();
  expect(cleared.payload.activeEnvironmentId).toBeNull();
  const final = await callTool('environments_list', {});
  expect(final.payload.activeEnvironmentId).toBeNull();
});

test('workspaces_create + workspaces_switch round-trip', async () => {
  const original = (await callTool('workspaces_list', {})).payload.activeWorkspaceId as string;

  const created = await callTool('workspaces_create', { name: 'Agent Workspace' });
  expect(created.isError).toBeFalsy();
  const ws = created.payload.workspace as { id: string; active: boolean; loaded: boolean };
  expect(ws.active).toBe(false);

  const switched = await callTool('workspaces_switch', { workspaceId: ws.id });
  expect(switched.isError).toBeFalsy();
  expect(switched.payload.activeWorkspaceId).toBe(ws.id);
  expect((switched.payload.workspace as { loaded: boolean }).loaded).toBe(true);

  // Workspace-scoped tools now default to the fresh workspace. The open
  // Workbench window intentionally does NOT retarget — windows bind to
  // the workspace they were opened on; the runtime-active pointer moves
  // underneath them.
  const rules = await callTool('rules_list', {});
  expect(rules.payload.rules as unknown[]).toHaveLength(0);

  // Restore the original workspace for the rest of the suite.
  const restored = await callTool('workspaces_switch', { workspaceId: original });
  expect(restored.payload.activeWorkspaceId).toBe(original);

  // Background workspaces keep no active-env pointer — agent-readable error.
  const denied = await callTool('environments_switch', { workspaceId: ws.id, environmentId: null });
  expect(denied.isError).toBe(true);
  expect(denied.text).toContain('workspaces_switch');
});

let requestUid: string;

test('creates and patches a saved request against the playground', async () => {
  const created = await callTool('requests_save', {
    request: { name: 'Echo', method: 'POST', url: 'http://127.0.0.1:3000/api/echo' },
  });
  expect(created.isError).toBeFalsy();
  requestUid = (created.payload.request as { uid: string }).uid;

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

test('requests_import lands a parsed curl command as a saved request', async () => {
  const { isError, payload } = await callTool('requests_import', {
    format: 'curl',
    content: "curl -X POST 'http://127.0.0.1:3000/api/echo' -H 'authorization: Bearer xyz'",
  });
  expect(isError).toBeFalsy();
  const created = payload.created as Array<{ uid: string; method: string }>;
  expect(created).toHaveLength(1);
  expect(created[0].method).toBe('POST');

  const get = await callTool('requests_get', { uid: created[0].uid });
  const request = get.payload.request as { auth: { type: string }; url: string };
  expect(request.url).toBe('http://127.0.0.1:3000/api/echo');
  expect(request.auth.type).toBe('bearer');
});

test('records every mutation in the activity feed', async () => {
  const { payload } = await callTool('activity_list', {});
  expect((payload.entries as unknown[]).length).toBeGreaterThan(0);
});

// ── Execute tier ────────────────────────────────────────────────────

test('execute tools stay hidden and denied while mcp.allowExecute is off', async () => {
  const { json } = await rpc('tools/list', {});
  const names = (json.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
  expect(names).not.toContain('requests_send');
  expect(names).not.toContain('workflows_run');

  const denied = await callTool('requests_send', { uid: requestUid });
  expect(denied.isError).toBe(true);
  expect(denied.text).toContain('Execute tools are disabled');
});

test('flipping mcp.allowExecute exposes the execute tier without a restart', async () => {
  await workbench.evaluate(async () => {
    const bridge = (
      window as unknown as {
        oh: {
          storage: {
            get(req: { key: string }): Promise<{ value: unknown }>;
            set(req: { key: string; value: unknown }): Promise<unknown>;
          };
        };
      }
    ).oh;
    const current = await bridge.storage.get({ key: 'oh.settings.user' });
    await bridge.storage.set({
      key: 'oh.settings.user',
      value: { ...((current.value as Record<string, unknown>) ?? {}), 'mcp.allowExecute': true },
    });
  });

  await expect
    .poll(async () => {
      const { json } = await rpc('tools/list', {});
      return (json.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    })
    .toContain('requests_send');
});

test('requests_send executes the saved request against the playground', async () => {
  const { isError, payload } = await callTool('requests_send', { uid: requestUid });
  expect(isError).toBeFalsy();
  expect(payload.sent).toBe(true);

  const response = payload.response as { status: number; body: string; bodyTruncated: boolean };
  expect(response.status).toBe(200);
  expect(response.bodyTruncated).toBe(false);
  const echo = JSON.parse(response.body) as { method: string; headers: Record<string, string> };
  expect(echo.method).toBe('POST');
  expect(echo.headers['x-trace']).toBe('on');
});

let workflowUid: string;

test('workflows_save creates a published workflow with an exposed live variable', async () => {
  const { isError, payload } = await callTool('workflows_save', {
    workflow: {
      name: 'Echo probe',
      published: true,
      steps: [
        {
          id: 's1',
          requestUid,
          captures: [{ name: 'method', extractor: { kind: 'json-path', path: '$.method' } }],
        },
      ],
    },
    exposes: [{ name: 'echoMethod', stepId: 's1', captureName: 'method' }],
  });
  expect(isError).toBeFalsy();
  workflowUid = (payload.workflow as { uid: string }).uid;
  expect((payload.workflow as { published: boolean }).published).toBe(true);
  expect(payload.liveVariables).toEqual([{ name: 'echoMethod', reference: '{{live.echoMethod}}' }]);
});

test('workflows_run executes the chain and publishes the exposed live variable', async () => {
  const { isError, payload } = await callTool('workflows_run', { uid: workflowUid });
  expect(isError).toBeFalsy();
  expect(payload.ok).toBe(true);
  expect(payload.liveVariables).toEqual([
    { name: 'echoMethod', reference: '{{live.echoMethod}}', published: true, value: 'POST' },
  ]);

  // Publish-on-run must be visible on the read tier too.
  const variables = await callTool('variables_list', {});
  const live = variables.payload.live as Array<{ name: string; reference: string }>;
  expect(live.map((row) => row.reference)).toContain('{{live.echoMethod}}');
});

test('workflows_history reports the run with capture names, not values', async () => {
  const { payload } = await callTool('workflows_history', { uid: workflowUid });
  const runs = payload.runs as Array<{ captureNames: Record<string, string[]>; extractedAt: number }>;
  expect(runs).toHaveLength(1);
  expect(runs[0].captureNames).toEqual({ s1: ['method'] });
  expect(runs[0].extractedAt).toBeGreaterThan(0);
});

test('workflows_save patches the workflow by uid and keeps it published', async () => {
  const { isError, payload } = await callTool('workflows_save', {
    uid: workflowUid,
    workflow: { name: 'Echo probe (renamed)' },
  });
  expect(isError).toBeFalsy();
  const workflow = payload.workflow as { uid: string; name: string; published: boolean };
  expect(workflow.uid).toBe(workflowUid);
  expect(workflow.name).toBe('Echo probe (renamed)');
  expect(workflow.published).toBe(true);

  const blocked = await callTool('workflows_save', {
    uid: workflowUid,
    workflow: { steps: [{ id: 's1', requestUid, captures: [] }] },
  });
  expect(blocked.isError).toBe(true);
  expect(blocked.text).toContain('{{live.echoMethod}}');
});

test('workspaces_diff answers for a loaded pair and rejects unknown ids', async () => {
  const workspaces = await callTool('workspaces_list', {});
  const activeId = workspaces.payload.activeWorkspaceId as string;

  const identical = await callTool('workspaces_diff', { otherWorkspaceId: activeId });
  expect(identical.isError).toBeFalsy();
  const diff = identical.payload.diff as Record<string, { added: unknown[]; removed: unknown[]; changed: unknown[] }>;
  for (const family of Object.values(diff)) {
    expect(family).toEqual({ added: [], removed: [], changed: [] });
  }

  const unknown = await callTool('workspaces_diff', { otherWorkspaceId: 'ghost' });
  expect(unknown.isError).toBe(true);
  expect(unknown.text).toContain('workspaces_list');
});

// ── Secrets tier ────────────────────────────────────────────────────

test('variables_reveal_secret stays hidden and denied while mcp.allowSecrets is off', async () => {
  const { json } = await rpc('tools/list', {});
  const names = (json.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
  expect(names).not.toContain('variables_reveal_secret');

  const denied = await callTool('variables_reveal_secret', { name: 'apiKey' });
  expect(denied.isError).toBe(true);
  expect(denied.text).toContain('Secrets tools are disabled');
});

test('flipping mcp.allowSecrets exposes the reveal tool without a restart', async () => {
  await workbench.evaluate(async () => {
    const bridge = (
      window as unknown as {
        oh: {
          storage: {
            get(req: { key: string }): Promise<{ value: unknown }>;
            set(req: { key: string; value: unknown }): Promise<unknown>;
          };
        };
      }
    ).oh;
    const current = await bridge.storage.get({ key: 'oh.settings.user' });
    await bridge.storage.set({
      key: 'oh.settings.user',
      value: { ...((current.value as Record<string, unknown>) ?? {}), 'mcp.allowSecrets': true },
    });
  });

  await expect
    .poll(async () => {
      const { json } = await rpc('tools/list', {});
      return (json.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    })
    .toContain('variables_reveal_secret');

  // The fresh workspace has no vault entries — the gate passes and the
  // handler answers with the agent-readable miss, not a tier denial.
  const miss = await callTool('variables_reveal_secret', { name: 'apiKey' });
  expect(miss.isError).toBe(true);
  expect(miss.text).toContain("no vault secret named 'apiKey'");
});

// ── stdio bridge ────────────────────────────────────────────────────

// The same binary the packaged client configs point at: the electron
// executable driving the built app dir, exactly like `_electron.launch`.
const electronBinary = createRequire(__filename)('electron') as string;

interface BridgeSession {
  send(message: Record<string, unknown>): void;
  /** Next JSON line the bridge writes to stdout. */
  next(): Promise<Record<string, unknown>>;
  end(): void;
  exited: Promise<number | null>;
}

function spawnBridge(extraArgs: readonly string[]): BridgeSession {
  const proc = spawn(electronBinary, [APP_ROOT, '--mcp-stdio', ...extraArgs]);
  const buffered: Record<string, unknown>[] = [];
  const waiters: Array<(msg: Record<string, unknown>) => void> = [];
  const reader = createInterface({ input: proc.stdout });
  reader.on('line', (line) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return; // stray runtime noise on stdout is not protocol traffic
    }
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else buffered.push(message);
  });
  return {
    send: (message) => {
      proc.stdin.write(`${JSON.stringify(message)}\n`);
    },
    next: () => {
      const head = buffered.shift();
      if (head) return Promise.resolve(head);
      return new Promise((resolve) => waiters.push(resolve));
    },
    end: () => proc.stdin.end(),
    exited: new Promise((resolve) => proc.once('exit', (code) => resolve(code))),
  };
}

test('the stdio bridge drives a full session end-to-end', async () => {
  const bridge = spawnBridge(['--port', String(DAEMON_PORT), '--token', token]);

  bridge.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: INITIALIZE_PARAMS });
  const init = await bridge.next();
  expect(init.id).toBe(1);
  expect((init.result as { serverInfo: { name: string } }).serverInfo.name).toBe('open-headers');

  // Notifications relay silently — the daemon answers 202, no stdout line.
  bridge.send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  bridge.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const listed = await bridge.next();
  expect(listed.id).toBe(2);
  const names = (listed.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
  expect(names).toContain('workspaces_list');

  bridge.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'workspaces_list', arguments: {} } });
  const called = await bridge.next();
  expect(called.id).toBe(3);
  const result = called.result as { content: Array<{ text: string }> };
  const payload = JSON.parse(result.content[0]?.text ?? '{}') as { activeWorkspaceId: string };

  // Parity with the HTTP leg — same endpoint, same answers.
  const http = await callTool('workspaces_list', {});
  expect(payload.activeWorkspaceId).toBe(http.payload.activeWorkspaceId);

  bridge.end();
  expect(await bridge.exited).toBe(0);
});

test('the stdio bridge relays daemon admission errors under the request id', async () => {
  const bridge = spawnBridge(['--port', String(DAEMON_PORT), '--token', 'oh_not-a-real-token']);
  bridge.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: INITIALIZE_PARAMS });
  const rejected = await bridge.next();
  expect(rejected.id).toBe(1);
  expect((rejected.error as { message: string }).message).toContain('paired access token');
  bridge.end();
  await bridge.exited;
});

test('the stdio bridge fails fast when the app is not running', async () => {
  const bridge = spawnBridge(['--port', '18999', '--token', 'oh_irrelevant']);
  bridge.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: INITIALIZE_PARAMS });
  const failed = await bridge.next();
  expect(failed.id).toBe(1);
  expect((failed.error as { message: string }).message).toBe('Open Headers is not running — start it from the tray');
  expect(await bridge.exited).toBe(1);
});

// ── Settings → MCP page ─────────────────────────────────────────────

test('the Settings → MCP page surfaces tiers, tokens, and client snippets', async () => {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByText('Settings…', { exact: true }).click();
  await workbench.getByRole('button', { name: 'MCP', exact: true }).click();

  await expect(workbench.getByText('Enable MCP server')).toBeVisible();
  await expect(workbench.getByText('Allow write tools')).toBeVisible();
  await expect(workbench.getByText('Allow execute tools')).toBeVisible();
  await expect(workbench.getByText('Allow secret reveal')).toBeVisible();
  await expect(workbench.getByText('Paired devices')).toBeVisible();
  await expect(workbench.getByText('Connect a client')).toBeVisible();

  // The suite runs off the default port — the snippets must carry it.
  await workbench.getByRole('tab', { name: 'HTTP', exact: true }).click();
  await expect(workbench.getByText(`http://127.0.0.1:${DAEMON_PORT}/mcp`)).toBeVisible();

  await workbench.keyboard.press('Escape');
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

  // Point the extension at the e2e app's daemon socket with the minted
  // token (the daemon requires a token even on loopback). The connection
  // identity lives on the `oh.backends` registry (a sensitive slot), so
  // the seed encrypts the record with the SW's own at-rest key — same
  // blob format as `browser-secret-cipher` — and the registry mirror's
  // storage subscription makes the connection manager dial it live.
  await serviceWorker.evaluate(
    async ({ backendUrl, authToken }) => {
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
        id: 'e2e-desktop-backend',
        label: 'e2e desktop',
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

// ── LAN bind rebind ─────────────────────────────────────────────────
//
// Flipping `backend.bindAddress` live tears the daemon socket down and
// rebinds it. The MCP surface must survive both directions with its
// full admission chain — same composed handler, same token ledger.
// Last in the suite: the rebind briefly drops the extension's WS pipe.

async function setBindAddress(address: string): Promise<void> {
  await workbench.evaluate(async (addr) => {
    const bridge = (
      window as unknown as {
        oh: {
          storage: {
            get(req: { key: string }): Promise<{ value: unknown }>;
            set(req: { key: string; value: unknown }): Promise<unknown>;
          };
        };
      }
    ).oh;
    const current = await bridge.storage.get({ key: 'oh.settings.user' });
    await bridge.storage.set({
      key: 'oh.settings.user',
      value: { ...((current.value as Record<string, unknown>) ?? {}), 'backend.bindAddress': addr },
    });
  }, address);
}

test('the MCP admission chain survives a live bindAddress rebind', async () => {
  await setBindAddress('0.0.0.0');
  await expect
    .poll(
      async () => {
        try {
          const { status } = await rpc('initialize', INITIALIZE_PARAMS);
          return status;
        } catch {
          return 0;
        }
      },
      { timeout: 15000 },
    )
    .toBe(200);

  // Full posture on the wide bind: no token 401, Origin 403.
  const missing = await fetch(MCP_URL, { method: 'POST', body: '{}' });
  expect(missing.status).toBe(401);
  const origin = await rpc('initialize', INITIALIZE_PARAMS, { headers: { origin: 'https://openheaders.io' } });
  expect(origin.status).toBe(403);

  await setBindAddress('127.0.0.1');
  await expect
    .poll(
      async () => {
        try {
          const { status } = await rpc('initialize', INITIALIZE_PARAMS);
          return status;
        } catch {
          return 0;
        }
      },
      { timeout: 15000 },
    )
    .toBe(200);
});
