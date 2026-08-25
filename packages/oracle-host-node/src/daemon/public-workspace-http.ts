/**
 * Anonymous HTTP route for published public workspace snapshots (the
 * access-foundation plan §8 F5b) — composed BEFORE the static-web
 * handler so `/public/*` never falls into the SPA fallback:
 *
 *   - `GET /public/<id>` — the viewer page: the served web SPA's entry
 *     document, whose client detects the public path and hydrates from
 *     the payload below. 404 when nothing is published there.
 *   - `GET /public/<id>/snapshot.json` — the stored publication
 *     payload, served verbatim (the projection was computed and the
 *     content contract applied at publish time, never re-derived
 *     here). 404 when unpublished.
 *
 * The `publicWorkspaces` master switch gates SERVING here per request:
 * off = every path answers 404 — standing publications go dark,
 * nothing is deleted. Malformed paths under the prefix 404 too; the
 * admission matrix's `public` row counts those 404s as brute-force
 * failures (workspace-id enumeration).
 */

import * as fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import { PUBLIC_WORKSPACE_PATH_PREFIX, parsePublicWorkspacePath } from '@openheaders/core/protocol';
import type { SqlitePublishedSnapshotStore } from '../sync/sqlite-published-snapshots';

/** Same composition contract as the other handlers: `true` = response owned. */
export type PublicWorkspaceHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface PublicWorkspaceHttpOptions {
  store: SqlitePublishedSnapshotStore;
  /** The `publicWorkspaces` master switch — config-as-code, fixed for the process lifetime. */
  enabled: boolean;
  /**
   * The static web bundle's root (`index.html` lives here) — the viewer
   * page is the SPA entry document. Null when no web bundle is served;
   * the page path then 404s while the JSON payload still answers.
   */
  webRootDir: string | null;
}

function respondNotFound(res: ServerResponse): void {
  res.writeHead(404, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end('not found');
}

export function createPublicWorkspaceHttpHandler(options: PublicWorkspaceHttpOptions): PublicWorkspaceHttpHandler {
  const indexPath = options.webRootDir !== null ? path.join(path.resolve(options.webRootDir), 'index.html') : null;

  return (req, res) => {
    const rawPath = (req.url ?? '').split('?', 1)[0];
    if (!rawPath.startsWith(PUBLIC_WORKSPACE_PATH_PREFIX)) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return true;
    }
    const parsed = parsePublicWorkspacePath(rawPath);
    const row = parsed !== null && options.enabled ? options.store.get(parsed.workspaceId) : null;
    if (parsed === null || row === null) {
      respondNotFound(res);
      return true;
    }

    if (parsed.kind === 'snapshot') {
      const body = Buffer.from(row.payloadJson, 'utf8');
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': body.byteLength,
        // Re-publish replaces in place under the same URL — always
        // revalidate so viewers pick the newest copy up.
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    }

    // The viewer page — the SPA entry document, same no-cache posture
    // as the static handler's fallback.
    if (indexPath === null) {
      respondNotFound(res);
      return true;
    }
    let body: Buffer;
    try {
      body = fs.readFileSync(indexPath);
    } catch {
      respondNotFound(res);
      return true;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': body.byteLength,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  };
}
