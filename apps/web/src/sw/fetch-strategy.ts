/**
 * Service-worker fetch routing — the pure decision half of the PWA
 * offline shell (Phase 6, DAEMON_PLAN.md §8). Classifies one fetch into
 * what the worker does with it; the worker body (`sw.ts`) owns the
 * cache mechanics.
 *
 *   - `bypass`  — the worker stays out of it entirely (no respondWith):
 *                 non-GET, cross-origin, and every daemon-owned route.
 *                 The daemon's routes are live control-plane surfaces —
 *                 `/healthz` must fail honestly when the daemon is
 *                 unreachable (the login gate's boot probe reads that
 *                 failure as "mount offline-first"), and the pairing /
 *                 SSO / MCP / metrics planes are token-gated request
 *                 bodies a cache must never answer for.
 *   - `shell`   — a top-level navigation: network-first so a redeploy
 *                 is picked up while online, cached entry document when
 *                 the daemon is unreachable.
 *   - `asset`   — everything else same-origin: cache-first (the bundle
 *                 is content-hashed and precached in full at install),
 *                 network on a miss.
 *
 * The reserved list mirrors the daemon's route table (the admission
 * matrix in oracle-host-node): every path the daemon claims before the
 * static handler. `/auth/` covers the whole OIDC plane.
 */

/** The subset of a fetch-event Request the decision is made on. */
export interface FetchFacts {
  readonly method: string;
  readonly url: string;
  /** `Request.mode` — `'navigate'` marks a top-level document load. */
  readonly mode: string;
}

export type FetchDecision = 'bypass' | 'shell' | 'asset';

const RESERVED_EXACT: readonly string[] = ['/healthz', '/metrics', '/mcp', '/mcp/'];
const RESERVED_PREFIXES: readonly string[] = ['/pair/', '/auth/'];

export function isReservedDaemonPath(path: string): boolean {
  if (RESERVED_EXACT.includes(path)) return true;
  return RESERVED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function classifyFetch(facts: FetchFacts, ownOrigin: string): FetchDecision {
  if (facts.method !== 'GET') return 'bypass';
  let parsed: URL;
  try {
    parsed = new URL(facts.url);
  } catch {
    return 'bypass';
  }
  if (parsed.origin !== ownOrigin) return 'bypass';
  if (isReservedDaemonPath(parsed.pathname)) return 'bypass';
  return facts.mode === 'navigate' ? 'shell' : 'asset';
}
