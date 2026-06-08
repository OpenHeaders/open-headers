/**
 * Horizontal timing ladder — the wide, explanatory hover breakdown for a
 * Waterfall bar (the vertical {@link WaterfallTimingPopover} is its compact
 * narrow-panel twin). Both render the SAME {@link TimingLadder} and the SAME
 * shared semantics ({@link ./timing-popover-model}) — band names, explain spec,
 * absent wording, warm-socket hint — so they can never disagree. This renderer
 * adds no timing math; it only lays the ladder out along the X axis.
 *
 * Layout is computed in pixels on a fixed-width stage by {@link layoutHorizontal}
 * so it is robust for ANY timings, including the degenerate ones (a blocked
 * request whose Queued and Started are µs apart, or whole bands that never ran):
 *
 *   - the bar is one cell per rung, each scaled by its real duration but never
 *     below a readable floor, so a sub-ms phase is still a visible cell;
 *   - the ▼ instant ticks sit at their true cell boundaries, but their stacked
 *     labels are de-collided (pushed apart to a minimum spacing) with a thin
 *     leader back to the mark whenever a label has to shift — so labels never
 *     overlap however clustered the instants are;
 *   - the band brackets + the 🌐-on-the-wire span line up with the bar, and the
 *     band labels are de-collided the same way;
 *   - a numbered legend carries every rung's value or its absent reason.
 *
 * The bar is a true-order schematic, not strict-to-scale (the floor would erase
 * tiny phases); the exact durations live in the cells + legend + ticks.
 */

import { formatTimeMs } from '../../data/format-time';
import type { WaterfallMetric } from '../../data/network-columns';
import type { TimingBand, TimingLadder, TimingRungKey } from '../../data/timing-ladder';
import {
  absentText,
  type Anchor,
  BAND_LABEL,
  BAND_ORDER,
  BAND_WHERE,
  explainSpec,
  isWarmSocketConnect,
  WARM_SOCKET_TITLE,
  type WaterfallTerminal,
} from './timing-popover-model';

// Bar geometry (px on the fixed stage). The two minimums keep tiny / skipped
// phases visible; the label minimums drive the de-collision spacing.
const CHART_PX = 900;
const SEG_MIN = 88; // floor width of a real (ms > 0) phase
const ZERO_MIN = 16; // slot a zero-ms (but real) phase keeps
const ABSENT_MIN = 46; // a not-reached / reused phase — roomy, so absent bands read clearly
const TICK_LBL = 80; // minimum centre-to-centre spacing for instant labels
const BAND_LBL = 120; // … and for band labels (just over the widest location line)
const GAP = 6;
const AXIS_H = 56;
const BRACKET_H = 34;

/** The bar floor for a rung: a real phase scales above SEG_MIN; a zero-ms phase
 *  keeps a thin slot; a not-reached / reused phase gets a roomy fixed width so
 *  the absent bands (and their labels) have space to read. */
function cellFloor(kind: 'elapsed' | 'zero' | 'absent'): number {
  if (kind === 'elapsed') return SEG_MIN;
  if (kind === 'zero') return ZERO_MIN;
  return ABSENT_MIN;
}

type InstantLine = Anchor | 'response' | 'ended';

interface HCell {
  key: TimingRungKey;
  leftPx: number;
  widthPx: number;
  kind: 'elapsed' | 'zero' | 'absent';
  step: number;
}
interface HTick {
  line: InstantLine;
  label: string;
  localMs: number;
  why: string;
  /** `false` for a terminal row's Response / Ended — the instant never happened,
   *  so the tick shows "not reached" at its would-be boundary instead of a time. */
  reached: boolean;
  markPx: number;
  labelCenterPx: number;
  leader: boolean;
}
interface HBand {
  band: TimingBand;
  leftPx: number;
  widthPx: number;
  labelCenterPx: number;
  leader: boolean;
}
/** Where a terminal request stopped — the right edge of the last reached rung —
 *  marked on the bar itself so the user sees where it died. */
interface HFailure {
  markPx: number;
  labelCenterPx: number;
  leader: boolean;
}
interface HLayout {
  chartPx: number;
  cells: readonly HCell[];
  ticks: readonly HTick[];
  bands: readonly HBand[];
  wire: { leftPx: number; widthPx: number };
  failure: HFailure | null;
}

/** Push monotonically-increasing positions apart to a minimum spacing, then pull
 *  the tail back under `hi` so the row stays on the stage (the side padding
 *  absorbs a half-label of overflow at either end). */
function spread(pos: readonly number[], minGap: number, hi: number): number[] {
  const out = pos.slice();
  for (let i = 1; i < out.length; i++) {
    if (out[i] < out[i - 1] + minGap) out[i] = out[i - 1] + minGap;
  }
  if (out.length > 0 && out[out.length - 1] > hi) {
    out[out.length - 1] = hi;
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i] > out[i + 1] - minGap) out[i] = out[i + 1] - minGap;
    }
  }
  return out;
}

/** Pure pixel layout for the bar, ticks, brackets, wire span, and (for a
 *  terminal row) the failure marker — everything the renderer positions, derived
 *  from the ladder. `hasFailure` folds the failure marker into the label
 *  de-collision so it never overlaps the instant ticks. */
