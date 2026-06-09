/**
 * Hover breakdown for an in-flight request that has no HAR entry yet.
 *
 * A HAR entry (and its `timings` block) only lands once a request *finishes*,
 * so a still-pending — or post-navigation "(unknown)" — row has no HAR to drive
 * the rich {@link WaterfallTimingPopover}. The host doesn't read HAR for this
 * either: its waterfall + Timing popover are built from the live request model
 * (CDP), available from the first event, before any response. We mirror that.
 *
 * The partial is read from the lifecycle, never from the provenance: both
 * correlators populate the issue instant (`hopStartedAtMs`) from the first
 * request event, so the live story renders the same on either path.
 *
 *   - A still-stalled request never left the queue, so we show Queued + the open
 *     Stalled phase + the not-finished caution (no "Started at" — it would just
 *     duplicate Queued). Once a network start is known we show Queued + Started.
 *   - The heuristic (no-CDP) path can't observe the queue-exit instant the way
 *     CDP does — it stays Stalled until the finished HAR supplies the real
 *     network start — so we add an in-app hint that CDP fills the connection
 *     breakdown (no link out).
 */

import { formatTimeMs } from '../../data/format-time';
import { computeInFlightTiming } from '../../data/in-flight-timing';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';

export function WaterfallLivePopover({
  row,
  t0,
  cdpEnhanced,
}: {
  row: InspectorRowWithFires;
  /** Shared timeline zero — the earliest request's issue time in view. */
  t0: number;
  /** CDP provenance; without it the queue-exit instant is unobservable until
   *  the finished HAR lands, so the row stays Stalled and we add a hint. */
  cdpEnhanced: boolean;
}) {
  // Queued = the issue instant (the bar's zero). "Started at" only means
  // something once the request actually left the queue for the wire (a known
  // network start); for a request still stalled it never started, so showing
  // "Started == Queued" would be a misleading duplicate — omit it, and show the
  // open Stalled phase instead.
  const { queuedAtMs, startedAtMs, networkStarted } = computeInFlightTiming(row.lifecycle, t0);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: guard only, not interactive
    <div className="dt-waterfall-pop" onClick={(e) => e.stopPropagation()}>
      <div className="dt-waterfall-pop-start">
        <div>Queued at {formatTimeMs(queuedAtMs)}</div>
        {networkStarted && <div>Started at {formatTimeMs(startedAtMs)}</div>}
      </div>
      {!networkStarted && (
        <div className="dt-waterfall-pop-group">
          <div className="dt-waterfall-pop-head">Connection Start</div>
          <div className="dt-waterfall-pop-row">
            <span className="dt-waterfall-pop-swatch dt-wf-fill--stalled" aria-hidden="true" />
            <span className="dt-waterfall-pop-label">Stalled</span>
            <span className="dt-waterfall-pop-ms">–</span>
          </div>
        </div>
      )}
      <div className="dt-waterfall-pop-caution">CAUTION: request is not finished yet!</div>
      {!cdpEnhanced && (
        <div className="dt-waterfall-pop-explainer">
          Enable CDP and reload before navigating for the full connection breakdown as it runs.
        </div>
      )}
    </div>
  );
}
