/**
 * JSON-RPC client for the daemon's stateless `/mcp` surface — one
 * `fetch` POST per command, bearer token on every request, JSON
 * responses (`enableJsonResponse` mode server-side). Never sends an
 * `Origin` header: the handler 403s any Origin by design, and the CLI
 * is a native process — exactly the client shape that rule protects.
 *
 * Failure honesty (mirrors the desktop stdio bridge): connect failure
 * and the disabled-surface 404 are {@link UnreachableError}; a rejected
 * token (401) and the policy gate's in-band denials are
 * {@link AuthError}; other in-band tool errors surface as plain errors
 * (exit 1) carrying the tool's own copy verbatim.
 */

import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import type { Connection } from './connection';
import { AuthError, UnreachableError } from './exit-codes';

interface JsonRpcError {
  code: number;
  message: string;
}

interface ToolResultContent {
  type: string;
  text?: string;
}

interface ToolCallResult {
  content?: ToolResultContent[];
  isError?: boolean;
}

interface ToolsListResult {
  tools?: { name: string; title?: string }[];
}

interface JsonRpcResponse {
  result?: unknown;
  error?: JsonRpcError;
}

/**
 * In-band denials ride `isError` tool results, not HTTP status. The
 * two denial shapes are the policy gate's own copy (mcp/policy.ts):
 * a disabled tier ("… tools are disabled on this host …") and a
 * capability deny ("permission denied: …").
 */
function isPermissionDenial(text: string): boolean {
  return text.startsWith('permission denied:') || text.includes('tools are disabled on this host');
}

async function postRpc(conn: Connection, method: string, params: unknown): Promise<unknown> {
  const endpoint = `${conn.daemonUrl}${MCP_HTTP_PATH}`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(conn.token !== undefined ? { authorization: `Bearer ${conn.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  } catch {
    throw new UnreachableError(
      `no Open Headers daemon reachable at ${conn.daemonUrl} — start the app (or the daemon service), or point --daemon at it`,
    );
  }
  if (response.status === 404) {
    throw new UnreachableError(
      `${conn.daemonUrl} answers, but its MCP surface is disabled — enable it in Open Headers → Settings → MCP`,
    );
  }
  if (response.status === 401) {
    throw new AuthError('token rejected — mint one in Open Headers → Settings → MCP, then run oh connect');
  }
  let body: JsonRpcResponse;
  try {
    body = (await response.json()) as JsonRpcResponse;
  } catch {
    throw new Error(`invalid response from ${conn.daemonUrl} (HTTP ${response.status})`);
  }
  if (body.error) {
    throw new Error(body.error.message);
  }
  return body.result;
}

/** Call one tool; returns the result payload's JSON text verbatim (the `--json` contract). */
export async function callTool(conn: Connection, name: string, args: Record<string, unknown>): Promise<string> {
  const result = (await postRpc(conn, 'tools/call', { name, arguments: args })) as ToolCallResult;
  const text = result.content?.find((block) => block.type === 'text')?.text ?? '';
  if (result.isError === true) {
    if (isPermissionDenial(text)) throw new AuthError(text);
    throw new Error(text || 'the tool reported an error without a message');
  }
  return text;
}

/** `tools/list` — the connect/status validation probe. */
export async function listTools(conn: Connection): Promise<{ name: string; title?: string }[]> {
  const result = (await postRpc(conn, 'tools/list', {})) as ToolsListResult;
  return result.tools ?? [];
}

interface InitializeResult {
  serverInfo?: { name?: string; version?: string };
}

/** MCP `initialize` — announces the host's name + app version. */
export async function initialize(conn: Connection): Promise<{ name: string; version: string }> {
  const result = (await postRpc(conn, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'oh', version: 'cli' },
  })) as InitializeResult;
  return {
    name: result.serverInfo?.name ?? 'unknown',
    version: result.serverInfo?.version ?? 'unknown',
  };
}
