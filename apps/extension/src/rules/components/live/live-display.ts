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

/** Pick the snapshot for the active env, falling back to `null` env, then anything else. */
export function pickActiveRun(
  runs: LiveWorkflowRunSnapshot[],
  activeEnvironmentId: string | null,
): LiveWorkflowRunSnapshot | null {
  if (runs.length === 0) return null;
  const matchActive = runs.find((r) => r.environmentId === activeEnvironmentId);
  if (matchActive) return matchActive;
  const matchNull = runs.find((r) => r.environmentId === null);
  if (matchNull) return matchNull;
  return runs[0] ?? null;
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
