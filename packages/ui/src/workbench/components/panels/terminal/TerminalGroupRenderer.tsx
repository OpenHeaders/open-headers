/**
 * TerminalGroupRenderer — recursive renderer for the terminal panel's
 * split pane tree, the editor's EditorGroupRenderer mechanism applied
 * to terminal tabs:
 *
 *   - Each leaf renders its own tab strip + terminal viewport.
 *   - While a tab drags, one window pointermove listener hit-tests the
 *     cursor against every leaf (shared computeZoneForLeaf — 25%/12.5%
 *     edge thresholds, strip excluded) and shows the half/whole-panel
 *     drop preview (shared LeafDropPreview).
 *   - Drop dispatch: over a tab → same-leaf reorder or cross-leaf
 *     insert at that index; over a leaf zone → center move or edge
 *     split. Same priority order as the editor.
 *
 * Owns the panel's DndContext (the terminal's drags never leave the
 * panel, so it doesn't ride the shell's context) with the shell's
 * sensor/collision/measuring configuration, and publishes drag intent
 * to the strips via TerminalDragIntentContext.
 */

import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Allotment } from 'allotment';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { allLeaves, type EditorLeaf, type EditorNode, findLeaf, firstLeaf } from '../../../editor-groups';
import { useSettingValue } from '../../../settings/hooks';
import { computeZoneForLeaf, type LeafDropZone, LeafDropPreview } from '../../shell/EditorGroupRenderer';
import { type TerminalDragIntent, TerminalDragIntentContext } from './terminal-drag-intent';
import type { TerminalTabInfo, WorkbenchTerminalTabs } from './terminal-instance';
import {
  oppositeDirectionOf,
  parentOrientationOf,
  type TerminalPaneRef,
  type WorkbenchTerminalPanes,
} from './terminal-panes';
import TerminalLeafView from './TerminalLeafView';
import TerminalTabStrip, { terminalTabLabel } from './TerminalTabStrip';

const CONTENT_SELECTOR = '.terminal-leaf-content';

/**
 * Scoped collision for terminal-tab drags — the editor's
 * `makeEditorTabCollisionDetection` law applied to this panel: report
 * collisions ONLY while the pointer is inside a tab bar (scoped to
 * that bar's tabs, so same-leaf reorder and cross-leaf insert work);
 * everywhere else return none, leaving `event.over` null so the
 * renderer's zone-based drop intent (center move / edge split) is
 * what dispatches. Plain `closestCenter` would always name the
 * nearest tab and mask every zone drop as a reorder.
 */
const terminalTabCollision: CollisionDetection = (args) => {
  const ptr = args.pointerCoordinates;
  if (!ptr) return [];

  let hoveredTabBar: HTMLElement | null = null;
  for (const container of args.droppableContainers) {
    const data = container.data.current as { kind?: unknown } | undefined;
    if (data?.kind !== 'terminal-tab') continue;
    const node = container.node.current;
    if (!node) continue;
    const tabBar = node.closest('.rules-tabs-bar');
    if (!(tabBar instanceof HTMLElement)) continue;
    const r = tabBar.getBoundingClientRect();
    if (ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom) {
      hoveredTabBar = tabBar;
      break;
    }
  }
  if (!hoveredTabBar) return [];

  const scoped = args.droppableContainers.filter((container) => {
    const data = container.data.current as { kind?: unknown } | undefined;
    if (data?.kind !== 'terminal-tab') return false;
    const node = container.node.current;
    return node != null && hoveredTabBar.contains(node);
  });
  return closestCenter({ ...args, droppableContainers: scoped });
};

interface LeafHover {
  leafId: string;
  zone: LeafDropZone;
}

