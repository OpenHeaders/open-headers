/**
 * `GET /metrics` — token-gated operational metrics on the composed bind.
 *
 * `/healthz` is deliberately data-free because it answers
 * unauthenticated; everything beyond liveness belongs to an
 * authenticated surface, and this is it. Admission follows the `/mcp`
 * posture exactly:
 *
 *   1. Origin rejection — metrics consumers are native processes (the
 *      CLI, a scraper); a request carrying an `Origin` header is a
 *      browser context and is refused. The admission matrix enforces
 *      the same rule one layer out; this check keeps the handler safe
 *      when composed without it (tests, other hosts).
 *   2. Bearer token — every request presents a paired daemon token,
 *      loopback included, validated against the same ledger as the WS
 *      handshake and `/mcp`: one revoke list, one audit trail.
 *
 * Response: the {@link DaemonMetrics} JSON by default, `no-store`;
 * an `Accept` header naming a Prometheus media type selects the text
 * exposition of the same numbers — a second format, not a second
 * route, so the admission posture is identical. Read-only by
 * construction — the provider derives every number at request time.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveDaemonPeerUser, validateDaemonAuthToken } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { MetricsProvider } from './metrics';
import { PROMETHEUS_CONTENT_TYPE, renderPrometheusMetrics, wantsPrometheusText } from './metrics-prometheus';

const SCOPE = 'MetricsHttp';

export const METRICS_HTTP_PATH = '/metrics';

/** Same composition contract as the pairing/MCP/healthz handlers: `true` = handled. */
export type MetricsHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface MetricsHttpHandlerOptions {
  readonly provider: MetricsProvider;
  /**
   * Peer address for rejection log lines. Defaults to the socket's
   * remote address; the daemon spine injects a trusted-proxy-aware
   * resolver so logs behind a reverse proxy carry the real client.
   */
  readonly resolvePeer?: (req: IncomingMessage) => string;
}

function readBearerSecret(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const [scheme, value] = header.split(' ', 2);
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value.trim() || undefined;
}

function json(res: ServerResponse, statusCode: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders ?? {})) {
    res.setHeader(name, value);
  }
  res.end(JSON.stringify(body));
}

function prometheusText(res: ServerResponse, body: string): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', PROMETHEUS_CONTENT_TYPE);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

export function createMetricsHttpHandler(options: MetricsHttpHandlerOptions): MetricsHttpHandler {
  const { provider, resolvePeer } = options;

  return (req, res) => {
    const url = (req.url ?? '').split('?')[0];
    if (url !== METRICS_HTTP_PATH) return false;

    if (req.method !== 'GET') {
      res.writeHead(405, { allow: 'GET' });
      res.end();
      return true;
    }

    const remoteAddress = resolvePeer?.(req) ?? req.socket.remoteAddress ?? 'unknown';
    if (req.headers.origin !== undefined) {
      logger.info(
        SCOPE,
        `rejected browser-originated request (origin=${String(req.headers.origin)} peer=${remoteAddress})`,
      );
      json(res, 403, { error: 'browser-originated requests are not accepted on this endpoint' });
      return true;
    }

    void (async () => {
      try {
        const validation = await validateDaemonAuthToken(readBearerSecret(req));
        if (!validation.ok) {
          logger.info(SCOPE, `rejected request: ${validation.reason} (peer=${remoteAddress})`);
          json(res, 401, { error: 'a paired access token is required' }, { 'WWW-Authenticate': 'Bearer' });
          return;
        }
        // The token proves the credential; the user resolution proves it
        // still maps to an admitted identity — a deactivated directory
        // user's token fails here, same as the WS gate and /mcp.
        const resolved = await resolveDaemonPeerUser(validation.userId);
        if (!resolved.ok) {
          logger.info(SCOPE, `rejected request: ${resolved.reason} (peer=${remoteAddress})`);
          json(res, 401, { error: 'a paired access token is required' }, { 'WWW-Authenticate': 'Bearer' });
          return;
        }
        const metrics = provider.getMetrics();
        if (wantsPrometheusText(req.headers.accept)) {
          prometheusText(res, renderPrometheusMetrics(metrics));
        } else {
          json(res, 200, metrics);
        }
      } catch (err) {
        logger.warn(SCOPE, 'request handling failed', err);
        if (!res.headersSent) {
          json(res, 500, { error: 'internal error' });
        } else {
          res.end();
        }
      }
    })();
    return true;
  };
}
