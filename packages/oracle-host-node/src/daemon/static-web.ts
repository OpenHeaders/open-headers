/**
 * Static web serving on the composed bind (Phase 4a, DAEMON_PLAN.md §3/§5):
 * the daemon hands out the Workbench web bundle so a plain browser tab
 * becomes a front-end. Composed LAST in the HTTP chain
 * (healthz ‖ pairing ‖ mcp ‖ static) — every route with its own handler
 * keeps claiming its path first; the static handler owns the rest.
 *
 * Serving contract, sized to a hashed single-page Vite build:
 *
 *   - `/` and any path without a file extension → `index.html` with
 *     `no-cache` (the SPA fallback; the entry document must revalidate
 *     so a redeploy is picked up on the next load).
 *   - files under `/assets/` → `immutable` for a year (Vite content-hashes
 *     every emitted asset filename, so a changed file is a new URL).
 *   - extension-bearing paths that don't exist → 404 (an asset miss must
 *     not fall back to index.html, or a stale-hash request would get an
 *     HTML body under a `.js` URL).
 *   - GET/HEAD only; dotfiles and traversal segments answer 404 without
 *     touching the filesystem.
 *
 * The handler never lists directories and serves only regular files
 * resolved strictly under the configured root.
 */

import * as fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';

/** Same composition contract as the healthz/pairing/MCP handlers: `true` = response owned. */
export type StaticWebHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface StaticWebOptions {
  /** Directory holding the built web bundle (`index.html` + `assets/`). */
  rootDir: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const REVALIDATE_CACHE = 'no-cache';

/**
 * Decode and normalize a request path into safe segments, or null when
 * the path must not reach the filesystem (malformed encoding, NUL,
 * traversal, dotfiles).
 */
function safeSegments(rawPath: string): string[] | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const segments = decoded.split('/').filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (segment.startsWith('.')) return null;
  }
  return segments;
}

function respondNotFound(res: ServerResponse): void {
  res.writeHead(404, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end('not found');
}

export function createStaticWebHandler(options: StaticWebOptions): StaticWebHttpHandler {
  const rootDir = path.resolve(options.rootDir);
  const indexPath = path.join(rootDir, 'index.html');

  function serveFile(req: IncomingMessage, res: ServerResponse, filePath: string, cacheControl: string): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      respondNotFound(res);
      return;
    }
    if (!stat.isFile()) {
      respondNotFound(res);
      return;
    }
    const mime = MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': mime,
      'content-length': stat.size,
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      // Headers are already gone; all we can do is drop the connection
      // so the client sees a truncated transfer instead of hanging.
      res.destroy();
    });
    stream.pipe(res);
  }

  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return true;
    }
    const rawPath = (req.url ?? '/').split('?', 1)[0];
    const segments = safeSegments(rawPath);
    if (segments === null) {
      respondNotFound(res);
      return true;
    }
    // Extension-less path = a client-side route; the SPA entry document
    // answers it. Extension-bearing = an asset; it exists or it 404s.
    const last = segments[segments.length - 1];
    const isAssetPath = last !== undefined && path.extname(last) !== '';
    if (!isAssetPath) {
      serveFile(req, res, indexPath, REVALIDATE_CACHE);
      return true;
    }
    const filePath = path.join(rootDir, ...segments);
    // Belt over the segment filter's braces: never serve outside the root.
    if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
      respondNotFound(res);
      return true;
    }
    const cache = segments[0] === 'assets' ? IMMUTABLE_CACHE : REVALIDATE_CACHE;
    serveFile(req, res, filePath, cache);
    return true;
  };
}
