/**
 * Pure timing derivations over `RequestLifecycle` state.
 *
 * Co-located with the invariant predicates because, like them, both the
 * engine-side reducer and its client-side mirror apply the exact same rule
 * to the exact same shapes — so the rule lives once, in `core`, rather than
 * being re-implemented on each side.
 */

import type { InspectorHarEntry } from '../types/har-source';
import type { RequestLifecycle } from './types';

/**
 * Network start for the current hop, derived from its attached HAR's queueing
 * leg (`hopStartedAtMs` + `_blocked_queueing`) — the wall instant the request
 * left the queue for the wire (the footer's `baseTime`). This is the heuristic
 * path's only network-start source: its events carry no separate network-start
 * vs issue split, but the attached HAR does.
 *
 * Returns `undefined` (leave `hopNetworkStartMs` unset, so consumers fall back
 * to the issue instant) when:
 *   - the network start is already known from upstream — the CDP path stamps
 *     it precisely from the response timing, which must win over the HAR's
 *     ms-truncated issue base;
 *   - the HAR is for an earlier hop, not the current one; or
 *   - no queueing leg was measured (the `-1` / `0` HAR sentinel).
 */
export function deriveHopNetworkStartMs(
  prev: RequestLifecycle,
  hopIndex: number,
  har: InspectorHarEntry,
): number | undefined {
  if (prev.hopNetworkStartMs !== undefined) return undefined;
  if (hopIndex !== prev.redirectHopCount) return undefined;
  const queueing = har.timings?._blocked_queueing;
  if (typeof queueing !== 'number' || queueing <= 0) return undefined;
  return prev.hopStartedAtMs + queueing;
}
