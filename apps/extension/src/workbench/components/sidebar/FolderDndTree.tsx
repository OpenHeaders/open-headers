/**
 * FolderDndTree — wraps a flat sidebar `TreeNode[]` with dnd-kit so
 * folder rows can be dragged across two gestures:
 *
 *   1. **Same-parent reorder** — drop folder X on a sibling Y under
 *      the same parent. Emits a single `moveBefore` envelope with the
 *      fractional `keyBetween(prev, next)` key.
 *   2. **Cross-parent reparent** — drop folder X on a different folder
 *      Y, or on a collection row C. The drop target becomes X's new
 *      parent; X is appended at the end of that parent's child set.
 *      Emits the atomic `removeFromSet(oldParent.folders) +
 *      addToSet(newParent.folders)` batch via the catalog's reparent
 *      branch (§7.2 + §11.2 — per-batch all-or-nothing).
 *
 * Tree-agnostic: the per-tree caller supplies the id prefixes, a
 * sibling-lookup callback against the appropriate parent mirror, and
 * a move callback that fires the entity-specific mutator.
 *
 * Cycle guard: drops onto X's own descendants are rejected at the UI
 * level. The mutator would technically apply, but the parent walk
 * would fail to resolve a path and the folder would orphan from the
 * tree. Reject before firing.
 *
 * Sibling order is parent-owned (§23.5). On drop, the new orderKey
 * is minted via `keyBetween(prev, next)` from the parent's live
 * `folders` ordered set on the supplied mirror.
 */

import type { DragEndEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { keyBetween, seedKey } from '@openheaders/core/sync';
import type React from 'react';
import { useCallback } from 'react';
import type { TreeNode } from './types';

export interface FolderDndParent {
  kind: 'collection' | 'folder';
  uid: string;
}

export interface FolderDndConfig {
  /** Prefix for collection-row tree-node ids (e.g. `col-`, `req-col-`,
   *  `tpl-col-`). When stripped, leaves the bare collection uid. */
  collectionIdPrefix: string;
  /** Prefix for folder-row tree-node ids (e.g. `folder-`, `req-folder-`,
   *  `tpl-folder-`). When stripped, leaves the bare folder uid. */
  folderIdPrefix: string;
  /** Read the parent's live ordered child-folder slots. The dnd surface
   *  consults this on drop to compute the new fractional orderKey. */
  lookupSiblings(parent: FolderDndParent): Array<{ itemId: string; orderKey: string }>;
  /** Fire the entity-specific move mutator. The caller-side hook owns
   *  the parent-ref shape (`FolderParentRef` / `RequestFolderParentRef` /
   *  `TemplateFolderParentRef`) and the mutator binding. `oldParent`
   *  is required for the cross-parent reparent path; absent for the
   *  intra-parent reorder path. */
  moveFolder(input: {
    folderUid: string;
    parent: FolderDndParent;
    orderKey: string;
    oldParent?: FolderDndParent;
  }): void;
}

interface FolderDndTreeProps {
  nodes: readonly TreeNode[];
  renderNode: (node: TreeNode) => React.ReactNode;
  config: FolderDndConfig;
}

function stripPrefix(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

/** Resolve a tree-node id to a `FolderDndParent` ref via prefix match.
 *  Returns null when the id doesn't match either tree role (system
 *  rows, environment leaves, etc.). */
function parentFromId(id: string, config: FolderDndConfig): FolderDndParent | null {
  const collectionUid = stripPrefix(id, config.collectionIdPrefix);
  if (collectionUid) return { kind: 'collection', uid: collectionUid };
  const folderUid = stripPrefix(id, config.folderIdPrefix);
  if (folderUid) return { kind: 'folder', uid: folderUid };
  return null;
}

export function FolderDndTree({ nodes, renderNode, config }: FolderDndTreeProps): React.ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Map id → node for fast lookups in onDragEnd.
  const byId = new Map<string, TreeNode>(nodes.map((n) => [n.id, n]));

  // Sortable participants: folder rows whose id matches our prefix.
  // Other folders that may appear in the same tree (e.g. system-template
  // rows that share the kind: 'folder' tag but not the prefix) stay
  // out of the sortable set, so they're never sortable drop targets.
  const sortableIds = nodes
    .filter((n) => n.kind === 'folder' && n.id.startsWith(config.folderIdPrefix))
    .map((n) => n.id);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const activeNode = byId.get(String(active.id));
      const overNode = byId.get(String(over.id));
      if (!activeNode || !overNode) return;
      if (activeNode.kind !== 'folder' || !activeNode.id.startsWith(config.folderIdPrefix)) return;

      const folderUid = stripPrefix(activeNode.id, config.folderIdPrefix);
      if (!folderUid) return;

      const oldParent = activeNode.parentId ? parentFromId(activeNode.parentId, config) : null;
      if (!oldParent) return;

      // Same-parent reorder: over is a sibling folder under the same
      // parent. Use the existing moveBefore path with `keyBetween` on
      // adjacent neighbours after virtual remove.
      const sameParentSiblingDrop =
        overNode.kind === 'folder' &&
        overNode.id.startsWith(config.folderIdPrefix) &&
        overNode.parentId === activeNode.parentId;
      if (sameParentSiblingDrop) {
        const overFolderUid = stripPrefix(overNode.id, config.folderIdPrefix);
        if (!overFolderUid) return;
        const siblings = config.lookupSiblings(oldParent);
        const orderKey = computeMoveOrderKey(siblings, folderUid, overFolderUid);
        if (orderKey === null) return;
        config.moveFolder({ folderUid, parent: oldParent, orderKey });
        return;
      }

      // Cross-parent reparent: over is a folder in a different parent,
      // or a collection row. The drop target becomes the new parent.
      const newParent = parentFromId(overNode.id, config);
      if (!newParent) return;

      // Reject drops on the dragged folder's own current parent
      // (already there).
      if (newParent.kind === oldParent.kind && newParent.uid === oldParent.uid) return;

      // Cycle guard: reject drops onto descendants of the dragged
      // folder. Walking the over node's parentId chain and bailing if
      // we hit `activeNode.id` covers the case where over is INSIDE
      // active's subtree.
      if (isDescendantOf(activeNode.id, overNode, byId)) return;

      // The drag started against the rules tree's flat list; if the
      // user dropped on a row from a different tree (id prefix mismatch
      // for collection role), bail. `parentFromId` already gates this
      // by accepting only our prefixes.
      const newSiblings = config.lookupSiblings(newParent);
      const lastKey = newSiblings[newSiblings.length - 1]?.orderKey ?? null;
      const orderKey = lastKey === null ? seedKey() : keyBetween(lastKey, null);
      config.moveFolder({ folderUid, parent: newParent, orderKey, oldParent });
    },
    [byId, config],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => {
          if (node.kind === 'folder' && node.id.startsWith(config.folderIdPrefix)) {
            return (
              <SortableFolderRow key={node.id} id={node.id}>
                {renderNode(node)}
              </SortableFolderRow>
            );
          }
          if (node.kind === 'group' && node.id.startsWith(config.collectionIdPrefix)) {
            return (
              <DroppableContainerRow key={node.id} id={node.id}>
                {renderNode(node)}
              </DroppableContainerRow>
            );
          }
          return <div key={node.id}>{renderNode(node)}</div>;
        })}
      </SortableContext>
    </DndContext>
  );
}

