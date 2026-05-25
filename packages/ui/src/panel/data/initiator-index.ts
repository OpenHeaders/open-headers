/**
 * Pure projection: lifecycle snapshot → parent-URL → child-requestId
 * inverted index.
 *
 * Chrome's "Request initiator chain" detail view is a *downstream* view —
 * for the selected request, list every subresource the page initiated,
 * recursively. The HAR `_initiator` only describes the *upstream* parent
 * for each request; the panel inverts that into a parent → children
 * map.
 *
 * Pure: same input → same output, no subscriptions, no IO. Consumers
 * wrap in `useMemo` over `snapshot.ordered`.
 *
 * Lookup keys (`url`) are the resolved initiator root URL — the entry
 * in `RequestLifecycle.har` for hop 0 is the source of `_initiator`
 * here, matching how the legacy store sourced it. Later hops in a
 * redirect chain inherit the same initiator (they're the same logical
 * request), so we only inspect hop 0.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { resolveInitiatorRootUrl } from './initiator-graph';

/** Parent URL → ordered list of child requestIds attributed to it. */
export type InitiatorIndex = ReadonlyMap<string, readonly string[]>;

const EMPTY: InitiatorIndex = new Map<string, readonly string[]>();

export function buildInitiatorIndex(lifecycles: readonly RequestLifecycle[]): InitiatorIndex {
  if (lifecycles.length === 0) return EMPTY;
  const out = new Map<string, string[]>();
  for (const lifecycle of lifecycles) {
    const hop0 = lifecycle.har.get(0);
    if (!hop0) continue;
    const parent = resolveInitiatorRootUrl(hop0);
    if (!parent || parent === lifecycle.url) continue;
    const existing = out.get(parent);
    if (existing) existing.push(lifecycle.requestId);
    else out.set(parent, [lifecycle.requestId]);
  }
  return out;
}
