/**
 * Pure helpers in `workbench/components/live/live-display.ts` — the
 * single source of truth for "what env is this cache row for, what
 * does it look like to the user". Keeping the env-selection contract
 * pinned in tests prevents the cross-env fallback bug from ever
 * silently coming back (the previous behavior made the workflow
 * header lie about freshness when the active env had no row).
 */

import { initialCircuitSnapshot } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import type { LiveWorkflowRunSnapshot } from '@utils/bridge';
import { describe, expect, it } from 'vitest';
import {
  describeRunSchedule,
  formatCountdown,
  formatRelativeMs,
  pickActiveRun,
  summarizeRunsByEnv,
} from '@/workbench/components/live/live-display';

function makeRun(overrides: Partial<LiveWorkflowRunSnapshot> = {}): LiveWorkflowRunSnapshot {
  return {
    workflowUid: 'wf01',
    environmentId: null,
    stepCaptures: {},
    extractedAt: 1_700_000_000_000,
    expiresAt: null,
    stepResponseBytes: {},
    consecutiveFailures: 0,
    lastExtractorOk: true,
    circuit: initialCircuitSnapshot(),
    ...overrides,
  };
}

describe('pickActiveRun', () => {
  it('returns the row strictly matching the active env', () => {
    const a = makeRun({ environmentId: 'env-a' });
    const b = makeRun({ environmentId: 'env-b' });
    expect(pickActiveRun([a, b], 'env-a')).toBe(a);
    expect(pickActiveRun([a, b], 'env-b')).toBe(b);
  });

  it('returns null when no row matches the active env (NO cross-env fallback)', () => {
    // The prior implementation fell back to the null-env row, which
    // produced a "looks green but doesn't resolve" trap: the badge
    // showed a fresh capture from a different env while the SW-side
    // resolver (strict env match) found nothing for the active env.
    const nullRun = makeRun({ environmentId: null });
    const otherRun = makeRun({ environmentId: 'env-other' });
    expect(pickActiveRun([nullRun, otherRun], 'env-corp')).toBeNull();
  });

  it('returns the null-env row when active env IS null (still strict)', () => {
    const nullRun = makeRun({ environmentId: null });
    const otherRun = makeRun({ environmentId: 'env-other' });
    expect(pickActiveRun([nullRun, otherRun], null)).toBe(nullRun);
  });

  it('returns null on an empty run list', () => {
    expect(pickActiveRun([], 'env-corp')).toBeNull();
    expect(pickActiveRun([], null)).toBeNull();
  });
});

describe('summarizeRunsByEnv', () => {
  it('always lists the active env first, even when no row exists for it', () => {
    const otherRun = makeRun({ environmentId: 'env-other', extractedAt: 100 });
    const summary = summarizeRunsByEnv([otherRun], 'env-corp');
    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({ environmentId: 'env-corp', run: null, isActive: true });
    expect(summary[1]).toMatchObject({ environmentId: 'env-other', isActive: false });
  });

  it('marks the active env entry with its existing row when present', () => {
    const activeRun = makeRun({ environmentId: 'env-corp', extractedAt: 200 });
    const otherRun = makeRun({ environmentId: 'env-other', extractedAt: 100 });
    const summary = summarizeRunsByEnv([activeRun, otherRun], 'env-corp');
    expect(summary[0]).toMatchObject({ environmentId: 'env-corp', run: activeRun, isActive: true });
  });

  it('sorts non-active envs by extractedAt descending', () => {
    const oldRun = makeRun({ environmentId: 'env-old', extractedAt: 100 });
    const newRun = makeRun({ environmentId: 'env-new', extractedAt: 500 });
    const summary = summarizeRunsByEnv([oldRun, newRun], 'env-corp');
    // Active env first (no row), then envs by extractedAt descending.
    expect(summary[0].environmentId).toBe('env-corp');
    expect(summary[1].environmentId).toBe('env-new');
    expect(summary[2].environmentId).toBe('env-old');
  });

  it('handles the all-empty case — single active-env entry with null run', () => {
    const summary = summarizeRunsByEnv([], 'env-corp');
    expect(summary).toEqual([{ environmentId: 'env-corp', run: null, isActive: true }]);
  });

  it('does NOT duplicate the active env when a row already exists for it', () => {
    const activeRun = makeRun({ environmentId: 'env-corp', extractedAt: 200 });
    const summary = summarizeRunsByEnv([activeRun], 'env-corp');
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ environmentId: 'env-corp', run: activeRun, isActive: true });
  });
});

