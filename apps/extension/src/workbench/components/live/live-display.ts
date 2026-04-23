/**
 * Display helpers for Live Variable / Live Workflow editors + sidebar.
 *
 * Pure functions — no React, no bridge calls. Every surface that needs
 * to render a "last refreshed 3m ago" label, a countdown to next fire,
 * or a status color derives it here so the strings stay in lockstep.
 */

import type { V5 } from '@openheaders/core/types';
import type { LiveWorkflowRunSnapshot } from '@utils/bridge';

export type LiveStatusLevel = 'green' | 'yellow' | 'red' | 'idle';

/**
 * Format a millisecond gap as a compact human string.
 *   - future → "in 45s" / "in 12m" / "in 3h"
 *   - past → "5s ago" / "2m ago" / "3h ago"
 *   - absent → "never"
 */
export function formatRelativeMs(targetMs: number | null | undefined, nowMs: number = Date.now()): string {
  if (targetMs === null || targetMs === undefined) return 'never';
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const sign = diff < 0 ? 'ago' : 'in';
  let n = 0;
  let unit = '';
  if (abs < 60_000) {
    n = Math.max(1, Math.floor(abs / 1000));
    unit = 's';
  } else if (abs < 3_600_000) {
    n = Math.floor(abs / 60_000);
    unit = 'm';
  } else if (abs < 86_400_000) {
    n = Math.floor(abs / 3_600_000);
    unit = 'h';
  } else {
    n = Math.floor(abs / 86_400_000);
    unit = 'd';
  }
  return sign === 'ago' ? `${n}${unit} ago` : `in ${n}${unit}`;
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
  if (run.consecutiveFailures >= 5) return 'red';
  if (run.consecutiveFailures >= 1) return 'yellow';
  if (!run.lastExtractorOk) return 'yellow';
  if (run.expiresAt !== null && run.extractedAt > 0) {
    const ttl = run.expiresAt - run.extractedAt;
    if (ttl > 0 && nowMs - run.extractedAt > 2 * ttl) return 'yellow';
  }
  return 'green';
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
export function describeRefreshPolicy(policy: V5.RefreshPolicy): string {
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
