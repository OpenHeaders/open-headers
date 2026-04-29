import { describe, expect, it } from 'vitest';
import type { CollectionTree } from '../../src/types/v5/collection';
import { computePausedUids, hasNestedPauseMarkers, type PauseMarker, resolvePauseState } from '../../src/utils/pause';

function markers(record: Record<string, PauseMarker>): Map<string, PauseMarker> {
  return new Map(Object.entries(record));
}

// A small fixture: one collection, two folders, three rules.
//   rules/col-a
//     ├ folder-x  (path: rules/col-a/folder-x)
//     │   └ rule-r1 (path: rules/col-a/folder-x/rule-r1)
//     └ folder-y  (path: rules/col-a/folder-y)
//         └ rule-r2 (path: rules/col-a/folder-y/rule-r2)
//   rules/col-b
//     └ rule-r3 (path: rules/col-b/rule-r3)
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

describe('resolvePauseState', () => {
  it('returns false when no markers exist', () => {
    expect(resolvePauseState('rules/col-a/folder-x/rule-r1', new Map())).toBe(false);
  });

  it('returns true when self path is marked paused', () => {
    expect(resolvePauseState('rules/col-a/folder-x', markers({ 'rules/col-a/folder-x': 'paused' }))).toBe(true);
  });

  it('returns true when an ancestor is marked paused', () => {
    expect(resolvePauseState('rules/col-a/folder-x/rule-r1', markers({ 'rules/col-a': 'paused' }))).toBe(true);
  });

  it('returns false when self has an unpaused override even though ancestor is paused', () => {
    // closest specifier wins
    expect(
      resolvePauseState(
        'rules/col-a/folder-x',
        markers({ 'rules/col-a': 'paused', 'rules/col-a/folder-x': 'unpaused' }),
      ),
    ).toBe(false);
  });

  it('returns true for a rule under a paused collection but inside an unpaused folder override', () => {
    // The unpaused override on the FOLDER protects every rule inside it.
    expect(
      resolvePauseState(
        'rules/col-a/folder-x/rule-r1',
        markers({ 'rules/col-a': 'paused', 'rules/col-a/folder-x': 'unpaused' }),
      ),
    ).toBe(false);
  });

  it('keeps a sibling paused when only one folder is overridden', () => {
    // folder-y has no override — inherited 'paused' from collection still wins.
    expect(
      resolvePauseState(
        'rules/col-a/folder-y/rule-r2',
        markers({ 'rules/col-a': 'paused', 'rules/col-a/folder-x': 'unpaused' }),
      ),
    ).toBe(true);
  });

  it('does not treat a path with the same prefix as an ancestor', () => {
    // 'rules/col-ab' must not be treated as a child of 'rules/col-a'.
    expect(resolvePauseState('rules/col-ab/rule-x', markers({ 'rules/col-a': 'paused' }))).toBe(false);
  });
});

describe('hasNestedPauseMarkers', () => {
  it('returns false for an empty map', () => {
    expect(hasNestedPauseMarkers('rules/col-a', new Map())).toBe(false);
  });

  it('returns true when a strict descendant has a marker', () => {
    expect(hasNestedPauseMarkers('rules/col-a', markers({ 'rules/col-a/folder-x': 'paused' }))).toBe(true);
  });

  it('returns false when only the path itself has a marker', () => {
    // A self marker is not a "nested" descendant.
    expect(hasNestedPauseMarkers('rules/col-a', markers({ 'rules/col-a': 'paused' }))).toBe(false);
  });

  it('does not match unrelated prefixes', () => {
    expect(hasNestedPauseMarkers('rules/col-a', markers({ 'rules/col-ab/folder': 'paused' }))).toBe(false);
  });
});

describe('computePausedUids', () => {
  it('returns an empty set when no markers exist', () => {
    expect(computePausedUids(trees, new Map())).toEqual(new Set());
  });

  it('marks every descendant of a paused collection', () => {
    const result = computePausedUids(trees, markers({ 'rules/col-a': 'paused' }));
    expect(result).toEqual(new Set(['col-a', 'folder-x', 'rule-r1', 'folder-y', 'rule-r2']));
  });

  it('honors an unpaused folder override under a paused collection', () => {
    const result = computePausedUids(trees, markers({ 'rules/col-a': 'paused', 'rules/col-a/folder-x': 'unpaused' }));
    // col-a paused; folder-y + rule-r2 inherit paused;
    // folder-x + rule-r1 are protected by the override.
    expect(result).toEqual(new Set(['col-a', 'folder-y', 'rule-r2']));
  });

  it('does not pause sibling collections', () => {
    const result = computePausedUids(trees, markers({ 'rules/col-a': 'paused' }));
    expect(result.has('col-b')).toBe(false);
    expect(result.has('rule-r3')).toBe(false);
  });
});
