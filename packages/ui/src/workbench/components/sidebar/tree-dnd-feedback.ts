/**
 * tree-dnd-feedback — where the drag feedback renders for a live drop
 * target, in the flat `nodes` order:
 *
 *   - the insertion placeholder: before the over row ('before'), after
 *     the over row's visible subtree at the row's depth ('after'), or
 *     at the head of the run the row lands in ('into': a folder right
 *     under the container row, a leaf right after the container's
 *     folder run; a folder dropped on a leaf lands at the end of the
 *     leaf's parent's folder run — the same spot, seen from below);
 *   - the drop guide: the indent guide of the parent the drop lands in,
 *     painted from the parent's first child row down to the
 *     placeholder so the eye follows the line up to the container.
 *     A drop on the roots (no parent row) has no guide.
 *
 * Pure — the dnd component paints what this resolves.
 */

import { isDescendantOf } from './tree-dnd-helpers';
import type { TreeDndRole } from './tree-dnd-ids';
import type { DropZone } from './tree-dnd-zone';
import { CARET_SLOT, ROW_MARGIN, rowPaddingLeft } from './tree-geometry';
import type { TreeNode } from './types';

export interface DropPlaceholder {
  /** Renders before the row at `index` (past the end = after the last row). */
  index: number;
  depth: number;
}

export interface DropGuide {
  /** The first row the guide runs through; it runs to the placeholder inclusive. */
  fromIndex: number;
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

/** The index of the container's first direct child that is not a folder — where its items run starts. */
export function itemsHead(
  nodes: readonly TreeNode[],
  byId: ReadonlyMap<string, TreeNode>,
  containerIndex: number,
): number {
  const container = nodes[containerIndex];
  let i = containerIndex + 1;
  while (i < nodes.length && isDescendantOf(container.id, nodes[i], byId)) {
    if (nodes[i].depth === container.depth + 1 && nodes[i].kind !== 'folder') return i;
    i++;
  }
  return i;
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
  activeRole: TreeDndRole['role'],
): DropFeedback {
  const overIndex = nodes.findIndex((n) => n.id === overNode.id);
  if (zone === 'into') {
    const containerIndex =
      overNode.kind === 'leaf' && overNode.parentId ? nodes.findIndex((n) => n.id === overNode.parentId) : overIndex;
    const container = nodes[containerIndex];
    const index =
      activeRole === 'folder' && overNode.kind !== 'leaf' ? containerIndex + 1 : itemsHead(nodes, byId, containerIndex);
    return {
      placeholder: { index, depth: container.depth + 1 },
      guide: { fromIndex: containerIndex + 1, left: guideLeft(container.depth) },
    };
  }
  const placeholder =
    zone === 'before'
      ? { index: overIndex, depth: overNode.depth }
      : { index: subtreeEnd(nodes, byId, overIndex), depth: overNode.depth };
  const parentIndex = overNode.parentId ? nodes.findIndex((n) => n.id === overNode.parentId) : -1;
  const guide = parentIndex < 0 ? null : { fromIndex: parentIndex + 1, left: guideLeft(nodes[parentIndex].depth) };
  return { placeholder, guide };
}

/** Whether the row at `index` sits on the guide's run — the rows before the placeholder, which renders
 *  ahead of the row at its own index and carries the guide itself. */
export function onGuide(feedback: DropFeedback, index: number): boolean {
  return feedback.guide !== null && index >= feedback.guide.fromIndex && index < feedback.placeholder.index;
}
