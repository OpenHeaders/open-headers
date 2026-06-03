/**
 * Pure geometry + label placement for the Waterfall bar.
 *
 * The active metric picks one of two bar shapes — the same split the browser
 * makes by swapping time calculators:
 *
 *   - **duration** (Total duration / Latency) — a two-tone bar (waiting then
 *     download) colored by resource type, zero-aligned at the left edge with
 *     width scaled against the largest duration in view.
 *   - **timeline** (Start / Response / End time) — a per-phase "rainbow" bar
 *     (queueing, stalled, DNS, connect, SSL, send, wait, receive) placed on
 *     the shared `[t0, tMax]` window at the issue time. The phases come from
 *     `computeTimingPhases`, so DNS is counted once and SSL is peeled out of
 *     connect — no double-counting in the segment widths.
 *
 * Keeping the math here — pure, percentage-based, React-free — means the bar a
 * row draws and the order it sorts into are derived from one place and stay
 * testable.
 */

import type { Page } from '@openheaders/core/page-stream';
import { formatClock, formatTimeMs } from './format-time';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { timelineEndMs, type WaterfallMetric, waterfallSortValue, waterfallStartMs } from './network-columns';
import type { ComputedTimings, TimingPhaseKey } from './timing-phases';

/** A bar never collapses below this width (% of column) so it stays visible. */
const MIN_BAR_PCT = 0.25;

/** Dot-and-leader length (px) drawn between the bar end and an outside label. */
export const LEADER_PX = 12;

/** Two-tone (Total duration / Latency) bar, as percentages of the column. */
export interface DurationBarLayout {
  /** Bar width. */
  widthPct: number;
  /** Waiting (latency) share of the bar itself, 0–100; the rest is download. */
  waitPct: number;
  /** Raw millisecond spans, carried through for labels and tooltips. */
  durationMs: number;
  latencyMs: number;
  downloadMs: number;
}

/** One phase segment of a timeline (rainbow) bar. `key` is the phase key —
 * the consumer maps it to a `dt-wf-fill--<key>` color class (theme-aware). */
export interface TimelineSegment {
  key: string;
  /** Share of the bar this phase occupies, 0–100. */
  pct: number;
  /**
   * Tall = the request/response phases (send, wait, receive); the connection
   * setup phases (queueing, stalled, DNS, connect, SSL) draw thinner. Mirrors
   * the browser's stepped waterfall so connection-vs-transfer reads at a glance.
   */
  tall: boolean;
}

/** Per-phase (Start / Response / End time) bar placed on the shared window. */
export interface TimelineBarLayout {
  /** Bar left edge (issue time on the window). */
  leftPct: number;
  /** Bar total width (issue → finish). */
  widthPct: number;
  /** Phase segments left-to-right; empty when no timing detail is available. */
  segments: readonly TimelineSegment[];
}

function split(durationMs: number, latencyMs: number): { waitPct: number; downloadMs: number } {
  const waitPct = durationMs > 0 ? Math.min((latencyMs / durationMs) * 100, 100) : 100;
  return { waitPct, downloadMs: Math.max(durationMs - latencyMs, 0) };
}

/** Zero-aligned two-tone bar for the Total duration / Latency metrics. */
export function durationBarLayout(row: InspectorRowWithFires, maxMs: number): DurationBarLayout {
  const duration = Math.max(waterfallSortValue(row, 'duration'), 0);
  const latency = Math.max(waterfallSortValue(row, 'latency'), 0);
  const { waitPct, downloadMs } = split(duration, latency);
  return {
    widthPct: Math.max((duration / Math.max(maxMs, 1)) * 100, MIN_BAR_PCT),
    waitPct,
    durationMs: duration,
    latencyMs: latency,
    downloadMs,
  };
}

/**
 * Per-phase rainbow bar for the Start / Response / End time metrics. The bar
 * spans `[issue, issue + total]` on the window (queueing is its leading
 * segment), and each phase fills its share of `total`. `total` is the phase
 * sum (DNS counted once), so the segments tile the bar exactly.
 */
