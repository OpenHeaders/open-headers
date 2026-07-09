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
 * SDK `Server` + transport pair (no session ids, JSON responses), which
 * keeps the endpoint restart-safe and multi-client-safe with zero
 * session bookkeeping. GET (standalone SSE stream) and DELETE (session
 * teardown) have no meaning in stateless mode; the SDK answers them
 * with the spec's 405.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { resolveDaemonPeerUser, validateDaemonAuthToken } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import type { McpPolicy } from './policy';
import type { McpToolRegistry } from './registry';
import { createMcpServer } from './server';

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
      error: { code: -32000, message },
      id: null,
    }),
  );
}

function readBearerSecret(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const [scheme, value] = header.split(' ', 2);
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value.trim() || undefined;
}

export function createMcpHttpHandler(options: McpHttpHandlerOptions): McpHttpHandler {
  const { registry, isEnabled, getPolicy, serverVersion, resolvePeer } = options;

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

        const server = createMcpServer({
          registry,
          getPolicy,
          serverVersion,
          context: {
            tokenId: validation.tokenId,
            ...(validation.label !== undefined ? { tokenLabel: validation.label } : {}),
            userId: resolved.userId,
          },
        });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        res.on('close', () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
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
