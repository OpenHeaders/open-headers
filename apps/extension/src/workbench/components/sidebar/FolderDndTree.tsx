/**
 * FolderDndTree — wraps a flat sidebar `TreeNode[]` with dnd-kit so
 * folder rows can be dragged across three gestures:
 *
 *   1. **Same-parent reorder** — drop folder X on a sibling Y under the
 *      same parent. Hovering on the row's middle band reparents (no-op
 *      for same-parent); top / bottom bands inserts above / below via
 *      `keyBetween` on the parent's live siblings.
 *   2. **Cross-parent reparent (INTO)** — drop folder X on the middle
 *      band of a different folder Y, or on a collection row C. The
 *      drop target becomes X's new parent; X is appended at the end of
 *      that parent's child set.
 *   3. **Cross-parent sibling-insert (BEFORE / AFTER)** — drop folder X
 *      on the top or bottom edge of a folder Y in a different parent.
 *      Y's parent becomes X's new parent; X is inserted immediately
 *      above or below Y. This is the gesture session 45 deferred —
 *      cleanly separates "drop INTO Y" from "drop AS SIBLING of Y".
 *
 * Tree-agnostic: the per-tree caller supplies the id prefixes, a
 * sibling-lookup callback against the appropriate parent mirror, and
 * a move callback that fires the entity-specific mutator. All three
 * gestures route through the same `moveFolder` callback; the only
 * variation is whether `oldParent` is set (cross-parent) or omitted
 * (same-parent reorder).
 *
 * Cycle guard: drops onto X's own descendants are rejected at the UI
 * level — the catalog would accept the cyclic addToSet but the parent
 * walk in folder-tree post-state would later orphan the folder. UI
 * rejection has the cleaner failure mode (drop is rejected; user sees
 * no change instead of a vanished folder).
 *
 * Sibling order is parent-owned (§23.5). The dnd component is purely
 * the gesture surface — pure placement math lives in
 * `folder-dnd-placement.ts`, classification in `folder-dnd-zone.ts`,
 * id resolution in `folder-dnd-ids.ts`, helper math in
 * `folder-dnd-helpers.ts`. Each module is independently testable.
 */

