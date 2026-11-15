/**
 * Pure-model suite for the Git tool window's log-window surfaces: the
 * compressed changed-files tree, the slash-folded ref rail, the
 * graduated date column, and the toolbar's filter model (wire
 * translation). The graph's layout is core's, pinned there.
 */

import { allDirKeys, buildFileTree } from '@openheaders/ui/workbench/components/panels/git/file-tree';
import { formatLogDate, hourCycleFor } from '@openheaders/ui/workbench/components/panels/git/log-date';
import {
  allFolderKeys,
  buildRefTree,
  filterRefTree,
  folderKeysToRef,
} from '@openheaders/ui/workbench/components/panels/git/rail/ref-tree-model';
import {
  buildLogWireFilters,
  type GitLogRowFilterState,
  hasRowFilters,
  pathLabel,
  pathsChipText,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/log-filters';
import { describe, expect, it } from 'vitest';

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

  it('keeps every directory a row of its own when asked not to compress — a tree that picks directories', () => {
    const tree = buildFileTree(
      [
        { path: 'requests/git-pass-e2egcol1/collection.yaml', status: '' },
        { path: 'config/envs/dev.env', status: '' },
      ],
      true,
      false,
    );
    expect(allDirKeys(tree)).toEqual(['config', 'config/envs', 'requests', 'requests/git-pass-e2egcol1']);
    const config = tree[0];
    if (config.kind !== 'dir') throw new Error('expected dir');
    expect(config.label).toBe('config');
    expect(config.children.map((node) => (node.kind === 'dir' ? node.label : ''))).toEqual(['envs']);
  });

  it('answers flat sorted full-path leaves while Group By Directory is off', () => {
    const flat = buildFileTree(
      [
        { path: 'rules/b/rule.yaml', status: 'D' },
        { path: 'rules/a/rule.yaml', status: 'M' },
        { path: 'workspace.yaml', status: 'M' },
      ],
      false,
    );
    expect(flat.map((node) => (node.kind === 'file' ? node.label : ''))).toEqual([
      'rules/a/rule.yaml',
      'rules/b/rule.yaml',
      'workspace.yaml',
    ]);
    expect(flat.every((node) => node.kind === 'file')).toBe(true);
  });
});

