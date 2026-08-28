/**
 * tree-dnd-placement — pure resolver from a (zone, active, over) drag
 * tuple to the one `moveChild` call the drop makes:
 *
 *   folder     → { folderUid, parent, oldParent?, orderKey }
 *   leaf       → { entityType, uid, parent, oldParent?, orderKey }
 *   collection → { uid, orderKey }            (roots reorder only)
 *
 * Zones (the tree containment plan, slice 7):
 *
 *   - folder over folder: 'before' / 'after' = sibling of the over
 *     folder (its parent becomes the new parent); 'into' = child of
 *     the over folder, head of its folder run.
 *   - folder over collection: 'into', head of the folder run.
 *   - folder over leaf: 'into' that leaf's parent, tail of the folder
 *     run (the whole leaf row) — right above the leaves.
 *   - leaf over leaf: 'before' / 'after' = sibling in the over leaf's
 *     parent, keyed between the neighbours' live `items` keys.
 *   - leaf over folder or collection: 'into', head of the `items` run
 *     (the whole row).
 *
 * 'into' lands at the HEAD of the run because that is where the
 * pointer is: the container row's bottom edge meets its first child's
 * top edge, and the two resolutions there must name the same spot —
 * a tail landing would sit rows away and the placeholder would leap
 * between the container's first and last row as the layout shifted.
 *   - collection over collection: 'before' / 'after' on the tree's
 *     roots set. Collections never nest and never receive one.
 *
 * A multi-item drop (`computeDropPlacements`) moves every selected
 * participant of the tree: items are grouped by role in their visible
 * order, each group's first item resolves as above and the rest take
 * keys strictly between it and the next live sibling, so the group
 * lands together in its run, in the order it was seen. A selected
 * child of a selected folder travels with the folder and is not moved
 * on its own; a drop onto one of the moved rows is rejected.
 *
 * Keys come from the live mirrors the caller supplies; `path` is a
 * projection and is never part of the result. A drop resolves to
 * `move` (one placement per row), `stay` (the rows' own slot — a
 * sibling insert right where they already sit, or into the parent
 * they are already in; the drag feedback shows the slot, the drop
 * writes nothing) or `rejected` (cycle, foreign row, onto a moving
 * row); the single-row form returns the placement or `null`.
 *
 * Pure — no React, no dnd-kit; the dnd component supplies every input
 * and dispatches the result.
 */

import type { TreeLeafEntityType } from '@openheaders/ui/shared/sync/tree-move-write-client';
import {
  computeAppendSlot,
  computePrependSlot,
  computeSiblingInsertSlot,
  isDescendantOf,
  type KeySlot,
  type LiveSiblings,
  mintKeysAfter,
} from './tree-dnd-helpers';
import {
  parentFromId,
  parentOf,
  roleOf,
  sameParent,
  type TreeDndIdConfig,
  type TreeDndParent,
  type TreeDndRole,
} from './tree-dnd-ids';
import type { DropZone } from './tree-dnd-zone';
import type { TreeNode } from './types';

export type DropPlacement =
  | { kind: 'folder'; folderUid: string; parent: TreeDndParent; oldParent?: TreeDndParent; orderKey: string }
  | {
      kind: 'leaf';
      entityType: TreeLeafEntityType;
      uid: string;
      parent: TreeDndParent;
      oldParent?: TreeDndParent;
      orderKey: string;
    }
  | { kind: 'collection'; uid: string; orderKey: string };

/** The live order reads a placement needs: one per set a child can land in. */
export interface TreeDndLookups {
  /** A parent's live `folders` slots. */
  lookupSiblings(parent: TreeDndParent): LiveSiblings;
  /** A parent's live `items` slots. */
  lookupItems(parent: TreeDndParent): LiveSiblings;
  /** The tree's live collection slots on the workspace roots. */
  lookupCollections(): LiveSiblings;
}

export interface DropPlacementInput extends TreeDndLookups {
  zone: DropZone;
  activeNode: TreeNode;
  overNode: TreeNode;
  byId: ReadonlyMap<string, TreeNode>;
  config: TreeDndIdConfig;
}

export interface DropPlacementsInput extends TreeDndLookups {
  zone: DropZone;
  /** The moved rows in visible order — the dragged row, or the selection it belongs to. */
  activeNodes: readonly TreeNode[];
  overNode: TreeNode;
  byId: ReadonlyMap<string, TreeNode>;
  config: TreeDndIdConfig;
}

export type DropResolution = { kind: 'move'; placements: DropPlacement[] } | { kind: 'stay' } | { kind: 'rejected' };

export function computeDropPlacement(input: DropPlacementInput): DropPlacement | null {
  const resolved = resolveDrop(input);
  return resolved === null || resolved === 'stay' ? null : resolved.placement;
}

/** One placement per moved row; empty when the drop is rejected or a no-op. */
export function computeDropPlacements(input: DropPlacementsInput): DropPlacement[] {
  const resolution = resolveDropPlacements(input);
  return resolution.kind === 'move' ? resolution.placements : [];
}

