/**
 * WaterfallBar — per-row timing visualization for the Network table.
 *
 * Two visual modes, picked by the active Waterfall metric:
 *
 *   - **timeline** (Start / Response / End time) — the bar is absolutely
 *     positioned inside a `[t0, tMax]` window: left = `startedAtMs - t0`,
 *     width = the lifecycle's duration. Inner phases (blocked / dns /
 *     connect / ssl / send / wait / receive) render as stacked colored
 *     segments matching the Timing detail palette.
 *
 *   - **duration** (Total duration / Latency) — every bar starts at the
 *     left edge (zero-aligned) and its width is the value over the
 *     largest value in view, so lengths compare directly. Latency bars
 *     drop the trailing `receive` phase (they end at the first byte).
 *
 * The per-row value comes from the same `waterfallSortValue` the sort
 * uses, so the bar a row draws and the order it sorts into always agree.
 */

import { Popover } from 'antd';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { type WaterfallMetric, waterfallSortValue } from '../../data/network-columns';
import { currentHarEntry, type InspectorRowWithFires, lifecycleDurationMs } from '../../data/inspector-row-projection';
import { computeTimingPhases } from '../../data/timing-phases';
import { WaterfallTimingPopover } from './WaterfallTimingPopover';

/** How the Waterfall column maps a row to a bar. */
export type WaterfallScale =
  | { mode: 'timeline'; metric: WaterfallMetric; t0: number; tMax: number }
  | { mode: 'duration'; metric: Extract<WaterfallMetric, 'duration' | 'latency'>; max: number };

interface WaterfallBarProps {
  row: InspectorRowWithFires;
  scale: WaterfallScale;
}

const PHASE_COLORS: Record<string, string> = {
  blocked: '#ccc',
  dns: '#6ecba4',
  connect: '#f0a73c',
  ssl: '#c689d6',
  send: '#79b6e8',
  wait: '#79d279',
  receive: '#5c9aef',
};

type TimingsKey = keyof NonNullable<InspectorHarEntry['timings']>;

/** Phases that precede the first response byte — the span a latency bar covers. */
const PRE_RESPONSE_PHASES: readonly TimingsKey[] = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait'];
const ALL_PHASES: readonly TimingsKey[] = [...PRE_RESPONSE_PHASES, 'receive'];

function positivePhases(
  timings: NonNullable<InspectorHarEntry['timings']>,
  order: readonly TimingsKey[],
): Array<{ key: string; ms: number }> {
  const out: Array<{ key: string; ms: number }> = [];
  for (const k of order) {
    const v = timings[k];
    if (typeof v === 'number' && v > 0) out.push({ key: String(k), ms: v });
  }
  return out;
}

export function WaterfallBar({ row, scale }: WaterfallBarProps) {
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);
  const timings = har?.timings;

  let leftPct: number;
  let widthPct: number;
  let phaseOrder: readonly TimingsKey[];
  let title: string;

  if (scale.mode === 'timeline') {
    const span = Math.max(scale.tMax - scale.t0, 1);
    const start = Math.max(lc.startedAtMs - scale.t0, 0);
    const duration = lifecycleDurationMs(lc) ?? 1;
    leftPct = (start / span) * 100;
    widthPct = Math.max((duration / span) * 100, 0.25);
    phaseOrder = ALL_PHASES;
    title = `${Math.round(duration)} ms`;
  } else {
    const value = Math.max(waterfallSortValue(row, scale.metric), 0);
    leftPct = 0;
    widthPct = Math.max((value / Math.max(scale.max, 1)) * 100, 0.25);
    phaseOrder = scale.metric === 'latency' ? PRE_RESPONSE_PHASES : ALL_PHASES;
    title = scale.metric === 'latency' ? `${Math.round(value)} ms latency` : `${Math.round(value)} ms`;
  }

  const phases = timings ? positivePhases(timings, phaseOrder) : [];
  const phaseTotal = phases.reduce((s, p) => s + p.ms, 0);

  // Rich hover breakdown when we have real phase data; otherwise the bar
  // keeps a plain native tooltip with its value.
  const timingDetail = har?.timings ? computeTimingPhases(har) : null;

  const track = (
    <div className="dt-waterfall-track" title={timingDetail ? undefined : title}>
      <div
        className="dt-waterfall-bar"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
        }}
      >
        {phaseTotal > 0
          ? phases.map((p) => (
              <span
                key={p.key}
                className="dt-waterfall-segment"
                style={{
                  width: `${(p.ms / phaseTotal) * 100}%`,
                  background: PHASE_COLORS[p.key] ?? '#999',
                }}
              />
            ))
          : null}
      </div>
    </div>
  );

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
