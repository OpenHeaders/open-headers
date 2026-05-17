/**
 * Upstream initiator chain.
 *
 * For a given request, walks the `_initiator` parent attribution
 * recursively to produce the path from the document root down to this
 * request (top-down, root first). Mirrors Chrome's "Request initiator
 * chain" rendering for a leaf request:
 *
 *   https://github.com/
 *     → https://github.githubassets.com/assets/wp-runtime-….js
 *         → https://github.githubassets.com/assets/50110-….js
 *
 * Pure helper — takes the current request and a URL → request lookup
 * (App-side provides the closure over `entries`). Cycle-guarded so a
 * pathological HAR with a self-referencing initiator can't loop.
 */

import { resolveInitiatorRootUrl } from './initiator-graph';
import type { InspectorRequest } from './types';

export interface UpstreamChainEntry {
  /** URL on this hop. May be an `InspectorRequest` we know about, or
   *  just a URL string when the parent isn't in our entries list
   *  (e.g. the document itself, which we know only as a URL string). */
  url: string;
  /** Resolved `InspectorRequest` when one exists for this URL. */
  request: InspectorRequest | null;
}

const MAX_DEPTH = 32;

export function computeUpstreamChain(
  request: InspectorRequest,
  getRequestByUrl: (url: string) => InspectorRequest | null,
): readonly UpstreamChainEntry[] {
  const chain: UpstreamChainEntry[] = [];
  const seen = new Set<string>();
  let cursor: InspectorRequest | null = request;
  // Walk parents into `chain` bottom-up; reverse at the end so we
  // return root-first.
  while (cursor && chain.length < MAX_DEPTH) {
    if (seen.has(cursor.url)) break;
    seen.add(cursor.url);
    chain.push({ url: cursor.url, request: cursor });
    const parentUrl = resolveInitiatorRootUrl(cursor.harEntry);
    if (!parentUrl || parentUrl === cursor.url) break;
    const parent = getRequestByUrl(parentUrl);
    if (!parent) {
      // Parent URL is real (the document, typically) but isn't in our
      // entries list — append it as a string-only hop and stop.
      if (!seen.has(parentUrl)) {
        chain.push({ url: parentUrl, request: null });
      }
      break;
    }
    cursor = parent;
  }
  return chain.reverse();
}