export function resolveDropPlacements(input: DropPlacementsInput): DropResolution {
  const { activeNodes, overNode, byId, config } = input;
  const moving = new Set(activeNodes.map((n) => n.id));
  if (moving.has(overNode.id)) return { kind: 'rejected' };
  const folderIds = activeNodes.filter((n) => roleOf(n, config)?.role === 'folder').map((n) => n.id);
  const carried = (node: TreeNode): boolean => folderIds.some((id) => id !== node.id && isDescendantOf(id, node, byId));

  const groups = new Map<TreeDndRole['role'], TreeNode[]>();
  for (const node of activeNodes) {
    const role = roleOf(node, config);
    if (!role || carried(node)) continue;
    const group = groups.get(role.role) ?? [];
    group.push(node);
    groups.set(role.role, group);
  }

  const out: DropPlacement[] = [];
  let stays = false;
  for (const group of groups.values()) {
    const resolved = resolveDrop({ ...input, activeNode: group[0] });
    if (resolved === null) continue;
    if (resolved === 'stay') {
      stays = true;
      continue;
    }
    out.push(resolved.placement);
    const keys = mintKeysAfter(resolved.slot, group.length - 1);
    for (const [i, node] of group.slice(1).entries()) {
      const follower = withIdentity(resolved.placement, node, keys[i], config);
      if (follower) out.push(follower);
    }
  }
  if (out.length > 0) return { kind: 'move', placements: out };
  return stays ? { kind: 'stay' } : { kind: 'rejected' };
}

interface ResolvedDrop {
  placement: DropPlacement;
  slot: KeySlot;
}

/** `null` = rejected, `'stay'` = the row's own slot. */
function resolveDrop(input: DropPlacementInput): ResolvedDrop | 'stay' | null {
  const { activeNode, overNode, byId, config } = input;
  if (activeNode.id === overNode.id) return null;
  const active = roleOf(activeNode, config);
  const over = roleOf(overNode, config);
  if (!active || !over) return null;

  if (active.role === 'collection') {
    if (over.role !== 'collection' || input.zone === 'into') return null;
    const slot = computeSiblingInsertSlot(input.lookupCollections(), active.uid, over.uid, input.zone);
    return slot === null
      ? 'stay'
      : { placement: { kind: 'collection', uid: active.uid, orderKey: slot.orderKey }, slot };
  }
  if (over.role === 'collection' && input.zone !== 'into') return null;

  const oldParent = parentOf(activeNode, config);
  if (!oldParent) return null;
  // Cycle guard: never drop a folder into (or beside a row inside) its own subtree.
  if (active.role === 'folder' && isDescendantOf(activeNode.id, overNode, byId)) return null;

  return active.role === 'folder'
    ? placeFolder(input, active.uid, oldParent, over)
    : placeLeaf(input, active.uid, active.entityType, oldParent, over);
}

function placed(
  base: { kind: 'folder'; folderUid: string } | { kind: 'leaf'; entityType: TreeLeafEntityType; uid: string },
  parent: TreeDndParent,
  oldParent: TreeDndParent,
  slot: KeySlot | null,
): ResolvedDrop | 'stay' {
  if (slot === null) return 'stay';
  const linkage = { parent, ...(sameParent(parent, oldParent) ? {} : { oldParent }), orderKey: slot.orderKey };
  return { placement: { ...base, ...linkage }, slot };
}

function placeFolder(
  input: DropPlacementInput,
  folderUid: string,
  oldParent: TreeDndParent,
  over: TreeDndRole,
): ResolvedDrop | 'stay' | null {
  const { zone, overNode, config } = input;
  const base = { kind: 'folder', folderUid } as const;

  if (over.role === 'leaf') {
    // Into the leaf's parent, tail of its folder run.
    const parent = parentOf(overNode, config);
    return parent ? placed(base, parent, oldParent, computeAppendSlot(input.lookupSiblings(parent), folderUid)) : null;
  }
  if (zone === 'into') {
    const parent = parentFromId(overNode.id, config);
    if (!parent) return null;
    if (sameParent(parent, oldParent)) return 'stay';
    return placed(base, parent, oldParent, computePrependSlot(input.lookupSiblings(parent), folderUid));
  }
  // 'before' / 'after' on a folder: its parent becomes ours (or stays ours).
  const parent = parentOf(overNode, config);
  if (!parent) return null;
  return placed(
    base,
    parent,
    oldParent,
    computeSiblingInsertSlot(input.lookupSiblings(parent), folderUid, over.uid, zone),
  );
}

function placeLeaf(
  input: DropPlacementInput,
  uid: string,
  entityType: TreeLeafEntityType,
  oldParent: TreeDndParent,
  over: TreeDndRole,
): ResolvedDrop | 'stay' | null {
  const { zone, overNode, config } = input;
  const base = { kind: 'leaf', entityType, uid } as const;

  if (over.role === 'leaf') {
    if (zone === 'into') return null;
    const parent = parentOf(overNode, config);
    return parent
      ? placed(base, parent, oldParent, computeSiblingInsertSlot(input.lookupItems(parent), uid, over.uid, zone))
      : null;
  }
  // A container row: into it, head of its items run.
  const parent = parentFromId(overNode.id, config);
  if (!parent) return null;
  if (sameParent(parent, oldParent)) return 'stay';
  return placed(base, parent, oldParent, computePrependSlot(input.lookupItems(parent), uid));
}

/** The group leader's placement re-addressed to a follower row with its own key and old parent. */
function withIdentity(
  leader: DropPlacement,
  node: TreeNode,
  orderKey: string,
  config: TreeDndIdConfig,
): DropPlacement | null {
  const role = roleOf(node, config);
  if (!role) return null;
  if (leader.kind === 'collection') {
    return role.role === 'collection' ? { kind: 'collection', uid: role.uid, orderKey } : null;
  }
  const oldParent = parentOf(node, config);
  if (!oldParent) return null;
  const linkage = { parent: leader.parent, ...(sameParent(leader.parent, oldParent) ? {} : { oldParent }), orderKey };
  if (leader.kind === 'folder')
    return role.role === 'folder' ? { kind: 'folder', folderUid: role.uid, ...linkage } : null;
  return role.role === 'leaf' ? { kind: 'leaf', entityType: role.entityType, uid: role.uid, ...linkage } : null;
}
