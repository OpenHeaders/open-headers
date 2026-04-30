/**
 * FolderDndTree — wraps a flat sidebar `TreeNode[]` with dnd-kit so
 * folder rows can be dragged to reorder their siblings under the same
 * parent. Tree-agnostic: the per-tree caller supplies the id prefixes,
 * a sibling-lookup callback against the appropriate parent mirror, and
 * a move callback that fires the entity-specific mutator.
 *
 * Slice 1 (same-parent only): cross-parent drops are rejected at
 * drop-time. The mutator catalog supports cross-parent moves; the
 * UX gesture for that lands in a later slice.
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
   *  `TemplateFolderParentRef`) and the mutator binding. */
  moveFolder(input: { folderUid: string; parent: FolderDndParent; orderKey: string }): void;
}

interface FolderDndTreeProps {
  nodes: readonly TreeNode[];
  renderNode: (node: TreeNode) => React.ReactNode;
  config: FolderDndConfig;
}

function stripPrefix(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
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
  // out of the sortable set, so they're never drop targets.
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
      if (activeNode.kind !== 'folder' || overNode.kind !== 'folder') return;
      // Same-parent gate (slice 1).
      if (activeNode.parentId !== overNode.parentId) return;
      const parentId = activeNode.parentId;
      if (!parentId) return;

      const folderUid = stripPrefix(activeNode.id, config.folderIdPrefix);
      const overFolderUid = stripPrefix(overNode.id, config.folderIdPrefix);
      if (!folderUid || !overFolderUid) return;

      const collectionUid = stripPrefix(parentId, config.collectionIdPrefix);
      const parentFolderUid = stripPrefix(parentId, config.folderIdPrefix);
      const parent: FolderDndParent | null = collectionUid
        ? { kind: 'collection', uid: collectionUid }
        : parentFolderUid
          ? { kind: 'folder', uid: parentFolderUid }
          : null;
      if (!parent) return;

      const siblings = config.lookupSiblings(parent);
      const orderKey = computeMoveOrderKey(siblings, folderUid, overFolderUid);
      if (orderKey === null) return;

      config.moveFolder({ folderUid, parent, orderKey });
    },
    [byId, config],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {nodes.map((node) =>
          node.kind === 'folder' && node.id.startsWith(config.folderIdPrefix) ? (
            <SortableFolderRow key={node.id} id={node.id}>
              {renderNode(node)}
            </SortableFolderRow>
          ) : (
            <div key={node.id}>{renderNode(node)}</div>
          ),
        )}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Compute the orderKey for a same-parent move. Returns `null` when the
 * move is a no-op (active and over are already in the same slot —
 * happens at drag-start jitter).
 */
function computeMoveOrderKey(
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
