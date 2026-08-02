/**
 * MCP streamable-HTTP endpoint — mounted on the daemon's bound socket
 * via the same composable `httpRequestHandler` seam the pairing surface
 * rides (see `startOracleWsServer`). Returns `true` when the request
 * targets `MCP_HTTP_PATH` (the handler owns the response); `false`
 * otherwise so the caller falls through its handler chain.
 *
 * Request admission, in order:
 *
 *   1. Master switch. While `isEnabled()` is false the path 404s —
 *      indistinguishable from a host without the feature.
 *   2. Origin rejection. MCP clients are native processes; a request
 *      carrying an `Origin` header is a browser context (drive-by page,
 *      DNS-rebound origin) and is refused outright. Cheaper and
 *      stricter than allowlisting — there is no legitimate
 *      browser-originated caller on this surface.
 *   3. Bearer token. Every request must present a paired daemon token
 *      (`Authorization: Bearer oh_…`), loopback included — trust-by-
 *      process is not a sound floor on a shared box (same posture as
 *      the WS handshake). Validation reuses the daemon token ledger:
 *      one revoke list, one admin UI, one audit trail.
 *
 * Transport: stateless streamable HTTP. Each POST builds a fresh
 * SDK `Server` + transport pair (no session ids), which keeps the
 * endpoint restart-safe and multi-client-safe with zero session
 * bookkeeping. Answers are single-shot JSON with one carve-out: a
 * `runs_execute` call carrying the MCP progress opt-in
 * (`_meta.progressToken`) answers as `text/event-stream`, streaming
 * spec `notifications/progress` frames ahead of the final result —
 * the buffered report stays the contract, streaming is additive.
 * Every other request (including token-less `runs_execute`) keeps
 * today's JSON byte-shape; the SDK already 406s POSTs whose `Accept`
 * doesn't offer both `application/json` and `text/event-stream`, so
 * the SSE leg never surprises a conformant client. GET (standalone
 * SSE stream) and DELETE (session teardown) have no meaning in
 * stateless mode; the SDK answers them with the spec's 405.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { resolveDaemonPeerUser, validateDaemonAuthToken } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import type { McpPolicy } from './policy';
import type { McpToolRegistry } from './registry';
import { createMcpServer, type McpObserveCallEvent } from './server';

const SCOPE = 'McpHttp';

export interface McpHttpHandlerOptions {
  readonly registry: McpToolRegistry;
  /** Master switch — read per request so a settings flip needs no rebind. */
  readonly isEnabled: () => boolean;
  /** Tier policy — read per call so toggles apply to in-flight clients. */
  readonly getPolicy: () => McpPolicy;
  /** Host app version, announced in the MCP `initialize` response. */
  readonly serverVersion: string;
  /**
   * Peer address for rejection log lines. Defaults to the socket's
   * remote address; the daemon spine injects a trusted-proxy-aware
   * resolver so logs behind a reverse proxy carry the real client.
   */
  readonly resolvePeer?: (req: IncomingMessage) => string;
  /** Observe-visibility sink — see {@link McpObserveCallEvent}. */
  readonly onObserveCall?: (event: McpObserveCallEvent) => void;
}

/** Same contract as `PairingHttpHandler` — `true` = response owned. */
export type McpHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

function isMcpPath(url: string | undefined): boolean {
  if (!url) return false;
  const pathOnly = url.split('?', 1)[0];
  return pathOnly === MCP_HTTP_PATH || pathOnly === `${MCP_HTTP_PATH}/`;
}

function jsonError(
  res: ServerResponse,
  statusCode: number,
  message: string,
  extraHeaders?: Record<string, string>,
  code = -32000,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders ?? {})) {
    res.setHeader(name, value);
  }
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    }),
  );
}

/** Mirrors the SDK transport's own message-size ceiling (4 MiB). */
const MAXIMUM_BODY_BYTES = 4 * 1024 * 1024;

/** Buffer the request body; `null` = over the size ceiling (chunks are
 *  dropped past the limit, so memory stays bounded either way). */
function readRequestBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let overLimit = false;
    req.on('data', (chunk: Buffer) => {
      if (overLimit) return;
      size += chunk.length;
      if (size > MAXIMUM_BODY_BYTES) {
        overLimit = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(overLimit ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** The H6 streaming gate: a `tools/call` of `runs_execute` carrying the
 *  MCP progress opt-in answers as SSE; anything else keeps the
 *  single-shot JSON answer byte-for-byte. */
function isStreamingRunCall(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const message = body as { method?: unknown; params?: unknown };
  if (message.method !== 'tools/call') return false;
  if (typeof message.params !== 'object' || message.params === null) return false;
  const params = message.params as { name?: unknown; _meta?: unknown };
  if (params.name !== 'runs_execute') return false;
  if (typeof params._meta !== 'object' || params._meta === null) return false;
  return (params._meta as { progressToken?: unknown }).progressToken !== undefined;
}

function readBearerSecret(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const [scheme, value] = header.split(' ', 2);
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value.trim() || undefined;
}

export function createMcpHttpHandler(options: McpHttpHandlerOptions): McpHttpHandler {
  const { registry, isEnabled, getPolicy, serverVersion, resolvePeer, onObserveCall } = options;

  return (req, res) => {
    if (!isMcpPath(req.url)) return false;

    if (!isEnabled()) {
      jsonError(res, 404, 'not found');
      return true;
    }

    const remoteAddress = resolvePeer?.(req) ?? req.socket.remoteAddress ?? 'unknown';
    if (req.headers.origin !== undefined) {
      logger.info(
        SCOPE,
        `rejected browser-originated request (origin=${String(req.headers.origin)} peer=${remoteAddress})`,
      );
      jsonError(res, 403, 'browser-originated requests are not accepted on this endpoint');
      return true;
    }

    void (async () => {
      try {
        const validation = await validateDaemonAuthToken(readBearerSecret(req));
        if (!validation.ok) {
          logger.info(SCOPE, `rejected request: ${validation.reason} (peer=${remoteAddress})`);
          jsonError(res, 401, 'a paired access token is required — mint one in Open Headers → Settings → MCP', {
            'WWW-Authenticate': 'Bearer',
          });
          return;
        }
        // The token proves the credential; the user resolution proves
        // it still maps to an admitted identity — a deactivated (or
        // wiped) directory user's token fails here, same as the WS gate.
        const resolved = await resolveDaemonPeerUser(validation.userId);
        if (!resolved.ok) {
          logger.info(SCOPE, `rejected request: ${resolved.reason} (peer=${remoteAddress})`);
          jsonError(res, 401, 'a paired access token is required — mint one in Open Headers → Settings → MCP', {
            'WWW-Authenticate': 'Bearer',
          });
          return;
        }

        // POST bodies are read here (not by the SDK) so the answer mode
        // can be picked per call — the parsed body rides through the
        // transport's pre-parsed-body seat.
        let parsedBody: unknown;
        if (req.method === 'POST') {
          const raw = await readRequestBody(req);
          if (raw === null) {
            jsonError(res, 413, 'request body exceeds maximum size');
            return;
          }
          try {
            parsedBody = JSON.parse(raw);
          } catch {
            jsonError(res, 400, 'Parse error', undefined, -32700);
            return;
          }
        }

        const server = createMcpServer({
          registry,
          getPolicy,
          serverVersion,
          context: {
            tokenId: validation.tokenId,
            ...(validation.label !== undefined ? { tokenLabel: validation.label } : {}),
            userId: resolved.userId,
          },
          ...(onObserveCall !== undefined ? { onObserveCall } : {}),
        });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: !isStreamingRunCall(parsedBody),
        });
        res.on('close', () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, parsedBody);
      } catch (err) {
        logger.warn(SCOPE, 'request handling failed', err);
        if (!res.headersSent) {
          jsonError(res, 500, 'internal error');
        } else {
          res.end();
        }
      }
    })();
    return true;
  };
}
