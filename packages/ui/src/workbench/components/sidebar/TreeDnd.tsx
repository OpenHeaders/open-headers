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
 * Feedback follows the editor tab strip's placeholder contract: at the
 * grab each moving row's slot becomes an empty dashed placeholder (a
 * moving folder's subtree collapses under it) and the DragOverlay pill
 * (the dock's `.rules-drag-preview`, compact) carries the content —
 * one row's icon and label, or "N items" — hanging off the pointer
 * (the cursor sits a fifth of the way into the pill, centred
 * vertically). Once the pointer reaches a spot the drop would land in,
 * the placeholder moves there — the source slots collapse and the
 * dashed row renders at the landing spot (at the row's own depth
 * beside a sibling, or one deeper at the head of the run inside a
 * container, right where the pointer is) — and the landing parent's indent
 * guide turns primary from its first child row down to it. The
 * landing spot is sticky: it only changes when another valid spot
 * resolves (the rows' own slot counts — the placeholder returns there
 * and the drop writes nothing), never blinks back, and the drop lands
 * where the placeholder shows. A container row that would receive the drop is
 * tinted as well. Sibling rows never slide — the zone math reads the
 * pointer, not a sorted preview. The source rows stay in layout until
 * the first landing spot (dnd-kit measures the active row right after
 * the start commit and positions the overlay from that rect — a hidden
 * row would measure as nothing).
 *
 * The landing spot tracks the pointer itself: the collision rect is
 * the pointer point (not the overlay pill's box, which is measured
 * once at mount with the translate already applied by then), the
 * target and the pointer's y are read from the fresh collision on
 * every move (dnd-kit's over callback fires only when the row changes,
 * and its move callback carries the previous render's over), a
 * different row takes over only past a few px of edge hysteresis, and
 * the rows are re-measured after every placeholder move — collapsing
 * a source slot and inserting the placeholder shifts the rows between
 * them by a row height, which dnd-kit's resize observers never see.
 *
 * The gesture surface only: zone classification lives in
 * `tree-dnd-zone.ts`, placement math in `tree-dnd-placement.ts`, the
 * placeholder and guide spots in `tree-dnd-feedback.ts`, id
 * resolution in `tree-dnd-ids.ts`, key math in `tree-dnd-helpers.ts`.
 * A drop resolves to one placement per moved row and one config
 * `move`; the per-tree caller (`useTreeDndConfigs`) binds the mirrors
 * and the mutators. Drops into a folder's own subtree are rejected in
 * placement (the catalog would accept the cyclic addToSet and the
 * tree index would later break the cycle by rehoming).
 */

import type {
  Collision,
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  Modifier,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { emptyPlaceholderStyle } from '../tabbar/tab-format';
import { rowPaddingLeft } from './tree-geometry';
import { computeDropFeedback, type DropFeedback, onGuide } from './tree-dnd-feedback';
import { isDescendantOf } from './tree-dnd-helpers';
import { type TreeDndIdConfig, roleOf } from './tree-dnd-ids';
import { type DropPlacement, resolveDropPlacements, type TreeDndLookups } from './tree-dnd-placement';
import { classifyDropZone, classifySiblingZone, type DropZone, type RowRect } from './tree-dnd-zone';
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
  feedback: DropFeedback;
}

/**
 * Closest row centre to the pointer point. The pointer's y and the
 * row's band rect ride on each collision: the move callback reads the
 * target from here, not from its `over` — dnd-kit hands the callback
 * the over of the previous render, one move behind the pointer.
 */
const pointerClosestCenter: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableRects } = args;
  if (!pointerCoordinates) return closestCenter(args);
  const { x, y } = pointerCoordinates;
  const collisions = closestCenter({
    ...args,
    collisionRect: { top: y, bottom: y, left: x, right: x, width: 0, height: 0 },
  });
  return collisions.map((c) => {
    const rect = droppableRects.get(c.id);
    return { ...c, data: { ...c.data, pointerY: y, top: rect?.top, height: rect?.height } };
  });
};