export function timelineBarLayout(
  row: InspectorRowWithFires,
  t0: number,
  tMax: number,
  timing: ComputedTimings | null,
): TimelineBarLayout {
  const lc = row.lifecycle;
  const span = Math.max(tMax - t0, 1);
  const start = waterfallStartMs(lc);
  const total = timing ? timing.totalMs : Math.max(timelineEndMs(lc) - start, 0);
  const segments: TimelineSegment[] =
    timing && total > 0
      ? timing.phases.map((p) => ({
          key: p.key,
          pct: (p.ms / total) * 100,
          tall: p.group === 'transfer',
        }))
      : [];
  return {
    leftPct: (Math.max(start - t0, 0) / span) * 100,
    widthPct: Math.max((total / span) * 100, MIN_BAR_PCT),
    segments,
  };
}

const TIMELINE_METRICS: ReadonlySet<WaterfallMetric> = new Set<WaterfallMetric>([
  'startTime',
  'responseTime',
  'endTime',
]);

/**
 * The value to print on a timeline (Start / Response / End time) bar. Derived
 * from the SAME quantities the bar is built from (the queue moment, the
 * queueing phase, the phase sum) so the number agrees with the bar and the
 * sort. `relative` reads the offset from the timeline zero (the first request
 * in view), matching the hover popover's "Started at", and carries a leading
 * `+` so it reads as an offset rather than an absolute reading; `timestamp`
 * reads the absolute wall-clock instant (local or UTC). The chip is centered in
 * the column; only the value changes with the metric. Null for the zero-aligned
 * metrics (duration / latency, which carry their own labels) or when timing is
 * absent.
 */
export function timelineMetricLabel(
  row: InspectorRowWithFires,
  metric: WaterfallMetric,
  t0: number,
  timing: ComputedTimings | null,
  format: 'relative' | 'timestamp',
  tz: 'local' | 'utc',
): string | null {
  if (!timing || !TIMELINE_METRICS.has(metric)) return null;
  const start = waterfallStartMs(row.lifecycle);
  const phaseMs = (key: string) => timing.phases.find((p) => p.key === key)?.ms ?? 0;
  let offset: number;
  if (metric === 'startTime') offset = phaseMs('queueing');
  else if (metric === 'responseTime') offset = Math.max(timing.totalMs - phaseMs('receive'), 0);
  else offset = timing.totalMs;
  if (format === 'timestamp') return formatClock(start + offset, tz);
  return `+${formatTimeMs(Math.max(start - t0, 0) + offset)}`;
}

/** A bar segment's tone — the two tones the duration bar paints (lighter
 * waiting half, base download half), keyed so the consumer resolves each to a
 * `barColors` value. */
export type WaterfallTone = 'waiting' | 'download';

/** One colored span of a popover phase row: a tone and the fraction (0–1) of
 * the row's width it covers. A row split across the waiting/download boundary
 * carries two spans; a row wholly in one band carries one. */
export interface PhaseTintSpan {
  tone: WaterfallTone;
  frac: number;
}

/**
 * Which tone(s) paint each phase row in the hover popover, so the popover reads
 * as a legend for the two-tone duration bar: the rows that sum to the bar's
 * latency value carry the waiting tone, the row(s) that sum to its download
 * value carry the download tone. The split is phase-aligned — `latencyMs` is
 * `duration − receive`, so the boundary falls exactly between "Waiting for
 * server" and "Content Download" and no single phase is shared. The fractional
 * `PhaseTintSpan` shape still lets a row carry two spans should a future metric
 * ever cut through one. Empty for the timeline metrics (their rainbow bar
 * already colors each phase) and for phases outside the bar (Queueing, which
 * the duration bar excludes).
 */
export function phaseTints(
  data: ComputedTimings,
  metric: WaterfallMetric,
): ReadonlyMap<TimingPhaseKey, readonly PhaseTintSpan[]> {
  const tints = new Map<TimingPhaseKey, readonly PhaseTintSpan[]>();
  if (metric !== 'duration' && metric !== 'latency') return tints;
  for (const p of data.phases) {
    if (p.key === 'queueing') continue;
    const tone: WaterfallTone = p.key === 'receive' ? 'download' : 'waiting';
    tints.set(p.key, [{ tone, frac: 1 }]);
  }
  return tints;
}