export interface TerminalGroupRendererProps {
  panes: WorkbenchTerminalPanes;
  registry: WorkbenchTerminalTabs;
  /** True while the terminal's dock owns focus — combined with per-leaf
   *  focus for the strip tint (editor posture: only one strip in the
   *  whole workbench shows the primary tint). */
  dockFocused: boolean;
  /** Confirm-aware closes owned by the panel. */
  onRequestClose: (id: string) => void;
  onRequestCloseMany: (ids: string[]) => void;
  /** Open the rename modal (panel owns modal + commit). */
  onRenameOpen: (id: string) => void;
  /** New-tab creation, owned by the panel (profiles resolution, TUI
   *  gate live there). The renderer focuses the strip's leaf first so
   *  the created tab lands in that pane. */
  onNew: () => void;
  profiles: readonly { id: string; name: string }[];
  onNewWithProfile: (profileId: string) => void;
  /** Renders the panel header row while the tree is a SINGLE pane —
   *  the one row of chrome (title + strip + cluster + header
   *  controls). Not called once split: every pane then owns its strip
   *  row, the first prefixed with the panel title, and the top-right
   *  one carrying `splitTrailing` (the IDE corner cluster). */
  renderHeader: (headerContent: React.ReactNode) => React.ReactNode;
  /** The (i) info trigger — split state renders it right after the
   *  "Terminal" label in the title pane's row, matching the single-row
   *  header's placement. */
  titleInfo: React.ReactNode;
  /** Right-aligned strip tail, minted per strip (each instance owns
   *  its own dropdown state): EVERY pane's strip carries the search
   *  chevron (scoped to that pane's tabs) + TUI; the split-state
   *  top-right pane passes `corner: true` and additionally hosts
   *  info + hide (the PanelHeader that normally hosts them isn't
   *  rendered while split). */
  renderTrailing: (options: {
    corner: boolean;
    tabs: TerminalTabInfo[];
    activeId: string | null;
    onActivate: (id: string) => void;
    isFocusedPane: boolean;
  }) => React.ReactNode;
}

