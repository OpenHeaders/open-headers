/**
 * Hover breakdown for a Waterfall bar — the compact cousin of the
 * Timing detail pane. Renders the canonical grouped phases
 * (`computeTimingPhases`) with a colored swatch, label, and duration
 * per row, then a bold total. The total reflects the active metric:
 * Latency sums the pre-response phases (it ends at the first byte);
 * every other metric uses the full request duration.
 */

import type { WaterfallMetric } from '../../data/network-columns';
import { type ComputedTimings, type TimingGroup } from '../../data/timing-phases';

const GROUP_LABEL: Record<TimingGroup, string> = {
  scheduling: 'Resource Scheduling',
  connection: 'Connection Start',
  transfer: 'Request / Response',
};

const GROUP_ORDER: readonly TimingGroup[] = ['scheduling', 'connection', 'transfer'];

function formatMs(ms: number): string {
  if (ms < 0.01) return '0 ms';
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function WaterfallTimingPopover({ data, metric }: { data: ComputedTimings; metric: WaterfallMetric }) {
  const isLatency = metric === 'latency';
  const totalMs = isLatency
    ? data.phases.filter((p) => p.key !== 'receive').reduce((sum, p) => sum + p.ms, 0)
    : data.totalMs;
  const totalLabel = isLatency ? 'Latency' : 'Duration';

  return (
    <div className="dt-waterfall-pop">
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
                <span className="dt-waterfall-pop-ms">{formatMs(p.ms)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <div className="dt-waterfall-pop-total">
        <span>{totalLabel}</span>
        <span>{formatMs(totalMs)}</span>
      </div>
    </div>
  );
}
