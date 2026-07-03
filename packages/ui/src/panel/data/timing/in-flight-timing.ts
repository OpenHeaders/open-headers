/**
 * Partial timing for an in-flight request that has no HAR entry yet.
 *
 * The HAR `timings` block lands only when a request finishes, so a still-pending
 * — or post-navigation `(unknown)` — row has no {@link TimingLadder}. The host
 * doesn't read HAR here either: its waterfall + Timing view are built from the
 * live request model from the first event, before any response. This is the one
 * shared partial both the Waterfall live popover and the Timing detail tab read,
 * so the in-flight story is told once, not forked per surface.
 *
 * Instants are offsets from a caller-supplied zero (the in-view timeline zero
 * for the popover, the session baseline for the Timing tab). A request still in
 * the queue has no meaningful network start — `networkStarted` is `false` and
 * `startedAtMs` collapses onto `queuedAtMs`, so a caller shows the open Stalled
 * step instead of a misleading "Started == Queued".
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { waterfallStartMs } from '../network-columns';

export interface InFlightTiming {
  /** Offset of the queue moment (issue time) from the zero, clamped to ≥ 0. */
  queuedAtMs: number;
  /** Offset of the network-start instant from the zero; equals `queuedAtMs`
   *  while the request is still queued (no wire start yet). */
  startedAtMs: number;
  /** Whether the request has left the queue for the wire (a known network
   *  start). `false` → still Stalled. */
  networkStarted: boolean;
}

export function computeInFlightTiming(lc: RequestLifecycle, zeroMs: number): InFlightTiming {
  const queuedAtMs = Math.max(waterfallStartMs(lc) - zeroMs, 0);
  const networkStarted = lc.hopNetworkStartMs != null;
  const startedAtMs = queuedAtMs + Math.max((lc.hopNetworkStartMs ?? lc.hopStartedAtMs) - lc.hopStartedAtMs, 0);
  return { queuedAtMs, startedAtMs, networkStarted };
}
