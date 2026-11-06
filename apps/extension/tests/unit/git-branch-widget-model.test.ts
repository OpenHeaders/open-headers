/**
 * Branch widget model pins: the trigger label (branch / detached /
 * none) and counts off the status frame, the popup's sections (Recent
 * in recency order over existing branches only, the unborn branch
 * leading Local, Tags behind the toggle, the search pruning every
 * section), and the Recent ring's algebra.
 */

import type { WorkspaceTreeGitStatusWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import {
  actionMatches,
  branchTriggerCounts,
  branchTriggerLabel,
  buildBranchPopupSections,
} from '@openheaders/ui/workbench/components/panels/git/branch-widget/branch-widget-model';
import {
  RECENT_BRANCHES_CAP,
  withRecentBranch,
} from '@openheaders/ui/workbench/components/panels/git/branch-widget/branch-widget-prefs';
import { describe, expect, it } from 'vitest';

function status(overrides: Partial<WorkspaceTreeGitStatusWire> = {}): WorkspaceTreeGitStatusWire {
  return {
    bound: true,
    git: { available: true, version: '2.45.0' },
    repo: true,
    branch: 'main',
    headSha: 'b55ab33c'.padEnd(40, '0'),
    branches: ['main', 'local-test', 'feature/auth-headers'],
    dirtyFiles: 1,
    userIndexBusy: false,
    suggestedMessage: '',
    cadence: 'off',
    bypassHooks: false,
    upstream: 'origin/main',
    ahead: 0,
    behind: 1,
    autoPushOnCommit: false,
    forcePush: null,
    shallow: false,
    ...overrides,
  };
}

const refs: WorkspaceTreeRefWire[] = [
  { name: 'main', kind: 'local', sha: 'a'.repeat(40) },
  { name: 'local-test', kind: 'local', sha: 'b'.repeat(40) },
  { name: 'feature/auth-headers', kind: 'local', sha: 'c'.repeat(40) },
  { name: 'origin/main', kind: 'remote', sha: 'd'.repeat(40) },
  { name: 'origin/release/2026.10', kind: 'remote', sha: 'e'.repeat(40) },
  { name: 'v2026.10.3', kind: 'tag', sha: 'f'.repeat(40) },
];

describe('branchTriggerLabel / branchTriggerCounts', () => {
  it('names the branch and reads behind as incoming, ahead as outgoing', () => {
    expect(branchTriggerLabel(status())).toEqual({ kind: 'branch', name: 'main' });
    expect(branchTriggerCounts(status({ ahead: 2, behind: 1 }))).toEqual({ incoming: 1, outgoing: 2 });
  });

  it('a detached HEAD reads the short sha; unbound or headless reads none; no upstream reads zeros', () => {
    expect(branchTriggerLabel(status({ branch: null }))).toEqual({ kind: 'detached', sha: 'b55ab33c' });
    expect(branchTriggerLabel(status({ bound: false }))).toEqual({ kind: 'none' });
    expect(branchTriggerLabel(null)).toEqual({ kind: 'none' });
    expect(branchTriggerLabel(status({ branch: null, headSha: null }))).toEqual({ kind: 'none' });
    expect(branchTriggerCounts(status({ upstream: null, ahead: null, behind: null }))).toEqual({
      incoming: 0,
      outgoing: 0,
    });
  });
});

describe('buildBranchPopupSections', () => {
  const base = { refs, unbornBranch: null, showTags: true, groupByDirectory: true, search: '' };

  it('Recent keeps recency order over branches that still exist, then Local / Remote / Tags fold on slashes', () => {
    const sections = buildBranchPopupSections({ ...base, recent: ['local-test', 'gone', 'main'] });
    expect(sections.map((section) => section.kind)).toEqual(['recent', 'local', 'remote', 'tag']);
    const recent = sections[0].nodes.map((node) => (node.kind === 'leaf' ? node.name : node.label));
    expect(recent).toEqual(['local-test', 'main']);
    const local = sections[1].nodes.map((node) => (node.kind === 'folder' ? `${node.label}/` : node.name));
    expect(local).toEqual(['feature/', 'local-test', 'main']);
    const remote = sections[2].nodes;
    expect(remote).toHaveLength(1);
    expect(remote[0].kind === 'folder' && remote[0].label).toBe('origin');
  });

  it('an empty ring omits Recent; Show Tags off drops Tags; flat mode lists full names', () => {
    const sections = buildBranchPopupSections({ ...base, recent: [], showTags: false, groupByDirectory: false });
    expect(sections.map((section) => section.kind)).toEqual(['local', 'remote']);
    expect(sections[0].nodes.map((node) => (node.kind === 'leaf' ? node.name : ''))).toEqual([
      'feature/auth-headers',
      'local-test',
      'main',
    ]);
  });

  it('the unborn branch leads Local and counts as existing for Recent', () => {
    const sections = buildBranchPopupSections({
      ...base,
      refs: [],
      unbornBranch: 'main',
      recent: ['main'],
    });
    expect(sections.map((section) => section.kind)).toEqual(['recent', 'local']);
    expect(sections[1].nodes).toEqual([{ kind: 'leaf', label: 'main', name: 'main', refKind: 'local' }]);
  });

  it('a search prunes every section to matching names', () => {
    const sections = buildBranchPopupSections({ ...base, recent: ['main'], search: 'release' });
    expect(sections.map((section) => section.kind)).toEqual(['remote']);
    const origin = sections[0].nodes[0];
    expect(origin.kind === 'folder' && origin.children.map((node) => node.label)).toEqual(['release']);
    expect(buildBranchPopupSections({ ...base, recent: [], search: 'nothing-here' })).toEqual([]);
  });
});

describe('withRecentBranch', () => {
  it('moves the branch to the front, dedupes, caps, and keeps the array when it already leads', () => {
    const ring = ['a', 'b', 'c'];
    expect(withRecentBranch(ring, 'b')).toEqual(['b', 'a', 'c']);
    expect(withRecentBranch(ring, 'a')).toBe(ring);
    const full = Array.from({ length: RECENT_BRANCHES_CAP }, (_, index) => `b${index}`);
    const next = withRecentBranch(full, 'new');
    expect(next).toHaveLength(RECENT_BRANCHES_CAP);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`b${RECENT_BRANCHES_CAP - 1}`);
  });
});

describe('actionMatches', () => {
  it('is a case-insensitive substring match; blank matches everything', () => {
    expect(actionMatches('Update Workspace (Pull)', '')).toBe(true);
    expect(actionMatches('Update Workspace (Pull)', 'WORK')).toBe(true);
    expect(actionMatches('Push…', 'pull')).toBe(false);
  });
});
