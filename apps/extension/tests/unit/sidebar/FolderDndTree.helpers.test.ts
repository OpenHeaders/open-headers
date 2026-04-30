/**
 * Unit tests for FolderDndTree's pure logic helpers:
 *   - `computeMoveOrderKey` — derives a fractional `keyBetween` for
 *     same-parent reorder, including the dnd-kit convention of
 *     placing AFTER `over` when dragging down and BEFORE when
 *     dragging up.
 *   - `isDescendantOf` — cycle guard for the cross-parent reparent
 *     gesture.
 */

import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@/workbench/components/sidebar/types';
import {
  computeMoveOrderKey,
  isDescendantOf,
} from '@/workbench/components/sidebar/FolderDndTree';

const node = (id: string, parentId?: string): TreeNode => ({
  id,
  parentId,
  kind: 'folder',
  label: id,
  depth: 0,
  expandable: true,
  icon: null,
  canRename: true,
  canDelete: true,
  canAddChild: true,
});

describe('computeMoveOrderKey', () => {
  // Order keys mirror the canonical seed convention — `keyBefore('a')`
  // throws by design (floor of the alphabet). Use mid-range letters so
  // every drop position has room on both sides.
  const siblings = [
    { itemId: 'a', orderKey: 'g' },
    { itemId: 'b', orderKey: 'm' },
    { itemId: 'c', orderKey: 's' },
  ];

  it('returns null when active and over are at the same index (drag jitter)', () => {
    expect(computeMoveOrderKey(siblings, 'a', 'a')).toBeNull();
  });

  it('drops below `over` when dragging DOWN — key sits between over and its successor', () => {
    // Move 'a' (idx 0) over 'b' (idx 1). Without 'a': [b='m', c='s'].
    // overIdxInWithout=0; insertIdx=1. prev='m', next='s' → strictly between.
    const key = computeMoveOrderKey(siblings, 'a', 'b');
    expect(key).not.toBeNull();
    expect(key! > 'm' && key! < 's').toBe(true);
  });

  it('drops above `over` when dragging UP — key sits between over and its predecessor', () => {
    // Move 'c' (idx 2) over 'b' (idx 1). Without 'c': [a='g', b='m'].
    // overIdxInWithout=1; insertIdx=1. prev='g', next='m' → strictly between.
    const key = computeMoveOrderKey(siblings, 'c', 'b');
    expect(key).not.toBeNull();
    expect(key! > 'g' && key! < 'm').toBe(true);
  });

  it('seeds a fresh key when the moved uid is missing from siblings (mirror lag)', () => {
    const key = computeMoveOrderKey(siblings, 'unknown', 'a');
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThan(0);
  });

  it('drops at the head when moving to the first slot from below', () => {
    // Move 'c' (idx 2) over 'a' (idx 0) — dragging UP. Without 'c':
    // [a='g', b='m']. overIdxInWithout=0; insertIdx=0. prev=null, next='g'.
    const key = computeMoveOrderKey(siblings, 'c', 'a');
    expect(key).not.toBeNull();
    expect(key! < 'g').toBe(true);
  });

  it('drops at the tail when moving to the last slot from above', () => {
    // Move 'a' (idx 0) over 'c' (idx 2) — dragging DOWN. Without 'a':
    // [b='m', c='s']. overIdxInWithout=1; insertIdx=2. prev='s', next=null.
    const key = computeMoveOrderKey(siblings, 'a', 'c');
    expect(key).not.toBeNull();
    expect(key! > 's').toBe(true);
  });
});

describe('isDescendantOf', () => {
  it('detects a direct child', () => {
    const map = new Map<string, TreeNode>();
    const parent = node('p');
    const child = node('c', 'p');
    map.set(parent.id, parent);
    map.set(child.id, child);
    expect(isDescendantOf('p', child, map)).toBe(true);
  });

  it('detects a deep descendant', () => {
    const map = new Map<string, TreeNode>();
    const a = node('a');
    const b = node('b', 'a');
    const c = node('c', 'b');
    const d = node('d', 'c');
    [a, b, c, d].forEach((n) => map.set(n.id, n));
    expect(isDescendantOf('a', d, map)).toBe(true);
  });

  it('returns false for an unrelated subtree', () => {
    const map = new Map<string, TreeNode>();
    const a = node('a');
    const b = node('b');
    const cOfB = node('c-b', 'b');
    [a, b, cOfB].forEach((n) => map.set(n.id, n));
    expect(isDescendantOf('a', cOfB, map)).toBe(false);
  });

  it('treats a node as its own descendant (same-id is the trivial case)', () => {
    const map = new Map<string, TreeNode>();
    const a = node('a');
    map.set(a.id, a);
    expect(isDescendantOf('a', a, map)).toBe(true);
  });

  it('terminates safely on a cycle in the parent chain', () => {
    // Should never happen in well-formed state, but the guard's
    // `visited` set must keep the walk bounded.
    const map = new Map<string, TreeNode>();
    const a = node('a', 'b');
    const b = node('b', 'a');
    map.set(a.id, a);
    map.set(b.id, b);
    // Neither contains 'unrelated'; the cycle detection bails false.
    expect(isDescendantOf('unrelated', a, map)).toBe(false);
  });
});
