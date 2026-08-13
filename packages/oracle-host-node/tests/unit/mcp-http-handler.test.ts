/**
 * Coverage for the MCP streamable-HTTP endpoint: path ownership, the
 * master switch, origin rejection, bearer-token admission against the
 * real daemon token ledger (in-memory HostStorage fake), and a full
 * JSON-RPC round-trip (initialize / tools/list / tools/call) through
 * the SDK transport against a real bound socket.
 */

import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import {
  clearIdentitySnapshot,
  createDaemonPairingService,
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  mintDaemonAuthToken,
  refreshIdentitySnapshotFromHostStorage,
  revokeWorkspaceRole,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPairingHttpHandler } from '../../src/host-runtime/pairing-http';
import { createMcpHttpHandler, type McpHttpHandler } from '../../src/mcp/http-handler';
import type { McpPolicy } from '../../src/mcp/policy';
import { createMcpToolRegistry, type McpToolDefinition } from '../../src/mcp/registry';
import { setMcpUsageObserver } from '../../src/mcp/usage-observer';
import { createHostStorageFake } from './_host-storage-fake';

const ECHO_TOOL: McpToolDefinition = {
  name: 'echo_args',
  title: 'Echo',
  description: 'echoes its arguments and the calling token id',
  inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
  tier: 'read',
  resolveWorkspaceId: () => undefined,
  handler: async (args, ctx) => ({ echoed: args.value, tokenId: ctx.tokenId, userId: ctx.userId }),
};

const RBAC_WS_ID = 'ws-mcp-rbac';

const WS_READ_TOOL: McpToolDefinition = {
  name: 'ws_read_stub',
  title: 'Workspace read stub',
  description: 'workspace-scoped read, gated as the calling user',
  inputSchema: { type: 'object', properties: {} },
  tier: 'read',
  resolveWorkspaceId: () => RBAC_WS_ID,
  handler: async () => ({ ok: true }),
};

const SECRETS_TOOL: McpToolDefinition = {
  name: 'secrets_stub',
  title: 'Secrets stub',
  description: 'gated behind the secrets tier',
  inputSchema: { type: 'object', properties: {} },
  tier: 'secrets',
  resolveWorkspaceId: () => undefined,
  handler: async () => ({ secret: 'never' }),
};

interface Harness {
  baseUrl: string;
  server: Server;
  enabled: { value: boolean };
}

async function startHarness(handler: McpHttpHandler): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    if (handler(req, res)) return;
    res.statusCode = 400;
    res.end('fallback');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, server };
}

function rpcHeaders(secret: string): Record<string, string> {
  return {
    authorization: `Bearer ${secret}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
}

function rpcBody(method: string, params: Record<string, unknown>, id = 1): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

async function postRpc(
  baseUrl: string,
  secret: string,
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${MCP_HTTP_PATH}`, {
    method: 'POST',
    headers: rpcHeaders(secret),
    body: rpcBody(method, params),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json };
}

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-test-client', version: '0.0.0' },
};

