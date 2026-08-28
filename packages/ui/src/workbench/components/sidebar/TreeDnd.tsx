/**
 * TreeDnd — wraps a flat sidebar `TreeNode[]` with dnd-kit so every
 * row of ONE tree moves by drag: folders (reorder, re-parent, sibling
 * insert across parents), leaves (reorder among siblings, into a
 * folder or collection), collections (reorder on the tree's roots).
 * Rows of other trees, response examples, drafts and system rows are
 * neither sources nor targets. Dragging a row that belongs to the
 * sidebar's multi-selection moves the whole selection (its tree's
 * participants, in visible order).
 *
 * Feedback follows the editor tab strip's placeholder contract: the
 * moving rows keep their slots as dashed empty placeholders and the
 * DragOverlay pill (the dock's `.rules-drag-preview`) carries the
 * content — one row's icon and label, or "N items" — hanging off the
 * pointer (the cursor sits a fifth of the way into the pill, centred
 * vertically, wherever the row was grabbed); when the pointer
 * is over a spot the drop would actually land in, an empty dashed row
 * appears there (at the row's own depth beside a sibling, one deeper
 * under a container, after the container's visible subtree) and the
 * source slots collapse so the item is never shown twice; leaving
 * every valid spot puts the tree back as it was. A container row that
 * would receive the drop is tinted as well. Sibling rows never slide —
 * the zone math reads the pointer, not a sorted preview.
 *
 * The gesture surface only: zone classification lives in
 * `tree-dnd-zone.ts`, placement math in `tree-dnd-placement.ts`, id
 * resolution in `tree-dnd-ids.ts`, key math in `tree-dnd-helpers.ts`.
 * A drop resolves to one placement per moved row and one config
 * `move`; the per-tree caller (`useTreeDndConfigs`) binds the mirrors
 * and the mutators. Drops into a folder's own subtree are rejected in
 * placement (the catalog would accept the cyclic addToSet and the
 * tree index would later break the cycle by rehoming).
 */

import type { ClientRect, DragEndEvent, DragOverEvent, DragStartEvent, Modifier } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { emptyPlaceholderStyle } from '../tabbar/tab-format';
import { rowPaddingLeft } from './tree-geometry';
import { isDescendantOf } from './tree-dnd-helpers';
import { type TreeDndIdConfig, roleOf } from './tree-dnd-ids';
import { computeDropPlacements, type DropPlacement, type TreeDndLookups } from './tree-dnd-placement';
import { classifyDropZone, classifySiblingZone, type DropZone } from './tree-dnd-zone';
import type { TreeNode } from './types';

export type { TreeDndParent } from './tree-dnd-ids';
export type { DropPlacement } from './tree-dnd-placement';

export interface TreeDndConfig extends TreeDndIdConfig, TreeDndLookups {
  /** Dispatch the resolved placements — one per moved row — to the entity mutators. */
  move(placements: DropPlacement[]): void;
}

interface TreeDndProps {
  nodes: readonly TreeNode[];
  renderNode: (node: TreeNode) => React.ReactNode;
  config: TreeDndConfig;
  /** The sidebar's multi-selection; a dragged member takes the whole selection along. */
  selectedIds: ReadonlySet<string>;
}

interface DragState {
  /** The rows the drop moves, in visible order. */
  moving: TreeNode[];
  /** Every row that travels — the moving rows and the subtrees of moving folders. */
  travelling: ReadonlySet<string>;
}

interface DragOverState {
  overId: string;
  zone: DropZone;
  placements: DropPlacement[];
  /** Where the insertion placeholder renders: before the row at `index` (nodes order), at `depth`. */
  placeholder: { index: number; depth: number };
}

function activePointerY(activeRect: ClientRect | null): number | null {
  if (!activeRect) return null;
  return activeRect.top + activeRect.height / 2;
}

