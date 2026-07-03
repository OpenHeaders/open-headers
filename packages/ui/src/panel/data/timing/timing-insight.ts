/**
 * Heuristic interpretation of timing phases.
 *
 * Chrome's panel shows the raw numbers and lets users do the diagnosis
 * themselves. We add a one-line "bottleneck" callout that picks the
 * dominant phase (largest % of total) and attaches a short explanation
 * + a "what to look at next" hint scoped to that phase.
 *
 * Plus a `warnings` list — phases that are above a "this is unusually
 * slow" threshold even when they're not the single biggest contributor.
 * Both lists are derived; the view renders them as-is.
 */

import type { TimingRungKey } from './timing-ladder';

/** The minimal shape the insights read — one elapsed ladder rung. Decoupled from
 *  any full phase/ladder type so the insights work off the popover's model and
 *  the legacy phases alike. */
export interface ElapsedRung {
  key: TimingRungKey;
  label: string;
  ms: number;
}

interface PhaseDiagnosis {
  /** What this phase represents in user-facing language. */
  what: string;
  /** Actionable next-step hint scoped to this phase. */
  hint: string;
  /** ms threshold above which this phase is "unusually slow" even when not dominant. */
  warnAboveMs: number;
}

const PHASE_DIAGNOSIS: Record<TimingRungKey, PhaseDiagnosis> = {
  queueing: {
    what: 'Request scheduler held this request',
    hint: 'Too many concurrent requests competing for slots, or low priority.',
    warnAboveMs: 50,
  },
  stalled: {
    what: 'Waiting for an available connection',
    hint: 'Connection-pool limit, proxy negotiation, or HTTP/1.1 head-of-line blocking.',
    warnAboveMs: 50,
  },
  dns: {
    what: 'DNS lookup',
    hint: 'Affects only the first request to this domain. Consider DNS prefetch.',
    warnAboveMs: 100,
  },
  connect: {
    what: 'TCP handshake to the server',
    hint: 'New connection — keep-alive or HTTP/2/3 multiplexing reuses one across requests.',
    warnAboveMs: 300,
  },
  ssl: {
    what: 'TLS handshake',
    hint: 'Reduced by session resumption / 0-RTT (HTTP/3).',
    warnAboveMs: 200,
  },
  send: {
    what: 'Uploading the request body',
    hint: 'Large request body or slow upstream — usually only visible on POST/PUT.',
    warnAboveMs: 200,
  },
  wait: {
    what: 'Server time to first byte',
    hint: 'Backend processing. Look for backend timing in Server-Timing or DB query logs.',
    warnAboveMs: 500,
  },
  receive: {
    what: 'Downloading the response payload',
    hint: 'Payload size or CDN throughput — check effective transfer rate.',
    warnAboveMs: 1000,
  },
};

export interface TimingInsight {
  phase: TimingRungKey;
  label: string;
  ms: number;
  percent: number;
  what: string;
  hint: string;
}

/**
 * Picks the single dominant phase ("bottleneck"). Only returns a result
 * when one phase actually dominates — defined as ≥ 30% of total or being
 * at least 2× the runner-up. Below those bars there's no useful single
 * answer, so we return null rather than picking a phase that's only
 * marginally biggest.
 */
export function findBottleneck(phases: readonly ElapsedRung[], totalMs: number): TimingInsight | null {
  if (phases.length === 0 || totalMs <= 0) return null;
  const sorted = phases.slice().sort((a, b) => b.ms - a.ms);
  const top = sorted[0];
  const runnerUp = sorted[1]?.ms ?? 0;
  const percent = (top.ms / totalMs) * 100;
  const dominates = percent >= 30 || top.ms >= runnerUp * 2;
  if (!dominates) return null;
  const diag = PHASE_DIAGNOSIS[top.key];
  return {
    phase: top.key,
    label: top.label,
    ms: top.ms,
    percent,
    what: diag.what,
    hint: diag.hint,
  };
}

/**
 * Phases above their per-phase "unusually slow" threshold. Excludes the
 * bottleneck (already covered by findBottleneck) so we never show the
 * same phase twice.
 */
export function findWarnings(
  phases: readonly ElapsedRung[],
  excludeKey: TimingRungKey | null,
): readonly TimingInsight[] {
  const out: TimingInsight[] = [];
  for (const p of phases) {
    if (p.key === excludeKey) continue;
    const diag = PHASE_DIAGNOSIS[p.key];
    if (p.ms < diag.warnAboveMs) continue;
    out.push({
      phase: p.key,
      label: p.label,
      ms: p.ms,
      percent: 0,
      what: diag.what,
      hint: diag.hint,
    });
  }
  return out;
}

export interface TransferRate {
  bytes: number;
  ms: number;
  bytesPerSecond: number;
  formatted: string;
}

/**
 * Effective transfer rate for the Content-Download phase. Returns null
 * when we can't compute it (no body size, no receive timing). Used by
 * the view to surface "388 ms for 240 KB ≈ 620 KB/s" inline.
 */
export function computeTransferRate(receiveMs: number, bytes: number | null | undefined): TransferRate | null {
  if (receiveMs <= 0) return null;
  if (typeof bytes !== 'number' || bytes <= 0) return null;
  const bytesPerSecond = bytes / (receiveMs / 1000);
  return { bytes, ms: receiveMs, bytesPerSecond, formatted: formatRate(bytesPerSecond) };
}

function formatRate(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}
