/**
 * log-reachability (S41, S43): the loaded-window walk behind the
 * current-branch band — reachable commits, the window's edge, a tip
 * outside the window — the band's set over the host's containment flags
 * (the walk when a host sends none) — and the band's tip rule: HEAD's
 * commit, withheld on the HEAD scope, on the checked-out branch's own
 * scope and on the two together.
 */

import {
  currentBranchBandTip,
  currentBranchShas,
  reachableFrom,
} from '@openheaders/ui/workbench/components/panels/git/log-reachability';
import { describe, expect, it } from 'vitest';

const entries = [
  { sha: 'c4', parents: ['c3', 'b2'] },
  { sha: 'b2', parents: ['b1'] },
  { sha: 'c3', parents: ['c2'] },
  { sha: 'b1', parents: ['c1'] },
  { sha: 'c2', parents: ['c1'] },
  { sha: 'c1', parents: ['c0'] },
];

describe('reachableFrom', () => {
  it('walks every parent edge inside the window and stops at its edge', () => {
    expect([...(reachableFrom('c4', entries) ?? [])].sort()).toEqual(['b1', 'b2', 'c1', 'c2', 'c3', 'c4']);
    expect([...(reachableFrom('c3', entries) ?? [])].sort()).toEqual(['c1', 'c2', 'c3']);
    expect([...(reachableFrom('b2', entries) ?? [])].sort()).toEqual(['b1', 'b2', 'c1']);
  });

  it('a tip outside the window paints nothing', () => {
    expect(reachableFrom('c0', entries)).toBeNull();
    expect(reachableFrom('zz', entries)).toBeNull();
  });
});

describe('currentBranchBandTip', () => {
  const scope = (selectedRefs: readonly string[], currentBranch: string | null = 'main') => ({
    selectedRefs,
    headScope: 'HEAD',
    currentBranch,
  });

  it('walks from HEAD over every ref and over another branch’s scope', () => {
    expect(currentBranchBandTip('c4', scope([]))).toBe('c4');
    expect(currentBranchBandTip('c4', scope(['feature/auth-headers']))).toBe('c4');
  });

  it('withholds the band on the HEAD scope and on the checked-out branch’s scope', () => {
    expect(currentBranchBandTip('c4', scope(['HEAD']))).toBeNull();
    expect(currentBranchBandTip('c4', scope(['main']))).toBeNull();
  });

  it('over several refs the band shows unless HEAD reaches every row', () => {
    expect(currentBranchBandTip('c4', scope(['HEAD', 'main']))).toBeNull();
    expect(currentBranchBandTip('c4', scope(['HEAD', 'main', 'origin/main']))).toBe('c4');
    expect(currentBranchBandTip('c4', scope(['main', 'feature/auth-headers']))).toBe('c4');
    expect(currentBranchBandTip('c4', scope(['HEAD', 'main'], null))).toBe('c4');
  });

  it('a detached head bands from its sha and scopes by name still band', () => {
    expect(currentBranchBandTip('c4', scope(['main'], null))).toBe('c4');
    expect(currentBranchBandTip('c4', scope([], null))).toBe('c4');
  });

  it('no head commit, no band', () => {
    expect(currentBranchBandTip(null, scope([]))).toBeNull();
  });
});

describe('currentBranchShas', () => {
  it('reads the host’s flags when every row carries one — a scope without HEAD’s tip still bands', () => {
    const scoped = [
      { sha: 'f2', parents: ['f1'], onHead: false },
      { sha: 'f1', parents: ['c2'], onHead: false },
      { sha: 'c2', parents: ['c1'], onHead: true },
      { sha: 'c1', parents: [], onHead: true },
    ];
    expect([...(currentBranchShas('c4', scoped) ?? [])].sort()).toEqual(['c1', 'c2']);
    expect(
      currentBranchShas(
        'c4',
        scoped.map((entry) => ({ ...entry, onHead: false })),
      ),
    ).toBeNull();
  });

  it('falls back to the window walk when a row carries no flag', () => {
    expect([...(currentBranchShas('c3', entries) ?? [])].sort()).toEqual(['c1', 'c2', 'c3']);
    const mixed = [
      { sha: 'c2', parents: ['c1'], onHead: true },
      { sha: 'c1', parents: [] },
    ];
    expect([...(currentBranchShas('c1', mixed) ?? [])]).toEqual(['c1']);
  });
});
