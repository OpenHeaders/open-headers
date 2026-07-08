/**
 * `/healthz` — unauthenticated liveness probe on the composed bind.
 *
 * Deliberately data-free: a `200 {"ok":true}` says "the process is up
 * and the socket is serving", nothing else. No engine state, no
 * version, no identity — anything more would turn an ops probe into an
 * unauthenticated information surface. Readiness beyond liveness (is
 * the engine synced? are peers healthy?) belongs to authenticated
 * surfaces.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

/** Same composition contract as the pairing/MCP handlers: `true` = handled. */
export type HealthzHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export function createHealthzHandler(): HealthzHttpHandler {
  return (req, res) => {
    const url = (req.url ?? '').split('?')[0];
    if (url !== '/healthz') return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return true;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '{"ok":true}');
    return true;
  };
}