describe('log filter model', () => {
  const base: GitLogRowFilterState = {
    author: null,
    date: null,
    paths: [],
    sort: 'date',
  };
  const now = new Date('2026-08-09T12:00:00Z');

  it('translates chips to wire fields — me stays a host-side flag', () => {
    expect(buildLogWireFilters(base, now)).toEqual({});
    expect(buildLogWireFilters({ ...base, author: { kind: 'me' } }, now)).toEqual({ authorMe: true });
    // Several authors travel by `authors`; a directory's closing slash is the view's own.
    expect(
      buildLogWireFilters({ ...base, author: { kind: 'users', values: ['John Doe', 'Dana Reyes'] } }, now),
    ).toEqual({ authors: ['John Doe', 'Dana Reyes'] });
    expect(buildLogWireFilters({ ...base, paths: ['assets/', 'notes/orders.md'] }, now)).toEqual({
      paths: ['assets', 'notes/orders.md'],
    });
    expect(pathsChipText([])).toBeNull();
    expect(pathsChipText(['notes/orders.md'])).toBe('orders.md');
    expect(pathsChipText(['assets/', 'config/envs/', 'workspace.yaml'])).toBe('assets/ + 2');
    // A path picked in the tree by what it belongs to reads by that name.
    expect(
      pathsChipText(['requests/git-pass-e2egcol1/', 'workspace.yaml'], { 'requests/git-pass-e2egcol1/': 'Git Pass' }),
    ).toBe('Git Pass + 1');
    expect(pathLabel('config/envs/')).toBe('envs/');
    expect(pathLabel('config/envs/', false)).toBe('envs');
    expect(buildLogWireFilters({ ...base, author: { kind: 'users', values: ['John Doe'] } }, now)).toEqual({
      author: 'John Doe',
    });
    expect(buildLogWireFilters({ ...base, paths: ['rules/a'] }, now)).toEqual({ paths: ['rules/a'] });
    expect(buildLogWireFilters({ ...base, sort: 'topo' }, now)).toEqual({ topoOrder: true });
  });

  it('presets roll against now; an explicit until widens to end of day', () => {
    const day = buildLogWireFilters({ ...base, date: { kind: 'preset', preset: '24h' } }, now);
    expect(day.since).toBe('2026-08-08T12:00:00.000Z');
    const week = buildLogWireFilters({ ...base, date: { kind: 'preset', preset: '7d' } }, now);
    expect(week.since).toBe('2026-08-02T12:00:00.000Z');
    const range = buildLogWireFilters(
      { ...base, date: { kind: 'range', since: '2026-08-01', until: '2026-08-05' } },
      now,
    );
    expect(range).toEqual({ since: '2026-08-01', until: '2026-08-05T23:59:59' });
  });

  it('hasRowFilters counts row-hiding filters only — sort never does', () => {
    expect(hasRowFilters(base)).toBe(false);
    expect(hasRowFilters({ ...base, sort: 'topo' })).toBe(false);
    expect(hasRowFilters({ ...base, author: { kind: 'me' } })).toBe(true);
    expect(hasRowFilters({ ...base, author: { kind: 'users', values: ['John Doe', 'Dana Reyes'] } })).toBe(true);
    expect(hasRowFilters({ ...base, date: { kind: 'preset', preset: '7d' } })).toBe(true);
    expect(hasRowFilters({ ...base, paths: ['a'] })).toBe(true);
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

  it('renders a flat sorted full-name list while Group By Directory is off', () => {
    const flat = buildRefTree(refs, 'local', false);
    expect(flat.map((node) => (node.kind === 'leaf' ? node.label : `d:${node.label}`))).toEqual([
      'fix/one',
      'main',
      'v5/data-model',
      'v5/other',
    ]);
    expect(flat.every((node) => node.kind === 'leaf')).toBe(true);
  });
});

describe('formatLogDate', () => {
  const now = new Date(2026, 7, 9, 14, 30);
  const labels = { today: (time: string) => `Today ${time}`, yesterday: (time: string) => `Yesterday ${time}` };

  it('renders fresh commits relative, same-day as Today, yesterday labeled, older as full date', () => {
    const fresh = new Date(2026, 7, 9, 14, 0).toISOString();
    expect(formatLogDate(fresh, 'en', labels, {}, now)).toMatch(/30/);

    const today = new Date(2026, 7, 9, 9, 15).toISOString();
    expect(formatLogDate(today, 'en', labels, {}, now)).toBe('Today 09:15');

    const yesterday = new Date(2026, 7, 8, 22, 5).toISOString();
    expect(formatLogDate(yesterday, 'en', labels, {}, now)).toBe('Yesterday 22:05');

    const older = new Date(2026, 6, 8, 21, 23).toISOString();
    expect(formatLogDate(older, 'en', labels, {}, now)).toContain('2026');
  });

  it('the hour cycle follows the clock-format setting, not the locale', () => {
    const today = new Date(2026, 7, 9, 13, 30).toISOString();
    expect(formatLogDate(today, 'en-US', labels, { hourCycle: 'h23' }, now)).toBe('Today 13:30');
    expect(formatLogDate(today, 'en-US', labels, { hourCycle: 'h12' }, now)).toBe('Today 01:30 PM');
    expect(hourCycleFor('24h')).toBe('h23');
    expect(hourCycleFor('12h')).toBe('h12');
  });

  it('drops the time from older dates while Commit Timestamp is off', () => {
    const older = new Date(2026, 6, 8, 21, 23).toISOString();
    const withTime = formatLogDate(older, 'en', labels, { withTime: true }, now);
    const dateOnly = formatLogDate(older, 'en', labels, { withTime: false }, now);
    expect(withTime).toContain('21:23');
    expect(dateOnly).toContain('2026');
    expect(dateOnly).not.toContain(':');
  });
});