describe('MCP HTTP handler', () => {
  let harness: Harness;
  let secret: string;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    clearIdentitySnapshot();
    // The auth gate resolves the token's user post-validation; an
    // unbound token maps to the operator's synthetic identity, which
    // every production host seeds at boot before the bind comes up.
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
    secret = (await mintDaemonAuthToken({ label: 'test client' })).secret;
    const enabled = { value: true };
    const policy: McpPolicy = { enabledTiers: new Set(['read']) };
    const handler = createMcpHttpHandler({
      registry: createMcpToolRegistry([ECHO_TOOL, WS_READ_TOOL, SECRETS_TOOL]),
      isEnabled: () => enabled.value,
      getPolicy: () => policy,
      serverVersion: '2026.7.0',
    });
    const started = await startHarness(handler);
    harness = { ...started, enabled };
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      harness.server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('ignores non-MCP paths so the caller chain falls through', async () => {
    const response = await fetch(`${harness.baseUrl}/pair/123456`);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('fallback');
  });

  it('404s while the master switch is off', async () => {
    harness.enabled.value = false;
    const response = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders(secret),
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(response.status).toBe(404);
  });

  it('403s any browser-originated request (Origin header present)', async () => {
    const response = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: { ...rpcHeaders(secret), origin: 'https://openheaders.io' },
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(response.status).toBe(403);
  });

  it('401s a missing or unknown bearer token', async () => {
    const missing = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toBe('Bearer');

    const unknown = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders('oh_not-a-real-token'),
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(unknown.status).toBe(401);
  });

  it('answers initialize with the open-headers server identity', async () => {
    const { status, json } = await postRpc(harness.baseUrl, secret, 'initialize', INITIALIZE_PARAMS);
    expect(status).toBe(200);
    const result = json.result as { serverInfo: { name: string; version: string } };
    expect(result.serverInfo.name).toBe('open-headers');
    expect(result.serverInfo.version).toBe('2026.7.0');
  });

  it('lists only tools whose tier is enabled', async () => {
    const { json } = await postRpc(harness.baseUrl, secret, 'tools/list', {});
    const result = json.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((t) => t.name)).toEqual(['echo_args', 'ws_read_stub']);
  });

  it('runs a tool call end-to-end and threads the token identity', async () => {
    const { json } = await postRpc(harness.baseUrl, secret, 'tools/call', {
      name: 'echo_args',
      arguments: { value: 'openheaders.io' },
    });
    const result = json.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text) as { echoed: string; tokenId: string; userId: string };
    expect(payload.echoed).toBe('openheaders.io');
    expect(payload.tokenId).toMatch(/^[0-9a-f-]+$/i);
    // Unbound token → the call acts as the daemon operator (slice 1).
    expect(payload.userId).toMatch(/^[0-9a-f-]+$/i);
  });

  it('answers 401 when the token user is deactivated (bound token, directory refusal)', async () => {
    const created = await createDaemonUser({ displayName: 'Alice' });
    if (!created.ok) throw new Error('directory create failed');
    const bound = await mintDaemonAuthToken({ label: 'alice', userId: created.record.user.id });
    const first = await postRpc(harness.baseUrl, bound.secret, 'tools/call', {
      name: 'echo_args',
      arguments: { value: 'ok' },
    });
    expect(first.status).toBe(200);
    await deactivateDaemonUser(created.record.user.id);
    const second = await postRpc(harness.baseUrl, bound.secret, 'tools/call', {
      name: 'echo_args',
      arguments: { value: 'refused' },
    });
    expect(second.status).toBe(401);
  });

  it('gates a workspace tool as the calling user — grant admits, revocation bites the next request', async () => {
    // The operator path reads the installed registry snapshot.
    await refreshIdentitySnapshotFromHostStorage();
    const created = await createDaemonUser({ displayName: 'Bob' });
    if (!created.ok) throw new Error('directory create failed');
    const bound = await mintDaemonAuthToken({ label: 'bob device', userId: created.record.user.id });

    const noGrant = await postRpc(harness.baseUrl, bound.secret, 'tools/call', { name: 'ws_read_stub' });
    const refused = noGrant.json.result as { content: Array<{ text: string }>; isError?: boolean };
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('permission denied: workspace.read');

    await grantWorkspaceRole({ principalId: created.record.principal.id, workspaceId: RBAC_WS_ID, role: 'viewer' });
    const granted = await postRpc(harness.baseUrl, bound.secret, 'tools/call', { name: 'ws_read_stub' });
    expect((granted.json.result as { isError?: boolean }).isError).toBeUndefined();

    await revokeWorkspaceRole(created.record.principal.id, RBAC_WS_ID);
    const revoked = await postRpc(harness.baseUrl, bound.secret, 'tools/call', { name: 'ws_read_stub' });
    expect((revoked.json.result as { isError?: boolean }).isError).toBe(true);

    // The operator's unbound token rides localAdmin throughout.
    const operator = await postRpc(harness.baseUrl, secret, 'tools/call', { name: 'ws_read_stub' });
    expect((operator.json.result as { isError?: boolean }).isError).toBeUndefined();
  });

  it('surfaces a disabled tier as an in-band tool error the agent can read', async () => {
    const { json } = await postRpc(harness.baseUrl, secret, 'tools/call', {
      name: 'secrets_stub',
      arguments: {},
    });
    const result = json.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Settings → MCP');
  });

  it('rejects an unknown tool name as a JSON-RPC error', async () => {
    const { json } = await postRpc(harness.baseUrl, secret, 'tools/call', {
      name: 'not_a_tool',
      arguments: {},
    });
    expect(json.error).toBeDefined();
    expect((json.error as { message: string }).message).toContain('unknown tool');
  });
});

