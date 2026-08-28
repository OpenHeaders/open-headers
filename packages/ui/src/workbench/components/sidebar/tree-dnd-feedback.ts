/**
 * tree-dnd-feedback — where the drag feedback renders for a live drop
 * target, in the flat `nodes` order:
 *
 *   - the insertion placeholder: before the over row ('before'), after
 *     the over row's visible subtree at the row's depth ('after'), or
 *     right under the container row ('into' — the first child, for a
 *     folder and a leaf alike);
 *   - the drop guide: the indent guide of the parent the drop lands in,
 *     painted the full length of that parent's children — from its
 *     first child row through its last descendant, the placeholder
 *     included wherever it sits — so the whole level the drop joins
 *     reads as one. A drop on the roots (no parent row) has no guide.
 *
 * Pure — the dnd component paints what this resolves.
 */

import { isDescendantOf } from './tree-dnd-helpers';
import type { DropZone } from './tree-dnd-zone';
import { CARET_SLOT, ROW_MARGIN, rowPaddingLeft } from './tree-geometry';
import type { TreeNode } from './types';

export interface DropPlaceholder {
  /** Renders before the row at `index` (past the end = after the last row). */
  index: number;
  depth: number;
}

export interface DropGuide {
  /** The first row the guide runs through — the landing parent's first child. */
  fromIndex: number;
  /** One past the last row the guide runs through — the end of the parent's visible subtree. */
  toIndex: number;
  /** The guide's x inside a full-width row wrapper. */
  left: number;
}

export interface DropFeedback {
  placeholder: DropPlaceholder;
  guide: DropGuide | null;
}

/** The index just past the over row's visible subtree. */
export function subtreeEnd(nodes: readonly TreeNode[], byId: ReadonlyMap<string, TreeNode>, overIndex: number): number {
  const over = nodes[overIndex];
  let end = overIndex + 1;
  while (end < nodes.length && isDescendantOf(over.id, nodes[end], byId)) end++;
  return end;
}

/** The x of the guide that descends from a container row at `depth`, in a full-width wrapper. */
export function guideLeft(depth: number): number {
  return ROW_MARGIN + rowPaddingLeft(depth) + CARET_SLOT / 2;
}

export function computeDropFeedback(
  zone: DropZone,
  nodes: readonly TreeNode[],
  byId: ReadonlyMap<string, TreeNode>,
  overNode: TreeNode,
): DropFeedback {
  const overIndex = nodes.findIndex((n) => n.id === overNode.id);
  if (zone === 'into') {
    return {
      placeholder: { index: overIndex + 1, depth: overNode.depth + 1 },
      guide: containerGuide(nodes, byId, overIndex),
    };
  }
  const placeholder =
    zone === 'before'
      ? { index: overIndex, depth: overNode.depth }
      : { index: subtreeEnd(nodes, byId, overIndex), depth: overNode.depth };
  const parentIndex = overNode.parentId ? nodes.findIndex((n) => n.id === overNode.parentId) : -1;
  return { placeholder, guide: parentIndex < 0 ? null : containerGuide(nodes, byId, parentIndex) };
}

/** The guide down a container's whole visible subtree. */
function containerGuide(
  nodes: readonly TreeNode[],
  byId: ReadonlyMap<string, TreeNode>,
  containerIndex: number,
): DropGuide {
  return {
    fromIndex: containerIndex + 1,
    toIndex: subtreeEnd(nodes, byId, containerIndex),
    left: guideLeft(nodes[containerIndex].depth),
  };
}

/** Whether the row at `index` sits on the guide's run; the placeholder row carries the guide itself. */
export function onGuide(feedback: DropFeedback, index: number): boolean {
  return feedback.guide !== null && index >= feedback.guide.fromIndex && index < feedback.guide.toIndex;
}
