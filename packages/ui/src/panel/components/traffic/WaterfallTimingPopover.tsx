/**
 * Hover breakdown for a Waterfall bar — the compact cousin of the
 * Timing detail pane. Opens with the request's absolute timeline position
 * (Queued at / Started at, relative to the first request in view), then
 * renders the canonical grouped phases (`computeTimingPhases`) with a
 * colored swatch, label, and duration per row, then a bold total. The
 * total reflects the active metric: Latency sums the pre-response phases
 * (it ends at the first byte); every other metric uses the full duration.
 */

import { formatTimeMs } from '../../data/format-time';
import type { WaterfallMetric } from '../../data/network-columns';
import { type ComputedTimings, type TimingGroup } from '../../data/timing-phases';

const GROUP_LABEL: Record<TimingGroup, string> = {
  scheduling: 'Resource Scheduling',
  connection: 'Connection Start',
  transfer: 'Request / Response',
};

const GROUP_ORDER: readonly TimingGroup[] = ['scheduling', 'connection', 'transfer'];

export function WaterfallTimingPopover({
  data,
  metric,
  queuedAtMs,
}: {
  data: ComputedTimings;
  metric: WaterfallMetric;
  /** Issue time relative to the timeline zero (the earliest request in view). */
  queuedAtMs: number;
}) {
  // Duration spans the whole request (issue → end), so it sums every phase
  // including Queueing — browser parity. Latency instead measures the post-
  // queue start to the first response byte, so it drops `queueing` + `receive`.
  const isLatency = metric === 'latency';
  const totalMs = data.phases
    .filter((p) => !(isLatency && (p.key === 'queueing' || p.key === 'receive')))
    .reduce((sum, p) => sum + p.ms, 0);
  const totalLabel = isLatency ? 'Latency' : 'Duration';

  // The network start lags the queue moment by exactly the queueing phase.
  const queueingMs = data.phases.find((p) => p.key === 'queueing')?.ms ?? 0;
  const startedAtMs = queuedAtMs + queueingMs;

  return (
    <div className="dt-waterfall-pop">
      <div className="dt-waterfall-pop-start">
        <div>Queued at {formatTimeMs(queuedAtMs)}</div>
        <div>Started at {formatTimeMs(startedAtMs)}</div>
      </div>
      {GROUP_ORDER.map((group) => {
        const phases = data.byGroup[group];
        if (phases.length === 0) return null;
        return (
          <div key={group} className="dt-waterfall-pop-group">
            <div className="dt-waterfall-pop-head">{GROUP_LABEL[group]}</div>
            {phases.map((p) => (
              <div key={p.key} className="dt-waterfall-pop-row">
                <span className="dt-waterfall-pop-swatch" style={{ background: p.color }} aria-hidden="true" />
                <span className="dt-waterfall-pop-label">{p.label}</span>
                <span className="dt-waterfall-pop-ms">{formatTimeMs(p.ms)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <div className="dt-waterfall-pop-total">
        <span>{totalLabel}</span>
        <span>{formatTimeMs(totalMs)}</span>
      </div>
    </div>
  );
}
