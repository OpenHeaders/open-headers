/**
 * Hover breakdown for an in-flight request that has no HAR entry yet.
 *
 * A HAR entry (and its `timings` block) only lands once a request *finishes*,
 * so a still-pending — or post-navigation "(unknown)" — row has no HAR to drive
 * the rich {@link WaterfallTimingPopover}. The host doesn't read HAR for this
 * either: its waterfall + Timing popover are built from the live request model
 * (CDP), available from the first event, before any response. We mirror that.
 *
 *   - With CDP, the lifecycle carries the issue + network-start instants, so we
 *     show Queued / Started, the still-open Stalled phase (its duration is
 *     unknowable until it advances), and the not-finished caution — the host's
 *     pre-response popover.
 *   - Without CDP, the heuristic path sees nothing until the request finishes,
 *     so there is genuinely no live timing to show; we explain the gap and the
 *     one setting that closes it (in-app, no link out).
 */

import { formatTimeMs } from '../../data/format-time';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { waterfallStartMs } from '../../data/network-columns';

export function WaterfallLivePopover({
  row,
  t0,
  cdpEnhanced,
}: {
  row: InspectorRowWithFires;
  /** Shared timeline zero — the earliest request's issue time in view. */
  t0: number;
  /** CDP provenance; without it the live request model is unavailable. */
  cdpEnhanced: boolean;
}) {
  if (!cdpEnhanced) {
    return (
      <div className="dt-waterfall-pop">
        <div className="dt-waterfall-pop-caution">Live timing isn't captured for this request.</div>
        <div className="dt-waterfall-pop-explainer">
          Enable CDP and reload before navigating to capture each request's timing as it runs.
        </div>
      </div>
    );
  }

  const lc = row.lifecycle;
  // Queued = the issue instant (the bar's zero); Started = the network start,
  // i.e. issue plus the queueing leg. For a request still stalled before the
  // wire the two coincide — exactly what the host shows.
  const queuedAtMs = Math.max(waterfallStartMs(lc) - t0, 0);
  const queueingMs = Math.max((lc.hopNetworkStartMs ?? lc.hopStartedAtMs) - lc.hopStartedAtMs, 0);
  const startedAtMs = queuedAtMs + queueingMs;
  return (
    <div className="dt-waterfall-pop">
      <div className="dt-waterfall-pop-start">
        <div>Queued at {formatTimeMs(queuedAtMs)}</div>
        <div>Started at {formatTimeMs(startedAtMs)}</div>
      </div>
      <div className="dt-waterfall-pop-group">
        <div className="dt-waterfall-pop-head">Connection Start</div>
        <div className="dt-waterfall-pop-row">
          <span className="dt-waterfall-pop-swatch dt-wf-fill--stalled" aria-hidden="true" />
          <span className="dt-waterfall-pop-label">Stalled</span>
          <span className="dt-waterfall-pop-ms">–</span>
        </div>
      </div>
      <div className="dt-waterfall-pop-caution">CAUTION: request is not finished yet!</div>
    </div>
  );
}
