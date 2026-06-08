/**
 * WaterfallBar — per-row timing visualization for the Network table.
 *
 * The active Waterfall metric picks the bar shape (the placement lives in
 * `waterfall-geometry`):
 *
 *   - **duration** (Total duration / Latency) — a zero-aligned two-tone bar
 *     (waiting + download) colored by resource type, with value labels.
 *   - **timeline** (Start / Response / End time) — a per-phase rainbow bar
 *     placed on the shared `[t0, tMax]` window; the hover popover carries the
 *     numeric breakdown.
 *
 * This component stays declarative: it resolves a layout from the row + scale
 * and renders the matching bar. Geometry, colors, phase data, and the per-row
 * value the sort reads all come from the same `data/` helpers, so the bar a
 * row draws and the order it sorts into always agree.
 */

import { Popover } from 'antd';
import type { ReactNode } from 'react';
import { type WaterfallMetric, waterfallStartMs } from '../../data/network-columns';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { isPreservedUnknown, PRESERVED_UNKNOWN_LABEL } from '../../data/request-state';
import type { ComputedTimings } from '../../data/timing-phases';
import { barColors } from '../../data/waterfall-colors';
import {
  barLabels,
  computeRowTimingPhases,
  type DurationBarLayout,
  durationBarLayout,
  timelineBarLayout,
  type TimelineBarLayout,
  timelineMetricLabel,
} from '../../data/waterfall-geometry';
import { WaterfallLivePopover } from './WaterfallLivePopover';
import { WaterfallTimingPopover } from './WaterfallTimingPopover';

/** How the Waterfall column maps a row to a bar. `t0` is the shared timeline
 * zero (the first request's issue time) — common to both modes because the
 * hover popover reports each row's absolute position regardless of bar shape.
 * `colPx` (duration mode) is the measured column width — needed to decide
 * whether a value label fits inside its segment, sits outside with a leader,
 * or is dropped. */
export type WaterfallScale = {
  t0: number;
  valuesMode: 'off' | 'always' | 'hover';
  valueFormat: 'relative' | 'timestamp';
  timestampTz: 'local' | 'utc';
  explainValue: boolean;
} & (
  | { mode: 'timeline'; metric: WaterfallMetric; tMax: number }
  | { mode: 'duration'; metric: Extract<WaterfallMetric, 'duration' | 'latency'>; max: number; colPx: number }
);

interface WaterfallBarProps {
  row: InspectorRowWithFires;
  scale: WaterfallScale;
  /** CDP provenance — drives the in-flight popover: with CDP we read the live
   *  request model for a not-yet-finished row, without it we explain the gap. */
  cdpEnhanced: boolean;
  /** Supersession floor (see `CellContext`) — picks the in-flight inline label:
   *  "(unknown)" for a preserved row, "Pending" otherwise. */
  supersededFloorMs: number;
}

/** The Time-column state shown when an in-flight row has no measurable timing
 *  (mirrors the Time/Status cells, so the Waterfall reads the same word). */
const PENDING_LABEL = 'Pending';

function DurationBar({
  layout,
  colors,
  colPx,
  hasPopover,
  valuesMode,
  stateLabel,
}: {
  layout: DurationBarLayout;
  colors: ReturnType<typeof barColors>;
  colPx: number;
  hasPopover: boolean;
  valuesMode: 'off' | 'always' | 'hover';
  /** In-flight-with-no-timing state ("Pending" / "(unknown)"); shown in place of
   *  a misleading "0 ms" duration/latency. */
  stateLabel: string | null;
}) {
  const showLabels = valuesMode !== 'off';
  const trackClass = `dt-waterfall-track dt-waterfall-track--split${
    valuesMode === 'always' ? ' dt-waterfall-track--values-always' : ''
  }`;
  if (stateLabel) {
    // No measurable duration: the bar is a placeholder and the value chip reads
    // the row's state, not "0 ms". No native title (the popover owns the hover).
    return (
      <div className={trackClass}>
        <div
          className="dt-waterfall-bar dt-waterfall-bar--split"
          style={{ left: 0, width: `${layout.widthPct}%`, borderColor: colors.border }}
        />
        {showLabels && <span className="dt-wf-vallabel">{stateLabel}</span>}
      </div>
    );
  }
  const labels = barLabels(layout, colPx);
  return (
    <div className={trackClass} title={hasPopover ? undefined : `${labels.latency.text} latency`}>
      <div
        className="dt-waterfall-bar dt-waterfall-bar--split"
        style={{ left: 0, width: `${layout.widthPct}%`, borderColor: colors.border }}
      >
        <span className="dt-wf-seg" style={{ width: `${layout.waitPct}%`, background: colors.waiting }}>
          {showLabels && labels.latency.inside && <span className="dt-wf-inlabel">{labels.latency.text}</span>}
        </span>
        <span className="dt-wf-seg" style={{ width: `${100 - layout.waitPct}%`, background: colors.download }}>
          {showLabels && labels.download.placement === 'inside' && (
            <span className="dt-wf-inlabel">{labels.download.text}</span>
          )}
        </span>
      </div>
      {showLabels && labels.download.placement === 'outside' && (
        <span className="dt-wf-outlabel" style={{ left: `${layout.widthPct}%` }}>
          <span className="dt-wf-leader" aria-hidden="true" />
          {labels.download.text}
        </span>
      )}
    </div>
  );
}

