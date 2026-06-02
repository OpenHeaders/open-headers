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
 *     left edge (zero-aligned) and its width is the full duration over
 *     the largest duration in view. The bar is split in two at the
 *     first-response point: a light "waiting" segment (latency) and a
 *     darker "download" segment — two shades, not the phase rainbow.
 *     The latency and download values print after the bar. Both Duration
 *     and Latency draw the same bar; only the sort order differs.
 *
 * The per-row value comes from the same `waterfallSortValue` the sort
 * uses, so the bar a row draws and the order it sorts into always agree.
 */

import { Popover } from 'antd';
import type { ReactNode } from 'react';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { type WaterfallMetric, waterfallSortValue } from '../../data/network-columns';
import { currentHarEntry, type InspectorRowWithFires, lifecycleDurationMs } from '../../data/inspector-row-projection';
import { computeTimingPhases } from '../../data/timing-phases';
import { WaterfallTimingPopover } from './WaterfallTimingPopover';

/** How the Waterfall column maps a row to a bar. `colPx` is the measured
 * column width — needed to decide whether a value label fits inside its
 * segment, sits outside with a leader, or is dropped (the browser measures
 * the same thing on its canvas). */
export type WaterfallScale =
  | { mode: 'timeline'; metric: WaterfallMetric; t0: number; tMax: number }
  | { mode: 'duration'; metric: Extract<WaterfallMetric, 'duration' | 'latency'>; max: number; colPx: number };

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

const ALL_PHASES: readonly TimingsKey[] = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'];

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

function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Dot-and-leader length (px) drawn between the bar end and an outside label. */
const LEADER_PX = 12;

/** Rough pixel width of a 10px-font label — enough to decide inside/outside fit. */
function estLabelPx(label: string): number {
  return label.length * 6.2 + 4;
}

/**
 * Resource-type bar palette for the simplified (Duration / Latency) bar —
 * soft pastels keyed by type [hue, saturation, lightness]. `download` is the
 * base shade, `waiting` a touch lighter, `border` a darker outline so the
 * pale fills stay legible.
 */
const TYPE_HSL: Record<string, [number, number, number]> = {
  document: [215, 100, 80],
  stylesheet: [272, 64, 80],
  script: [31, 100, 80],
  xhr: [53, 100, 80],
  image: [90, 50, 80],
  media: [90, 50, 80],
  font: [8, 100, 80],
  websocket: [0, 0, 85],
  wasm: [262, 60, 80],
  other: [0, 0, 85],
};

function typeKey(resourceType: string | undefined): string {
  const rt = (resourceType ?? '').toLowerCase();
  if (rt === 'main_frame' || rt === 'sub_frame' || rt === 'document') return 'document';
  if (rt === 'xmlhttprequest' || rt === 'fetch' || rt === 'xhr') return 'xhr';
  if (rt === 'js') return 'script';
  if (rt === 'css') return 'stylesheet';
  if (rt === 'img') return 'image';
  return TYPE_HSL[rt] ? rt : 'other';
}

function barColors(resourceType: string | undefined): { waiting: string; download: string; border: string } {
  const [h, s, l] = TYPE_HSL[typeKey(resourceType)];
  return {
    download: `hsl(${h} ${s}% ${l}%)`,
    waiting: `hsl(${h} ${s}% ${Math.min(Math.round(l * 1.1), 96)}%)`,
    border: `hsl(${h} ${Math.round(s / 2)}% ${Math.max(l - 20, 0)}%)`,
  };
}

