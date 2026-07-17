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

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { TimingRungKey } from './timing-ladder';

/** The minimal shape the insights read — one elapsed ladder rung. Decoupled from
 *  any full phase/ladder type so the insights work off the popover's model and
 *  the legacy phases alike. */
export interface ElapsedRung {
  key: TimingRungKey;
  label: string;
  ms: number;
}

interface PhaseCopy {
  /** What this phase represents in user-facing language. */
  what: string;
  /** Actionable next-step hint scoped to this phase. */
  hint: string;
}

/** ms threshold above which each phase is "unusually slow" even when not dominant. */
const PHASE_WARN_ABOVE_MS: Record<TimingRungKey, number> = {
  queueing: 50,
  stalled: 50,
  dns: 100,
  connect: 300,
  ssl: 200,
  send: 200,
  wait: 500,
  receive: 1000,
};

function phaseCopy(t: Translate, key: TimingRungKey): PhaseCopy {
  switch (key) {
    case 'queueing':
      return {
        what: t('panel.inspector.timing.phase.queueing.what'),
        hint: t('panel.inspector.timing.phase.queueing.hint'),
      };
    case 'stalled':
      return {
        what: t('panel.inspector.timing.phase.stalled.what'),
        hint: t('panel.inspector.timing.phase.stalled.hint'),
      };
    case 'dns':
      return { what: t('panel.inspector.timing.phase.dns.what'), hint: t('panel.inspector.timing.phase.dns.hint') };
    case 'connect':
      return {
        what: t('panel.inspector.timing.phase.connect.what'),
        hint: t('panel.inspector.timing.phase.connect.hint'),
      };
    case 'ssl':
      return { what: t('panel.inspector.timing.phase.ssl.what'), hint: t('panel.inspector.timing.phase.ssl.hint') };
    case 'send':
      return { what: t('panel.inspector.timing.phase.send.what'), hint: t('panel.inspector.timing.phase.send.hint') };
    case 'wait':
      return { what: t('panel.inspector.timing.phase.wait.what'), hint: t('panel.inspector.timing.phase.wait.hint') };
    case 'receive':
      return {
        what: t('panel.inspector.timing.phase.receive.what'),
        hint: t('panel.inspector.timing.phase.receive.hint'),
      };
  }
}

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
export function findBottleneck(t: Translate, phases: readonly ElapsedRung[], totalMs: number): TimingInsight | null {
  if (phases.length === 0 || totalMs <= 0) return null;
  const sorted = phases.slice().sort((a, b) => b.ms - a.ms);
  const top = sorted[0];
  const runnerUp = sorted[1]?.ms ?? 0;
  const percent = (top.ms / totalMs) * 100;
  const dominates = percent >= 30 || top.ms >= runnerUp * 2;
  if (!dominates) return null;
  const copy = phaseCopy(t, top.key);
  return {
    phase: top.key,
    label: top.label,
    ms: top.ms,
    percent,
    what: copy.what,
    hint: copy.hint,
  };
}

/**
 * Phases above their per-phase "unusually slow" threshold. Excludes the
 * bottleneck (already covered by findBottleneck) so we never show the
 * same phase twice.
 */
export function findWarnings(
  t: Translate,
  phases: readonly ElapsedRung[],
  excludeKey: TimingRungKey | null,
): readonly TimingInsight[] {
  const out: TimingInsight[] = [];
  for (const p of phases) {
    if (p.key === excludeKey) continue;
    if (p.ms < PHASE_WARN_ABOVE_MS[p.key]) continue;
    const copy = phaseCopy(t, p.key);
    out.push({
      phase: p.key,
      label: p.label,
      ms: p.ms,
      percent: 0,
      what: copy.what,
      hint: copy.hint,
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
