/**
 * Coverage for the MCP streamable-HTTP endpoint: path ownership, the
 * master switch, origin rejection, bearer-token admission against the
 * real daemon token ledger (in-memory HostStorage fake), and a full
 * JSON-RPC round-trip (initialize / tools/list / tools/call) through
 * the SDK transport against a real bound socket.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { clearIdentitySnapshot, mintDaemonAuthToken } from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHttpHandler, type McpHttpHandler } from '../../src/mcp/http-handler';
import type { McpPolicy } from '../../src/mcp/policy';
import { createMcpToolRegistry, type McpToolDefinition } from '../../src/mcp/registry';
import { createHostStorageFake } from './_host-storage-fake';

const ECHO_TOOL: McpToolDefinition = {
  name: 'echo_args',
  title: 'Echo',
  description: 'echoes its arguments and the calling token id',
  inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
  tier: 'read',
  resolveWorkspaceId: () => undefined,
  handler: async (args, ctx) => ({ echoed: args.value, tokenId: ctx.tokenId }),
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
    secret = (await mintDaemonAuthToken({ label: 'test client' })).secret;
    const enabled = { value: true };
    const policy: McpPolicy = { enabledTiers: new Set(['read']) };
    const handler = createMcpHttpHandler({
      registry: createMcpToolRegistry([ECHO_TOOL, SECRETS_TOOL]),
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
    expect(result.tools.map((t) => t.name)).toEqual(['echo_args']);
  });

  it('runs a tool call end-to-end and threads the token identity', async () => {
    const { json } = await postRpc(harness.baseUrl, secret, 'tools/call', {
      name: 'echo_args',
      arguments: { value: 'openheaders.io' },
    });
    const result = json.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text) as { echoed: string; tokenId: string };
    expect(payload.echoed).toBe('openheaders.io');
    expect(payload.tokenId).toMatch(/^[0-9a-f-]+$/i);
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
