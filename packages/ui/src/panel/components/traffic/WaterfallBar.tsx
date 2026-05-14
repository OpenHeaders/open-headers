/**
 * WaterfallBar — per-row timing visualization, mirroring the Chrome
 * Network tab's waterfall column.
 *
 * Inputs:
 *   - `t0`    absolute wall-clock ms of the earliest visible row
 *             (reference zero of the waterfall)
 *   - `tMax`  absolute wall-clock ms of the latest visible row's
 *             finish time (reference right edge)
 *   - `entry` the row being rendered
 *
 * The bar is absolute-positioned inside a track sized to the
 * `[t0, tMax]` window. Request start is `entry.timestamp - t0` and
 * request end is `start + (entry.duration ?? 0)`. When timings data is
 * available the inner phases (blocked/dns/connect/ssl/send/wait/receive)
 * are rendered as stacked colored segments, matching the color palette
 * used in the Timing detail view.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRequest } from '../../data/types';

interface WaterfallBarProps {
  entry: InspectorRequest;
  t0: number;
  tMax: number;
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

const PHASE_ORDER: Array<keyof NonNullable<InspectorHarEntry['timings']>> = [
  'blocked',
  'dns',
  'connect',
  'ssl',
  'send',
  'wait',
  'receive',
];

function positivePhases(timings: NonNullable<InspectorHarEntry['timings']>): Array<{ key: string; ms: number }> {
  const out: Array<{ key: string; ms: number }> = [];
  for (const k of PHASE_ORDER) {
    const v = timings[k];
    if (typeof v === 'number' && v > 0) out.push({ key: String(k), ms: v });
  }
  return out;
}

export function WaterfallBar({ entry, t0, tMax }: WaterfallBarProps) {
  const span = Math.max(tMax - t0, 1);
  const start = Math.max(entry.timestamp - t0, 0);
  const duration = entry.duration && entry.duration > 0 ? entry.duration : 1;
  const leftPct = (start / span) * 100;
  const widthPct = Math.max((duration / span) * 100, 0.25);

  const timings = entry.harEntry.timings;
  const phases = timings ? positivePhases(timings) : [];
  const phaseTotal = phases.reduce((s, p) => s + p.ms, 0);

  return (
    <div className="dt-waterfall-track" title={`${Math.round(duration)} ms`}>
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
                title={`${p.key}: ${Math.round(p.ms)} ms`}
              />
            ))
          : null}
      </div>
    </div>
  );
}