export const TerminalGroupRenderer: React.FC<TerminalGroupRendererProps> = ({
  panes,
  registry,
  dockFocused,
  onRequestClose,
  onRequestCloseMany,
  onRenameOpen,
  onNew,
  profiles,
  onNewWithProfile,
  renderHeader,
  renderTrailing,
  titleInfo,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const defaultTabName = useSettingValue('terminal.defaultTabName');
  const root = panes.root();
  const focusedLeafId = panes.focusedLeafId();

  // Rebuilt per render (registry.list() mints fresh arrays, so identity
  // can't gate a memo) — the panel re-renders only on registry/pane
  // change notifications, and the map is a few dozen entries at most.
  const infoById = new Map<string, TerminalTabInfo>();
  for (const info of registry.list()) infoById.set(info.id, info);
  const leafInfos = (leaf: EditorLeaf<TerminalPaneRef>): TerminalTabInfo[] =>
    leaf.tabs.map((ref) => infoById.get(ref.id)).filter((info): info is TerminalTabInfo => info !== undefined);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Per-leaf DOM refs for cursor hit-testing.
  const leafRefs = useRef(new Map<string, HTMLElement>());
  const registerLeafRef = useCallback((leafId: string) => {
    return (el: HTMLElement | null) => {
      if (el) leafRefs.current.set(leafId, el);
      else leafRefs.current.delete(leafId);
    };
  }, []);

  // Drag state — populated while a terminal-tab drag is active; ref
  // mirrors for inside-of-listener reads without stale closures.
  const [dragActive, setDragActive] = useState<{ fromLeafId: string; tabId: string } | null>(null);
  const dragRef = useRef<{ fromLeafId: string; tabId: string } | null>(null);
  const [hover, setHover] = useState<LeafHover | null>(null);
  const hoverRef = useRef<LeafHover | null>(null);
  hoverRef.current = hover;
  const [insertion, setInsertion] = useState<{ leafId: string; index: number } | null>(null);
  const rootRef = useRef(root);
  rootRef.current = root;

  // Cursor tracking — one pointermove listener while dragging.
  useEffect(() => {
    if (!dragActive) {
      setHover(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      let match: LeafHover | null = null;
      for (const [leafId, el] of leafRefs.current) {
        const zone = computeZoneForLeaf(el, e.clientX, e.clientY, CONTENT_SELECTOR);
        if (zone) {
          match = { leafId, zone };
          break;
        }
      }
      setHover((prev) => {
        if (prev && match && prev.leafId === match.leafId && prev.zone === match.zone) return prev;
        return match;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [dragActive]);

  const asTabData = (data: unknown): { leafId: string; tabId: string } | null => {
    const d = data as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
    if (d?.kind !== 'terminal-tab' || typeof d.leafId !== 'string' || typeof d.tabId !== 'string') return null;
    return { leafId: d.leafId, tabId: d.tabId };
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = asTabData(event.active.data.current);
    if (!data) return;
    const next = { fromLeafId: data.leafId, tabId: data.tabId };
    dragRef.current = next;
    setDragActive(next);
    setInsertion(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const overData = asTabData(event.over?.data.current);
    if (!overData || overData.leafId === drag.fromLeafId) {
      // Same-leaf reorder is handled natively by SortableContext — no
      // cross-leaf insertion marker needed.
      setInsertion((prev) => (prev === null ? prev : null));
      return;
    }
    const toLeaf = findLeaf(rootRef.current, overData.leafId);
    const idx = toLeaf?.tabs.findIndex((ref) => ref.id === overData.tabId) ?? -1;
    if (idx < 0) return;
    setInsertion((prev) => {
      if (prev && prev.leafId === overData.leafId && prev.index === idx) return prev;
      return { leafId: overData.leafId, index: idx };
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    dragRef.current = null;
    setDragActive(null);
    setHover(null);
    setInsertion(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      const hoverAtDrop = hoverRef.current;
      setDragActive(null);
      setHover(null);
      setInsertion(null);
      if (!drag) return;

      // Priority 1: dropped on another terminal tab (sortable droppable).
      const overData = asTabData(event.over?.data.current);
      if (overData) {
        if (drag.fromLeafId === overData.leafId) {
          if (drag.tabId !== overData.tabId) panes.reorderTab(overData.leafId, drag.tabId, overData.tabId);
          return;
        }
        const toLeaf = findLeaf(panes.root(), overData.leafId);
        const idx = toLeaf?.tabs.findIndex((ref) => ref.id === overData.tabId) ?? -1;
        panes.moveTabToLeaf(drag.fromLeafId, overData.leafId, drag.tabId, idx === -1 ? undefined : idx);
        return;
      }

      // Priority 2: cursor is inside some leaf — center or edge split.
      if (!hoverAtDrop) return;
      if (hoverAtDrop.zone === 'center') {
        if (hoverAtDrop.leafId === drag.fromLeafId) return;
        panes.moveTabToLeaf(drag.fromLeafId, hoverAtDrop.leafId, drag.tabId);
        return;
      }
      panes.splitLeafWithDrop(hoverAtDrop.leafId, hoverAtDrop.zone, drag.fromLeafId, drag.tabId);
    },
    [panes],
  );

  const draggingInfo = dragActive ? infoById.get(dragActive.tabId) : undefined;
  const draggingLabel = draggingInfo ? terminalTabLabel(t, draggingInfo, defaultTabName) : null;

  const dragIntent = useMemo<TerminalDragIntent>(
    () => ({
      draggingTabId: dragActive?.tabId ?? null,
      draggingLabel,
      overDropZone: dragActive !== null && hover !== null,
      insertion,
    }),
    [dragActive, draggingLabel, hover, insertion],
  );

  const leaves = allLeaves(root);
  const canUnsplitAll = leaves.length >= 3;
  const parentedLeafIds = useMemo(() => {
    const out = new Set<string>();
    if (root.kind === 'split') for (const leaf of leaves) out.add(leaf.id);
    return out;
  }, [root, leaves]);

  // The strip for a leaf — rendered either inline in the panel header
  // (single pane: single-row posture) or as the pane's own top row.
  const renderStrip = (leaf: EditorLeaf<TerminalPaneRef>, corner: boolean): React.ReactNode => {
    const infos = leafInfos(leaf);
    const closeMany = (ids: string[]) => onRequestCloseMany(ids);
    const trailing = renderTrailing({
      corner,
      tabs: infos,
      activeId: leaf.activeTabId,
      onActivate: (id) => panes.activateTab(leaf.id, id),
      isFocusedPane: focusedLeafId === leaf.id,
    });
    return (
      <TerminalTabStrip
        leafId={leaf.id}
        tabs={infos}
        activeId={leaf.activeTabId}
        focused={focusedLeafId === leaf.id && dockFocused}
        onActivate={(id) => panes.activateTab(leaf.id, id)}
        onClose={onRequestClose}
        onCloseOther={(id) => closeMany(infos.filter((info) => info.id !== id).map((info) => info.id))}
        onCloseAll={() => closeMany(infos.map((info) => info.id))}
        onCloseToLeft={(id) => {
          const index = infos.findIndex((info) => info.id === id);
          if (index > 0) closeMany(infos.slice(0, index).map((info) => info.id));
        }}
        onCloseToRight={(id) => {
          const index = infos.findIndex((info) => info.id === id);
          if (index !== -1) closeMany(infos.slice(index + 1).map((info) => info.id));
        }}
        onRename={onRenameOpen}
        onNew={() => {
          // Focus first so the created tab lands in THIS pane (the
          // registry inserts new tabs into the focused leaf).
          panes.focusLeaf(leaf.id);
          onNew();
        }}
        profiles={profiles}
        onNewWithProfile={(profileId) => {
          panes.focusLeaf(leaf.id);
          onNewWithProfile(profileId);
        }}
        trailing={trailing}
        onSplitAndMove={(id, direction) => panes.splitAndMove(leaf.id, id, direction)}
        onMoveToOppositeGroup={(id) => panes.moveToOppositeGroup(leaf.id, id)}
        oppositeDirection={oppositeDirectionOf(root, leaf.id)}
        parentOrientation={parentOrientationOf(root, leaf.id)}
        onChangeSplitterOrientation={() => panes.changeSplitterOrientation(leaf.id)}
        onUnsplit={() => panes.unsplit(leaf.id)}
        onUnsplitAll={() => panes.unsplitAll()}
        canUnsplit={parentedLeafIds.has(leaf.id)}
        canUnsplitAll={canUnsplitAll}
      />
    );
  };

  // Single-row law: while the tree is ONE pane, its strip rides the
  // panel header row (rendered by the panel via renderHeader) so the
  // panel spends a single row of chrome. Once split, there is NO
  // full-width header at all — every pane's strip row IS its top row
  // (IDE terminal posture): the top-left pane's row leads with
  // the panel title, the top-right pane's row trails with the corner
  // cluster (search + TUI + info + hide).
  const headerLeafId = root.kind === 'leaf' ? root.id : null;
  const titleLeafId = firstLeaf(root).id;
  const cornerLeafId = (() => {
    let node = root;
    while (node.kind === 'split') node = node.orientation === 'horizontal' ? node.b : node.a;
    return node.id;
  })();

  const renderLeaf = (leaf: EditorLeaf<TerminalPaneRef>): React.ReactNode => {
    const hoverHere = hover?.leafId === leaf.id;
    const activeHandle = leaf.activeTabId !== null ? registry.getTab(leaf.activeTabId) : null;

    return (
      <div
        ref={registerLeafRef(leaf.id)}
        data-leaf-id={leaf.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
          background: token.colorBgContainer,
        }}
        onPointerDownCapture={() => panes.focusLeaf(leaf.id)}
      >
        {leaf.id !== headerLeafId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              padding: '0 8px 0 12px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {leaf.id === titleLeafId && (
              <>
                <strong style={{ flexShrink: 0, marginRight: 8 }}>{t('workbench.toolWindows.terminal')}</strong>
                <span style={{ flexShrink: 0, marginRight: 8 }}>{titleInfo}</span>
              </>
            )}
            {renderStrip(leaf, leaf.id === cornerLeafId)}
          </div>
        )}
        <div className="terminal-leaf-content" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <TerminalLeafView active={activeHandle} />
          <LeafDropPreview active={hoverHere} zone={hover?.zone ?? 'center'} />
        </div>
      </div>
    );
  };

  const renderNode = (node: EditorNode<TerminalPaneRef>): React.ReactNode => {
    if (node.kind === 'leaf') return renderLeaf(node);
    const vertical = node.orientation === 'vertical';
    // Allotment captures orientation at mount and does not react to later
    // changes of its `vertical` prop — keying on orientation forces a
    // clean remount on flip (same trap as the editor tree).
    return (
      <Allotment key={`${node.id}-${node.orientation}`} vertical={vertical} proportionalLayout separator>
        <Allotment.Pane minSize={120}>{renderNode(node.a)}</Allotment.Pane>
        <Allotment.Pane minSize={120}>{renderNode(node.b)}</Allotment.Pane>
      </Allotment>
    );
  };

  // The header strip participates in the same DndContext as every
  // pane strip (it IS the single pane's strip), so tabs drag freely
  // between the header row and any pane a drop creates.
  const headerContent =
    headerLeafId !== null ? (
      <div
        style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
        onPointerDownCapture={() => panes.focusLeaf(headerLeafId)}
      >
        {renderStrip(firstLeaf(root), false)}
      </div>
    ) : null;

  return (
    <TerminalDragIntentContext.Provider value={dragIntent}>
      <DndContext
        sensors={sensors}
        collisionDetection={terminalTabCollision}
        measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {headerContent !== null && renderHeader(headerContent)}
        <div
          className="rules-bottom-content is-fill"
          style={{ position: 'relative', background: token.colorBgContainer }}
        >
          <div
            className="terminal-split-tree"
            style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minWidth: 0, minHeight: 0 }}
          >
            {renderNode(root)}
          </div>
        </div>
        {/* The moving pill — same preview contract as the editor
            strip's shell DragOverlay, minus the entity icon. */}
        <DragOverlay>
          {draggingLabel !== null ? (
            <div className="rules-drag-preview">
              <span className="rules-drag-preview-label">{draggingLabel}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TerminalDragIntentContext.Provider>
  );
};

export default TerminalGroupRenderer;
