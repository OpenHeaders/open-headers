/**
 * The tail tracker appends after a container's MERGED tail: a folder
 * and a leaf created under one parent in one run mint increasing keys
 * across the two sets, and the first mint clears whichever set's tail
 * is greatest.
 */

import { describe, expect, it } from 'vitest';
import type { LiveSetEntry } from '../../src/sync-builders';
import { createTailTracker } from '../../src/sync-builders/mutations/workspace-import-emission';

const PARENT = { type: 'collection', uid: 'col00001' };

function liveOf(sets: Record<string, Array<[string, string]>>) {
  return (type: string, id: string, setPath: string): LiveSetEntry[] =>
    type === PARENT.type && id === PARENT.uid
      ? (sets[setPath] ?? []).map(([itemId, orderKey]) => ({ itemId, orderKey, item: { uid: itemId } }))
      : [];
}

describe('createTailTracker', () => {
  it('mints one ascending run across folders and items of a parent', () => {
    const tail = createTailTracker(liveOf({ folders: [['f1', 'm']], items: [['a', 's']] }));
    const folder = tail(PARENT, 'folders', 'f2');
    const leaf = tail(PARENT, 'items', 'b');
    const folderAgain = tail(PARENT, 'folders', 'f3');
    expect(folder > 's').toBe(true);
    expect(leaf > folder).toBe(true);
    expect(folderAgain > leaf).toBe(true);
  });

  it('a set outside the tree child pair keeps its own tail', () => {
    const tail = createTailTracker(liveOf({ folders: [['f1', 'z']], variables: [['v1', 'm']] }));
    const key = tail(PARENT, 'variables', 'v2');
    expect(key > 'm' && key < 'z').toBe(true);
  });
});