function segmentClass(seg: TimelineBarLayout['segments'][number]): string {
  const cls = ['dt-waterfall-segment'];
  if (seg.tall) cls.push('dt-waterfall-segment--tall');
  // `send` keeps its slot (so later phases stay positioned) but draws empty:
  // the browser doesn't paint a Request-sent bar in the waterfall.
  if (seg.key !== 'send') cls.push(`dt-wf-fill--${seg.key}`);
  return cls.join(' ');
}

function RainbowBar({
  layout,
  title,
  metricLabel,
  valuesAlways,
}: {
  layout: TimelineBarLayout;
  title: string | undefined;
  metricLabel: string | null;
  valuesAlways: boolean;
}) {
  // With per-phase segments the segments ARE the bar, so the plain muted fill
  // must drop out — otherwise it shows through the vertical gaps around the
  // thinner connection-setup phases. The fill stays only for the empty/pending
  // bar (no timing yet).
  const barClass = layout.segments.length > 0 ? 'dt-waterfall-bar dt-waterfall-bar--phased' : 'dt-waterfall-bar';
  const trackClass = `dt-waterfall-track${valuesAlways ? ' dt-waterfall-track--values-always' : ''}`;
  return (
    <div className={trackClass} title={title}>
      <div className={barClass} style={{ left: `${layout.leftPct}%`, width: `${layout.widthPct}%` }}>
        {layout.segments.map((seg) => (
          <span key={seg.key} className={segmentClass(seg)} style={{ width: `${seg.pct}%` }} />
        ))}
      </div>
      {metricLabel && <span className="dt-wf-vallabel">{metricLabel}</span>}
    </div>
  );
}

function bar(row: InspectorRowWithFires, scale: WaterfallScale, timing: ComputedTimings | null, stateLabel: string | null) {
  if (scale.mode === 'timeline') {
    return (
      <RainbowBar
        layout={timelineBarLayout(row, scale.t0, scale.tMax, timing)}
        // No native tooltip: a timed row's hover is the rich popover, and an
        // in-flight row's is the live popover — a native title would double up.
        title={undefined}
        metricLabel={
          scale.valuesMode === 'off'
            ? null
            : // An in-flight row with no timing reads its state ("Pending" /
              // "(unknown)") in place of an absent or misleading metric value.
              (stateLabel ??
                timelineMetricLabel(row, scale.metric, scale.t0, timing, scale.valueFormat, scale.timestampTz))
        }
        valuesAlways={scale.valuesMode === 'always'}
      />
    );
  }
  return (
    <DurationBar
      layout={durationBarLayout(row, scale.max)}
      colors={barColors(row.lifecycle.resourceType)}
      colPx={scale.colPx}
      hasPopover={timing != null}
      valuesMode={scale.valuesMode}
      stateLabel={stateLabel}
    />
  );
}

export function WaterfallBar({ row, scale, cdpEnhanced, supersededFloorMs }: WaterfallBarProps) {
  // Rich hover breakdown when we have real phase data; otherwise the bar keeps
  // a plain native tooltip. While the row streams, this carries a live Content
  // Download leg so the bar, inline value, and popover all grow together.
  const timingDetail = computeRowTimingPhases(row);
  // An in-flight row with no measurable timing has no metric value to print, so
  // the bar reads its state instead — the same word the Time column shows.
  const inFlightNoTiming = timingDetail == null && row.lifecycle.completedAtMs == null;
  const stateLabel = inFlightNoTiming
    ? isPreservedUnknown(row.lifecycle, supersededFloorMs)
      ? PRESERVED_UNKNOWN_LABEL
      : PENDING_LABEL
    : null;
  const track = bar(row, scale, timingDetail, stateLabel);

  let content: ReactNode = null;
  if (timingDetail) {
    // Position of this row's queue moment on the shared timeline (`t0` is the
    // earliest request's issue time in view, so this is never negative).
    const queuedAtMs = Math.max(waterfallStartMs(row.lifecycle) - scale.t0, 0);
    // The duration bar's two tones, so the popover bands match the hovered bar;
    // the timeline (rainbow) bar colors each phase itself, so it carries none.
    const bandColors = scale.mode === 'duration' ? barColors(row.lifecycle.resourceType) : undefined;
    content = (
      <WaterfallTimingPopover
        data={timingDetail}
        metric={scale.metric}
        queuedAtMs={queuedAtMs}
        explain={scale.explainValue}
        bandColors={bandColors && { waiting: bandColors.waiting, download: bandColors.download }}
        unfinished={row.lifecycle.completedAtMs == null}
      />
    );
  } else if (row.lifecycle.completedAtMs == null) {
    // No HAR phases yet, but the request is still in flight — a pending or a
    // post-navigation "(unknown)" row. The popover reads the live request model
    // (CDP) the way the host does, or explains the gap when CDP is off.
    content = <WaterfallLivePopover row={row} t0={scale.t0} cdpEnhanced={cdpEnhanced} />;
  }

  if (!content) return track;

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="left"
      arrow={false}
      mouseEnterDelay={0.25}
      overlayClassName="dt-morefilters-popover dt-waterfall-pop-overlay"
    >
      {/* antd attaches the hover ref + handlers to this child via
          cloneElement, so it must be a DOM element — the bar itself is a
          function component (RainbowBar / DurationBar) that wouldn't forward
          them, which silently killed the hover trigger. */}
      <div className="dt-waterfall-celltrigger">{track}</div>
    </Popover>
  );
}