function timelineTrack(
  row: InspectorRowWithFires,
  scale: Extract<WaterfallScale, { mode: 'timeline' }>,
  hasPopover: boolean,
): ReactNode {
  const lc = row.lifecycle;
  const timings = currentHarEntry(lc)?.timings;
  const span = Math.max(scale.tMax - scale.t0, 1);
  const start = Math.max(lc.startedAtMs - scale.t0, 0);
  const duration = lifecycleDurationMs(lc) ?? 1;
  const leftPct = (start / span) * 100;
  const widthPct = Math.max((duration / span) * 100, 0.25);
  const phases = timings ? positivePhases(timings, ALL_PHASES) : [];
  const phaseTotal = phases.reduce((s, p) => s + p.ms, 0);

  return (
    <div className="dt-waterfall-track" title={hasPopover ? undefined : `${Math.round(duration)} ms`}>
      <div className="dt-waterfall-bar" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
        {phaseTotal > 0
          ? phases.map((p) => (
              <span
                key={p.key}
                className="dt-waterfall-segment"
                style={{ width: `${(p.ms / phaseTotal) * 100}%`, background: PHASE_COLORS[p.key] ?? '#999' }}
              />
            ))
          : null}
      </div>
    </div>
  );
}

function durationTrack(
  row: InspectorRowWithFires,
  scale: Extract<WaterfallScale, { mode: 'duration' }>,
  hasPopover: boolean,
): ReactNode {
  const duration = Math.max(waterfallSortValue(row, 'duration'), 0);
  const latency = Math.max(waterfallSortValue(row, 'latency'), 0);
  const download = Math.max(duration - latency, 0);
  const widthPct = Math.max((duration / Math.max(scale.max, 1)) * 100, 0.25);
  const waitPct = duration > 0 ? Math.min((latency / duration) * 100, 100) : 100;
  const colors = barColors(row.lifecycle.resourceType);

  // Label placement, the way the browser does it: a value prints inside its
  // segment when it fits; the download value otherwise sits past the bar end
  // with a dot-and-leader; if there's no room there either, it's dropped.
  const colPx = scale.colPx;
  const barPx = (widthPct / 100) * colPx;
  const waitingPx = (waitPct / 100) * barPx;
  const downloadPx = Math.max(barPx - waitingPx, 0);
  const latLabel = formatMs(latency);
  const dlLabel = formatMs(download);
  const measured = colPx > 0;
  const latInside = measured && estLabelPx(latLabel) <= waitingPx;
  const showDownload = download >= 0.5;
  let dlPlacement: 'inside' | 'outside' | 'none' = 'none';
  if (measured && showDownload) {
    if (estLabelPx(dlLabel) <= downloadPx) dlPlacement = 'inside';
    else if (barPx + LEADER_PX + estLabelPx(dlLabel) <= colPx) dlPlacement = 'outside';
  }

  return (
    <div
      className="dt-waterfall-track dt-waterfall-track--split"
      title={hasPopover ? undefined : `${formatMs(latency)} latency`}
    >
      <div
        className="dt-waterfall-bar dt-waterfall-bar--split"
        style={{ left: 0, width: `${widthPct}%`, borderColor: colors.border }}
      >
        <span className="dt-wf-seg" style={{ width: `${waitPct}%`, background: colors.waiting }}>
          {latInside && <span className="dt-wf-inlabel">{latLabel}</span>}
        </span>
        <span className="dt-wf-seg" style={{ width: `${100 - waitPct}%`, background: colors.download }}>
          {dlPlacement === 'inside' && <span className="dt-wf-inlabel">{dlLabel}</span>}
        </span>
      </div>
      {dlPlacement === 'outside' && (
        <span className="dt-wf-outlabel" style={{ left: `${widthPct}%` }}>
          <span className="dt-wf-leader" aria-hidden="true" />
          {dlLabel}
        </span>
      )}
    </div>
  );
}

export function WaterfallBar({ row, scale }: WaterfallBarProps) {
  const har = currentHarEntry(row.lifecycle);
  // Rich hover breakdown when we have real phase data; otherwise the bar
  // keeps a plain native tooltip with its value.
  const timingDetail = har?.timings ? computeTimingPhases(har) : null;

  const track =
    scale.mode === 'timeline'
      ? timelineTrack(row, scale, timingDetail != null)
      : durationTrack(row, scale, timingDetail != null);

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
