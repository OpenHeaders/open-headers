/**
 * FolderDndTree — wraps a flat sidebar `TreeNode[]` with dnd-kit so
 * folder rows in the rules tree can be dragged to reorder their
 * siblings under the same parent.
 *
 * Slice 1 (same-parent only): cross-parent drops are rejected at
 * drop-time. The mutator catalog supports cross-parent moves; the
 * UX gesture for that lands in a later slice.
 *
 * Sibling order is parent-owned (§23.5). On drop, the new orderKey
 * is minted via `keyBetween(prev, next)` from the parent's live
 * `folders` ordered set on either the collection-sync-mirror or the
 * folder-sync-mirror, depending on parent kind.
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
import { useFolderMutator } from '@/hooks/useFolderMutator';
import { getActiveCollectionSyncMirror } from '@/context/collection-sync-mirror';
import { getActiveFolderSyncMirror } from '@/context/folder-sync-mirror';
import type { TreeNode } from './types';

const FOLDERS_PATH = 'folders';
const SURFACE_ID = 'workbench';

interface FolderDndTreeProps {
  workspaceId: string | null;
  nodes: readonly TreeNode[];
  renderNode: (node: TreeNode) => React.ReactNode;
}

/** Strip the conventional `folder-` / `col-` prefix from a tree-node id. */
function stripPrefix(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

export function FolderDndTree({ workspaceId, nodes, renderNode }: FolderDndTreeProps): React.ReactElement {
  const { moveFolder } = useFolderMutator({ workspaceId, surfaceId: SURFACE_ID });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Map id → node for fast lookups in onDragEnd.
  const byId = new Map<string, TreeNode>(nodes.map((n) => [n.id, n]));

  // Sortable participants: the folder rows. Non-folder rows pass through
  // the renderer unchanged (group / placeholder / leaf — none of them
  // participate in this gesture).
  const sortableIds = nodes.filter((n) => n.kind === 'folder').map((n) => n.id);

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

      const folderUid = stripPrefix(activeNode.id, 'folder-');
      const overFolderUid = stripPrefix(overNode.id, 'folder-');
      if (!folderUid || !overFolderUid) return;

      // Resolve parent kind + uid from the parent id prefix.
      const collectionUid = stripPrefix(parentId, 'col-');
      const parentFolderUid = stripPrefix(parentId, 'folder-');
      let siblings: Array<{ itemId: string; orderKey: string }>;
      let parent: { type: 'collection' | 'folder'; uid: string };
      if (collectionUid) {
        siblings = getActiveCollectionSyncMirror().liveOrderedSetItems(collectionUid, FOLDERS_PATH);
        parent = { type: 'collection', uid: collectionUid };
      } else if (parentFolderUid) {
        siblings = getActiveFolderSyncMirror().liveOrderedSetItems(parentFolderUid, FOLDERS_PATH);
        parent = { type: 'folder', uid: parentFolderUid };
      } else {
        return;
      }

      const orderKey = computeMoveOrderKey(siblings, folderUid, overFolderUid);
      if (orderKey === null) return;

      void moveFolder({ folderUid, newParent: parent, orderKey });
    },
    [byId, moveFolder],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {nodes.map((node) =>
          node.kind === 'folder' ? (
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
 * move is a no-op (active and over already adjacent in the target
 * direction — happens at drag-start jitter).
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