import type { ClientRect, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { computeDropPlacement } from './folder-dnd-placement';
import type { FolderDndParent, FolderDndIdConfig } from './folder-dnd-ids';
import type { DropZone } from './folder-dnd-zone';
import { classifyDropZone } from './folder-dnd-zone';
import type { TreeNode } from './types';

// Re-export public identity types + pure helpers so existing
// consumers (Sidebar.tsx, the helper test suite) keep one import
// surface.
export type { FolderDndParent } from './folder-dnd-ids';
export {
  computeMoveOrderKey,
  computeSiblingInsertOrderKey,
  isDescendantOf,
} from './folder-dnd-helpers';

export interface FolderDndConfig extends FolderDndIdConfig {
  /** Read the parent's live ordered child-folder slots. The dnd surface
   *  consults this on drop to compute the new fractional orderKey. */
  lookupSiblings(parent: FolderDndParent): ReadonlyArray<{ itemId: string; orderKey: string }>;
  /** Fire the entity-specific move mutator. The caller-side hook owns
   *  the parent-ref shape (`FolderParentRef` / `RequestFolderParentRef` /
   *  `TemplateFolderParentRef`) and the mutator binding. `oldParent`
   *  is set for the cross-parent paths and omitted for the
   *  same-parent reorder path. */
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

interface DragOverState {
  overId: string;
  zone: DropZone;
}

function activePointerY(activeRect: ClientRect | null): number | null {
  if (!activeRect) return null;
  return activeRect.top + activeRect.height / 2;
}

export function FolderDndTree({ nodes, renderNode, config }: FolderDndTreeProps): React.ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => new Map<string, TreeNode>(nodes.map((n) => [n.id, n])), [nodes]);

  // Sortable participants: folder rows whose id matches our prefix.
  // Foreign-tree folder rows that share the kind but not the prefix
  // stay out of the sortable set, so they're never sortable drop
  // targets.
  const sortableIds = useMemo(
    () =>
      nodes
        .filter((n) => n.kind === 'folder' && n.id.startsWith(config.folderIdPrefix))
        .map((n) => n.id),
    [nodes, config.folderIdPrefix],
  );

  const [dragOver, setDragOver] = useState<DragOverState | null>(null);

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const { active, over } = e;
      if (!over) {
        setDragOver(null);
        return;
      }
      const overNode = byId.get(String(over.id));
      const activeNode = byId.get(String(active.id));
      if (!overNode || !activeNode) {
        setDragOver(null);
        return;
      }

      // Foreign rows / non-participants: clear indicator.
      const overIsFolder =
        overNode.kind === 'folder' && overNode.id.startsWith(config.folderIdPrefix);
      const overIsCollection =
        overNode.kind === 'group' && overNode.id.startsWith(config.collectionIdPrefix);
      if (!overIsFolder && !overIsCollection) {
        setDragOver(null);
        return;
      }

      // Collections accept only 'into' — there's no sibling-above /
      // below for a top-level container row.
      if (overIsCollection) {
        setDragOver({ overId: overNode.id, zone: 'into' });
        return;
      }

      const pointerY = activePointerY(active.rect.current.translated);
      if (pointerY === null) {
        setDragOver({ overId: overNode.id, zone: 'into' });
        return;
      }
      const zone = classifyDropZone(pointerY, over.rect);
      setDragOver((prev) =>
        prev && prev.overId === overNode.id && prev.zone === zone ? prev : { overId: overNode.id, zone },
      );
    },
    [byId, config.collectionIdPrefix, config.folderIdPrefix],
  );

  const clearDragOver = useCallback(() => setDragOver(null), []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const finalZone = dragOver?.zone ?? 'into';
      setDragOver(null);

      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const activeNode = byId.get(String(active.id));
      const overNode = byId.get(String(over.id));
      if (!activeNode || !overNode) return;

      const placement = computeDropPlacement({
        zone: finalZone,
        activeNode,
        overNode,
        byId,
        config,
        lookupSiblings: config.lookupSiblings,
      });
      if (!placement) return;

      config.moveFolder({
        folderUid: placement.folderUid,
        parent: placement.parent,
        orderKey: placement.orderKey,
        oldParent: placement.oldParent,
      });
    },
    [byId, config, dragOver],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragOver}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => {
          if (node.kind === 'folder' && node.id.startsWith(config.folderIdPrefix)) {
            const indicator = dragOver?.overId === node.id ? dragOver.zone : null;
            return (
              <SortableFolderRow key={node.id} id={node.id} indicator={indicator}>
                {renderNode(node)}
              </SortableFolderRow>
            );
          }
          if (node.kind === 'group' && node.id.startsWith(config.collectionIdPrefix)) {
            const isInto = dragOver?.overId === node.id && dragOver.zone === 'into';
            return (
              <DroppableContainerRow key={node.id} id={node.id} active={isInto}>
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

const INDICATOR_LINE_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  background: 'var(--ant-color-primary)',
  borderRadius: 1,
  pointerEvents: 'none',
};

function SortableFolderRow({
  id,
  children,
  indicator,
}: {
  id: string;
  children: React.ReactNode;
  indicator: DropZone | null;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    background:
      indicator === 'into' && !isDragging ? 'var(--ant-color-primary-bg)' : undefined,
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle} {...attributes} {...listeners}>
      {indicator === 'before' && !isDragging && (
        <div style={{ ...INDICATOR_LINE_STYLE, top: -1 }} aria-hidden />
      )}
      {children}
      {indicator === 'after' && !isDragging && (
        <div style={{ ...INDICATOR_LINE_STYLE, bottom: -1 }} aria-hidden />
      )}
    </div>
  );
}

function DroppableContainerRow({
  id,
  children,
  active,
}: {
  id: string;
  children: React.ReactNode;
  active: boolean;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id });
  const highlight = active || isOver;
  const style: React.CSSProperties = {
    background: highlight ? 'var(--ant-color-primary-bg)' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}
