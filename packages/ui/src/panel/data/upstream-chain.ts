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
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
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
    if (seen.has(cursor.url)) break;
    seen.add(cursor.url);
    chain.push({ url: cursor.url, lifecycle: cursor });
    const har = currentHarEntry(cursor);
    if (!har) break;
    const parentUrl = resolveInitiatorRootUrl(har);
    if (!parentUrl || parentUrl === cursor.url) break;
    const parent = getLifecycleByUrl(parentUrl);
    if (!parent) {
      if (!seen.has(parentUrl)) {
        chain.push({ url: parentUrl, lifecycle: null });
      }
      break;
    }
    cursor = parent;
  }
  return chain.reverse();
}