/** The zone a row offers to the dragged row, `null` when it is no target. */
function zoneFor(
  active: ReturnType<typeof roleOf>,
  over: ReturnType<typeof roleOf>,
  pointerY: number | null,
  rect: ClientRect,
): DropZone | null {
  if (!active || !over) return null;
  if (active.role === 'collection') {
    return over.role === 'collection' ? (pointerY === null ? 'after' : classifySiblingZone(pointerY, rect)) : null;
  }
  if (over.role === 'collection') return 'into';
  if (over.role === 'leaf') {
    if (active.role === 'folder') return 'into';
    return pointerY === null ? 'after' : classifySiblingZone(pointerY, rect);
  }
  // Over a folder: a folder picks among three bands, a leaf only lands inside.
  if (active.role === 'leaf') return 'into';
  return pointerY === null ? 'into' : classifyDropZone(pointerY, rect);
}

/** Where the cursor sits inside the overlay pill, as a fraction of its width. */
const PILL_CURSOR_INSET = 0.2;

/**
 * Hang the overlay pill off the pointer instead of the grabbed row:
 * the overlay starts at the row's rect, so the grab offset inside that
 * rect is what the pill must give back, then the pill's own anchor.
 */
const anchorPillToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const grab = getEventCoordinates(activatorEvent);
  if (!grab) return transform;
  return {
    ...transform,
    x: transform.x + (grab.x - draggingNodeRect.left) - draggingNodeRect.width * PILL_CURSOR_INSET,
    y: transform.y + (grab.y - draggingNodeRect.top) - draggingNodeRect.height / 2,
  };
};

/** The index just past the over row's visible subtree. */
function subtreeEnd(nodes: readonly TreeNode[], byId: ReadonlyMap<string, TreeNode>, overIndex: number): number {
  const over = nodes[overIndex];
  let end = overIndex + 1;
  while (end < nodes.length && isDescendantOf(over.id, nodes[end], byId)) end++;
  return end;
}