interface CollisionHit {
  id: string;
  pointerY: number;
  rect: RowRect;
}

function collisionHit(collisions: Collision[] | null): CollisionHit | null {
  const first = collisions?.[0];
  if (!first) return null;
  const { pointerY, top, height } = first.data ?? {};
  if (typeof pointerY !== 'number' || typeof top !== 'number' || typeof height !== 'number') return null;
  return { id: String(first.id), pointerY, rect: { top, height } };
}

/**
 * A different row takes the landing spot over only once the pointer
 * is this far inside it. At a row edge the two rows can name spots
 * rows apart (a leaf into a container lands after its folder run; into
 * the first folder lands right under it), and a resting hand's tremor
 * would toggle them.
 */
const EDGE_HYSTERESIS = 3;

function insideRow(hit: CollisionHit): boolean {
  const { pointerY, rect } = hit;
  return pointerY - rect.top >= EDGE_HYSTERESIS && rect.top + rect.height - pointerY >= EDGE_HYSTERESIS;
}

/** Re-measure the rows after every placeholder move, so the next collision reads the shifted layout. */
function RemeasureRows({ ids, signature }: { ids: UniqueIdentifier[]; signature: string }): null {
  const { measureDroppableContainers } = useDndContext();
  useLayoutEffect(() => {
    measureDroppableContainers(ids);
  }, [measureDroppableContainers, ids, signature]);
  return null;
}

