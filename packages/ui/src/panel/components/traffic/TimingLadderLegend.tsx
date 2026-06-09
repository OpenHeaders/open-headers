/**
 * The numbered timing-ladder legend — one column per band (Scheduling /
 * Connecting / Transferring), each listing its rungs with the step number, the
 * colour swatch, the label, and the elapsed value or the reason it is absent
 * (connection reused / not reached / n/a). The three columns line up under the
 * chart's three band brackets, so the legend reads as the grouped breakdown.
 *
 * Shared by the Waterfall wide popover and the Timing detail tab — both render
 * this identical legend over the same {@link TimingLadder}, so they can't drift.
 */

import { formatTimeMs } from '../../data/format-time';
import type { TimingLadder } from '../../data/timing-ladder';
import {
  absentText,
  BAND_ORDER,
  type ExplainSpec,
  isWarmSocketConnect,
  WARM_SOCKET_TITLE,
} from '../../data/timing-popover-model';

export function TimingLadderLegend({ ladder, spec }: { ladder: TimingLadder; spec?: ExplainSpec | null }) {
  const warmConnect = isWarmSocketConnect(ladder);
  return (
    <div className="dt-wf-h-legend">
      {BAND_ORDER.map((band) => (
        <div key={band} className="dt-wf-h-legend-col">
          {ladder.rungs.map((r, i) => {
            if (r.band !== band) return null;
            const absent = r.state.kind !== 'elapsed';
            const warmSocket = r.key === 'connect' && warmConnect;
            const hl = spec?.rungs.has(r.key) ? ' dt-waterfall-pop-row--hl' : '';
            return (
              <div
                key={r.key}
                className={`dt-wf-h-legend-item${absent ? ' dt-waterfall-pop-row--absent' : ''}${hl}`}
                title={warmSocket ? WARM_SOCKET_TITLE : undefined}
              >
                <span className="dt-waterfall-pop-stepno">{i + 1}.</span>
                <span className={`dt-waterfall-pop-swatch dt-wf-fill--${r.key}`} aria-hidden="true" />
                <span className="dt-wf-h-legend-name">{r.label}</span>
                {warmSocket && <span className="dt-wf-h-legend-hint">warm socket</span>}
                {r.state.kind === 'elapsed' ? (
                  <span className="dt-waterfall-pop-ms">{formatTimeMs(r.state.ms)}</span>
                ) : (
                  <span className="dt-waterfall-pop-absent-text">{absentText(r.state)}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
