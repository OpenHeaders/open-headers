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
import { type WaterfallMetric } from '../../data/network-columns';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { type ComputedTimings, computeTimingPhases } from '../../data/timing-phases';
import { barColors } from '../../data/waterfall-colors';
import {
  barLabels,
  type DurationBarLayout,
  durationBarLayout,
  timelineBarLayout,
  type TimelineBarLayout,
} from '../../data/waterfall-geometry';
import { WaterfallTimingPopover } from './WaterfallTimingPopover';

/** How the Waterfall column maps a row to a bar. `colPx` (duration mode) is the
 * measured column width — needed to decide whether a value label fits inside
 * its segment, sits outside with a leader, or is dropped. */
export type WaterfallScale =
  | { mode: 'timeline'; metric: WaterfallMetric; t0: number; tMax: number }
  | { mode: 'duration'; metric: Extract<WaterfallMetric, 'duration' | 'latency'>; max: number; colPx: number };

interface WaterfallBarProps {
  row: InspectorRowWithFires;
  scale: WaterfallScale;
}

function DurationBar({
  layout,
  colors,
  colPx,
  hasPopover,
}: {
  layout: DurationBarLayout;
  colors: ReturnType<typeof barColors>;
  colPx: number;
  hasPopover: boolean;
}) {
  const labels = barLabels(layout, colPx);
  return (
    <div
      className="dt-waterfall-track dt-waterfall-track--split"
      title={hasPopover ? undefined : `${labels.latency.text} latency`}
    >
      <div
        className="dt-waterfall-bar dt-waterfall-bar--split"
        style={{ left: 0, width: `${layout.widthPct}%`, borderColor: colors.border }}
      >
        <span className="dt-wf-seg" style={{ width: `${layout.waitPct}%`, background: colors.waiting }}>
          {labels.latency.inside && <span className="dt-wf-inlabel">{labels.latency.text}</span>}
        </span>
        <span className="dt-wf-seg" style={{ width: `${100 - layout.waitPct}%`, background: colors.download }}>
          {labels.download.placement === 'inside' && <span className="dt-wf-inlabel">{labels.download.text}</span>}
        </span>
      </div>
      {labels.download.placement === 'outside' && (
        <span className="dt-wf-outlabel" style={{ left: `${layout.widthPct}%` }}>
          <span className="dt-wf-leader" aria-hidden="true" />
          {labels.download.text}
        </span>
      )}
    </div>
  );
}

function RainbowBar({ layout, title }: { layout: TimelineBarLayout; title: string | undefined }) {
  return (
    <div className="dt-waterfall-track" title={title}>
      <div className="dt-waterfall-bar" style={{ left: `${layout.leftPct}%`, width: `${layout.widthPct}%` }}>
        {layout.segments.map((seg) => (
          <span key={seg.key} className="dt-waterfall-segment" style={{ width: `${seg.pct}%`, background: seg.color }} />
        ))}
      </div>
    </div>
  );
}

function bar(row: InspectorRowWithFires, scale: WaterfallScale, timing: ComputedTimings | null) {
  if (scale.mode === 'timeline') {
    return (
      <RainbowBar
        layout={timelineBarLayout(row, scale.t0, scale.tMax, timing)}
        title={timing ? undefined : 'pending'}
      />
    );
  }
  return (
    <DurationBar
      layout={durationBarLayout(row, scale.max)}
      colors={barColors(row.lifecycle.resourceType)}
      colPx={scale.colPx}
      hasPopover={timing != null}
    />
  );
}

export function WaterfallBar({ row, scale }: WaterfallBarProps) {
  const har = currentHarEntry(row.lifecycle);
  // Rich hover breakdown when we have real phase data; otherwise the bar keeps
  // a plain native tooltip.
  const timingDetail = har?.timings ? computeTimingPhases(har) : null;
  const track = bar(row, scale, timingDetail);

  if (!timingDetail) return track;

  return (
    <Popover
      content={<WaterfallTimingPopover data={timingDetail} metric={scale.metric} />}
      trigger="hover"
      placement="left"
      arrow={false}
      mouseEnterDelay={0.25}
      overlayClassName="dt-morefilters-popover dt-waterfall-pop-overlay"
    >
      {track}
    </Popover>
  );
}
