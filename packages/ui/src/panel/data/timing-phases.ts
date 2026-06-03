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
}

export interface ComputedTimings {
  phases: readonly TimingPhase[];
  byGroup: Readonly<Record<TimingGroup, readonly TimingPhase[]>>;
  totalMs: number;
}

interface PhaseMeta {
  label: string;
  group: TimingGroup;
}

const PHASE_META: Record<TimingPhaseKey, PhaseMeta> = {
  queueing: { label: 'Queueing', group: 'scheduling' },
  stalled: { label: 'Stalled', group: 'connection' },
  dns: { label: 'DNS Lookup', group: 'connection' },
  connect: { label: 'Initial connection', group: 'connection' },
  ssl: { label: 'SSL', group: 'connection' },
  send: { label: 'Request sent', group: 'transfer' },
  wait: { label: 'Waiting for server', group: 'transfer' },
  receive: { label: 'Content Download', group: 'transfer' },
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
  const dnsMs = positive(t.dns);
  // `connect` spans the whole connection setup: it includes `ssl` (HAR 1.2)
  // and, as the browser's HAR exporter emits it, also `dns`. Peel both out
  // so the "Initial connection" row is TCP-only and the phases don't
  // double-count DNS/SSL. Clamp at 0 against exporters that report
  // `ssl > connect` (rare, seen on aborted handshakes).
  const connect = Math.max(0, rawConnect - sslMs - dnsMs);

  const ms: Record<TimingPhaseKey, number> = {
    queueing,
    stalled,
    dns: dnsMs,
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
    phases.push({ key, label: meta.label, group: meta.group, ms: value });
  }

  if (phases.length === 0) return null;

  const byGroup: Record<TimingGroup, TimingPhase[]> = { scheduling: [], connection: [], transfer: [] };
  for (const p of phases) byGroup[p.group].push(p);

  // Sum the (now non-overlapping) phases. We deliberately do NOT use HAR
  // `time`: the browser's exporter computes it as
  // `blocked + dns + connect + send + wait + receive`, but its `connect`
  // already contains `dns`, so HAR `time` double-counts DNS. The phase sum
  // (DNS and SSL peeled out of connect) is the true start-to-finish total.
  const totalMs = phases.reduce((sum, p) => sum + p.ms, 0);

  return { phases, byGroup, totalMs };
}

// Exported for default-state callers that want the empty groups shape.
export const EMPTY_TIMING_GROUPS = EMPTY_BY_GROUP;
