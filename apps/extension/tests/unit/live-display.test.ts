/**
 * Pure helpers in `workbench/components/live/live-display.ts` — the
 * single source of truth for "what env is this cache row for, what
 * does it look like to the user". Keeping the env-selection contract
 * pinned in tests prevents the cross-env fallback bug from ever
 * silently coming back (the previous behavior made the workflow
 * header lie about freshness when the active env had no row).
 */

import type { LiveWorkflowRunSnapshot } from '@utils/bridge';
import { describe, expect, it } from 'vitest';
import { pickActiveRun, summarizeRunsByEnv } from '@/workbench/components/live/live-display';

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