// ── describeRunSchedule ─────────────────────────────────────────────
//
// The cache's `expiresAt` field is written by the chain adapter with
// policy-specific semantics:
//   - `interval`    → extractedAt + seconds (next scheduler tick, NOT
//                     a semantic expiry — value is still valid)
//   - `expires-in`  → extractedAt + captured_seconds (real token TTL)
//   - `expires-at`  → captured_absolute_ms (real token expiry)
//   - `manual`      → always null (no scheduler)
//
// Using the same "expires in X" label across all policies confused
// users on interval workflows — nothing expires there; the value is
// fresh until the scheduler ticks. These tests pin the policy-aware
// vocabulary so every surface (editor header, sidebar dashboard,
// future tooltips) speaks the same language.

describe('describeRunSchedule', () => {
  const NOW = 1_700_000_000_000;

  it('interval policy — says "auto-refresh" instead of "expires"', () => {
    const run = makeRun({ extractedAt: NOW - 60_000, expiresAt: NOW + 240_000 });
    const policy: V5.RefreshPolicy = { kind: 'interval', seconds: 300 };
    const chunks = describeRunSchedule(run, policy, NOW);
    const labels = chunks.map((c) => c.text);
    expect(labels).toContain('last 1m ago');
    expect(labels.some((l) => l.startsWith('auto-refresh'))).toBe(true);
    // No "expires" wording for interval — the cached value doesn't
    // actually expire; the scheduler just ticks at expiresAt.
    expect(labels.some((l) => l.startsWith('expires'))).toBe(false);
  });

  it('expires-in policy — says "expires" and optionally "auto-refresh" when leadSeconds gap is significant', () => {
    const run = makeRun({ extractedAt: NOW - 60_000, expiresAt: NOW + 600_000 });
    const policy: V5.RefreshPolicy = {
      kind: 'expires-in',
      stepId: 'step1',
      captureName: 'expires_in',
      leadSeconds: 60,
    };
    const chunks = describeRunSchedule(run, policy, NOW);
    const labels = chunks.map((c) => c.text);
    expect(labels.some((l) => l.startsWith('expires'))).toBe(true);
    // leadSeconds is 60s and the gap (600s) is large enough to
    // surface both — real token expiry + refresh window.
    expect(labels.some((l) => l.startsWith('auto-refresh'))).toBe(true);
  });

  it('expires-in policy — suppresses the auto-refresh chunk when leadSeconds gap is < 30s', () => {
    const run = makeRun({ extractedAt: NOW - 60_000, expiresAt: NOW + 60_000 });
    const policy: V5.RefreshPolicy = {
      kind: 'expires-in',
      stepId: 'step1',
      captureName: 'expires_in',
      leadSeconds: 10, // gap between expiry and refresh is only 10s
    };
    const chunks = describeRunSchedule(run, policy, NOW);
    const labels = chunks.map((c) => c.text);
    expect(labels.some((l) => l.startsWith('expires'))).toBe(true);
    // Two nearly-identical timestamps would be noise; only expiry shown.
    expect(labels.some((l) => l.startsWith('auto-refresh'))).toBe(false);
  });

  it('expires-at policy — treats the captured ms as true expiry', () => {
    const run = makeRun({ extractedAt: NOW - 60_000, expiresAt: NOW + 300_000 });
    const policy: V5.RefreshPolicy = {
      kind: 'expires-at',
      stepId: 'step1',
      captureName: 'exp',
      leadSeconds: 30,
    };
    const chunks = describeRunSchedule(run, policy, NOW);
    const labels = chunks.map((c) => c.text);
    expect(labels.some((l) => l.startsWith('expires'))).toBe(true);
  });

  it('manual policy — says "manual refresh only"', () => {
    const run = makeRun({ extractedAt: NOW - 60_000, expiresAt: null });
    const policy: V5.RefreshPolicy = { kind: 'manual' };
    const chunks = describeRunSchedule(run, policy, NOW);
    const labels = chunks.map((c) => c.text);
    expect(labels).toEqual(['last 1m ago', 'manual refresh only']);
  });

  it('past-expired token — flags the expiry chunk with warning tone', () => {
    const run = makeRun({ extractedAt: NOW - 3600_000, expiresAt: NOW - 60_000 });
    const policy: V5.RefreshPolicy = {
      kind: 'expires-in',
      stepId: 'step1',
      captureName: 'expires_in',
      leadSeconds: 60,
    };
    const chunks = describeRunSchedule(run, policy, NOW);
    const expiresChunk = chunks.find((c) => c.text.startsWith('expires'));
    expect(expiresChunk).toBeDefined();
    expect(expiresChunk?.tone).toBe('warning');
  });

  it('omits the "last ..." chunk when the cache has never been populated', () => {
    const run = makeRun({ extractedAt: 0, expiresAt: null });
    const policy: V5.RefreshPolicy = { kind: 'interval', seconds: 300 };
    const chunks = describeRunSchedule(run, policy, NOW);
    const labels = chunks.map((c) => c.text);
    expect(labels.some((l) => l.startsWith('last'))).toBe(false);
  });
});

