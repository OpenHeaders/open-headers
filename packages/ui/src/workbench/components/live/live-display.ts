/**
 * Display helpers for Live Variable / Live Workflow editors + sidebar.
 *
 * Pure functions — no React, no bridge calls. Every surface that needs
 * to render a "last refreshed 3m ago" label, a countdown to next fire,
 * or a status color derives it here so the strings stay in lockstep.
 */

import type { RefreshPolicy } from '@openheaders/core/types';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';

export type LiveStatusLevel = 'green' | 'yellow' | 'red' | 'idle';

/**
 * Format a millisecond gap as a compact human string.
 *   - future → "in 45s" / "in 12m" / "in 3h 42m" / "in 2d 4h"
 *   - past → "5s ago" / "2m ago" / "3h 42m ago" / "2d 4h ago"
 *   - absent → "never"
 *
 * Above the minute boundary the larger unit carries the smaller one
 * alongside (`3h 42m`, `2d 4h`) so a 3h 42m countdown doesn't round
 * down to "3h" and hide 42 minutes of imprecision. Sub-minute values
 * stay single-unit — a "45s 200ms" display would be noise for the
 * user, and second-level precision is already what the surface expects.
 * Zero-minor-unit cases collapse cleanly (`3h 0m` → `3h`, `2d 0h` → `2d`).
 */
