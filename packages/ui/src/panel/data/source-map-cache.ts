/**
 * In-memory source-map cache.
 *
 * The Initiator tab's call stack carries raw V8 names (`b.l`, `b.f.j`,
 * …) because the HAR pipeline preserves whatever V8 reported. Chrome's
 * DevTools resolves these via source maps before display; we replicate
 * the resolution here.
 *
 * Lifecycle per JS URL:
 *
 *   1. View asks `getSourceMap(jsUrl)` for the first time.
 *   2. Cache returns `null` immediately and kicks off a fetch in the
 *      background (the entry's state becomes `pending`).
 *   3. When the fetch settles, the entry transitions to `resolved` and
 *      every subscribed listener is notified — the view re-renders and
 *      `getSourceMap` now returns the parsed map (or `null` if there
 *      was no map / parsing failed).
 *
 * The cache is module-singleton on purpose: source-map files are
 * immutable per URL, and many call-stack frames hit the same handful of
 * JS files, so re-fetching per render or per tab would be wasteful.
 *
 * **Host-installed fetcher.** The renderer can't fetch cross-origin
 * directly — the DevTools panel page runs under `default-src 'self'`
 * CSP, which blocks fetches to third-party origins. The actual fetch
 * (JS body → `sourceMappingURL` discovery → map body) happens host-side
 * and the host registers the fetcher via `setSourceMapFetcher()`. Hosts
 * that don't install a fetcher get null resolution (silently — the view
 * just keeps showing raw V8 names).
 */

import { parseSourceMap, type ParsedSourceMap } from './source-map';

/**
 * Host-installed fetcher. The renderer can't fetch cross-origin (panel
 * page CSP blocks it); the host wires this to its own implementation —
 * for the browser extension that's an SW-side bridge RPC that does the
 * actual fetch under the extension's host_permissions. Hosts that don't
 * install one get null resolution silently.
 */
export type SourceMapFetcher = (jsUrl: string) => Promise<string | null>;

let installedFetcher: SourceMapFetcher | null = null;

export function setSourceMapFetcher(fn: SourceMapFetcher | null): void {
  installedFetcher = fn;
}

type CacheEntry =
  | { kind: 'pending'; promise: Promise<ParsedSourceMap | null> }
  | { kind: 'resolved'; map: ParsedSourceMap | null };

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // A listener crashing must not stop others.
    }
  }
}

async function fetchAndParse(jsUrl: string): Promise<ParsedSourceMap | null> {
  if (!installedFetcher) return null;
  try {
    const mapText = await installedFetcher(jsUrl);
    if (!mapText) return null;
    return parseSourceMap(mapText);
  } catch {
    return null;
  }
}

/**
 * Synchronous accessor. Returns the parsed map when one is in the
 * cache; returns `null` (and silently triggers a fetch) otherwise.
 * Subscribers are notified when the pending fetch completes.
 */
export function getSourceMap(jsUrl: string): ParsedSourceMap | null {
  if (!jsUrl) return null;
  const entry = cache.get(jsUrl);
  if (entry) {
    return entry.kind === 'resolved' ? entry.map : null;
  }
  const promise = fetchAndParse(jsUrl);
  cache.set(jsUrl, { kind: 'pending', promise });
  promise.then((map) => {
    cache.set(jsUrl, { kind: 'resolved', map });
    notify();
  });
  return null;
}

/** Module-singleton subscribe API. */
export function subscribeSourceMaps(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Test hooks ──────────────────────────────────────────────────────

/** Tests reset the cache between cases to keep them deterministic. */
export function __resetSourceMapCacheForTests(): void {
  cache.clear();
  listeners.clear();
}

/** Tests preload a resolved map without hitting the network. */
export function __seedSourceMapForTests(jsUrl: string, map: ParsedSourceMap | null): void {
  cache.set(jsUrl, { kind: 'resolved', map });
}
