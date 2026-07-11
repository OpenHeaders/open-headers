/**
 * JSON-RPC client — framing (one tools/call POST, bearer on every
 * request, both accept types, never an Origin header) and the failure
 * classification that backs the exit-code contract: connect failure /
 * 404 → unreachable, 401 → auth, in-band policy denials → auth,
 * other in-band tool errors → plain failure.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '../../src/connection';
import { AuthError, UnreachableError } from '../../src/exit-codes';
import { callTool, initialize, listTools } from '../../src/rpc';

const CONN: Connection = { daemonUrl: 'http://127.0.0.1:8137', token: 'oh_secret' };

function toolResult(payload: unknown): Response {
  return Response.json({
    jsonrpc: '2.0',
    id: 1,
    result: { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] },
  });
}

function toolError(message: string): Response {
  return Response.json({
    jsonrpc: '2.0',
    id: 1,
    result: { content: [{ type: 'text', text: message }], isError: true },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callTool', () => {
  it('POSTs one tools/call with bearer + accept headers and no Origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(toolResult({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const text = await callTool(CONN, 'rules_list', { workspaceId: 'ws-1' });

    expect(JSON.parse(text)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8137/mcp');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer oh_secret');
    expect(headers.accept).toBe('application/json, text/event-stream');
    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain('origin');
    expect(JSON.parse(init.body as string)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'rules_list', arguments: { workspaceId: 'ws-1' } },
    });
  });

  it('omits the authorization header without a token (server 401 copy is the message)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(toolResult({}));
    vi.stubGlobal('fetch', fetchMock);

    await callTool({ daemonUrl: CONN.daemonUrl }, 'rules_list', {});

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers as Record<string, string>).not.toHaveProperty('authorization');
  });

  it('classifies a connect failure as UnreachableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(callTool(CONN, 'rules_list', {})).rejects.toBeInstanceOf(UnreachableError);
  });

  it('classifies the disabled-surface 404 as UnreachableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(callTool(CONN, 'rules_list', {})).rejects.toBeInstanceOf(UnreachableError);
  });

  it('classifies 401 as AuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(callTool(CONN, 'rules_list', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('classifies an in-band tier denial as AuthError, copy verbatim', async () => {
    const denial = 'Write tools are disabled on this host. Enable them in Open Headers → Settings → MCP.';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(toolError(denial))));
    await expect(callTool(CONN, 'rules_toggle', {})).rejects.toThrow(denial);
    await expect(callTool(CONN, 'rules_toggle', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('classifies an in-band capability denial as AuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(toolError('permission denied: workspace.read on ws-1 (no-grant)')));
    await expect(callTool(CONN, 'rules_list', {})).rejects.toBeInstanceOf(AuthError);
  });

  it('surfaces other in-band tool errors as plain failures with the tool copy', async () => {
    const miss = "no rule with uid 'r-404' in workspace 'ws-1' — see rules_list";
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(toolError(miss)));
    const failure = callTool(CONN, 'rules_get', { uid: 'r-404' });
    await expect(failure).rejects.toThrow(miss);
    await expect(failure).rejects.not.toBeInstanceOf(AuthError);
  });

  it('surfaces JSON-RPC protocol errors with the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'unknown tool: nope' } })),
    );
    await expect(callTool(CONN, 'nope', {})).rejects.toThrow('unknown tool: nope');
  });
});

describe('listTools', () => {
  it('returns the tool list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'rules_list' }] } })),
    );
    expect(await listTools(CONN)).toEqual([{ name: 'rules_list' }]);
  });
});

describe('initialize', () => {
  it('returns the server identity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: { serverInfo: { name: 'open-headers', version: '2026.7.0' } },
        }),
      ),
    );
    expect(await initialize(CONN)).toEqual({ name: 'open-headers', version: '2026.7.0' });
  });
});