/** Walk `over`'s parentId chain; return true if `activeId` appears.
 *  `activeId` IS a descendant of itself for the purpose of this guard
 *  (we never reparent a folder onto itself; the same-id check earlier
 *  already covers that). Exported for unit testing. */
export function isDescendantOf(
  activeId: string,
  overNode: TreeNode,
  byId: Map<string, TreeNode>,
): boolean {
  let cursor: TreeNode | undefined = overNode;
  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor.id)) return false;
    visited.add(cursor.id);
    if (cursor.id === activeId) return true;
    if (!cursor.parentId) return false;
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

/**
 * Compute the orderKey for a same-parent move. Returns `null` when the
 * move is a no-op (active and over are already in the same slot —
 * happens at drag-start jitter). Exported for unit testing.
 */
export function computeMoveOrderKey(
  siblings: ReadonlyArray<{ itemId: string; orderKey: string }>,
  movingUid: string,
  overUid: string,
): string | null {
  const fromIdx = siblings.findIndex((s) => s.itemId === movingUid);
  const overIdx = siblings.findIndex((s) => s.itemId === overUid);
  if (fromIdx < 0 || overIdx < 0) {
    // Mirror hasn't caught up — seed a fresh key. The mutator will
    // converge once the local broadcast lands.
    return seedKey();
  }
  if (fromIdx === overIdx) return null;

  const without = siblings.filter((s) => s.itemId !== movingUid);
  const overIdxInWithout = without.findIndex((s) => s.itemId === overUid);
  // dnd-kit convention: dragging DOWN places after `over`; dragging UP
  // places before `over`. The sortable strategy already animated the
  // intent — onDragEnd just commits.
  const insertIdx = fromIdx < overIdx ? overIdxInWithout + 1 : overIdxInWithout;
  const prev = without[insertIdx - 1]?.orderKey ?? null;
  const next = without[insertIdx]?.orderKey ?? null;
  return keyBetween(prev, next);
}

function SortableFolderRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    background: isOver && !isDragging ? 'var(--ant-color-primary-bg)' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DroppableContainerRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id });
  const style: React.CSSProperties = {
    background: isOver ? 'var(--ant-color-primary-bg)' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}
