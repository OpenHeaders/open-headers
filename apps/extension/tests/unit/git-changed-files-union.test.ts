/**
 * changed-files-union (S43): two or more commits as one change set —
 * the net status fold, and the range base of a selection that is exactly
 * the commits between its newest and its base (null for a gapped set, a
 * merge with unselected side commits, or a run from the root).
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { contiguousRangeBase, unionFiles } from '@openheaders/ui/workbench/components/panels/git/changed-files-union';
import { describe, expect, it } from 'vitest';

function entry(sha: string, files: Array<[string, string]>, parents: string[] = []): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents,
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-09T10:00:00.000Z',
    subject: `commit ${sha}`,
    coAuthors: [],
    files: files.map(([path, status]) => ({ path, status })),
  };
}

describe('unionFiles', () => {
  it('folds newest-last so a path reads its net status across the commits', () => {
    const newest = entry('c', [
      ['docs/a.md', 'M'],
      ['docs/b.md', 'D'],
      ['new.txt', 'D'],
    ]);
    const oldest = entry('a', [
      ['docs/a.md', 'A'],
      ['docs/b.md', 'M'],
      ['new.txt', 'A'],
      ['keep.txt', 'M'],
    ]);
    expect(unionFiles([newest, oldest])).toEqual([
      { path: 'docs/a.md', status: 'A' },
      { path: 'docs/b.md', status: 'D' },
      { path: 'keep.txt', status: 'M' },
    ]);
    expect(unionFiles([])).toEqual([]);
  });
});

describe('contiguousRangeBase', () => {
  const linear = [entry('l3', [], ['l2']), entry('l2', [], ['l1']), entry('l1', [], ['l0']), entry('l0', [], [])];
  const merged = [
    entry('c4', [], ['c3', 'b2']),
    entry('b2', [], ['b1']),
    entry('c3', [], ['c2']),
    entry('b1', [], ['c1']),
    entry('c2', [], ['c1']),
    entry('c1', [], []),
  ];

  it('a run of commits diffs from the oldest commit\u2019s parent', () => {
    expect(contiguousRangeBase(['l3', 'l2'], linear)).toBe('l1');
    expect(contiguousRangeBase(['l3', 'l2', 'l1'], linear)).toBe('l0');
  });

  it('a merge diffs only with every side commit selected', () => {
    expect(contiguousRangeBase(['c4', 'b2', 'c3', 'b1', 'c2'], merged)).toBe('c1');
    expect(contiguousRangeBase(['c4', 'b2'], merged)).toBeNull();
    expect(contiguousRangeBase(['c4', 'c3'], merged)).toBeNull();
    expect(contiguousRangeBase(['b2', 'b1'], merged)).toBe('c1');
  });

  it('a gapped set, a run from the root and a single commit have no range', () => {
    expect(contiguousRangeBase(['l3', 'l1'], linear)).toBeNull();
    expect(contiguousRangeBase(['l2', 'l1', 'l0'], linear)).toBeNull();
    expect(contiguousRangeBase(['l3'], linear)).toBeNull();
  });
});