/**
 * The shared `[t0, tMax]` window for the timeline waterfall: zero at the
 * earliest issue time in view, extent at the latest finish. Must be computed
 * over the full (unfiltered) row set so a search/type filter never re-anchors
 * the zero or rescales the axis — a filtered request keeps its true offset
 * instead of reading "Queued at 0" as though it were the first request.
 */
export function waterfallWindow(rows: readonly InspectorRowWithFires[]): [number, number] {
  if (rows.length === 0) return [0, 1];
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const r of rows) {
    const start = waterfallStartMs(r.lifecycle);
    if (start < min) min = start;
    // HAR-derived finish (issue + queueing + duration), the same anchor the
    // timeline bars use, so a bar's right edge never overruns the window.
    const end = timelineEndMs(r.lifecycle);
    if (end > max) max = end;
  }
  if (!Number.isFinite(min)) min = 0;
  if (max <= min) max = min + 1;
  return [min, max];
}

/** A page-timing event line drawn across the timeline window. */
export interface PageMarker {
  key: string;
  kind: 'dcl' | 'load';
  /** Position on the window, 0–100. */
  pct: number;
}

/**
 * DOMContentLoaded / Load event lines for the timeline window. Each page's
 * milestones are relative to its own navigation start, so the absolute instant
 * is `page.startedAtMs + milestone`. Markers outside `[t0, tMax]` are dropped
 * (a milestone that predates the window, or hasn't fired, has no line). Only
 * meaningful in timeline mode — the zero-aligned duration view has no shared
 * time axis to place them on.
 */
export function pageMarkers(pages: readonly Page[], t0: number, tMax: number): PageMarker[] {
  const span = Math.max(tMax - t0, 1);
  const out: PageMarker[] = [];
  const place = (page: Page, kind: 'dcl' | 'load', ms: number | undefined): void => {
    if (typeof ms !== 'number' || ms < 0) return;
    const pct = ((page.startedAtMs + ms - t0) / span) * 100;
    if (pct >= 0 && pct <= 100) out.push({ key: `${page.id}-${kind}`, kind, pct });
  };
  for (const page of pages) {
    place(page, 'dcl', page.dclMs);
    place(page, 'load', page.loadMs);
  }
  return out;
}

/** Whole-ms below a second, two-decimal seconds above — the value labels the
 * browser prints on the bar (the hover popover keeps sub-ms precision). */
export function formatBarMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Rough pixel width of a 10px-font label — enough to decide inside/outside fit. */
function estLabelPx(label: string): number {
  return label.length * 6.2 + 4;
}

export type LabelPlacement = 'inside' | 'outside' | 'none';

export interface BarLabels {
  latency: { text: string; inside: boolean };
  download: { text: string; placement: LabelPlacement };
}

/**
 * Decide where each value label sits on a two-tone bar, given the measured
 * column width. A value prints inside its segment when it fits; the download
 * value otherwise sits past the bar end with a dot-and-leader; if there's no
 * room there either it is dropped. Mirrors how the browser measures labels
 * against its canvas.
 */
export function barLabels(layout: DurationBarLayout, colPx: number): BarLabels {
  const latText = formatBarMs(layout.latencyMs);
  const dlText = formatBarMs(layout.downloadMs);
  if (colPx <= 0) {
    return { latency: { text: latText, inside: false }, download: { text: dlText, placement: 'none' } };
  }

  const barPx = (layout.widthPct / 100) * colPx;
  const waitingPx = (layout.waitPct / 100) * barPx;
  const downloadPx = Math.max(barPx - waitingPx, 0);

  let placement: LabelPlacement = 'none';
  if (layout.downloadMs >= 0.5) {
    if (estLabelPx(dlText) <= downloadPx) placement = 'inside';
    else if (barPx + LEADER_PX + estLabelPx(dlText) <= colPx) placement = 'outside';
  }

  return {
    latency: { text: latText, inside: estLabelPx(latText) <= waitingPx },
    download: { text: dlText, placement },
  };
}