// ── formatRelativeMs + formatCountdown precision ───────────────────
//
// Above the 1h boundary both formatters must include the minutes
// component — a 3h 42m countdown that reads "in 3h" hides 42 minutes
// of slack and misleads users reading the sidebar at a glance.

describe('formatRelativeMs precision', () => {
  const NOW = 1_700_000_000_000;

  it('sub-minute targets stay single-unit (seconds)', () => {
    expect(formatRelativeMs(NOW + 15_000, NOW)).toBe('in 15s');
    expect(formatRelativeMs(NOW - 15_000, NOW)).toBe('15s ago');
  });

  it('sub-hour targets stay single-unit (minutes)', () => {
    expect(formatRelativeMs(NOW + 42 * 60_000, NOW)).toBe('in 42m');
    expect(formatRelativeMs(NOW - 42 * 60_000, NOW)).toBe('42m ago');
  });

  it('hour-range targets include the minutes remainder', () => {
    // 3h 42m
    const target = NOW + 3 * 3_600_000 + 42 * 60_000;
    expect(formatRelativeMs(target, NOW)).toBe('in 3h 42m');
    expect(formatRelativeMs(NOW - (3 * 3_600_000 + 42 * 60_000), NOW)).toBe('3h 42m ago');
  });

  it('hour-range targets collapse "0m" remainder into plain hours', () => {
    expect(formatRelativeMs(NOW + 3 * 3_600_000, NOW)).toBe('in 3h');
  });

  it('day-range targets include the hour remainder', () => {
    // 2d 4h
    const target = NOW + 2 * 86_400_000 + 4 * 3_600_000;
    expect(formatRelativeMs(target, NOW)).toBe('in 2d 4h');
  });

  it('day-range targets collapse "0h" remainder into plain days', () => {
    expect(formatRelativeMs(NOW + 2 * 86_400_000, NOW)).toBe('in 2d');
  });

  it('returns "never" for null/undefined targets', () => {
    expect(formatRelativeMs(null, NOW)).toBe('never');
    expect(formatRelativeMs(undefined, NOW)).toBe('never');
  });
});

describe('formatCountdown precision', () => {
  const NOW = 1_700_000_000_000;

  it('says "now" when the target has already passed', () => {
    expect(formatCountdown(NOW - 1000, NOW)).toBe('now');
    expect(formatCountdown(NOW, NOW)).toBe('now');
  });

  it('hour-range countdowns include minutes ("in 3h 42m", not "in 3h")', () => {
    const target = NOW + 3 * 3_600_000 + 42 * 60_000;
    expect(formatCountdown(target, NOW)).toBe('in 3h 42m');
  });

  it('hour-range countdowns collapse "0m" remainder', () => {
    expect(formatCountdown(NOW + 2 * 3_600_000, NOW)).toBe('in 2h');
  });

  it('day-range countdowns include hours ("in 1d 6h")', () => {
    const target = NOW + 86_400_000 + 6 * 3_600_000;
    expect(formatCountdown(target, NOW)).toBe('in 1d 6h');
  });

  it('seconds round up — a 100ms countdown shows "in 1s" not "in 0s"', () => {
    expect(formatCountdown(NOW + 100, NOW)).toBe('in 1s');
  });
});