// ── Usage observer (policy-free visibility seam) ────────────────────
//
// A host shell may install a process-wide observer to learn that the
// MCP surface is in real use: every admitted POST notifies once, and
// an `initialize` body additionally announces the client's free-form
// `clientInfo.name`. Requests refused by admission (switch off, bad
// origin, bad token) never notify — the seam reports real use only.

describe('MCP HTTP handler — usage observer', () => {
  let harness: Harness;
  let secret: string;
  let served: number;
  let clients: string[];

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    clearIdentitySnapshot();
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
    secret = (await mintDaemonAuthToken({ label: 'observed client' })).secret;
    served = 0;
    clients = [];
    setMcpUsageObserver({
      requestServed: () => {
        served += 1;
      },
      clientInitialized: (name) => {
        clients.push(name);
      },
    });
    const enabled = { value: true };
    const handler = createMcpHttpHandler({
      registry: createMcpToolRegistry([ECHO_TOOL]),
      isEnabled: () => enabled.value,
      getPolicy: () => ({ enabledTiers: new Set(['read']) }),
      serverVersion: '2026.7.0',
    });
    const started = await startHarness(handler);
    harness = { ...started, enabled };
  });

  afterEach(async () => {
    setMcpUsageObserver(null);
    await new Promise<void>((resolve, reject) => {
      harness.server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('notifies one served request plus the announced client name on initialize', async () => {
    const { status } = await postRpc(harness.baseUrl, secret, 'initialize', INITIALIZE_PARAMS);
    expect(status).toBe(200);
    expect(served).toBe(1);
    expect(clients).toEqual(['openheaders-test-client']);
  });

  it('notifies served without a client for non-initialize bodies', async () => {
    await postRpc(harness.baseUrl, secret, 'tools/call', { name: 'echo_args', arguments: { value: 'ok' } });
    expect(served).toBe(1);
    expect(clients).toEqual([]);
  });

  it('never notifies while the switch is off or when admission refuses', async () => {
    harness.enabled.value = false;
    await postRpc(harness.baseUrl, secret, 'initialize', INITIALIZE_PARAMS);
    harness.enabled.value = true;
    await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: { ...rpcHeaders(secret), origin: 'https://openheaders.io' },
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(served).toBe(0);
    expect(clients).toEqual([]);
  });

  it('a throwing observer never fails the request', async () => {
    setMcpUsageObserver({
      requestServed: () => {
        throw new Error('observer bug');
      },
      clientInitialized: () => {
        throw new Error('observer bug');
      },
    });
    const { status, json } = await postRpc(harness.baseUrl, secret, 'initialize', INITIALIZE_PARAMS);
    expect(status).toBe(200);
    expect((json.result as { serverInfo: { name: string } }).serverInfo.name).toBe('open-headers');
  });
});

// ── H6: runs_execute progress streaming ─────────────────────────────
//
// The one carve-out from single-shot JSON: a `tools/call` of
// `runs_execute` carrying `_meta.progressToken` answers as SSE —
// progress frames ahead of the final buffered report. Everything else
// (token-less runs_execute, other tools with a token) keeps today's
// JSON byte-shape.

const RUN_STREAM_TOOL: McpToolDefinition = {
  name: 'runs_execute',
  title: 'Run stub',
  description: 'emits two frames through the per-call progress seat, then returns a report',
  inputSchema: { type: 'object', properties: {} },
  tier: 'read',
  resolveWorkspaceId: () => undefined,
  handler: async (_args, ctx) => {
    ctx.progress?.({ progress: 0, total: 2, message: 'running Smoke: 2 items' });
    ctx.progress?.({ progress: 2, total: 2, message: '[2/2] PASS GET https://openheaders.io/ok (3ms)' });
    return { ok: true, totals: { items: 2, passed: 2, failed: 0, skipped: 0 } };
  },
};

function parseSseData(text: string): Array<Record<string, unknown>> {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice('data: '.length)) as Record<string, unknown>);
}

