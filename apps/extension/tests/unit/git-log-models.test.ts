/**
 * Pure-model suite for the Git tool window's IDE-log surfaces: the
 * multi-lane graph layout, the compressed changed-files tree, the
 * slash-folded ref rail, and the graduated date column.
 */

import { allDirKeys, buildFileTree } from '@openheaders/ui/workbench/components/panels/git/file-tree';
import { computeLogGraph } from '@openheaders/ui/workbench/components/panels/git/graph';
import { formatLogDate } from '@openheaders/ui/workbench/components/panels/git/log-date';
import {
  allFolderKeys,
  buildRefTree,
  filterRefTree,
  folderKeysToRef,
} from '@openheaders/ui/workbench/components/panels/git/ref-tree-model';
import { describe, expect, it } from 'vitest';

describe('computeLogGraph', () => {
  it('lays a linear history on one lane with pass-free rows', () => {
    const rows = computeLogGraph([
      { sha: 'c3', parents: ['c2'] },
      { sha: 'c2', parents: ['c1'] },
      { sha: 'c1', parents: [] },
    ]);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.lane).toBe(0);
      expect(row.laneCount).toBe(1);
    }
    // Interior rows connect through the dot: one top edge in, one bottom out.
    expect(rows[1].edges).toEqual([
      { from: 0, to: 0, color: rows[1].color, span: 'top' },
      { from: 0, to: 0, color: rows[1].color, span: 'bottom' },
    ]);
    // The root commit forks to no parent.
    expect(rows[2].edges.filter((edge) => edge.span === 'bottom')).toHaveLength(0);
  });

  it('a merge commit forks to two lanes and the side branch converges back', () => {
    // merge(m) -> [a, b]; a -> root; b -> root; root
    const rows = computeLogGraph([
      { sha: 'm', parents: ['a', 'b'] },
      { sha: 'a', parents: ['root'] },
      { sha: 'b', parents: ['root'] },
      { sha: 'root', parents: [] },
    ]);
    // The merge opens a second lane for its second parent.
    expect(rows[0].lane).toBe(0);
    expect(rows[0].edges.filter((edge) => edge.span === 'bottom')).toHaveLength(2);
    expect(rows[0].laneCount).toBe(2);
    // While `a` commits on lane 0, lane 1 passes through.
    expect(rows[1].lane).toBe(0);
    expect(rows[1].edges.some((edge) => edge.span === 'pass' && edge.from === 1 && edge.to === 1)).toBe(true);
    // Both lanes expect `root`: the dot lands leftmost and lane 1 converges in.
    expect(rows[3].lane).toBe(0);
    expect(rows[3].edges.filter((edge) => edge.span === 'top')).toHaveLength(2);
    expect(rows[3].laneCount).toBe(2);
  });

  it('an unrelated branch tip entering mid-log opens its own colored lane', () => {
    const rows = computeLogGraph([
      { sha: 'main2', parents: ['main1'] },
      { sha: 'feat1', parents: ['main1'] },
      { sha: 'main1', parents: [] },
    ]);
    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(1);
    expect(rows[1].color).not.toBe(rows[0].color);
    // Both lanes converge on main1.
    expect(rows[2].edges.filter((edge) => edge.span === 'top')).toHaveLength(2);
  });
});

