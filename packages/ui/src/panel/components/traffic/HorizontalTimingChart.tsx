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

import { formatTimeMs } from '../../data/timing/format-time';
import { layoutHorizontal } from '../../data/timing/horizontal-timing-layout';
import type { TimingLadder } from '../../data/timing/timing-ladder';
import {
  BAND_LABEL,
  BAND_WHERE,
  type ExplainSpec,
  isWarmSocketConnect,
  WARM_SOCKET_TITLE,
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
  const at = (localMs: number) => formatTimeMs(queuedAtMs + localMs);
  const warmConnect = isWarmSocketConnect(ladder);
  const layout = layoutHorizontal(ladder, terminal != null);

  return (
    <div className="dt-wf-h-chart">
      <div className="dt-wf-h-stage" style={{ width: layout.chartPx }}>
        {/* Instant ticks — ▼ marks at their true boundaries, labels de-collided
            above with a leader back to the mark whenever a label had to shift. */}
        <div className="dt-wf-h-axis" style={{ height: AXIS_H }}>
          <svg className="dt-wf-h-leaders" width={layout.chartPx} height={AXIS_H} aria-hidden="true">
            {layout.ticks
              .filter((t) => t.leader)
              .map((t) => (
                <line key={t.line} x1={t.markPx} y1={AXIS_H - 2} x2={t.labelCenterPx} y2={AXIS_H - 16} />
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
          {layout.ticks.map((t) => {
            const isAnchor = spec?.anchor === t.line;
            return (
              <span
                key={`l-${t.line}`}
                className={`dt-wf-h-tick${isAnchor ? ' dt-wf-pop-anchor' : ''}${t.reached ? '' : ' dt-wf-h-tick--unreached'}`}
                style={{ left: t.labelCenterPx }}
              >
                <span className="dt-wf-h-tick-label">
                  {t.label}
                  <TimingMomentInfo moment={t.line} />
                  {isAnchor && <span className="dt-wf-pop-down"> ↓</span>}
                </span>
                <span className="dt-wf-h-tick-value">{t.reached ? at(t.localMs) : 'not reached'}</span>
                <span className="dt-wf-h-tick-why">{t.why}</span>
              </span>
            );
          })}
          {terminal && layout.failure && (
            <span className="dt-wf-h-stop-label" style={{ left: layout.failure.labelCenterPx }} title={terminal.detail}>
              {terminal.label}
              <TimingTerminalInfo label={terminal.label} />
            </span>
          )}
          {layout.ticks.map((t) => (
            <span
              key={`m-${t.line}`}
              className={`dt-wf-h-tick-mark${t.reached ? '' : ' dt-wf-h-tick-mark--unreached'}`}
              style={{ left: t.markPx }}
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
                title={warmSocket ? WARM_SOCKET_TITLE : undefined}
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
                {BAND_LABEL[b.band]}
                <TimingBandInfo band={b.band} />
              </span>
              <span className="dt-waterfall-pop-where">{BAND_WHERE[b.band]}</span>
            </span>
          ))}
        </div>
        <div className="dt-wf-h-wirerow">
          <span className="dt-wf-h-wirespan" style={{ left: layout.wire.leftPx, width: layout.wire.widthPx }}>
            🌐 on the wire
          </span>
        </div>
      </div>
    </div>
  );
}