function callBody(name: string, meta?: Record<string, unknown>, id = 7): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: {}, ...(meta ? { _meta: meta } : {}) },
  });
}

describe('MCP HTTP handler — runs_execute progress streaming (H6)', () => {
  let harness: { baseUrl: string; server: Server };
  let secret: string;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    clearIdentitySnapshot();
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
    secret = (await mintDaemonAuthToken({ label: 'stream client' })).secret;
    const handler = createMcpHttpHandler({
      registry: createMcpToolRegistry([ECHO_TOOL, RUN_STREAM_TOOL]),
      isEnabled: () => true,
      getPolicy: () => ({ enabledTiers: new Set(['read']) }),
      serverVersion: '2026.7.0',
    });
    harness = await startHarness(handler);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      harness.server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('streams progress frames as SSE ahead of the final buffered report when a progressToken rides the call', async () => {
    const response = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders(secret),
      body: callBody('runs_execute', { progressToken: 'run-7' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const frames = parseSseData(await response.text());
    const progressFrames = frames.filter((frame) => frame.method === 'notifications/progress');
    expect(progressFrames).toHaveLength(2);
    expect(progressFrames[0].params).toMatchObject({
      progressToken: 'run-7',
      progress: 0,
      total: 2,
      message: 'running Smoke: 2 items',
    });
    expect(progressFrames[1].params).toMatchObject({ progressToken: 'run-7', progress: 2, total: 2 });

    // The final frame is the buffered report — the ratified v1 shape.
    const last = frames[frames.length - 1] as { id: number; result: { content: Array<{ text: string }> } };
    expect(last.id).toBe(7);
    const report = JSON.parse(last.result.content[0].text) as { ok: boolean; totals: Record<string, number> };
    expect(report.ok).toBe(true);
    expect(report.totals).toEqual({ items: 2, passed: 2, failed: 0, skipped: 0 });
    // Frames arrive strictly ahead of the closing report.
    expect(frames.indexOf(progressFrames[1])).toBeLessThan(frames.length - 1);
  });

  it('keeps the single-shot JSON answer for runs_execute without a progressToken', async () => {
    const response = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders(secret),
      body: callBody('runs_execute'),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const json = (await response.json()) as { id: number; result: { content: Array<{ text: string }> } };
    expect(json.id).toBe(7);
    const report = JSON.parse(json.result.content[0].text) as { ok: boolean };
    expect(report.ok).toBe(true);
  });

  it('leaves every other tool single-shot JSON even when it carries a progressToken', async () => {
    const response = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders(secret),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'echo_args', arguments: { value: 'openheaders.io' }, _meta: { progressToken: 'tok' } },
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const json = (await response.json()) as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(json.result.content[0].text)).toMatchObject({ echoed: 'openheaders.io' });
  });

  it('400s an unparsable body with the JSON-RPC parse-error code', async () => {
    const response = await fetch(`${harness.baseUrl}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders(secret),
      body: '{not json',
    });
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: number } };
    expect(json.error.code).toBe(-32700);
  });
});

// ── LAN / self-host matrix ──────────────────────────────────────────
//
// The `backend.bindAddress` toggle can put the daemon socket on
// 0.0.0.0. The admission chain is bind-agnostic by design (no
// loopback bypass exists), and this suite pins that: token required
// from a genuinely non-loopback remote, Origin refused even with a
// valid token, no Host-header branching, and the sibling pairing
// surface composed on the same bind stays independent.

/** First non-internal IPv4 address — the LAN vantage point. Suites
 *  skip the remote legs on hosts with no external interface. */
function lanAddress(): string | null {
  for (const rows of Object.values(networkInterfaces())) {
    for (const row of rows ?? []) {
      if (row && !row.internal && row.family === 'IPv4') return row.address;
    }
  }
  return null;
}

const LAN_IP = lanAddress();

/** Raw request helper — `fetch` strips forbidden headers like `Host`,
 *  so the Host-spoof leg needs `node:http` directly. */
function rawRequest(port: number, headers: Record<string, string>, body: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: MCP_HTTP_PATH, method: 'POST', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

describe('MCP HTTP handler on a 0.0.0.0 bind (LAN matrix)', () => {
  let server: Server;
  let port: number;
  let secret: string;
  let pairCode: string;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    clearIdentitySnapshot();
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
    secret = (await mintDaemonAuthToken({ label: 'lan client' })).secret;

    const pairing = createDaemonPairingService();
    pairCode = pairing.startPair({ deviceLabel: 'lan peer' }).code;
    const pairingHandler = createPairingHttpHandler({ pairing });
    const mcpHandler = createMcpHttpHandler({
      registry: createMcpToolRegistry([ECHO_TOOL]),
      isEnabled: () => true,
      getPolicy: () => ({ enabledTiers: new Set(['read']) }),
      serverVersion: '2026.7.0',
    });
    // Same composition install-rpc-host wires onto the daemon bind.
    server = createServer((req, res) => {
      if (pairingHandler(req, res)) return;
      if (mcpHandler(req, res)) return;
      res.statusCode = 400;
      res.end('fallback');
    });
    await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it.skipIf(!LAN_IP)('requires the bearer token from a non-loopback remote', async () => {
    const missing = await fetch(`http://${LAN_IP}:${port}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(missing.status).toBe(401);

    const authed = await fetch(`http://${LAN_IP}:${port}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: rpcHeaders(secret),
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(authed.status).toBe(200);
  });

  it.skipIf(!LAN_IP)('refuses Origin-bearing requests from the LAN even with a valid token', async () => {
    const response = await fetch(`http://${LAN_IP}:${port}${MCP_HTTP_PATH}`, {
      method: 'POST',
      headers: { ...rpcHeaders(secret), origin: `http://${LAN_IP}:${port}` },
      body: rpcBody('initialize', INITIALIZE_PARAMS),
    });
    expect(response.status).toBe(403);
  });

  it('admission ignores the Host header — a spoofed Host changes nothing', async () => {
    const base = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    const body = rpcBody('initialize', INITIALIZE_PARAMS);

    const unauthenticated = await rawRequest(port, { ...base, host: 'evil.openheaders.io' }, body);
    expect(unauthenticated.status).toBe(401);

    const authed = await rawRequest(
      port,
      { ...base, host: 'evil.openheaders.io', authorization: `Bearer ${secret}` },
      body,
    );
    expect(authed.status).toBe(200);
  });

  it('leaves the pairing surface intact on the shared bind', async () => {
    const view = await fetch(`http://127.0.0.1:${port}/pair/${pairCode}`);
    expect(view.status).toBe(200);
    expect(await view.text()).toContain('Confirm pairing');

    const unknownPath = await fetch(`http://127.0.0.1:${port}/somewhere-else`);
    expect(unknownPath.status).toBe(400);
    expect(await unknownPath.text()).toBe('fallback');

    const mcp = await postRpc(`http://127.0.0.1:${port}`, secret, 'initialize', INITIALIZE_PARAMS);
    expect(mcp.status).toBe(200);
  });
});
