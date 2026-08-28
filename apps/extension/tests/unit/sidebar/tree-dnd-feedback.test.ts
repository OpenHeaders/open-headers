/**
 * Unit tests for `computeDropFeedback` — where the insertion
 * placeholder and the landing parent's drop guide render for a live
 * drop target, in the flat nodes order.
 */

import {
  computeDropFeedback,
  guideLeft,
  itemsHead,
  onGuide,
} from '@openheaders/ui/workbench/components/sidebar/tree-dnd-feedback';
import { CARET_SLOT, ROW_MARGIN, rowPaddingLeft } from '@openheaders/ui/workbench/components/sidebar/tree-geometry';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { describe, expect, it } from 'vitest';

const node = (id: string, kind: TreeNode['kind'], depth: number, parentId?: string): TreeNode => ({
  id,
  parentId,
  kind,
  label: id,
  depth,
  expandable: kind !== 'leaf',
  icon: null,
  canRename: true,
  canDelete: true,
  canAddChild: kind !== 'leaf',
});

// col-a
//   folder-f          (expanded: folder-g, leaf-x, leaf-y)
//     folder-g
//     leaf-x
//     leaf-y
//   leaf-z
// col-b
const nodes: TreeNode[] = [
  node('col-a', 'group', 0),
  node('folder-f', 'folder', 1, 'col-a'),
  node('folder-g', 'folder', 2, 'folder-f'),
  node('leaf-x', 'leaf', 2, 'folder-f'),
  node('leaf-y', 'leaf', 2, 'folder-f'),
  node('leaf-z', 'leaf', 1, 'col-a'),
  node('col-b', 'group', 0),
];
const byId = new Map(nodes.map((n) => [n.id, n]));
const at = (id: string): TreeNode => byId.get(id) as TreeNode;

describe('computeDropFeedback', () => {
  it("'before' a leaf: placeholder at the leaf's index and depth, guide from the parent's first child", () => {
    const fb = computeDropFeedback('before', nodes, byId, at('leaf-y'), 'leaf');
    expect(fb.placeholder).toEqual({ index: 4, depth: 2 });
    expect(fb.guide).toEqual({ fromIndex: 2, left: guideLeft(1) });
  });

  it("'after' a folder: placeholder past its visible subtree at the folder's depth", () => {
    const fb = computeDropFeedback('after', nodes, byId, at('folder-f'), 'folder');
    expect(fb.placeholder).toEqual({ index: 5, depth: 1 });
    expect(fb.guide).toEqual({ fromIndex: 1, left: guideLeft(0) });
  });

  it("a folder 'into' a folder: placeholder right under the container row, one level deeper", () => {
    const fb = computeDropFeedback('into', nodes, byId, at('folder-f'), 'folder');
    expect(fb.placeholder).toEqual({ index: 2, depth: 2 });
    expect(fb.guide).toEqual({ fromIndex: 2, left: guideLeft(1) });
  });

  it("a leaf 'into' a folder: placeholder at the head of the items run, after the folder run", () => {
    const fb = computeDropFeedback('into', nodes, byId, at('folder-f'), 'leaf');
    expect(fb.placeholder).toEqual({ index: 3, depth: 2 });
    expect(fb.guide).toEqual({ fromIndex: 2, left: guideLeft(1) });
  });

  it("a folder 'into' a leaf lands in the leaf's parent at the end of its folder run", () => {
    const fb = computeDropFeedback('into', nodes, byId, at('leaf-y'), 'folder');
    expect(fb.placeholder).toEqual({ index: 3, depth: 2 });
    expect(fb.guide).toEqual({ fromIndex: 2, left: guideLeft(1) });
  });

  it("'into' the last collection: placeholder past the end of the list", () => {
    const fb = computeDropFeedback('into', nodes, byId, at('col-b'), 'leaf');
    expect(fb.placeholder).toEqual({ index: 7, depth: 1 });
    expect(fb.guide).toEqual({ fromIndex: 7, left: guideLeft(0) });
  });

  it('a collection reorder has no parent row and no guide', () => {
    expect(computeDropFeedback('after', nodes, byId, at('col-a'), 'collection').guide).toBeNull();
    expect(computeDropFeedback('before', nodes, byId, at('col-b'), 'collection')).toEqual({
      placeholder: { index: 6, depth: 0 },
      guide: null,
    });
  });
});

describe('itemsHead', () => {
  it('is the first direct non-folder child; past the subtree when there is none; the next row when collapsed', () => {
    expect(itemsHead(nodes, byId, 1)).toBe(3);
    expect(itemsHead(nodes, byId, 0)).toBe(5);
    expect(itemsHead(nodes, byId, 6)).toBe(7);
    const foldersOnly = [nodes[0], nodes[1], nodes[2]];
    expect(itemsHead(foldersOnly, new Map(foldersOnly.map((n) => [n.id, n])), 1)).toBe(3);
  });
});

describe('onGuide', () => {
  it('runs from the guide start up to the row the placeholder renders ahead of', () => {
    const fb = computeDropFeedback('before', nodes, byId, at('leaf-z'), 'leaf');
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => onGuide(fb, i))).toEqual([false, true, true, true, true, false, false]);
  });

  it('a collapsed folder: only the placeholder carries the guide', () => {
    const collapsed = [nodes[0], nodes[1], nodes[5], nodes[6]];
    const fb = computeDropFeedback('into', collapsed, new Map(collapsed.map((n) => [n.id, n])), at('folder-f'), 'leaf');
    expect(fb).toEqual({ placeholder: { index: 2, depth: 2 }, guide: { fromIndex: 2, left: guideLeft(1) } });
    expect([0, 1, 2, 3].map((i) => onGuide(fb, i))).toEqual([false, false, false, false]);
  });

  it('is never on without a guide', () => {
    const fb = computeDropFeedback('after', nodes, byId, at('col-a'), 'collection');
    expect(onGuide(fb, 5)).toBe(false);
  });
});

describe('guideLeft', () => {
  it('sits under the container row caret, offset by the row margin', () => {
    expect(guideLeft(1)).toBe(ROW_MARGIN + rowPaddingLeft(1) + CARET_SLOT / 2);
  });
});
