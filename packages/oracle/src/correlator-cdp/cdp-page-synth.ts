/**
 * Pure projections for CDP → HAR page timings.
 *
 * The stateful {@link CdpPageCorrelator} owns cross-event accumulation;
 * this module owns the two base conversions it composes, mirroring Chrome's
 * exporter (`PageLoad` + `Log.ts`):
 *
 *   - the page's wall-clock start, via the document request's wall↔monotonic
 *     offset (Chrome's `NetworkRequest.pseudoWallTime`);
 *   - a milestone's offset from that start (Chrome's
 *     `Entry.toMilliseconds(eventTime - startTime)`).
 *
 * No state, no chrome; every function is total and table-testable.
 */

import type { InspectorNavTiming } from '@openheaders/core/types';

import { round3 } from './units';

/**
 * High-level page signal the correlator emits; the host wires each onto the
 * `PageStreamHub` (`nav-started` → `notifyNavStarted`, `nav-timing` →
 * `notifyNavTimingAttached`). Mirrors the devtools-page nav bridge's verbs
 * so the hub stays the single owner of page-id assignment + fan-out.
 */
export type CdpPageSignal =
  | { readonly kind: 'nav-started'; readonly tabId: number; readonly startedAtMs: number; readonly url: string }
  | { readonly kind: 'nav-timing'; readonly tabId: number; readonly timing: InspectorNavTiming };

/**
 * Wall-clock ms of the page start. Chrome maps the document request's
 * monotonic start to wall time with the same request's `wallTime - issueTime`
 * offset (`pseudoWallTime`). `pageStartSec` is the request's
 * `timing.requestTime` (its `NetworkRequest.startTime`), which equals
 * `PageLoad.startTime`.
 */
export function pageStartedAtMs(wallTimeSec: number, issueSec: number, pageStartSec: number): number {
  return round3((wallTimeSec - issueSec + pageStartSec) * 1000);
}

/**
 * A page milestone (DOMContentLoaded / load) as a ms offset from the page
 * start — Chrome's `onContentLoad` / `onLoad`. `-1` when the event predates
 * the start (clock skew), the HAR "not applicable" sentinel.
 */
export function pageMilestoneMs(eventSec: number, pageStartSec: number): number {
  const offset = (eventSec - pageStartSec) * 1000;
  return offset < 0 ? -1 : round3(offset);
}