describe('buildFileTree', () => {
  it('compresses single-child directory chains and counts files per node', () => {
    const tree = buildFileTree([
      { path: 'packages/ui/src/a.ts', status: 'M' },
      { path: 'packages/ui/src/icons/b.ts', status: 'A' },
      { path: 'workspace.yaml', status: 'M' },
    ]);
    // Root: the compressed packages/ui/src dir, then the root-level file.
    expect(tree).toHaveLength(2);
    const dir = tree[0];
    if (dir.kind !== 'dir') throw new Error('expected dir first');
    expect(dir.label).toBe('packages/ui/src');
    expect(dir.key).toBe('packages/ui/src');
    expect(dir.fileCount).toBe(2);
    // Inside: icons dir before the file.
    expect(dir.children.map((node) => node.kind)).toEqual(['dir', 'file']);
    const icons = dir.children[0];
    if (icons.kind !== 'dir') throw new Error('expected icons dir');
    expect(icons.key).toBe('packages/ui/src/icons');
    expect(icons.fileCount).toBe(1);
    expect(tree[1]).toEqual({ kind: 'file', label: 'workspace.yaml', path: 'workspace.yaml', status: 'M' });
    expect(allDirKeys(tree)).toEqual(['packages/ui/src', 'packages/ui/src/icons']);
  });

  it('keeps sibling directories separate — only pure chains compress', () => {
    const tree = buildFileTree([
      { path: 'rules/a/rule.yaml', status: 'M' },
      { path: 'rules/b/rule.yaml', status: 'D' },
    ]);
    expect(tree).toHaveLength(1);
    const rules = tree[0];
    if (rules.kind !== 'dir') throw new Error('expected dir');
    expect(rules.label).toBe('rules');
    expect(rules.children.map((node) => (node.kind === 'dir' ? node.label : ''))).toEqual(['a', 'b']);
  });
});

describe('ref tree model', () => {
  const refs = [
    { name: 'main', kind: 'local' as const, sha: 's1' },
    { name: 'v5/data-model', kind: 'local' as const, sha: 's2' },
    { name: 'v5/other', kind: 'local' as const, sha: 's3' },
    { name: 'fix/one', kind: 'local' as const, sha: 's4' },
  ];

  it('folds slash segments into folders with sorted leaves', () => {
    const tree = buildRefTree(refs, 'local');
    // Folders first (fix, v5), then the bare leaf (main).
    expect(tree.map((node) => (node.kind === 'folder' ? `d:${node.label}` : `l:${node.label}`))).toEqual([
      'd:fix',
      'd:v5',
      'l:main',
    ]);
    const v5 = tree[1];
    if (v5.kind !== 'folder') throw new Error('expected folder');
    expect(v5.key).toBe('local:v5');
    expect(v5.children).toEqual([
      { kind: 'leaf', label: 'data-model', name: 'v5/data-model', refKind: 'local' },
      { kind: 'leaf', label: 'other', name: 'v5/other', refKind: 'local' },
    ]);
  });

  it('filters to matching full names, pruning empty folders', () => {
    const filtered = filterRefTree(buildRefTree(refs, 'local'), 'data');
    expect(allFolderKeys(filtered)).toEqual(['local:v5']);
    const v5 = filtered[0];
    if (v5.kind !== 'folder') throw new Error('expected folder');
    expect(v5.children).toEqual([{ kind: 'leaf', label: 'data-model', name: 'v5/data-model', refKind: 'local' }]);
  });

  it('names the ancestor folder keys of a ref for default expansion', () => {
    expect(folderKeysToRef('v5/deep/branch', 'local')).toEqual(['local:v5', 'local:v5/deep']);
    expect(folderKeysToRef('main', 'local')).toEqual([]);
  });
});

describe('formatLogDate', () => {
  const now = new Date(2026, 7, 9, 14, 30);

  it('renders fresh commits relative, same-day as time, yesterday labeled, older as full date', () => {
    const fresh = new Date(2026, 7, 9, 14, 0).toISOString();
    expect(formatLogDate(fresh, 'en', (time) => `Yesterday ${time}`, now)).toMatch(/30/);

    const today = new Date(2026, 7, 9, 9, 15).toISOString();
    const todayOut = formatLogDate(today, 'en', (time) => `Yesterday ${time}`, now);
    expect(todayOut).toContain('15');
    expect(todayOut).not.toContain('2026');

    const yesterday = new Date(2026, 7, 8, 22, 5).toISOString();
    expect(formatLogDate(yesterday, 'en', (time) => `Yesterday ${time}`, now)).toMatch(/^Yesterday /);

    const older = new Date(2026, 6, 8, 21, 23).toISOString();
    expect(formatLogDate(older, 'en', (time) => `Yesterday ${time}`, now)).toContain('2026');
  });
});
