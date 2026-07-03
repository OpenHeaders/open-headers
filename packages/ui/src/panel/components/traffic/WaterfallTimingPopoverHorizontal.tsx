/**
 * Horizontal timing ladder — the wide, explanatory hover breakdown for a
 * Waterfall bar (the vertical {@link WaterfallTimingPopover} is its compact
 * narrow-panel twin). The at-a-glance bar itself is the shared
 * {@link HorizontalTimingChart} (also rendered by the Timing detail tab, so the
 * two surfaces can't drift); this popover wraps it with the "Key moments" header,
 * the numbered legend, the reused-connection note, the not-finished caution, and
 * the Total. It renders the SAME {@link TimingLadder} + shared semantics
 * ({@link ../../data/timing-popover-model}) as the vertical view, adding no
 * timing math of its own.
 */

import { formatTimeMs } from '../../data/timing/format-time';
import type { WaterfallMetric } from '../../data/network-columns';
import type { TimingLadder } from '../../data/timing/timing-ladder';
import { explainSpec, type WaterfallTerminal } from '../../data/timing/timing-popover-model';
import { HorizontalTimingChart } from './HorizontalTimingChart';
import { TimingLadderLegend } from './TimingLadderLegend';
import { TimingKeyMomentsInfo } from './TimingRungInfo';

export function WaterfallTimingPopoverHorizontal({
  ladder,
  queuedAtMs,
  metric,
  explain,
  unfinished,
  terminal,
  reusedOpener,
}: {
  ladder: TimingLadder;
  /** Issue time relative to the timeline zero (the earliest request in view) —
   *  added to the ladder's local instants for the absolute "… at" tick value. */
  queuedAtMs: number;
  metric: WaterfallMetric;
  /** Show what the active metric is composed of (anchor + contributing rungs). */
  explain: boolean;
  /** Still streaming — Content Download and the total are growing, not final. */
  unfinished?: boolean;
  /** A terminal request that never received a response (see {@link WaterfallTerminal}). */
  terminal?: WaterfallTerminal;
  /** Display name of the request that opened this row's reused connection. */
  reusedOpener?: string;
}) {
  const spec = explain ? explainSpec(metric) : null;
  const anyReused = ladder.rungs.some((r) => r.state.kind === 'reused');

  return (
    // Stop clicks here from reaching the row's select handler: antd portals the
    // popover to <body>, but React replays events through the component tree, so
    // a click inside would otherwise bubble to the row and open the request.
    // biome-ignore lint/a11y/useKeyWithClickEvents: guard only, not an interactive element
    <div className="dt-waterfall-pop dt-waterfall-pop--h" onClick={(e) => e.stopPropagation()}>
      <div className="dt-waterfall-pop-head">
        <span>Key moments</span>
        <span className="dt-waterfall-pop-where">(since the first request)</span>
        <TimingKeyMomentsInfo />
      </div>

      <HorizontalTimingChart ladder={ladder} queuedAtMs={queuedAtMs} spec={spec} terminal={terminal} />

      <TimingLadderLegend ladder={ladder} spec={spec} />
      {anyReused && reusedOpener && <div className="dt-waterfall-pop-note">↳ connection opened by {reusedOpener}</div>}

      {/* A terminal row marks where it stopped on the bar above (the red ▼ +
          status); no separate "never reached the network" line — the hatched
          cells past the stop say it. */}
      {unfinished && <div className="dt-waterfall-pop-caution">CAUTION: request is not finished yet!</div>}
      <div className={`dt-waterfall-pop-total${spec?.total ? ' dt-wf-pop-hl' : ''}`}>
        <span>
          Total time <span className="dt-waterfall-pop-where">(queued → ended)</span>
        </span>
        <span>{formatTimeMs(ladder.durationMs)}</span>
      </div>
    </div>
  );
}