export function TreeDnd({ nodes, renderNode, config, selectedIds }: TreeDndProps): React.ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => new Map<string, TreeNode>(nodes.map((n) => [n.id, n])), [nodes]);
  const participantIds = useMemo(() => nodes.filter((n) => roleOf(n, config) !== null).map((n) => n.id), [nodes, config]);
  const participants = useMemo(() => new Set(participantIds), [participantIds]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<DragOverState | null>(null);

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      const activeNode = byId.get(String(e.active.id));
      if (!activeNode) return;
      const moving = selectedIds.has(activeNode.id)
        ? nodes.filter((n) => (n.id === activeNode.id || selectedIds.has(n.id)) && participants.has(n.id))
        : [activeNode];
      const folderIds = moving.filter((n) => roleOf(n, config)?.role === 'folder').map((n) => n.id);
      const travelling = new Set(moving.map((n) => n.id));
      for (const node of nodes) {
        if (folderIds.some((id) => isDescendantOf(id, node, byId))) travelling.add(node.id);
      }
      setDrag({ moving, travelling });
    },
    [byId, config, nodes, participants, selectedIds],
  );

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const { active, over } = e;
      const overNode = over ? byId.get(String(over.id)) : undefined;
      const activeNode = byId.get(String(active.id));
      if (!over || !overNode || !activeNode || !drag || drag.travelling.has(overNode.id)) {
        setDragOver(null);
        return;
      }
      const zone = zoneFor(
        roleOf(activeNode, config),
        roleOf(overNode, config),
        activePointerY(active.rect.current.translated),
        over.rect,
      );
      if (zone === null) {
        setDragOver(null);
        return;
      }
      setDragOver((prev) => {
        if (prev && prev.overId === overNode.id && prev.zone === zone) return prev;
        const placements = computeDropPlacements({
          zone,
          activeNodes: drag.moving,
          overNode,
          byId,
          config,
          lookupSiblings: config.lookupSiblings,
          lookupItems: config.lookupItems,
          lookupCollections: config.lookupCollections,
        });
        if (placements.length === 0) return null;
        const overIndex = nodes.findIndex((n) => n.id === overNode.id);
        const placeholder =
          zone === 'before'
            ? { index: overIndex, depth: overNode.depth }
            : zone === 'after'
              ? { index: subtreeEnd(nodes, byId, overIndex), depth: overNode.depth }
              : { index: subtreeEnd(nodes, byId, overIndex), depth: overNode.depth + 1 };
        return { overId: overNode.id, zone, placements, placeholder };
      });
    },
    [byId, config, drag, nodes],
  );

  const clearDrag = useCallback(() => {
    setDrag(null);
    setDragOver(null);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const current = dragOver;
      clearDrag();
      if (!e.over || !current || current.overId !== String(e.over.id)) return;
      config.move(current.placements);
    },
    [clearDrag, config, dragOver],
  );

  const preview = useMemo(() => {
    if (!drag) return null;
    const [first] = drag.moving;
    if (drag.moving.length === 1 && first) {
      return (
        <div className="rules-drag-preview">
          <span className="rules-drag-preview-icon">{first.icon}</span>
          <span className="rules-drag-preview-label">{first.label}</span>
        </div>
      );
    }
    return (
      <div className="rules-drag-preview">
        <span className="rules-drag-preview-label">{t('workbench.sidebar.dnd.itemsCount', { count: drag.moving.length })}</span>
      </div>
    );
  }, [drag, t]);

  const placeholderRow = dragOver ? (
    <div
      key="tree-dnd-placeholder"
      className="rules-sidebar-item tree-dnd-placeholder"
      style={{ marginLeft: rowPaddingLeft(dragOver.placeholder.depth), ...emptyPlaceholderStyle(token) }}
      aria-hidden
    />
  ) : null;

  const rows: React.ReactNode[] = [];
  nodes.forEach((node, index) => {
    if (dragOver && dragOver.placeholder.index === index) rows.push(placeholderRow);
    if (!participants.has(node.id) && !drag?.travelling.has(node.id)) {
      rows.push(<div key={node.id}>{renderNode(node)}</div>);
      return;
    }
    const travelling = drag?.travelling.has(node.id) ?? false;
    rows.push(
      <SortableRow
        key={node.id}
        id={node.id}
        receiving={dragOver?.overId === node.id && dragOver.zone === 'into'}
        source={travelling ? (dragOver ? 'collapsed' : 'placeholder') : null}
        placeholderStyle={emptyPlaceholderStyle(token)}
      >
        {renderNode(node)}
      </SortableRow>,
    );
  });
  if (dragOver && dragOver.placeholder.index >= nodes.length) rows.push(placeholderRow);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDrag}
    >
      <SortableContext items={participantIds} strategy={verticalListSortingStrategy}>
        {rows}
      </SortableContext>
      <DragOverlay modifiers={[anchorPillToCursor]}>{preview}</DragOverlay>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
  receiving,
  source,
  placeholderStyle,
}: {
  id: string;
  children: React.ReactNode;
  /** The row would receive the drop inside it. */
  receiving: boolean;
  /** A travelling row: its slot stays as a dashed placeholder, or collapses while a target is live. */
  source: 'placeholder' | 'collapsed' | null;
  placeholderStyle: React.CSSProperties;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef } = useSortable({ id });

  const wrapperStyle: React.CSSProperties = {
    ...(source === 'collapsed' ? { display: 'none' } : null),
    ...(source === 'placeholder' ? { ...placeholderStyle, borderRadius: 4, margin: '0 4px' } : null),
    ...(receiving ? { background: 'var(--ant-color-primary-bg)' } : null),
  };

  // The whole row is the drag surface: the pointer sensor's distance
  // constraint keeps clicks and double-clicks on the row body from
  // starting a drag, and the keyboard sensor pairs with the focused row.
  return (
    <div ref={setNodeRef} className="folder-dnd-row" style={wrapperStyle} {...attributes} {...listeners}>
      <div style={source === 'placeholder' ? { visibility: 'hidden' } : undefined}>{children}</div>
    </div>
  );
}
