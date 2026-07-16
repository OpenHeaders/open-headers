/**
 * Pure pixel layout for the horizontal timing ladder — the wide, explanatory
 * bar shared by the Waterfall hover popover (wide view) and the Timing detail
 * tab. Both render {@link HorizontalTimingChart} over this layout, so the bar a
 * user sees is identical wherever it appears.
 *
 * Layout is computed in pixels on a fixed-width stage so it is robust for ANY
 * timings, including the degenerate ones (a blocked request whose Queued and
 * Started are µs apart, or whole bands that never ran):
 *
 *   - the bar is one cell per rung, each scaled by its real duration but never
 *     below a readable floor, so a sub-ms phase is still a visible cell;
 *   - the ▼ instant ticks sit at their true cell boundaries, but their stacked
 *     labels are de-collided (pushed apart to a minimum spacing) with a thin
 *     leader back to the mark whenever a label has to shift;
 *   - the band brackets + the 🌐-on-the-wire span line up with the bar, and the
 *     band labels are de-collided the same way.
 *
 * The bar is a true-order schematic, not strict-to-scale (the floor would erase
 * tiny phases); the exact durations live in the cells + legend + ticks.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { TimingBand, TimingLadder, TimingRungKey } from './timing-ladder';
import { type Anchor, BAND_ORDER } from './timing-popover-model';

// Bar geometry (px on the fixed stage). The two minimums keep tiny / skipped
// phases visible; the label minimums drive the de-collision spacing.
const CHART_PX = 900;
const SEG_MIN = 88; // floor width of a real (ms > 0) phase
const ZERO_MIN = 16; // slot a zero-ms (but real) phase keeps
const ABSENT_MIN = 46; // a not-reached / reused phase — roomy, so absent bands read clearly
const TICK_LBL = 80; // minimum centre-to-centre spacing for instant labels
const BAND_LBL = 120; // … and for band labels (just over the widest location line)
const GAP = 6;

/** The bar floor for a rung: a real phase scales above SEG_MIN; a zero-ms phase
 *  keeps a thin slot; a not-reached / reused phase gets a roomy fixed width so
 *  the absent bands (and their labels) have space to read. */
function cellFloor(kind: 'elapsed' | 'zero' | 'absent'): number {
  if (kind === 'elapsed') return SEG_MIN;
  if (kind === 'zero') return ZERO_MIN;
  return ABSENT_MIN;
}

export type InstantLine = Anchor | 'response' | 'ended';

export interface HCell {
  key: TimingRungKey;
  leftPx: number;
  widthPx: number;
  kind: 'elapsed' | 'zero' | 'absent';
  step: number;
}
export interface HTick {
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
export interface HBand {
  band: TimingBand;
  leftPx: number;
  widthPx: number;
  labelCenterPx: number;
  leader: boolean;
}
/** Where a terminal request stopped — the right edge of the last reached rung —
 *  marked on the bar itself so the user sees where it died. */
export interface HFailure {
  markPx: number;
  labelCenterPx: number;
  leader: boolean;
}
export interface HLayout {
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
export function layoutHorizontal(t: Translate, ladder: TimingLadder, hasFailure = false): HLayout {
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
    {
      line: 'queued',
      label: t('panel.network.timing.moment.queued'),
      localMs: 0,
      why: t('panel.network.timing.momentWhy.queued'),
      reached: true,
      markPx: 0,
    },
    {
      line: 'started',
      label: t('panel.network.timing.moment.started'),
      localMs: ladder.startedMs,
      why: t('panel.network.timing.momentWhy.started'),
      reached: true,
      markPx: rightOf('queueing'),
    },
    {
      line: 'response',
      label: t('panel.network.timing.moment.response'),
      localMs: ladder.responseMs ?? 0,
      why: t('panel.network.timing.momentWhy.response'),
      reached: ladder.responseMs != null,
      markPx: rightOf('wait'),
    },
    {
      line: 'ended',
      label: t('panel.network.timing.moment.ended'),
      localMs: ladder.endedMs ?? 0,
      why: t('panel.network.timing.momentWhy.ended'),
      reached: ladder.endedMs != null,
      markPx: total,
    },
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
