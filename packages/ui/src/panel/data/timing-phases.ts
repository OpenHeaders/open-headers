/**
 * Timing-phase computation.
 *
 * Two HAR-spec quirks make raw rendering of `entry.timings` wrong, and
 * folding them into the view means every section + the waterfall has to
 * re-derive the same numbers (and at least one of them will drift):
 *
 *  1. HAR 1.2 says `timings.connect` INCLUDES `timings.ssl`. Chrome's
 *     panel subtracts SSL out for "Initial connection" so the two
 *     adjacent rows / bars don't double-count the handshake. Without
 *     this, our displayed phases sum higher than HAR's `time` total.
 *  2. Chrome's HAR exporter emits a `_blocked_queueing` extension that
 *     splits `blocked` into Resource-Scheduler queueing vs raw Stalled.
 *     Without that split everything blocked-ish gets one row.
 *
 * `computeTimingPhases` applies both rules and returns a canonical list
 * the view renders 1:1 — no math, no field plucking, no per-phase
 * conditional logic in the JSX.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';

export type TimingGroup = 'scheduling' | 'connection' | 'transfer';

export type TimingPhaseKey =
  | 'queueing'
  | 'stalled'
  | 'dns'
  | 'connect'
  | 'ssl'
  | 'send'
  | 'wait'
  | 'receive';

export interface TimingPhase {
  key: TimingPhaseKey;
  label: string;
  group: TimingGroup;
  ms: number;
  color: string;
}

export interface ComputedTimings {
  phases: readonly TimingPhase[];
  byGroup: Readonly<Record<TimingGroup, readonly TimingPhase[]>>;
  totalMs: number;
}

interface PhaseMeta {
  label: string;
  group: TimingGroup;
  color: string;
}

const PHASE_META: Record<TimingPhaseKey, PhaseMeta> = {
  queueing: { label: 'Queueing', group: 'scheduling', color: '#cccccc' },
  stalled: { label: 'Stalled', group: 'connection', color: '#a0a0a0' },
  dns: { label: 'DNS Lookup', group: 'connection', color: '#6ecba4' },
  connect: { label: 'Initial connection', group: 'connection', color: '#f0a73c' },
  ssl: { label: 'SSL', group: 'connection', color: '#c689d6' },
  send: { label: 'Request sent', group: 'transfer', color: '#79b6e8' },
  wait: { label: 'Waiting for server', group: 'transfer', color: '#79d279' },
  receive: { label: 'Content Download', group: 'transfer', color: '#5c9aef' },
};

const ORDER: readonly TimingPhaseKey[] = [
  'queueing',
  'stalled',
  'dns',
  'connect',
  'ssl',
  'send',
  'wait',
  'receive',
];

function positive(x: number | undefined | null): number {
  return typeof x === 'number' && x > 0 ? x : 0;
}

const EMPTY_BY_GROUP: Readonly<Record<TimingGroup, readonly TimingPhase[]>> = {
  scheduling: [],
  connection: [],
  transfer: [],
};

export function computeTimingPhases(har: InspectorHarEntry): ComputedTimings | null {
  if (!har.timings) return null;
  const t = har.timings;

  const blocked = positive(t.blocked);
  const queueing = positive(t._blocked_queueing);
  // When the Chrome extension is absent, all of `blocked` is Stalled.
  // When present and consistent, the remainder after subtracting
  // queueing is Stalled.
  const stalled = Math.max(0, blocked - queueing);

  const rawConnect = positive(t.connect);
  const sslMs = positive(t.ssl);
  // `connect` includes `ssl` per HAR 1.2 — clamp at 0 to defend against
  // exporters that report `ssl > connect` (rare but seen on aborted
  // handshakes).
  const connect = Math.max(0, rawConnect - sslMs);

  const ms: Record<TimingPhaseKey, number> = {
    queueing,
    stalled,
    dns: positive(t.dns),
    connect,
    ssl: sslMs,
    send: positive(t.send),
    wait: positive(t.wait),
    receive: positive(t.receive),
  };

  const phases: TimingPhase[] = [];
  for (const key of ORDER) {
    const value = ms[key];
    if (value <= 0) continue;
    const meta = PHASE_META[key];
    phases.push({ key, label: meta.label, group: meta.group, color: meta.color, ms: value });
  }

  if (phases.length === 0) return null;

  const byGroup: Record<TimingGroup, TimingPhase[]> = { scheduling: [], connection: [], transfer: [] };
  for (const p of phases) byGroup[p.group].push(p);

  // HAR `time` is authoritative when present — it's the canonical
  // start-to-finish wall-clock. Fall back to sum-of-phases otherwise.
  const totalMs =
    typeof har.time === 'number' && har.time >= 0 ? har.time : phases.reduce((sum, p) => sum + p.ms, 0);

  return { phases, byGroup, totalMs };
}

// Exported for default-state callers that want the empty groups shape.
export const EMPTY_TIMING_GROUPS = EMPTY_BY_GROUP;
