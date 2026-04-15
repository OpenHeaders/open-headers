/**
 * ShellLayout — tool-window shell for workspace.html.
 *
 * Renders the six tool-window docks across three visual regions (left
 * column, right column, bottom bar) plus a central editor area. Two
 * layout modes switch at runtime:
 *
 *   - Classic (bottomPanelFullWidth = false): the bottom region lives
 *     inside the middle column, between the editor and the status bar.
 *     The left/right columns extend all the way down.
 *
 *   - Wide bottom (bottomPanelFullWidth = true): the bottom region spans
 *     the full viewport width, underneath both side columns. Toggled
 *     from the status bar LayoutOutlined menu or the Settings page.
 *
 * Drag-and-drop is wired through dnd-kit: DockTabStrip tabs are draggable,
 * DropZoneOverlay renders six drop targets during a drag, and onDragEnd
 * resolves to a moveWindow() call on the ToolLayout state machine.
 *
 * Host props keep this component pure and render-prop driven so App.tsx
 * can pass arbitrary editor / sidebar / panel content into the right
 * slots without ShellLayout knowing anything about rules data.
 */

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Allotment, LayoutPriority } from 'allotment';
import { Dropdown, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { ToolLayoutApi } from '../hooks/useToolLayout';
import { useSetting, useSettingValue } from '../settings/hooks';
import { ALL_DOCK_SLOTS, dockRegion, TOOL_WINDOW_MAP } from '../tool-windows';
import type { DockSlot, ToolRegion, ToolWindowId } from '../types';
import DockTabStrip from './DockTabStrip';
import DropZoneOverlay from './DropZoneOverlay';

// ── Props ─────────────────────────────────────────────────────────────

export interface ShellLayoutProps {
  tl: ToolLayoutApi;
  responsive: ResponsiveLayout;
  /** Renders the body of a tool window when it is the active one in its dock. */
  renderToolWindow: (id: ToolWindowId, slot: DockSlot) => React.ReactNode;
  /** Renders the central editor area (tabs + breadcrumb + active tab body). */
  renderEditor: () => React.ReactNode;
  /** Called when a dock pane is resized so the host can persist ratios. */
  onHorizontalResize: (sizes: number[]) => void;
  onVerticalResize: (sizes: number[]) => void;
  /** Render the floating drag preview for an editor tab (owned by the host). */
  renderEditorTabDragPreview?: (tabId: string) => React.ReactNode;
}

type ToolWindowDragData = { kind: 'tool-window'; toolWindowId: ToolWindowId; fromSlot: DockSlot };
type EditorTabDragData = { kind: 'editor-tab'; leafId: string; tabId: string };
type DragData = ToolWindowDragData | EditorTabDragData;

function asDragData(current: unknown): DragData | null {
  if (!current || typeof current !== 'object') return null;
  const record = current as { kind?: unknown };
  if (record.kind === 'tool-window' || record.kind === 'editor-tab') return current as DragData;
  return null;
}

/**
 * Custom collision detection for editor-tab drags. Goal: dnd-kit's
 * sortable reorder animation should only fire when the pointer is in a
 * leaf's tab strip — NOT when it's in the content area.
 *
 * Strategy: pick the `.rules-tabs-bar` the pointer is currently over.
 * If none, return no collisions (no reorder animation). If one, scope
 * closestCenter to that bar's tabs so dnd-kit's normal centered-rect
 * swap math runs untouched.
 */
const editorTabCollisionDetection: CollisionDetection = (args) => {
  const activeKind = (args.active.data.current as { kind?: unknown } | undefined)?.kind;
  if (activeKind !== 'editor-tab') return closestCenter(args);
  const ptr = args.pointerCoordinates;
  if (!ptr) return [];

  let hoveredTabBar: HTMLElement | null = null;
  for (const container of args.droppableContainers) {
    const data = container.data.current as { kind?: unknown } | undefined;
    if (data?.kind !== 'editor-tab') continue;
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
    if (data?.kind !== 'editor-tab') return false;
    const node = container.node.current;
    return node != null && hoveredTabBar.contains(node);
  });
  return closestCenter({ ...args, droppableContainers: scoped });
};

// ── Helpers ───────────────────────────────────────────────────────────

