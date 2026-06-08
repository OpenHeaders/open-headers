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
import { type ConnectionOpener, connectionOpenerFor } from '../../data/connection-openers';
import { type WaterfallMetric, waterfallSortValue, waterfallStartMs } from '../../data/network-columns';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { extractName } from './formatters';
import {
  classifyRequestState,
  effectiveStatusCode,
  isPreservedUnknown,
  PRESERVED_UNKNOWN_LABEL,
  statusCellText,
  type SupersessionAnchor,
} from '../../data/request-state';
import { computeTimingLadder, type TimingLadder } from '../../data/timing-ladder';
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
import type { DevpanelNetworkWaterfallPopoverLayoutSetting } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { WaterfallTerminal } from './timing-popover-model';
import { WaterfallLivePopover } from './WaterfallLivePopover';
import { WaterfallTimingPopover } from './WaterfallTimingPopover';
import { WaterfallTimingPopoverHorizontal } from './WaterfallTimingPopoverHorizontal';

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
  /** Orientation preference for the hover timing popover; `auto` resolves
   *  against `panelPx`. Both orientations render the identical ladder. */
  popoverLayout: DevpanelNetworkWaterfallPopoverLayoutSetting;
  /** Measured panel width — drives the `auto` popover orientation (a wide,
   *  bottom-docked panel → horizontal; a narrow, side-docked one → vertical). */
  panelPx: number;
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
  /** Supersession anchor (see `CellContext`) — picks the in-flight inline label:
   *  "(unknown)" for a preserved row, "Pending" otherwise. */
  superseded: SupersessionAnchor;
  /** Connection id → opener, so a reused-connection row can name the request
   *  that opened its socket in the popover. */
  connectionOpeners: ReadonlyMap<string, ConnectionOpener>;
}

/** The Time-column state shown when an in-flight row has no measurable timing
 *  (mirrors the Time/Status cells, so the Waterfall reads the same word). */
const PENDING_LABEL = 'Pending';

/** Panel width at/above which the `auto` popover layout flips to horizontal — a
 *  wide (bottom-docked) panel has the room to lay the ladder on the X axis; a
 *  narrower (side-docked) one stays vertical. Tuned against live dock widths. */
export const HORIZONTAL_POPOVER_MIN_PX = 720;

/** Resolve the popover orientation: an explicit choice is honored as-is; `auto`
 *  picks by the measured panel width. */
export function resolvePopoverLayout(
  setting: DevpanelNetworkWaterfallPopoverLayoutSetting,
  panelPx: number,
): 'vertical' | 'horizontal' {
  if (setting !== 'auto') return setting;
  return panelPx >= HORIZONTAL_POPOVER_MIN_PX ? 'horizontal' : 'vertical';
}

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

/**
 * Outcome marker for a terminal row whose breakdown carries no response phase —
 * blocked before the wire, or a wire failure / cancel before any response. The
 * label mirrors the Status cell so the two never disagree; the popover swaps the
 * fabricated Response / Ended instants for it. `undefined` for any row that did
 * reach a response (success, redirect, 4xx/5xx, cache, mid-body failure), which
 * carries a real `wait` / `receive` phase.
 */
export function noResponseTerminal(row: InspectorRowWithFires, ladder: TimingLadder): WaterfallTerminal | undefined {
  if (ladder.responseMs != null) return undefined; // a response arrived
  const kind = classifyRequestState(row.lifecycle).kind;
  if (kind !== 'blocked' && kind !== 'failed') return undefined;
  // Phase-aware detail: a request that actually did any network step (a `onWire`
  // rung elapsed) reached the network, then got no response; one with only
  // local scheduling / stalled time died before any wire activity.
  const reachedNetwork = ladder.rungs.some((r) => r.onWire && r.state.kind === 'elapsed');
  const detail = reachedNetwork ? 'no response received' : 'never reached the network';
  return { label: statusCellText(row.lifecycle), detail };
}

/**
 * The full timing ladder for the popover, or `null` when there is no meaningful
 * timing yet (`hasTiming` mirrors the inline bar, so the popover appears exactly
 * when the bar has data). `reachedResponse` is read from the lifecycle status —
 * not the timings, since a blocked row's `wait` / `receive` are `0`, not absent.
 */
function buildLadder(row: InspectorRowWithFires, hasTiming: boolean): TimingLadder | null {
  if (!hasTiming) return null;
  const har = currentHarEntry(row.lifecycle);
  if (har == null) return null;
  const lc = row.lifecycle;
  // Live Content Download while streaming (duration − latency) — the same split
  // the Time column and the duration bar grow by, before the terminal HAR lands.
  const streaming = lc.completedAtMs == null && lc.lastActivityAtMs != null;
  const liveReceiveMs = streaming
    ? Math.max(waterfallSortValue(row, 'duration') - waterfallSortValue(row, 'latency'), 0)
    : undefined;
  return computeTimingLadder(har, {
    reachedResponse: (effectiveStatusCode(lc) ?? 0) > 0,
    isHttps: lc.url.startsWith('https:'),
    liveReceiveMs,
  });
}

export function WaterfallBar({ row, scale, cdpEnhanced, superseded, connectionOpeners }: WaterfallBarProps) {
  // Rich hover breakdown when we have real phase data; otherwise the bar keeps
  // a plain native tooltip. While the row streams, this carries a live Content
  // Download leg so the bar, inline value, and popover all grow together.
  const timingDetail = computeRowTimingPhases(row);
  // An in-flight row with no measurable timing has no metric value to print, so
  // the bar reads its state instead — the same word the Time column shows.
  const inFlightNoTiming = timingDetail == null && row.lifecycle.completedAtMs == null;
  const stateLabel = inFlightNoTiming
    ? isPreservedUnknown(row.lifecycle, superseded)
      ? PRESERVED_UNKNOWN_LABEL
      : PENDING_LABEL
    : null;
  const track = bar(row, scale, timingDetail, stateLabel);

  // The full honest breakdown for the popover (all eight rungs + explicit
  // states). Built from the same HAR shell `timingDetail` reads, so the popover
  // is present exactly when the inline bar has timing. `reachedResponse` comes
  // from the lifecycle status (not the timings — a blocked row's wait/receive
  // are `0`, not absent); the live download override feeds an in-flight row.
  const ladder = buildLadder(row, timingDetail != null);

  // One ladder, two views: the resolved orientation switches only the final
  // renderer — both consume the identical ladder + props, so they can't drift.
  const layout = resolvePopoverLayout(scale.popoverLayout, scale.panelPx);

  let content: ReactNode = null;
  if (ladder) {
    // Position of this row's queue moment on the shared timeline (`t0` is the
    // earliest request's issue time in view, so this is never negative).
    const queuedAtMs = Math.max(waterfallStartMs(row.lifecycle) - scale.t0, 0);
    // Reused-connection attribution: name the request that opened this socket.
    const opener = connectionOpenerFor(row, connectionOpeners);
    const Popover_ = layout === 'horizontal' ? WaterfallTimingPopoverHorizontal : WaterfallTimingPopover;
    content = (
      <Popover_
        ladder={ladder}
        metric={scale.metric}
        queuedAtMs={queuedAtMs}
        explain={scale.explainValue}
        unfinished={row.lifecycle.completedAtMs == null}
        terminal={noResponseTerminal(row, ladder)}
        reusedOpener={opener ? extractName(opener.url).name : undefined}
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
      // The wide horizontal ladder drops below the row; the vertical ladder and
      // the in-flight live popover sit to the left where the bar has room.
      placement={ladder && layout === 'horizontal' ? 'bottom' : 'left'}
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
