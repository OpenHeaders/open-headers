/**
 * The horizontal timing-ladder chart — the wide, at-a-glance bar shared by the
 * Waterfall hover popover (wide view) and the Timing detail tab.
 *
 * It lays the eight-rung {@link TimingLadder} along the X axis over the pure
 * {@link layoutHorizontal} geometry: the ▼ instant ticks (Queued / Started /
 * Response / Ended) above, the bar of one cell per rung below (hatched for a
 * skipped step — connection reused / not reached — with a numbered chip on each
 * real cell), the band brackets (Scheduling / Connecting / Transferring) and the
 * 🌐-on-the-wire span beneath. So the whole timing story reads without a hover.
 *
 * Pure presentation over the ladder + layout — no timing math of its own. Both
 * consumers render this identical component, so the bar can never drift.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatTimeMs } from '../../data/timing/format-time';
import { layoutHorizontal } from '../../data/timing/horizontal-timing-layout';
import type { TimingLadder } from '../../data/timing/timing-ladder';
import {
  bandLabel,
  bandWhere,
  type ExplainSpec,
  isWarmSocketConnect,
  terminalDetailText,
  warmSocketTitle,
  type WaterfallTerminal,
} from '../../data/timing/timing-popover-model';
import { TimingBandInfo, TimingMomentInfo, TimingTerminalInfo } from './TimingRungInfo';

// Render-only heights for the tick axis + band-bracket rows.
const AXIS_H = 56;
const BRACKET_H = 34;

export function HorizontalTimingChart({
  ladder,
  queuedAtMs,
  spec,
  terminal,
}: {
  ladder: TimingLadder;
  /** Issue time relative to the surface's zero — added to the ladder's local
   *  instants for the absolute "… at" tick value. */
  queuedAtMs: number;
  /** Metric-explain highlight (anchor instant + contributing rungs), or `null`
   *  when there is no active metric (the Timing tab). */
  spec?: ExplainSpec | null;
  /** A terminal request that never received a response — marks where it stopped. */
  terminal?: WaterfallTerminal;
}) {
  const t = useT();
  const at = (localMs: number) => formatTimeMs(queuedAtMs + localMs);
  const warmConnect = isWarmSocketConnect(ladder);
  const layout = layoutHorizontal(t, ladder, terminal != null);

  return (
    <div className="dt-wf-h-chart">
      <div className="dt-wf-h-stage" style={{ width: layout.chartPx }}>
        {/* Instant ticks — ▼ marks at their true boundaries, labels de-collided
            above with a leader back to the mark whenever a label had to shift. */}
        <div className="dt-wf-h-axis" style={{ height: AXIS_H }}>
          <svg className="dt-wf-h-leaders" width={layout.chartPx} height={AXIS_H} aria-hidden="true">
            {layout.ticks
              .filter((tick) => tick.leader)
              .map((tick) => (
                <line key={tick.line} x1={tick.markPx} y1={AXIS_H - 2} x2={tick.labelCenterPx} y2={AXIS_H - 16} />
              ))}
            {layout.failure?.leader && (
              <line
                className="dt-wf-h-leader--stop"
                x1={layout.failure.markPx}
                y1={AXIS_H - 2}
                x2={layout.failure.labelCenterPx}
                y2={AXIS_H - 16}
              />
            )}
          </svg>
          {layout.ticks.map((tick) => {
            const isAnchor = spec?.anchor === tick.line;
            const unreached = tick.reached ? '' : ' dt-wf-h-tick--unreached';
            return (
              <span
                key={`l-${tick.line}`}
                className={`dt-wf-h-tick${isAnchor ? ' dt-wf-pop-anchor' : ''}${unreached}`}
                style={{ left: tick.labelCenterPx }}
              >
                <span className="dt-wf-h-tick-label">
                  {tick.label}
                  <TimingMomentInfo moment={tick.line} />
                  {isAnchor && <span className="dt-wf-pop-down"> ↓</span>}
                </span>
                <span className="dt-wf-h-tick-value">
                  {tick.reached ? at(tick.localMs) : t('panel.network.timing.tickNotReached')}
                </span>
                <span className="dt-wf-h-tick-why">{tick.why}</span>
              </span>
            );
          })}
          {terminal && layout.failure && (
            <span
              className="dt-wf-h-stop-label"
              style={{ left: layout.failure.labelCenterPx }}
              title={terminalDetailText(t, terminal.detail)}
            >
              {terminal.label}
              <TimingTerminalInfo label={terminal.label} />
            </span>
          )}
          {layout.ticks.map((tick) => (
            <span
              key={`m-${tick.line}`}
              className={`dt-wf-h-tick-mark${tick.reached ? '' : ' dt-wf-h-tick-mark--unreached'}`}
              style={{ left: tick.markPx }}
              aria-hidden="true"
            >
              ▼
            </span>
          ))}
          {layout.failure && (
            <span className="dt-wf-h-stop-mark" style={{ left: layout.failure.markPx }} aria-hidden="true">
              ▼
            </span>
          )}
        </div>

        {/* The bar — one cell per rung, scaled by duration with a readable floor;
            a terminal row marks where it stopped with a red stop line. */}
        <div className="dt-wf-h-bar">
          {layout.cells.map((c) => {
            const warmSocket = c.key === 'connect' && warmConnect;
            const fill =
              c.kind === 'absent'
                ? ' dt-wf-h-cell--absent'
                : c.kind === 'zero'
                  ? ' dt-wf-h-cell--zero'
                  : ` dt-wf-fill--${c.key}`;
            return (
              <div
                key={c.key}
                className={`dt-wf-h-cell${fill}${spec?.rungs.has(c.key) ? ' dt-wf-h-cell--hl' : ''}`}
                style={{ width: c.widthPx, flex: 'none' }}
                title={warmSocket ? warmSocketTitle(t) : undefined}
              >
                {/* Skipped (hatched) cells keep their step number too — the
                    legend still lists 3/4/5 as "connection reused", so an
                    unnumbered hatch zone left the reader to guess which steps
                    it covered. Same chip as timed cells: it's the one
                    treatment that stays legible on every cell and theme. */}
                {c.kind !== 'zero' && <span className="dt-wf-h-cellno">{c.step}</span>}
              </div>
            );
          })}
          {layout.failure && (
            <span className="dt-wf-h-stopline" style={{ left: layout.failure.markPx }} aria-hidden="true" />
          )}
        </div>

        {/* Band brackets (accolade opening up toward the bar) + the 🌐 span;
            labels de-collided with a leader to their bracket when shifted. */}
        <div className="dt-wf-h-brackets" style={{ height: BRACKET_H }}>
          <svg className="dt-wf-h-leaders" width={layout.chartPx} height={BRACKET_H} aria-hidden="true">
            {layout.bands
              .filter((b) => b.leader)
              .map((b) => (
                <line key={b.band} x1={b.leftPx + b.widthPx / 2} y1={7} x2={b.labelCenterPx} y2={14} />
              ))}
          </svg>
          {layout.bands.map((b) => (
            <span
              key={`line-${b.band}`}
              className="dt-wf-h-bracket-line"
              style={{ left: b.leftPx, width: b.widthPx }}
              aria-hidden="true"
            />
          ))}
          {layout.bands.map((b) => (
            <span key={`lbl-${b.band}`} className="dt-wf-h-bracket-label" style={{ left: b.labelCenterPx }}>
              <span className="dt-wf-h-bracket-name">
                {bandLabel(t, b.band)}
                <TimingBandInfo band={b.band} />
              </span>
              <span className="dt-waterfall-pop-where">{bandWhere(t, b.band)}</span>
            </span>
          ))}
        </div>
        <div className="dt-wf-h-wirerow">
          <span className="dt-wf-h-wirespan" style={{ left: layout.wire.leftPx, width: layout.wire.widthPx }}>
            {t('panel.network.timing.onTheWire')}
          </span>
        </div>
      </div>
    </div>
  );
}
