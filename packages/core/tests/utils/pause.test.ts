import { describe, expect, it } from 'vitest';
import type { CollectionTree } from '../../src/types/collection';
import {
  collectNestedContainerUids,
  computePausedUids,
  hasNestedPauseMarkers,
  type PauseMarker,
  pauseMarkersFromEntries,
  resolvePauseState,
} from '../../src/utils/pause';

function markers(record: Record<string, PauseMarker>): Map<string, PauseMarker> {
  return new Map(Object.entries(record));
}

// A small fixture: one collection, two folders, three rules.
//   col-a
//     ├ folder-x
//     │   └ rule-r1
//     └ folder-y
//         └ rule-r2
//   col-b
//     └ rule-r3
const trees: CollectionTree[] = [
  {
    schemaVersion: 5,
    uid: 'col-a',
    name: 'Col A',
    path: 'rules/col-a',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    tree: [
      {
        type: 'folder',
        uid: 'folder-x',
        name: 'Folder X',
        path: 'rules/col-a/folder-x',
        children: [
          {
            type: 'rule',
            uid: 'rule-r1',
            name: 'R1',
            path: 'rules/col-a/folder-x/rule-r1',
            ruleType: 'header',
            enabled: true,
          },
        ],
      },
      {
        type: 'folder',
        uid: 'folder-y',
        name: 'Folder Y',
        path: 'rules/col-a/folder-y',
        children: [
          {
            type: 'rule',
            uid: 'rule-r2',
            name: 'R2',
            path: 'rules/col-a/folder-y/rule-r2',
            ruleType: 'header',
            enabled: true,
          },
        ],
      },
    ],
  },
  {
    schemaVersion: 5,
    uid: 'col-b',
    name: 'Col B',
    path: 'rules/col-b',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    tree: [
      {
        type: 'rule',
        uid: 'rule-r3',
        name: 'R3',
        path: 'rules/col-b/rule-r3',
        ruleType: 'header',
        enabled: true,
      },
    ],
  },
];

// The same fixture as a parent chain (what a store-side resolver walks).
const PARENTS: Record<string, string | null> = {
  'col-a': null,
  'col-b': null,
  'folder-x': 'col-a',
  'folder-y': 'col-a',
  'rule-r1': 'folder-x',
  'rule-r2': 'folder-y',
  'rule-r3': 'col-b',
};
const parentOf = (uid: string): string | null => PARENTS[uid] ?? null;

describe('resolvePauseState', () => {
  it('returns false when no markers exist', () => {
    expect(resolvePauseState('rule-r1', new Map(), parentOf)).toBe(false);
  });

  it('returns true when self is marked paused', () => {
    expect(resolvePauseState('folder-x', markers({ 'folder-x': 'paused' }), parentOf)).toBe(true);
  });

  it('returns true when an ancestor is marked paused', () => {
    expect(resolvePauseState('rule-r1', markers({ 'col-a': 'paused' }), parentOf)).toBe(true);
  });

  it('returns false when self has an unpaused override even though an ancestor is paused', () => {
    expect(resolvePauseState('folder-x', markers({ 'col-a': 'paused', 'folder-x': 'unpaused' }), parentOf)).toBe(false);
  });

  it('protects a rule under a paused collection through an unpaused folder override', () => {
    expect(resolvePauseState('rule-r1', markers({ 'col-a': 'paused', 'folder-x': 'unpaused' }), parentOf)).toBe(false);
  });

  it('keeps a sibling paused when only one folder is overridden', () => {
    expect(resolvePauseState('rule-r2', markers({ 'col-a': 'paused', 'folder-x': 'unpaused' }), parentOf)).toBe(true);
  });

  it('never loops on a cyclic chain', () => {
    const cyclic = (uid: string): string | null => (uid === 'a' ? 'b' : 'a');
    expect(resolvePauseState('a', markers({ z: 'paused' }), cyclic)).toBe(false);
  });
});

describe('hasNestedPauseMarkers', () => {
  const colA = trees[0].tree;

  it('returns false for an empty map', () => {
    expect(hasNestedPauseMarkers(colA, new Map())).toBe(false);
  });

  it('returns true when a strict descendant folder has a marker', () => {
    expect(hasNestedPauseMarkers(colA, markers({ 'folder-x': 'paused' }))).toBe(true);
  });

  it('ignores the container itself and unrelated containers', () => {
    expect(hasNestedPauseMarkers(colA, markers({ 'col-a': 'paused', 'col-b': 'paused' }))).toBe(false);
  });

  it('ignores rule uids (markers sit on containers only)', () => {
    expect(hasNestedPauseMarkers(colA, markers({ 'rule-r1': 'paused' }))).toBe(false);
  });
});

describe('collectNestedContainerUids', () => {
  it('lists every folder inside the subtree, depth-first', () => {
    expect(collectNestedContainerUids(trees[0].tree)).toEqual(['folder-x', 'folder-y']);
    expect(collectNestedContainerUids(trees[1].tree)).toEqual([]);
  });
});

describe('pauseMarkersFromEntries', () => {
  it('keys the map by container uid', () => {
    expect(
      pauseMarkersFromEntries([
        { type: 'collection', uid: 'col-a', marker: 'paused', path: 'rules/col-a' },
        { type: 'folder', uid: 'folder-x', marker: 'unpaused' },
      ]),
    ).toEqual(markers({ 'col-a': 'paused', 'folder-x': 'unpaused' }));
  });
});

describe('computePausedUids', () => {
  it('returns an empty set when no markers exist', () => {
    expect(computePausedUids(trees, new Map())).toEqual(new Set());
  });

  it('marks every descendant of a paused collection', () => {
    const result = computePausedUids(trees, markers({ 'col-a': 'paused' }));
    expect(result).toEqual(new Set(['col-a', 'folder-x', 'rule-r1', 'folder-y', 'rule-r2']));
  });

  it('honors an unpaused folder override under a paused collection', () => {
    const result = computePausedUids(trees, markers({ 'col-a': 'paused', 'folder-x': 'unpaused' }));
    expect(result).toEqual(new Set(['col-a', 'folder-y', 'rule-r2']));
  });

  it('does not pause sibling collections', () => {
    const result = computePausedUids(trees, markers({ 'col-a': 'paused' }));
    expect(result.has('col-b')).toBe(false);
    expect(result.has('rule-r3')).toBe(false);
  });

  it('follows a moved folder: the marker travels with the uid, not the path', () => {
    const moved: CollectionTree[] = [
      { ...trees[0], tree: [trees[0].tree[1]] },
      { ...trees[1], tree: [...trees[1].tree, { ...trees[0].tree[0], path: 'rules/col-b/folder-x' }] },
    ];
    const result = computePausedUids(moved, markers({ 'folder-x': 'paused' }));
    expect(result).toEqual(new Set(['folder-x', 'rule-r1']));
  });
});
