/**
 * Sidebar sort view — Name sorts collections, then folders and leaves
 * per container (folders first), recursively; Manual is the identity.
 */

import type { CollectionTree } from '@openheaders/core/types';
import { applySidebarSort, sortCollectionTreesByName } from '@openheaders/ui/workbench/components/sidebar/tree-sort';
import { describe, expect, it } from 'vitest';

const collection = (uid: string, name: string, tree: CollectionTree['tree']): CollectionTree =>
  ({ schemaVersion: 5, uid, name, path: `rules/${uid}`, variables: [], tree }) as unknown as CollectionTree;
const rule = (uid: string, name: string): CollectionTree['tree'][number] => ({
  type: 'rule',
  uid,
  name,
  path: uid,
  ruleType: 'header',
  enabled: true,
});
const folder = (uid: string, name: string, children: CollectionTree['tree']): CollectionTree['tree'][number] => ({
  type: 'folder',
  uid,
  name,
  path: uid,
  children,
});

const trees = [
  collection('c2', 'Zeta', [rule('r1', 'b'), folder('f2', 'sub', [rule('r3', 'z'), rule('r4', 'a')]), rule('r2', 'A')]),
  collection('c1', 'alpha', [rule('r5', 'item 10'), rule('r6', 'item 9')]),
];

describe('sortCollectionTreesByName', () => {
  it('sorts collections, folders first then leaves, recursively, case-insensitive and numeric', () => {
    const sorted = sortCollectionTreesByName(trees);
    expect(sorted.map((c) => c.uid)).toEqual(['c1', 'c2']);
    expect(sorted[0].tree.map((n) => n.uid)).toEqual(['r6', 'r5']);
    expect(sorted[1].tree.map((n) => n.uid)).toEqual(['f2', 'r2', 'r1']);
    const sub = sorted[1].tree[0];
    expect(sub.type === 'folder' && sub.children.map((n) => n.uid)).toEqual(['r4', 'r3']);
  });

  it('leaves the input untouched and manual returns the same trees', () => {
    sortCollectionTreesByName(trees);
    expect(trees.map((c) => c.uid)).toEqual(['c2', 'c1']);
    expect(trees[0].tree.map((n) => n.uid)).toEqual(['r1', 'f2', 'r2']);
    expect(applySidebarSort(trees, 'manual')).toBe(trees);
    expect(applySidebarSort(trees, 'name')[0].uid).toBe('c1');
  });
});