function regionDocks(region: ToolRegion): [DockSlot, DockSlot] {
  if (region === 'left') return ['left-top', 'left-bottom'];
  if (region === 'right') return ['right-top', 'right-bottom'];
  return ['bottom-left', 'bottom-right'];
}

// ── Region containers ────────────────────────────────────────────────

type DockWindowsMap = Record<DockSlot, ToolWindowId[]>;

export interface DropZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SideRegionProps {
  region: 'left' | 'right';
  tl: ToolLayoutApi;
  renderToolWindow: (id: ToolWindowId, slot: DockSlot) => React.ReactNode;
  topSize: { preferred: number; min: number };
  bottomSize: { preferred: number; min: number };
}

/**
 * Side region = vertical Allotment with two panes for top/bottom docks.
 * Each pane is hidden when its dock has no active tool window.
 */
const SideRegion: React.FC<SideRegionProps> = ({ region, tl, renderToolWindow, topSize, bottomSize }) => {
  const { token } = theme.useToken();
  const [topSlot, bottomSlot] = regionDocks(region);
  const topDock = tl.state.docks[topSlot];
  const bottomDock = tl.state.docks[bottomSlot];
  const topActive = topDock.active;
  const bottomActive = bottomDock.active;

  return (
    <div
      className={`rules-region rules-region-${region}`}
      data-region={region}
      tabIndex={-1}
      style={{ height: '100%', background: token.colorBgLayout }}
    >
      <Allotment vertical proportionalLayout={false}>
        <Allotment.Pane preferredSize={topSize.preferred} minSize={topSize.min} visible={topActive !== null} snap>
          {topActive && (
            <div className="rules-dock-body" data-dock-slot={topSlot}>
              {renderToolWindow(topActive, topSlot)}
            </div>
          )}
        </Allotment.Pane>
        <Allotment.Pane
          preferredSize={bottomSize.preferred}
          minSize={bottomSize.min}
          visible={bottomActive !== null}
          snap
        >
          {bottomActive && (
            <div className="rules-dock-body" data-dock-slot={bottomSlot}>
              {renderToolWindow(bottomActive, bottomSlot)}
            </div>
          )}
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};

interface BottomRegionProps {
  tl: ToolLayoutApi;
  renderToolWindow: (id: ToolWindowId, slot: DockSlot) => React.ReactNode;
}

/**
 * Bottom region = horizontal Allotment with two sub-panes for the left
 * and right halves. Each sub-pane is a pure content surface — tab
 * switching for the bottom region lives on the persistent BottomActivityBar
 * below it, not inside the pane.
 */
const BottomRegion: React.FC<BottomRegionProps> = ({ tl, renderToolWindow }) => {
  const { token } = theme.useToken();
  const leftDock = tl.state.docks['bottom-left'];
  const rightDock = tl.state.docks['bottom-right'];
  const leftActive = leftDock.active;
  const rightActive = rightDock.active;

  const renderBottomSub = (slot: DockSlot) => {
    const dock = tl.state.docks[slot];
    const active = dock.active;
    if (!active) return null;
    return (
      <div
        className="rules-dock-body rules-dock-body--bottom"
        data-dock-slot={slot}
        style={{
          background: token.colorBgLayout,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div className="rules-dock-content">{renderToolWindow(active, slot)}</div>
      </div>
    );
  };

  return (
    <div className="rules-region rules-region-bottom" data-region="bottom" tabIndex={-1} style={{ height: '100%' }}>
      <Allotment proportionalLayout={false}>
        <Allotment.Pane visible={leftActive !== null} minSize={200} snap>
          {leftActive !== null && renderBottomSub('bottom-left')}
        </Allotment.Pane>
        <Allotment.Pane visible={rightActive !== null} minSize={200} snap>
          {rightActive !== null && renderBottomSub('bottom-right')}
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};

// ── Vertical activity bars ────────────────────────────────────────────

interface VerticalBarProps {
  side: 'left' | 'right';
  tl: ToolLayoutApi;
  getWindows: (slot: DockSlot) => ToolWindowId[];
  dragging: boolean;
}

const VerticalActivityBar: React.FC<VerticalBarProps> = ({ side, tl, getWindows, dragging }) => {
  const { token } = theme.useToken();
  const [upperFirstSlot, upperSecondSlot] = regionDocks(side);
  const lowerSlot: DockSlot = side === 'left' ? 'bottom-left' : 'bottom-right';

  const upperFirst = tl.state.docks[upperFirstSlot];
  const upperSecond = tl.state.docks[upperSecondSlot];
  const lower = tl.state.docks[lowerSlot];
  const upperFirstWindows = getWindows(upperFirstSlot);
  const upperSecondWindows = getWindows(upperSecondSlot);
  const lowerWindows = getWindows(lowerSlot);

  const [showLabels, setShowLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const sidebarLayout = useSettingValue('workspaceLayout.sidebarLayout');
  const toggleLabels = useCallback(() => setShowLabels(!showLabels), [showLabels, setShowLabels]);

  const barMenu: ItemType[] = [
    {
      key: 'labels',
      label: showLabels ? 'Hide Tool Window Names' : 'Show Tool Window Names',
      onClick: toggleLabels,
    },
  ];

  const renderStrip = (slot: DockSlot, dock: typeof upperFirst, windowsList: ToolWindowId[]) => (
    <DockTabStrip
      slot={slot}
      windows={windowsList}
      activeId={dock.active}
      orientation="vertical"
      showLabels={showLabels}
      dragging={dragging}
      onActivate={tl.toggleWindow}
      onHide={tl.hideWindow}
      onMove={tl.moveWindow}
      onCloseDock={() => tl.closeDock(slot)}
      onToggleLabels={toggleLabels}
    />
  );

  return (
    <Dropdown menu={{ items: barMenu }} trigger={['contextMenu']}>
      <div
        className={`rules-activity-bar rules-activity-bar--${side} ${showLabels ? '' : 'rules-activity-bar--compact'} rules-activity-bar--layout-${sidebarLayout}`}
        style={{
          background: token.colorBgLayout,
          [side === 'left' ? 'borderRight' : 'borderLeft']: `1px solid ${token.colorBorderSecondary}`,
        }}
        data-side={side}
      >
        <div className="rules-activity-group rules-activity-group--top">
          <div className="rules-activity-subslot rules-activity-subslot--first">
            {renderStrip(upperFirstSlot, upperFirst, upperFirstWindows)}
          </div>
          <div className="rules-activity-subslot rules-activity-subslot--second">
            {renderStrip(upperSecondSlot, upperSecond, upperSecondWindows)}
          </div>
        </div>
        <div className="rules-activity-group rules-activity-group--bottom">
          {renderStrip(lowerSlot, lower, lowerWindows)}
        </div>
      </div>
    </Dropdown>
  );
};

// ── ShellLayout ───────────────────────────────────────────────────────

const ShellLayout: React.FC<ShellLayoutProps> = ({
  tl,
  responsive,
  renderToolWindow,
  renderEditor,
  onHorizontalResize,
  onVerticalResize,
  renderEditorTabDragPreview,
}) => {
  const [draggingId, setDraggingId] = useState<ToolWindowId | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DockWindowsMap | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const getWindows = useCallback(
    (slot: DockSlot): ToolWindowId[] => preview?.[slot] ?? tl.state.docks[slot].windows,
    [preview, tl.state.docks],
  );

  const resolveTarget = useCallback(
    (nodeId: string, source: DockWindowsMap): { slot: DockSlot; index: number } | null => {
      if (nodeId.startsWith('dock:')) {
        const slot = nodeId.slice(5) as DockSlot;
        return { slot, index: source[slot].length };
      }
      if (nodeId.startsWith('drop:')) {
        const slot = nodeId.slice(5) as DockSlot;
        return { slot, index: source[slot].length };
      }
      if (nodeId.startsWith('tw:')) {
        const twId = nodeId.slice(3) as ToolWindowId;
        for (const slot of ALL_DOCK_SLOTS) {
          const idx = source[slot].indexOf(twId);
          if (idx >= 0) return { slot, index: idx };
        }
      }
      return null;
    },
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = asDragData(event.active.data.current);
      if (!data) return;
      if (data.kind === 'editor-tab') {
        setDraggingTabId(data.tabId);
        return;
      }
      // tool-window
      setDraggingId(data.toolWindowId);
      const snapshot: DockWindowsMap = {
        'left-top': [],
        'left-bottom': [],
        'right-top': [],
        'right-bottom': [],
        'bottom-left': [],
        'bottom-right': [],
      };
      for (const slot of ALL_DOCK_SLOTS) snapshot[slot] = [...tl.state.docks[slot].windows];
      setPreview(snapshot);
    },
    [tl.state.docks],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const data = asDragData(event.active.data.current);
      // Editor-tab reorder is handled live by SortableContext (transform
      // animations) and committed in onDragEnd — no preview state needed.
      if (!data || data.kind === 'editor-tab') return;
      const { active, over } = event;
      if (!over) return;
      setPreview((prev) => {
        if (!prev) return prev;
        const activeLoc = resolveTarget(String(active.id), prev);
        const overLoc = resolveTarget(String(over.id), prev);
        if (!activeLoc || !overLoc) return prev;
        const activeTw = String(active.id).slice(3) as ToolWindowId;

        if (activeLoc.slot === overLoc.slot) {
          if (activeLoc.index === overLoc.index) return prev;
          const next: DockWindowsMap = { ...prev };
          next[activeLoc.slot] = arrayMove(prev[activeLoc.slot], activeLoc.index, overLoc.index);
          return next;
        }

        const next: DockWindowsMap = { ...prev };
        next[activeLoc.slot] = prev[activeLoc.slot].filter((id) => id !== activeTw);
        const destList = [...prev[overLoc.slot]];
        const insertIndex = String(over.id).startsWith('dock:') ? destList.length : overLoc.index;
        const clamped = Math.max(0, Math.min(insertIndex, destList.length));
        destList.splice(clamped, 0, activeTw);
        next[overLoc.slot] = destList;
        return next;
      });
    },
    [resolveTarget],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const data = asDragData(event.active.data.current);

      // Editor-tab drops are dispatched inside EditorGroupRenderer via
      // useDndMonitor; shell only clears its own preview state here.
      if (data?.kind === 'editor-tab') {
        setDraggingTabId(null);
        return;
      }

      const activeTw = data?.kind === 'tool-window' ? data.toolWindowId : null;
      const finalPreview = preview;
      setDraggingId(null);
      setPreview(null);
      if (!activeTw || !finalPreview) return;

      for (const slot of ALL_DOCK_SLOTS) {
        const idx = finalPreview[slot].indexOf(activeTw);
        if (idx < 0) continue;
        const currentIdx = tl.state.docks[slot].windows.indexOf(activeTw);
        if (currentIdx === idx) return;
        tl.moveWindow(activeTw, slot, idx);
        return;
      }
    },
    [preview, tl],
  );

  const handleDragCancel = useCallback(() => {
    setDraggingId(null);
    setDraggingTabId(null);
    setPreview(null);
  }, []);

  const leftOpen = tl.isRegionOpen('left');
  const rightOpen = tl.isRegionOpen('right');
  const bottomOpen = tl.isRegionOpen('bottom');
  const bottomFullWidth = useSettingValue('workspaceLayout.bottomPanelFullWidth');

  const shellRef = useRef<HTMLDivElement>(null);
  const [shellSize, setShellSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [horizontalSizes, setHorizontalSizes] = useState<number[] | null>(null);
  const [verticalSizes, setVerticalSizes] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setShellSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleHorizontalChange = useCallback(
    (next: number[]) => {
      setHorizontalSizes(next);
      onHorizontalResize(next);
    },
    [onHorizontalResize],
  );

  const handleVerticalChange = useCallback(
    (next: number[]) => {
      setVerticalSizes(next);
      onVerticalResize(next);
    },
    [onVerticalResize],
  );

  const sizes = responsive.sizes;
  const topBottomHalves = useMemo(
    () => ({
      top: { preferred: Math.round(window.innerHeight * 0.35), min: 120 },
      bottom: { preferred: Math.round(window.innerHeight * 0.35), min: 120 },
    }),
    [],
  );

  // ── Editor pane ───────────────────────────────────────────────────

  const editorPane = (
    <div className="rules-region rules-region-editor" data-region="editor" tabIndex={-1} style={{ height: '100%' }}>
      {renderEditor()}
    </div>
  );

  // ── Three-column horizontal: [left column | editor | right column] ──
  //
  // This is the core layout row. In classic mode it ALSO contains the
  // bottom region nested inside the middle column (so the left/right
  // columns extend full-height). In wide-bottom mode, the bottom region
  // is pulled out and placed below this row inside a vertical allotment,
  // so the left/right columns stop above the bottom region.

  const classicMiddle = (
    <Allotment vertical proportionalLayout={false} onChange={handleVerticalChange}>
      <Allotment.Pane>{editorPane}</Allotment.Pane>
      <Allotment.Pane
        preferredSize={sizes.bottom.preferred}
        minSize={sizes.bottom.min}
        maxSize={sizes.bottom.max}
        visible={bottomOpen}
        snap
      >
        <BottomRegion tl={tl} renderToolWindow={renderToolWindow} />
      </Allotment.Pane>
    </Allotment>
  );

  const wideMiddle = editorPane;

  const threeColumnRow = (middle: React.ReactNode) => (
    <Allotment proportionalLayout={false} onChange={handleHorizontalChange}>
      <Allotment.Pane
        preferredSize={sizes.sidebar.preferred}
        minSize={sizes.sidebar.min}
        maxSize={sizes.sidebar.max}
        visible={leftOpen}
        priority={LayoutPriority.Low}
        snap
      >
        <SideRegion
          region="left"
          tl={tl}
          renderToolWindow={renderToolWindow}
          topSize={topBottomHalves.top}
          bottomSize={topBottomHalves.bottom}
        />
      </Allotment.Pane>
      <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
        {middle}
      </Allotment.Pane>
      <Allotment.Pane
        preferredSize={sizes.inspector.preferred}
        minSize={sizes.inspector.min}
        maxSize={sizes.inspector.max}
        visible={rightOpen}
        snap
      >
        <SideRegion
          region="right"
          tl={tl}
          renderToolWindow={renderToolWindow}
          topSize={topBottomHalves.top}
          bottomSize={topBottomHalves.bottom}
        />
      </Allotment.Pane>
    </Allotment>
  );

  // ── Center content: either the classic row (bottom nested in middle)
  // or a wide-bottom vertical split where the bottom pane spans the
  // full width BETWEEN the two permanent activity bars. The vertical
  // activity bars always live outside this center content and stay at
  // full height regardless of layout mode.

  // Key the subtree by mode so Allotment fully remounts on toggle — its
  // internal pane sizing is positional and leaks between tree shapes
  // otherwise, leaving a grey middle on the classic → wide → classic
  // round trip.
  const centerContent = bottomFullWidth ? (
    <Allotment key="wide" vertical proportionalLayout={false} onChange={handleVerticalChange}>
      <Allotment.Pane>{threeColumnRow(wideMiddle)}</Allotment.Pane>
      <Allotment.Pane
        preferredSize={sizes.bottom.preferred}
        minSize={sizes.bottom.min}
        maxSize={sizes.bottom.max}
        visible={bottomOpen}
        snap
      >
        <BottomRegion tl={tl} renderToolWindow={renderToolWindow} />
      </Allotment.Pane>
    </Allotment>
  ) : (
    <div key="classic" style={{ height: '100%', width: '100%' }}>
      {threeColumnRow(classicMiddle)}
    </div>
  );

  const dragging = draggingId !== null;
  const highlightedSlot = useMemo<DockSlot | null>(() => {
    if (!preview || !draggingId) return null;
    for (const slot of ALL_DOCK_SLOTS) {
      if (preview[slot].includes(draggingId)) return slot;
    }
    return null;
  }, [preview, draggingId]);

  const ACTIVITY_BAR_WIDTH = 64;
  const dropZoneRects = useMemo<Record<DockSlot, DropZoneRect> | null>(() => {
    if (!dragging) return null;
    const fullW = shellSize.width;
    const fullH = shellSize.height;
    if (fullW === 0 || fullH === 0) return null;

    const displaySidebarW = leftOpen ? (horizontalSizes?.[0] ?? sizes.sidebar.preferred) : sizes.sidebar.preferred;
    const displayInspectorW = rightOpen
      ? (horizontalSizes?.[horizontalSizes.length - 1] ?? sizes.inspector.preferred)
      : sizes.inspector.preferred;
    const displayBottomH = bottomOpen
      ? (verticalSizes?.[verticalSizes.length - 1] ?? sizes.bottom.preferred)
      : sizes.bottom.preferred;

    const leftRectX = ACTIVITY_BAR_WIDTH;
    const leftRectEnd = leftRectX + displaySidebarW;
    const rightRectX = fullW - ACTIVITY_BAR_WIDTH - displayInspectorW;

    const bottomLeftX = leftRectEnd;
    const bottomWidth = Math.max(0, rightRectX - leftRectEnd);

    let leftRect: DropZoneRect;
    let rightRect: DropZoneRect;
    let bottomRect: DropZoneRect;

    if (bottomFullWidth) {
      const topH = Math.max(0, fullH - displayBottomH);
      leftRect = { left: leftRectX, top: 0, width: displaySidebarW, height: topH };
      rightRect = { left: rightRectX, top: 0, width: displayInspectorW, height: topH };
      bottomRect = {
        left: ACTIVITY_BAR_WIDTH,
        top: topH,
        width: Math.max(0, fullW - ACTIVITY_BAR_WIDTH * 2),
        height: displayBottomH,
      };
    } else {
      leftRect = { left: leftRectX, top: 0, width: displaySidebarW, height: fullH };
      rightRect = { left: rightRectX, top: 0, width: displayInspectorW, height: fullH };
      bottomRect = {
        left: bottomLeftX,
        top: Math.max(0, fullH - displayBottomH),
        width: bottomWidth,
        height: displayBottomH,
      };
    }

    const halfV = (r: DropZoneRect): [DropZoneRect, DropZoneRect] => [
      { left: r.left, top: r.top, width: r.width, height: r.height / 2 },
      { left: r.left, top: r.top + r.height / 2, width: r.width, height: r.height / 2 },
    ];
    const halfH = (r: DropZoneRect): [DropZoneRect, DropZoneRect] => [
      { left: r.left, top: r.top, width: r.width / 2, height: r.height },
      { left: r.left + r.width / 2, top: r.top, width: r.width / 2, height: r.height },
    ];

    const [lt, lb] = halfV(leftRect);
    const [rt, rb] = halfV(rightRect);
    const [bl, br] = halfH(bottomRect);

    return {
      'left-top': lt,
      'left-bottom': lb,
      'right-top': rt,
      'right-bottom': rb,
      'bottom-left': bl,
      'bottom-right': br,
    };
  }, [dragging, shellSize, horizontalSizes, verticalSizes, sizes, bottomFullWidth, leftOpen, rightOpen, bottomOpen]);
  const mainRow = (
    <div className="rules-main-row">
      <VerticalActivityBar side="left" tl={tl} getWindows={getWindows} dragging={dragging} />
      <div className="rules-main-horizontal">{centerContent}</div>
      <VerticalActivityBar side="right" tl={tl} getWindows={getWindows} dragging={dragging} />
    </div>
  );

  const content = mainRow;

  // ── DnD context + drop overlay ────────────────────────────────────

  const draggingDef = draggingId ? TOOL_WINDOW_MAP[draggingId] : null;
  const editorTabPreview = draggingTabId ? (renderEditorTabDragPreview?.(draggingTabId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={editorTabCollisionDetection}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="rules-main" ref={shellRef}>
        {content}
        <DropZoneOverlay visible={draggingId !== null} rects={dropZoneRects} highlightedSlot={highlightedSlot} />
      </div>
      <DragOverlay>
        {draggingDef ? (
          <div className="rules-drag-preview">
            <span className="rules-drag-preview-icon">{draggingDef.icon}</span>
            <span className="rules-drag-preview-label">{draggingDef.label}</span>
          </div>
        ) : (
          editorTabPreview
        )}
      </DragOverlay>
    </DndContext>
  );
};

// Suppress unused import warning — ALL_DOCK_SLOTS/dockRegion kept for reference.
void ALL_DOCK_SLOTS;
void dockRegion;

export default ShellLayout;