export function layoutHorizontal(ladder: TimingLadder, hasFailure = false): HLayout {
  const rungs = ladder.rungs;
  const kinds = rungs.map<HCell['kind']>((r) =>
    r.state.kind !== 'elapsed' ? 'absent' : r.state.ms === 0 ? 'zero' : 'elapsed',
  );
  const widths = kinds.map(cellFloor);
  const reserved = widths.reduce((a, b) => a + b, 0);
  const flex = Math.max(CHART_PX - reserved, 0);
  const dur = ladder.durationMs;
  if (dur > 0) {
    rungs.forEach((r, i) => {
      if (r.state.kind === 'elapsed' && r.state.ms > 0) widths[i] += (r.state.ms / dur) * flex;
    });
  }
  const lefts: number[] = [];
  let acc = 0;
  for (const w of widths) {
    lefts.push(acc);
    acc += w;
  }
  const total = acc;
  const idxOf = (key: TimingRungKey) => rungs.findIndex((r) => r.key === key);
  const rightOf = (key: TimingRungKey) => {
    const i = idxOf(key);
    return i < 0 ? 0 : lefts[i] + widths[i];
  };
  const leftOf = (key: TimingRungKey) => {
    const i = idxOf(key);
    return i < 0 ? 0 : lefts[i];
  };

  const cells: HCell[] = rungs.map((r, i) => ({
    key: r.key,
    leftPx: lefts[i],
    widthPx: widths[i],
    kind: kinds[i],
    step: i + 1,
  }));

  // Always all four instants; a terminal row's Response / Ended sit at their
  // would-be boundary marked "not reached".
  const raw: Array<Omit<HTick, 'labelCenterPx' | 'leader'>> = [
    { line: 'queued', label: 'Queued', localMs: 0, why: 'request created', reached: true, markPx: 0 },
    { line: 'started', label: 'Started', localMs: ladder.startedMs, why: 'left the queue', reached: true, markPx: rightOf('queueing') },
    { line: 'response', label: 'Response', localMs: ladder.responseMs ?? 0, why: 'first byte (TTFB)', reached: ladder.responseMs != null, markPx: rightOf('wait') },
    { line: 'ended', label: 'Ended', localMs: ladder.endedMs ?? 0, why: 'last byte, done', reached: ladder.endedMs != null, markPx: total },
  ];

  // The failure point — the right edge of the last reached rung.
  let failurePx = 0;
  rungs.forEach((r, i) => {
    if (r.state.kind === 'elapsed') failurePx = Math.max(failurePx, lefts[i] + widths[i]);
  });

  // De-collide the instant labels (+ the failure label) together so none overlap.
  const items = [
    ...raw.map((t, i) => ({ id: `t${i}`, markPx: t.markPx })),
    ...(hasFailure ? [{ id: 'fail', markPx: failurePx }] : []),
  ].sort((a, b) => a.markPx - b.markPx);
  const centers = spread(
    items.map((m) => m.markPx),
    TICK_LBL + GAP,
    total,
  );
  const centerOf = new Map(items.map((m, i) => [m.id, centers[i]]));

  const ticks: HTick[] = raw.map((t, i) => {
    const c = centerOf.get(`t${i}`) ?? t.markPx;
    return { ...t, labelCenterPx: c, leader: Math.abs(c - t.markPx) > 1.5 };
  });
  const failCenter = centerOf.get('fail') ?? failurePx;
  const failure: HFailure | null = hasFailure
    ? { markPx: failurePx, labelCenterPx: failCenter, leader: Math.abs(failCenter - failurePx) > 1.5 }
    : null;

  const bandRaw = BAND_ORDER.map((band) => {
    const rs = rungs.filter((r) => r.band === band);
    const left = leftOf(rs[0].key);
    const right = rightOf(rs[rs.length - 1].key);
    return { band, leftPx: left, widthPx: right - left, midPx: (left + right) / 2 };
  });
  const bandCenters = spread(
    bandRaw.map((b) => b.midPx),
    BAND_LBL + GAP,
    total,
  );
  const bands: HBand[] = bandRaw.map((b, i) => ({
    band: b.band,
    leftPx: b.leftPx,
    widthPx: b.widthPx,
    labelCenterPx: bandCenters[i],
    leader: Math.abs(bandCenters[i] - b.midPx) > 1.5,
  }));

  const onWire = rungs.filter((r) => r.onWire);
  const wire =
    onWire.length > 0
      ? { leftPx: leftOf(onWire[0].key), widthPx: rightOf(onWire[onWire.length - 1].key) - leftOf(onWire[0].key) }
      : { leftPx: 0, widthPx: 0 };

  return { chartPx: total, cells, ticks, bands, wire, failure };
}

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
  const at = (localMs: number) => formatTimeMs(queuedAtMs + localMs);
  const spec = explain ? explainSpec(metric) : null;
  const anyReused = ladder.rungs.some((r) => r.state.kind === 'reused');
  const warmConnect = isWarmSocketConnect(ladder);
  const layout = layoutHorizontal(ladder, terminal != null);

  return (
    // Stop clicks here from reaching the row's select handler: antd portals the
    // popover to <body>, but React replays events through the component tree, so
    // a click inside would otherwise bubble to the row and open the request.
    // biome-ignore lint/a11y/useKeyWithClickEvents: guard only, not an interactive element
    <div className="dt-waterfall-pop dt-waterfall-pop--h" onClick={(e) => e.stopPropagation()}>
      <div className="dt-waterfall-pop-head">
        <span>Key moments</span>
        <span className="dt-waterfall-pop-where">(since the first request)</span>
      </div>

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
                  {c.kind === 'elapsed' && <span className="dt-wf-h-cellno">{c.step}</span>}
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
                <span className="dt-wf-h-bracket-name">{BAND_LABEL[b.band]}</span>
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

      {/* Numbered legend — every rung's value or its absent reason. */}
      <div className="dt-wf-h-legend">
        {ladder.rungs.map((r, i) => {
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