/** The zone a row offers to the dragged row, `null` when it is no target. */
function zoneFor(
  active: ReturnType<typeof roleOf>,
  over: ReturnType<typeof roleOf>,
  pointerY: number,
  rect: RowRect,
): DropZone | null {
  if (!active || !over) return null;
  if (active.role === 'collection') {
    return over.role === 'collection' ? classifySiblingZone(pointerY, rect) : null;
  }
  if (over.role === 'collection') return 'into';
  if (over.role === 'leaf') {
    if (active.role === 'folder') return 'into';
    return classifySiblingZone(pointerY, rect);
  }
  // Over a folder: a folder picks among three bands, a leaf only lands inside.
  if (active.role === 'leaf') return 'into';
  return classifyDropZone(pointerY, rect);
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

  const handleDragMove = useCallback(
    (e: DragMoveEvent) => {
      const hit = collisionHit(e.collisions);
      const overNode = hit ? byId.get(hit.id) : undefined;
      const activeNode = byId.get(String(e.active.id));
      if (!hit || !overNode || !activeNode || !drag || drag.travelling.has(overNode.id)) return;
      const activeRole = roleOf(activeNode, config);
      const zone = zoneFor(activeRole, roleOf(overNode, config), hit.pointerY, hit.rect);
      if (zone === null || activeRole === null) return;
      setDragOver((prev) => {
        if (prev && prev.overId === overNode.id && prev.zone === zone) return prev;
        if (prev && prev.overId !== overNode.id && !insideRow(hit)) return prev;
        const resolution = resolveDropPlacements({
          zone,
          activeNodes: drag.moving,
          overNode,
          byId,
          config,
          lookupSiblings: config.lookupSiblings,
          lookupItems: config.lookupItems,
          lookupCollections: config.lookupCollections,
        });
        if (resolution.kind === 'rejected') return prev;
        // The rows' own slot: the placeholder sits where the first moving row is; the drop writes nothing.
        if (resolution.kind === 'stay') {
          return {
            overId: overNode.id,
            zone,
            placements: [],
            feedback: computeDropFeedback('before', nodes, byId, drag.moving[0], activeRole.role),
          };
        }
        return {
          overId: overNode.id,
          zone,
          placements: resolution.placements,
          feedback: computeDropFeedback(zone, nodes, byId, overNode, activeRole.role),
        };
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
      if (!current || current.placements.length === 0) return;
      config.move(current.placements);
    },
    [clearDrag, config, dragOver],
  );

  const preview = useMemo(() => {
    if (!drag) return null;
    const [first] = drag.moving;
    if (drag.moving.length === 1 && first) {
      return (
        <div className="rules-drag-preview tree-dnd-pill">
          <span className="rules-drag-preview-icon">{first.icon}</span>
          <span className="rules-drag-preview-label">{first.label}</span>
        </div>
      );
    }
    return (
      <div className="rules-drag-preview tree-dnd-pill">
        <span className="rules-drag-preview-label">{t('workbench.sidebar.dnd.itemsCount', { count: drag.moving.length })}</span>
      </div>
    );
  }, [drag, t]);

  const isMoving = (id: string): boolean => drag?.moving.some((n) => n.id === id) ?? false;
  const feedback = dragOver?.feedback ?? null;
  const guideAt = (index: number): React.ReactNode =>
    feedback && onGuide(feedback, index) ? (
      <span className="tree-dnd-guide" style={{ left: feedback.guide?.left }} aria-hidden />
    ) : null;
  const placeholderRow = feedback ? (
    <div key="tree-dnd-placeholder" className="tree-dnd-row">
      {feedback.guide ? <span className="tree-dnd-guide" style={{ left: feedback.guide.left }} aria-hidden /> : null}
      <div
        className="rules-sidebar-item tree-dnd-placeholder"
        style={{ marginLeft: rowPaddingLeft(feedback.placeholder.depth), ...emptyPlaceholderStyle(token) }}
        aria-hidden
      />
    </div>
  ) : null;

  const rows: React.ReactNode[] = [];
  nodes.forEach((node, index) => {
    if (feedback && feedback.placeholder.index === index) rows.push(placeholderRow);
    const travelling = drag?.travelling.has(node.id) ?? false;
    if (!participants.has(node.id) && !travelling) {
      rows.push(
        <div key={node.id} className="tree-dnd-row">
          {guideAt(index)}
          {renderNode(node)}
        </div>,
      );
      return;
    }
    rows.push(
      <SortableRow
        key={node.id}
        id={node.id}
        receiving={dragOver?.overId === node.id && dragOver.zone === 'into'}
        source={!travelling ? null : dragOver || !isMoving(node.id) ? 'collapsed' : 'placeholder'}
        placeholderStyle={emptyPlaceholderStyle(token)}
      >
        {guideAt(index)}
        {renderNode(node)}
      </SortableRow>,
    );
  });
  if (feedback && feedback.placeholder.index >= nodes.length) rows.push(placeholderRow);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerClosestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDrag}
    >
      <SortableContext items={participantIds} strategy={verticalListSortingStrategy}>
        {rows}
      </SortableContext>
      <RemeasureRows
        ids={participantIds}
        signature={feedback ? `${feedback.placeholder.index}:${feedback.placeholder.depth}` : drag ? 'grab' : 'idle'}
      />
      <DragOverlay modifiers={[anchorPillToCursor]} dropAnimation={null}>
        {preview}
      </DragOverlay>
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
  /** A travelling row: its slot stays as a dashed placeholder, or collapses once a landing spot is live. */
  source: 'placeholder' | 'collapsed' | null;
  placeholderStyle: React.CSSProperties;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef } = useSortable({ id });
  const style: React.CSSProperties | undefined =
    source === 'collapsed'
      ? { display: 'none' }
      : source === 'placeholder'
        ? { ...placeholderStyle, borderRadius: 4, margin: '0 4px' }
        : receiving
          ? { background: 'var(--ant-color-primary-bg)' }
          : undefined;

  // The whole row is the drag surface: the pointer sensor's distance
  // constraint keeps clicks and double-clicks on the row body from
  // starting a drag, and the keyboard sensor pairs with the focused row.
  return (
    <div
      ref={setNodeRef}
      className="tree-dnd-row"
      style={style}
      {...attributes}
      {...listeners}
    >
      <div style={source === 'placeholder' ? { visibility: 'hidden' } : undefined}>{children}</div>
    </div>
  );
}
