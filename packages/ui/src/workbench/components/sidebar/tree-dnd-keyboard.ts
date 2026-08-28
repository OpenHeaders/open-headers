/**
 * tree-dnd-keyboard — the keyboard half of the sidebar's move gesture.
 * Alt+↑ / Alt+↓ move the focused row before its previous / after its
 * next sibling (folders and leaves share one order; collections move
 * among collections); Alt+→ moves it into the nearest folder above it
 * in the same parent; Alt+← moves it out of its folder to sit right
 * after that folder. Every direction resolves to the same
 * `DropPlacement` a pointer drop produces, so both paths make the one
 * `moveChild` call.
 *
 * Siblings are read off the flat visible row list: the focused row is
 * visible, so its parent is expanded and every sibling is listed.
 */

import { parentOf, roleOf, type TreeDndIdConfig } from './tree-dnd-ids';
import { computeDropPlacement, type DropPlacement, type TreeDndLookups } from './tree-dnd-placement';
import type { TreeNode } from './types';

export type MoveDirection = 'up' | 'down' | 'into' | 'out';

export interface KeyboardMoveInput extends TreeDndLookups {
  direction: MoveDirection;
  activeNode: TreeNode;
  /** The visible rows, in render order. */
  nodes: readonly TreeNode[];
  byId: ReadonlyMap<string, TreeNode>;
  config: TreeDndIdConfig;
}

/** The Alt+Arrow chord for a keydown, `null` for any other key. */
export function moveDirectionForKey(e: {
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): MoveDirection | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return null;
  switch (e.key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowRight':
      return 'into';
    case 'ArrowLeft':
      return 'out';
    default:
      return null;
  }
}

export function computeKeyboardMove(input: KeyboardMoveInput): DropPlacement | null {
  const { direction, activeNode, nodes, config } = input;
  const active = roleOf(activeNode, config);
  if (!active) return null;

  const among = active.role === 'collection' ? 'collection' : 'child';
  const siblings = nodes.filter((n) => {
    if (n.parentId !== activeNode.parentId) return false;
    const role = roleOf(n, config)?.role;
    return role !== undefined && (role === 'collection' ? 'collection' : 'child') === among;
  });
  const index = siblings.findIndex((n) => n.id === activeNode.id);
  if (index < 0) return null;

  if (direction === 'up' || direction === 'down') {
    const over = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!over) return null;
    return computeDropPlacement({ ...input, zone: direction === 'up' ? 'before' : 'after', overNode: over });
  }
  if (active.role === 'collection') return null;

  if (direction === 'into') {
    const target = nearestFolderAbove(nodes, activeNode, config);
    return target ? computeDropPlacement({ ...input, zone: 'into', overNode: target }) : null;
  }

  return moveOut(input);
}

/** The closest folder row above the active row inside the same parent. */
function nearestFolderAbove(
  nodes: readonly TreeNode[],
  activeNode: TreeNode,
  config: TreeDndIdConfig,
): TreeNode | null {
  const at = nodes.findIndex((n) => n.id === activeNode.id);
  for (let i = at - 1; i >= 0; i--) {
    const candidate = nodes[i];
    if (candidate.parentId !== activeNode.parentId) continue;
    if (roleOf(candidate, config)?.role === 'folder') return candidate;
  }
  return null;
}

/** Out of a folder: a sibling right after that folder, in its parent. */
function moveOut(input: KeyboardMoveInput): DropPlacement | null {
  const { activeNode, byId, config } = input;
  const oldParent = parentOf(activeNode, config);
  const parentNode = activeNode.parentId ? byId.get(activeNode.parentId) : undefined;
  if (!oldParent || !parentNode || oldParent.kind !== 'folder') return null;
  return computeDropPlacement({ ...input, zone: 'after', overNode: parentNode });
}
