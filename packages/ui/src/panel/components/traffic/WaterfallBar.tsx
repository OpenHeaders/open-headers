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
import { type WaterfallMetric, waterfallStartMs } from '../../data/network-columns';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
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
}

function DurationBar({
  layout,
  colors,
  colPx,
  hasPopover,
  valuesMode,
}: {
  layout: DurationBarLayout;
  colors: ReturnType<typeof barColors>;
  colPx: number;
  hasPopover: boolean;
  valuesMode: 'off' | 'always' | 'hover';
}) {
  const showLabels = valuesMode !== 'off';
  const labels = barLabels(layout, colPx);
  const trackClass = `dt-waterfall-track dt-waterfall-track--split${
    valuesMode === 'always' ? ' dt-waterfall-track--values-always' : ''
  }`;
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

function bar(row: InspectorRowWithFires, scale: WaterfallScale, timing: ComputedTimings | null) {
  if (scale.mode === 'timeline') {
    return (
      <RainbowBar
        layout={timelineBarLayout(row, scale.t0, scale.tMax, timing)}
        title={timing ? undefined : 'pending'}
        metricLabel={
          scale.valuesMode !== 'off'
            ? timelineMetricLabel(row, scale.metric, scale.t0, timing, scale.valueFormat, scale.timestampTz)
            : null
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
    />
  );
}

export function WaterfallBar({ row, scale }: WaterfallBarProps) {
  // Rich hover breakdown when we have real phase data; otherwise the bar keeps
  // a plain native tooltip. While the row streams, this carries a live Content
  // Download leg so the bar, inline value, and popover all grow together.
  const timingDetail = computeRowTimingPhases(row);
  const track = bar(row, scale, timingDetail);

  if (!timingDetail) return track;

  // Position of this row's queue moment on the shared timeline (`t0` is the
  // earliest request's issue time in view, so this is never negative).
  const queuedAtMs = Math.max(waterfallStartMs(row.lifecycle) - scale.t0, 0);

  // The duration bar's two tones, so the popover bands match the hovered bar;
  // the timeline (rainbow) bar colors each phase itself, so it carries none.
  const bandColors = scale.mode === 'duration' ? barColors(row.lifecycle.resourceType) : undefined;

  return (
    <Popover
      content={
        <WaterfallTimingPopover
          data={timingDetail}
          metric={scale.metric}
          queuedAtMs={queuedAtMs}
          explain={scale.explainValue}
          bandColors={bandColors && { waiting: bandColors.waiting, download: bandColors.download }}
          unfinished={row.lifecycle.completedAtMs == null}
        />
      }
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