export function formatRelativeMs(targetMs: number | null | undefined, nowMs: number = Date.now()): string {
  if (targetMs === null || targetMs === undefined) return 'never';
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const sign = diff < 0 ? 'ago' : 'in';
  let label = '';
  if (abs < 60_000) {
    const n = Math.max(1, Math.floor(abs / 1000));
    label = `${n}s`;
  } else if (abs < 3_600_000) {
    const n = Math.max(1, Math.floor(abs / 60_000));
    label = `${n}m`;
  } else if (abs < 86_400_000) {
    const hours = Math.floor(abs / 3_600_000);
    const minutes = Math.floor((abs % 3_600_000) / 60_000);
    label = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(abs / 86_400_000);
    const hours = Math.floor((abs % 86_400_000) / 3_600_000);
    label = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  return sign === 'ago' ? `${label} ago` : `in ${label}`;
}

/**
 * Pick the snapshot for the active env STRICTLY. Returns `null` when
 * no row is keyed to the active env — even if rows exist for other
 * envs.
 *
 * Cross-env fallback was the previous behavior and produced a
 * dangerous trap: the workflow header would render "green · 28m ago"
 * by silently picking the null-env (or any other env) row, while the
 * resolver — which strictly env-matches at compile time — found
 * nothing for the active env and dropped the rule. Users saw a green
 * badge with broken rules and no diagnostic path.
 *
 * If the caller wants the cross-env state, it should walk `runs`
 * directly (e.g., the per-env table in the workflow header).
 */
export function pickActiveRun(
  runs: LiveWorkflowRunSnapshot[],
  activeEnvironmentId: string | null,
): LiveWorkflowRunSnapshot | null {
  if (runs.length === 0) return null;
  return runs.find((r) => r.environmentId === activeEnvironmentId) ?? null;
}

/**
 * Per-env summary for the workflow header's status table. One entry
 * per env that has a cache row, plus a synthetic "active env, no
 * row" entry when the user's active env has never been refreshed
 * (so the table always shows the actionable state for the env the
 * user is currently using).
 *
 * `isActive` flags the entry that matches the user's active env so
 * the UI can highlight it. Order: active env first, then other envs
 * sorted by most-recently extracted descending (newest at top).
 */
export interface PerEnvRunSummary {
  environmentId: string | null;
  /** `null` when no cache row exists for this env (active-env synthetic only). */
  run: LiveWorkflowRunSnapshot | null;
  isActive: boolean;
}

export function summarizeRunsByEnv(
  runs: LiveWorkflowRunSnapshot[],
  activeEnvironmentId: string | null,
): PerEnvRunSummary[] {
  const out: PerEnvRunSummary[] = [];
  const seenEnvs = new Set<string | null>();
  // Active env first, even when it has no row yet — that's the
  // diagnostic the user needs most.
  const activeRow = runs.find((r) => r.environmentId === activeEnvironmentId) ?? null;
  out.push({ environmentId: activeEnvironmentId, run: activeRow, isActive: true });
  seenEnvs.add(activeEnvironmentId);
  // Other envs sorted by extractedAt descending so the most recently
  // refreshed alternate envs appear first (helpful when the user is
  // diagnosing "where did this token come from?").
  const others = runs
    .filter((r) => !seenEnvs.has(r.environmentId))
    .sort((a, b) => (b.extractedAt ?? 0) - (a.extractedAt ?? 0));
  for (const run of others) {
    out.push({ environmentId: run.environmentId, run, isActive: false });
  }
  return out;
}

/**
 * Aggregate green/yellow/red from a cache snapshot. Matches the
 * live-refresh-scheduler recompute thresholds so the sidebar dot and
 * the footer pill can never disagree about a workflow's health.
 */
export function classifyRun(run: LiveWorkflowRunSnapshot | null, nowMs: number = Date.now()): LiveStatusLevel {
  if (!run) return 'idle';
  // Circuit-breaker state wins over raw failure counts — the state
  // machine is the source of truth for "is this workflow paused /
  // probing / failing?" The fallback to consecutiveFailures covers
  // the brief window where a pre-circuit cache row is still being
  // migrated on read.
  if (run.circuit) {
    if (run.circuit.state === 'open') return 'red';
    if (run.circuit.state === 'half-open') return 'yellow';
    // closed — still yellow if recent pre-breaker failures in play.
    if (run.circuit.consecutiveFailures >= 1) return 'yellow';
  } else {
    if (run.consecutiveFailures >= 5) return 'red';
    if (run.consecutiveFailures >= 1) return 'yellow';
  }
  if (!run.lastExtractorOk) return 'yellow';
  if (run.expiresAt !== null && run.extractedAt > 0) {
    const ttl = run.expiresAt - run.extractedAt;
    if (ttl > 0 && nowMs - run.extractedAt > 2 * ttl) return 'yellow';
  }
  return 'green';
}

// ── Circuit descriptors ────────────────────────────────────────────
//
// One-liner human-readable descriptions of circuit state used by the
// editor header's status line + the Workflow Status sidebar's row
// labels. Identical wording across both surfaces so users learn one
// vocabulary.

export interface CircuitDescriptor {
  /** Short label — fits in a status pill. */
  label: string;
  /** Longer hint shown in a tooltip. */
  hint: string;
  /** Visual tier — matches `classifyRun`. */
  level: LiveStatusLevel;
  /** Whether a "Retry now" button should be surfaced alongside the label. */
  actionable: boolean;
  /**
   * Wall-clock ms of the next scheduled attempt (OPEN state only).
   * Callers render a countdown off `Math.max(0, nextAttemptAt - now)`.
   */
  nextAttemptAt: number | null;
}

export function describeCircuit(run: LiveWorkflowRunSnapshot | null): CircuitDescriptor {
  if (!run?.circuit) {
    return {
      label: 'idle',
      hint: 'No cache yet — run a refresh to populate.',
      level: 'idle',
      actionable: true,
      nextAttemptAt: null,
    };
  }
  const c = run.circuit;
  if (c.state === 'open') {
    return {
      label: 'paused',
      hint: `Circuit is open after ${c.consecutiveFailures} consecutive failure${c.consecutiveFailures === 1 ? '' : 's'}. Automatic retry is deferred. Click Retry now to bypass the backoff.`,
      level: 'red',
      actionable: true,
      nextAttemptAt: c.nextAttemptAt,
    };
  }
  if (c.state === 'half-open') {
    return {
      label: 'probing…',
      hint: 'Probe attempt in flight — a single success closes the circuit.',
      level: 'yellow',
      actionable: false,
      nextAttemptAt: null,
    };
  }
  // closed
  if (c.consecutiveFailures > 0) {
    const attempt = c.consecutiveFailures + 1;
    return {
      label: `retry ${attempt} of 3`,
      hint: `Pre-breaker retry tier — quick retries with 5–10s backoff between attempts. Circuit opens after 3 consecutive failures.`,
      level: 'yellow',
      actionable: true,
      nextAttemptAt: null,
    };
  }
  return {
    label: 'healthy',
    hint: 'Circuit closed, no recent failures.',
    level: 'green',
    actionable: false,
    nextAttemptAt: null,
  };
}

/**
 * Format a countdown `"in 15s"` / `"in 12m"` / `"in 3h 42m"` /
 * `"in 2d 4h"` from a future wall-clock ms. Returns `"now"` when the
 * target has passed.
 *
 * Above the minute boundary the larger unit carries the smaller one
 * alongside, matching `formatRelativeMs` — a 3h 42m backoff countdown
 * should read "3h 42m" not "3h" or "4h". Seconds round up via
 * `Math.ceil` so a countdown never shows "0s" at the moment of fire.
 */
export function formatCountdown(targetMs: number | null, nowMs: number = Date.now()): string {
  if (targetMs === null) return '';
  const diff = targetMs - nowMs;
  if (diff <= 0) return 'now';
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`;
  if (diff < 3_600_000) return `in ${Math.ceil(diff / 60_000)}m`;
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
}

// ── Policy-aware schedule wording ──────────────────────────────────
//
// The cache's `expiresAt` field means different things depending on
// the refresh policy:
//
//   - `interval`    — derived as `extractedAt + seconds`. It's the
//                     NEXT auto-refresh tick, NOT a semantic expiry.
//                     Saying "expires in 3h" is wrong: nothing expires
//                     at that moment; the scheduler just ticks.
//   - `expires-in`  — derived from a captured `expires_in` value. IS a
//                     real expiry (OAuth-style TTL). Auto-refresh
//                     fires `leadSeconds` earlier to avoid racing a
//                     just-expired token against the next request.
//   - `expires-at`  — derived from a captured absolute-ms timestamp.
//                     Same — real expiry, refresh `leadSeconds` early.
//   - `manual`      — no auto-refresh at all; `expiresAt` stays null.
//
// `describeRunSchedule` returns the policy-appropriate chunks for one
// cache row, so the editor status line + sidebar dashboard speak the
// same vocabulary.
//
// Returns an ordered list of `{text, tone}` so the caller can render
// each chunk with the right typography (`secondary` for neutral info,
// `warning` for a looming expiry, `danger` handled upstream for
// errors + circuit).

export interface ScheduleChunk {
  text: string;
  tone: 'secondary' | 'warning';
}

export function describeRunSchedule(
  run: LiveWorkflowRunSnapshot,
  policy: RefreshPolicy,
  nowMs: number = Date.now(),
): ScheduleChunk[] {
  const chunks: ScheduleChunk[] = [];
  if (run.extractedAt > 0) {
    chunks.push({ text: `last ${formatRelativeMs(run.extractedAt, nowMs)}`, tone: 'secondary' });
  }
  switch (policy.kind) {
    case 'manual':
      chunks.push({ text: 'manual refresh only', tone: 'secondary' });
      break;
    case 'interval':
      // `expiresAt` here is the scheduler's next-tick target, not an
      // actual token expiry. Word it accordingly.
      if (run.expiresAt != null) {
        chunks.push({
          text: `auto-refresh ${formatRelativeMs(run.expiresAt, nowMs)}`,
          tone: 'secondary',
        });
      }
      break;
    case 'expires-in':
    case 'expires-at': {
      // The captured value IS a real expiry. Show it; if leadSeconds
      // is set, also surface the auto-refresh moment so the user sees
      // both "token dies at X" and "we'll refresh at X−lead".
      if (run.expiresAt == null) break;
      const expiryTone: 'secondary' | 'warning' = run.expiresAt - nowMs < 0 ? 'warning' : 'secondary';
      chunks.push({
        text: `expires ${formatRelativeMs(run.expiresAt, nowMs)}`,
        tone: expiryTone,
      });
      const leadMs = policy.leadSeconds * 1000;
      if (leadMs > 0) {
        const refreshAt = run.expiresAt - leadMs;
        // Only worth showing when the refresh is still in the future
        // AND distinct enough from the expiry to matter (> 30s gap).
        if (refreshAt > nowMs && run.expiresAt - refreshAt > 30_000) {
          chunks.push({
            text: `auto-refresh ${formatRelativeMs(refreshAt, nowMs)}`,
            tone: 'secondary',
          });
        }
      }
      break;
    }
  }
  return chunks;
}

export function statusColor(level: LiveStatusLevel): string {
  switch (level) {
    case 'green':
      return 'var(--ant-color-success, #52c41a)';
    case 'yellow':
      return 'var(--ant-color-warning, #faad14)';
    case 'red':
      return 'var(--ant-color-error, #ff4d4f)';
    default:
      return 'var(--ant-color-text-tertiary, #999)';
  }
}

/**
 * Describe a refresh policy in one short phrase. Used in editor summaries
 * and the sidebar's per-LV subtitle so the user immediately sees whether
 * a workflow re-runs on its own or only when they click Refresh.
 */
export function describeRefreshPolicy(policy: RefreshPolicy): string {
  switch (policy.kind) {
    case 'interval':
      return `every ${policy.seconds}s`;
    case 'expires-in':
      return `expires-in from step.${policy.stepId}.${policy.captureName} (lead ${policy.leadSeconds}s)`;
    case 'expires-at':
      return `expires-at from step.${policy.stepId}.${policy.captureName} (lead ${policy.leadSeconds}s)`;
    case 'manual':
      return 'manual refresh';
  }
}

/** Mask a string for the default reveal-off display. */
export function maskValue(value: string): string {
  if (!value) return '(empty)';
  if (value.length <= 2) return '••';
  return '••••••••';
}

/** Read the captured value for an LV binding from a run snapshot. */
export function readCapture(run: LiveWorkflowRunSnapshot | null, stepId: string, captureName: string): string | null {
  if (!run) return null;
  return run.stepCaptures[stepId]?.[captureName] ?? null;
}
