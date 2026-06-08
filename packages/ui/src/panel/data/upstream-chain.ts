/**
 * Upstream initiator chain.
 *
 * For a given lifecycle, walks the `_initiator` parent attribution
 * recursively to produce the path from the document root down to this
 * request (top-down, root first). Mirrors the host's "Request
 * initiator chain" rendering:
 *
 *   https://github.com/
 *     → https://github.githubassets.com/assets/wp-runtime-….js
 *         → https://github.githubassets.com/assets/50110-….js
 *
 * Pure helper — takes the current lifecycle and a URL → lifecycle
 * lookup (the App-side closure over the lifecycle list). Cycle-guarded
 * so a pathological HAR with a self-referencing initiator can't loop.
 *
 * The parent URL comes from the HAR `_initiator` once a hop has landed;
 * before then (an in-flight `(unknown)` row) it falls back to the
 * lifecycle's own `initiator` URL, captured at request-start by the CDP
 * mapper — so the chain renders for in-flight requests too, matching the
 * host's in-flight "Request initiator chain".
 *
 * Redirects: the host models each redirect hop as its own request and a
 * target's initiator is its redirect *source*, so a redirected ancestor
 * contributes every hop URL to the chain. We hold those hops on one
 * lifecycle (`redirectHops`), so each lifecycle is unfolded via `urlChain`
 * into its source → … → current URLs — matching the host's display
 * (e.g. `crypto.com/` → `crypto.com/ro` → the requested script).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { urlChain } from '@openheaders/core/request-lifecycle';
import { resolveInitiatorRootUrl } from './initiator-graph';
import { currentHarEntry } from './inspector-row-projection';

export interface UpstreamChainEntry {
  /** URL on this hop. May resolve to a known `RequestLifecycle`, or
   *  just be a URL string when the parent isn't in our lifecycle list
   *  (e.g. the document itself, which we know only as a URL). */
  url: string;
  /** Resolved lifecycle when one exists for this URL, else null. */
  lifecycle: RequestLifecycle | null;
}

const MAX_DEPTH = 32;

export function computeUpstreamChain(
  lifecycle: RequestLifecycle,
  getLifecycleByUrl: (url: string) => RequestLifecycle | null,
): readonly UpstreamChainEntry[] {
  const chain: UpstreamChainEntry[] = [];
  const seen = new Set<string>();
  let cursor: RequestLifecycle | null = lifecycle;
  while (cursor && chain.length < MAX_DEPTH) {
    // Expand this lifecycle's redirect chain. The host models every redirect
    // hop as its own request and shows them all (a target's initiator is its
    // redirect source); we hold the hops on one lifecycle, so unfold them here.
    // Push leaf-first (current URL, then each source toward the root) so the
    // final reverse() yields root-first display order; only the current URL
    // maps to this row, the redirect sources are URL-only (no separate row).
    const hops = urlChain(cursor);
    let advanced = false;
    for (let i = hops.length - 1; i >= 0; i--) {
      const url = hops[i];
      if (seen.has(url)) continue;
      seen.add(url);
      chain.push({ url, lifecycle: i === hops.length - 1 ? cursor : null });
      advanced = true;
    }
    // Wholly-seen lifecycle (cycle guard), or depth budget exhausted.
    if (!advanced || chain.length >= MAX_DEPTH) break;
    const har = currentHarEntry(cursor);
    // HAR `_initiator` once the hop landed; the lifecycle's own initiator URL
    // (set at request-start) while still in flight.
    const parentUrl = har ? resolveInitiatorRootUrl(har) : (cursor.initiator ?? null);
    if (!parentUrl || seen.has(parentUrl)) break;
    const parent = getLifecycleByUrl(parentUrl);
    if (!parent) {
      chain.push({ url: parentUrl, lifecycle: null });
      break;
    }
    cursor = parent;
  }
  return chain.reverse();
}
