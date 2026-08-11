/**
 * Pure-model suite for the Commit tree's keyboard-navigation rows
 * (S23): visible-row order across grouped/flat modes, collapse-state
 * pruning, and the shared flat sort.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import {
  commitFileRowKey,
  flatSortedRows,
  visibleCommitRows,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-tree-nav';
import { buildFileTree, type FileTreeNode } from '@openheaders/ui/workbench/components/panels/git/file-tree';
import { describe, expect, it } from 'vitest';

function row(overrides: Partial<WorkspaceTreeWorkingChangeWire> & { path: string }): WorkspaceTreeWorkingChangeWire {
  return { status: 'M', unversioned: false, ignored: false, ...overrides };
}

const CHANGES = [row({ path: 'rules/a.yaml' }), row({ path: 'workspace.yaml' })];
const UNVERSIONED = [row({ path: 'notes/new.yaml', status: '?', unversioned: true })];

function groupsAndTrees(): {
  groups: Array<{ key: string; rows: WorkspaceTreeWorkingChangeWire[] }>;
  trees: Map<string, FileTreeNode[]>;
} {
  return {
    groups: [
      { key: 'changes', rows: CHANGES },
      { key: 'unversioned', rows: UNVERSIONED },
    ],
    trees: new Map([
      ['changes', buildFileTree(CHANGES, true)],
      ['unversioned', buildFileTree(UNVERSIONED, true)],
    ]),
  };
}

describe('visibleCommitRows', () => {
  it('grouped mode walks header, root node, dirs-first tree — a single-chain tree compresses the root away', () => {
    const { groups, trees } = groupsAndTrees();
    const keys = visibleCommitRows(groups, trees, new Set(), true).map((r) => r.key);
    expect(keys).toEqual([
      'changes',
      'changes:__root__',
      'changes:rules',
      commitFileRowKey('rules/a.yaml'),
      commitFileRowKey('workspace.yaml'),
      'unversioned',
      'unversioned:notes',
      commitFileRowKey('notes/new.yaml'),
    ]);
  });

  it('a collapsed group keeps its header only; a collapsed dir keeps its row', () => {
    const { groups, trees } = groupsAndTrees();
    const collapsedGroup = visibleCommitRows(groups, trees, new Set(['unversioned']), true).map((r) => r.key);
    expect(collapsedGroup.filter((k) => k.startsWith('unversioned'))).toEqual(['unversioned']);
    const collapsedDir = visibleCommitRows(groups, trees, new Set(['changes:rules']), true).map((r) => r.key);
    expect(collapsedDir).toContain('changes:rules');
    expect(collapsedDir).not.toContain(commitFileRowKey('rules/a.yaml'));
  });

  it('flat mode lists files under the header in basename order', () => {
    const { groups, trees } = groupsAndTrees();
    const rows = visibleCommitRows(groups, trees, new Set(), false);
    expect(rows.map((r) => r.key)).toEqual([
      'changes',
      commitFileRowKey('rules/a.yaml'),
      commitFileRowKey('workspace.yaml'),
      'unversioned',
      commitFileRowKey('notes/new.yaml'),
    ]);
    expect(rows[1].parentKey).toBe('changes');
  });

  it('a single top-level dir hangs off the header (compressed root); several bring the root node back', () => {
    const oneDir = [
      row({ path: 'logs/run.log', status: '!', ignored: true }),
      row({ path: 'logs/old.log', status: '!', ignored: true }),
    ];
    const compressed = visibleCommitRows(
      [{ key: 'ignored', rows: oneDir }],
      new Map([['ignored', buildFileTree(oneDir, true)]]),
      new Set(),
      true,
    );
    expect(compressed.map((r) => r.key)).toEqual([
      'ignored',
      'ignored:logs',
      commitFileRowKey('logs/old.log'),
      commitFileRowKey('logs/run.log'),
    ]);
    expect(compressed[1].parentKey).toBe('ignored');

    const twoDirs = [...oneDir, row({ path: 'cache/blob.bin', status: '!', ignored: true })];
    const rooted = visibleCommitRows(
      [{ key: 'ignored', rows: twoDirs }],
      new Map([['ignored', buildFileTree(twoDirs, true)]]),
      new Set(),
      true,
    );
    expect(rooted.map((r) => r.key)).toEqual([
      'ignored',
      'ignored:__root__',
      'ignored:cache',
      commitFileRowKey('cache/blob.bin'),
      'ignored:logs',
      commitFileRowKey('logs/old.log'),
      commitFileRowKey('logs/run.log'),
    ]);
  });

  it('empty groups are skipped (label rows are not selectable)', () => {
    const keys = visibleCommitRows([{ key: 'changes', rows: [] }], new Map(), new Set(), true).map((r) => r.key);
    expect(keys).toEqual([]);
  });

  it('expandable rows carry collapse keys and expansion state', () => {
    const { groups, trees } = groupsAndTrees();
    const rows = visibleCommitRows(groups, trees, new Set(['changes:rules']), true);
    const dir = rows.find((r) => r.key === 'changes:rules');
    expect(dir?.collapseKey).toBe('changes:rules');
    expect(dir?.expanded).toBe(false);
    const file = rows.find((r) => r.key === commitFileRowKey('workspace.yaml'));
    expect(file?.collapseKey).toBeUndefined();
    expect(file?.parentKey).toBe('changes:__root__');
  });
});

describe('flatSortedRows', () => {
  it('sorts by basename then full path', () => {
    const rows = [row({ path: 'z/a.yaml' }), row({ path: 'a/z.yaml' }), row({ path: 'a/a.yaml' })];
    expect(flatSortedRows(rows).map((r) => r.path)).toEqual(['a/a.yaml', 'z/a.yaml', 'a/z.yaml']);
  });
});
