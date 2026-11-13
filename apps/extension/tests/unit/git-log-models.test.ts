/**
 * Pure-model suite for the Git tool window's log-window surfaces: the
 * multi-lane graph layout, the compressed changed-files tree, the
 * slash-folded ref rail, the graduated date column, and the toolbar's
 * filter model (wire translation + text matcher).
 */

import { allDirKeys, buildFileTree } from '@openheaders/ui/workbench/components/panels/git/file-tree';
import { computeLogGraph, edgeKey } from '@openheaders/ui/workbench/components/panels/git/graph';
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
  isMergeCommit,
  makeTextMatcher,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/log-filters';
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
    // Interior rows connect through the dot: one top edge in, one bottom out, each naming its commits.
    expect(rows[1].edges).toEqual([
      { from: 0, to: 0, color: rows[1].color, span: 'top', child: 'c3', parent: 'c2', collapsed: false },
      { from: 0, to: 0, color: rows[1].color, span: 'bottom', child: 'c2', parent: 'c1', collapsed: false },
    ]);
    // The head entering the window draws nothing above its dot; the root forks to no parent.
    expect(rows[0].edges.filter((edge) => edge.span === 'top')).toHaveLength(0);
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
    // The merged branch wears its own colour; the merge and the shared
    // root keep the trunk's (the newest head owns the history it meets).
    expect(rows[2].color).not.toBe(rows[0].color);
    expect(rows[1].color).toBe(rows[0].color);
    expect(rows[3].color).toBe(rows[0].color);
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
    // Both lanes converge on main1, which keeps the first head's colour
    // while the side lane's edge arrives in its own.
    expect(rows[2].edges.filter((edge) => edge.span === 'top')).toHaveLength(2);
    expect(rows[2].color).toBe(rows[0].color);
    expect(rows[2].edges.find((edge) => edge.span === 'top' && edge.from === 1)?.color).toBe(rows[1].color);
  });

  // feat2 (the newest row, a side head) -> feat1 -> base; main1 -> base -> root
  const FORKED = [
    { sha: 'feat2', parents: ['feat1'] },
    { sha: 'main1', parents: ['base'] },
    { sha: 'feat1', parents: ['base'] },
    { sha: 'base', parents: ['root'] },
    { sha: 'root', parents: [] },
  ];

  it('the checked-out branch owns the shared history: a newer side head does not recolour it below the fork', () => {
    const rows = computeLogGraph(FORKED, { headSha: 'main1' });
    const main = rows[1].color;
    const feature = rows[0].color;
    expect(feature).not.toBe(main);
    expect(rows[2].color).toBe(feature);
    expect(rows[3].color).toBe(main);
    expect(rows[4].color).toBe(main);
    // The fork row: the feature lane's edge arrives in the feature colour, the trunk's in the trunk's.
    const into = rows[3].edges.filter((edge) => edge.span === 'top').map((edge) => edge.color);
    expect(into).toContain(main);
    expect(into).toContain(feature);
  });

  it('without the checked-out commit in the window the newest head owns the shared history', () => {
    const rows = computeLogGraph(FORKED);
    expect(rows[3].color).toBe(rows[0].color);
    expect(rows[4].color).toBe(rows[0].color);
    expect(rows[1].color).not.toBe(rows[0].color);
  });

  it('a collapsed edge is flagged at both ends and on every row it passes', () => {
    // main3 -> main2 -> main1 (main2 hidden: the view rewired main3 -> main1); side -> main1 keeps lane 1 busy.
    const rows = computeLogGraph(
      [
        { sha: 'main3', parents: ['main1'] },
        { sha: 'side', parents: ['main1'] },
        { sha: 'main1', parents: [] },
      ],
      { collapsedEdges: new Set([edgeKey('main3', 'main1')]) },
    );
    expect(rows[0].edges.find((edge) => edge.span === 'bottom')?.collapsed).toBe(true);
    expect(rows[1].edges.find((edge) => edge.span === 'pass')?.collapsed).toBe(true);
    expect(rows[2].edges.find((edge) => edge.span === 'top' && edge.child === 'main3')?.collapsed).toBe(true);
    expect(rows[2].edges.find((edge) => edge.span === 'top' && edge.child === 'side')?.collapsed).toBe(false);
  });

  it("a branch head reached on the lane's own chain restarts the colour there; the edge into it keeps the old one", () => {
    // main2 (HEAD) -> main1 -> origin (origin/main) -> old
    const rows = computeLogGraph(
      [
        { sha: 'main2', parents: ['main1'] },
        { sha: 'main1', parents: ['origin'] },
        { sha: 'origin', parents: ['old'] },
        { sha: 'old', parents: [] },
      ],
      { headSha: 'main2', branchHeads: new Set(['main2', 'origin']) },
    );
    const local = rows[0].color;
    expect(rows[1].color).toBe(local);
    expect(rows[2].color).not.toBe(local);
    expect(rows[3].color).toBe(rows[2].color);
    expect(rows[2].edges.find((edge) => edge.span === 'top')?.color).toBe(local);
    expect(rows[2].edges.find((edge) => edge.span === 'bottom')?.color).toBe(rows[2].color);
  });

  it("a merged branch's head keeps the colour its lane opened with — no restart on a fresh lane", () => {
    // merge -> [main1, fix]; fix (fix/x) -> base; main1 -> base
    const rows = computeLogGraph(
      [
        { sha: 'merge', parents: ['main1', 'fix'] },
        { sha: 'main1', parents: ['base'] },
        { sha: 'fix', parents: ['base'] },
        { sha: 'base', parents: [] },
      ],
      { branchHeads: new Set(['merge', 'fix']) },
    );
    const sideEdge = rows[0].edges.find((edge) => edge.span === 'bottom' && edge.parent === 'fix');
    expect(rows[2].color).toBe(sideEdge?.color);
    expect(rows[2].color).not.toBe(rows[0].color);
  });

  it('the palette is the eight lane tokens, cycling in allocation order', () => {
    const heads = Array.from({ length: 9 }, (_, i) => ({ sha: `h${i}`, parents: [] }));
    const rows = computeLogGraph(heads);
    expect(rows[0].color).toBe('var(--oh-git-lane-0)');
    expect(rows[7].color).toBe('var(--oh-git-lane-7)');
    expect(rows[8].color).toBe(rows[0].color);
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
    firstParent: false,
  };
  const now = new Date('2026-08-09T12:00:00Z');

  it('translates chips to wire fields — me stays a host-side flag', () => {
    expect(buildLogWireFilters(base, now)).toEqual({});
    expect(buildLogWireFilters({ ...base, author: { kind: 'me' } }, now)).toEqual({ authorMe: true });
    expect(buildLogWireFilters({ ...base, author: { kind: 'user', value: 'John Doe' } }, now)).toEqual({
      author: 'John Doe',
    });
    expect(buildLogWireFilters({ ...base, paths: ['rules/a'], firstParent: true }, now)).toEqual({
      paths: ['rules/a'],
      firstParent: true,
    });
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
    expect(hasRowFilters({ ...base, date: { kind: 'preset', preset: '7d' } })).toBe(true);
    expect(hasRowFilters({ ...base, paths: ['a'] })).toBe(true);
    expect(hasRowFilters({ ...base, firstParent: true })).toBe(true);
  });

  it('No Merges is the view’s own sift — never the host’s: a merge is a commit with two parents or more', () => {
    expect(isMergeCommit({ parents: [] })).toBe(false);
    expect(isMergeCommit({ parents: ['a'] })).toBe(false);
    expect(isMergeCommit({ parents: ['a', 'b'] })).toBe(true);
  });

  it('text matcher: substring by default, sha prefix, case + regex toggles, invalid regex flagged', () => {
    const entry = { subject: 'Fix Response panel', authorName: 'John', sha: 'abc123def' };
    const plain = makeTextMatcher('response', false, false);
    if (plain.kind !== 'match') throw new Error('expected matcher');
    expect(plain.test(entry)).toBe(true);
    const cased = makeTextMatcher('response', false, true);
    if (cased.kind !== 'match') throw new Error('expected matcher');
    expect(cased.test(entry)).toBe(false);
    const sha = makeTextMatcher('abc12', false, false);
    if (sha.kind !== 'match') throw new Error('expected matcher');
    expect(sha.test(entry)).toBe(true);
    const regex = makeTextMatcher('^fix .*panel$', true, false);
    if (regex.kind !== 'match') throw new Error('expected matcher');
    expect(regex.test(entry)).toBe(true);
    expect(makeTextMatcher('(', true, false).kind).toBe('invalid');
    expect(makeTextMatcher('  ', false, false).kind).toBe('none');
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
