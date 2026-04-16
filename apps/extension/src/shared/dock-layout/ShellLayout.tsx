/**
 * ShellLayout — generic tool-window shell shared between workspace.html
 * and the DevTools Inspector panel.
 *
 * Renders the six tool-window docks across three visual regions (left
 * column, right column, bottom bar) plus a central editor area. Two
 * layout modes switch at runtime:
 *
 *   - Classic (bottomPanelFullWidth = false): the bottom region lives
 *     inside the middle column, between the editor and the status bar.
 *
 *   - Wide bottom (bottomPanelFullWidth = true): the bottom region spans
 *     the full viewport width, underneath both side columns.
 *
 * Drag-and-drop is wired through dnd-kit: DockTabStrip tabs are draggable,
 * DropZoneOverlay renders six drop targets during a drag, and onDragEnd
 * resolves to a moveWindow() call on the layout state machine.
 *
 * Host props keep this component pure and render-prop driven so the host
 * App can pass arbitrary editor / sidebar / panel content into the right
 * slots without ShellLayout knowing anything about domain data.
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
import { ALL_DOCK_SLOTS, regionDocks } from './constants';
import DockTabStrip from './DockTabStrip';
import DropZoneOverlay from './DropZoneOverlay';
import type { FocusStore } from './focus-store';
import type { DockSlot, DropZoneRect, SidebarLayoutVariant, ToolWindowDef } from './types';
import type { DockLayoutApi } from './use-dock-layout';

// ── Props ─────────────────────────────────────────────────────────────

export interface ShellLayoutProps<T extends string> {
  tl: DockLayoutApi<T>;
  windowMap: Record<T, ToolWindowDef<T>>;
  /** Renders the body of a tool window when it is the active one in its dock. */
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  /** Renders the central editor area (tabs + breadcrumb + active tab body). */
  renderEditor: () => React.ReactNode;
  /** Called when a dock pane is resized so the host can persist ratios. */
  onHorizontalResize: (sizes: number[]) => void;
  onVerticalResize: (sizes: number[]) => void;
  /** Render the floating drag preview for an editor tab (owned by the host). */
  renderEditorTabDragPreview?: (tabId: string) => React.ReactNode;
  /** Layout configuration — read from settings store by the host. */
  bottomPanelFullWidth: boolean;
  showToolWindowLabels: boolean;
  sidebarLayout: SidebarLayoutVariant;
  onToggleLabels: () => void;
  /** Responsive sizing. */
  sizes: {
    sidebar: { preferred: number; min: number; max: number };
    inspector: { preferred: number; min: number; max: number };
    bottom: { preferred: number; min: number; max: number };
    editorMin: number;
  };
  /** Custom collision detection for editor-tab drags. */
  collisionDetection?: CollisionDetection;
  /** Focus store — drives the blue accent on active tool-window tabs. */
  focusStore: FocusStore;
}

type ToolWindowDragData<T extends string> = { kind: 'tool-window'; toolWindowId: T; fromSlot: DockSlot };
type EditorTabDragData = { kind: 'editor-tab'; leafId: string; tabId: string };
type DragData<T extends string> = ToolWindowDragData<T> | EditorTabDragData;

function asDragData<T extends string>(current: unknown): DragData<T> | null {
  if (!current || typeof current !== 'object') return null;
  const record = current as { kind?: unknown };
  if (record.kind === 'tool-window' || record.kind === 'editor-tab') return current as DragData<T>;
  return null;
}

// ── Region containers ────────────────────────────────────────────────

type DockWindowsMap<T extends string> = Record<DockSlot, T[]>;

interface SideRegionProps<T extends string> {
  region: 'left' | 'right';
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  topSize: { preferred: number; min: number };
  bottomSize: { preferred: number; min: number };
}

function SideRegion<T extends string>({ region, tl, renderToolWindow, topSize, bottomSize }: SideRegionProps<T>) {
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
}

interface BottomRegionProps<T extends string> {
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
}

function BottomRegion<T extends string>({ tl, renderToolWindow }: BottomRegionProps<T>) {
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
}

// ── Vertical activity bars ────────────────────────────────────────────

interface VerticalBarProps<T extends string> {
  side: 'left' | 'right';
  tl: DockLayoutApi<T>;
  windowMap: Record<T, ToolWindowDef<T>>;
  getWindows: (slot: DockSlot) => T[];
  dragging: boolean;
  showLabels: boolean;
  sidebarLayout: SidebarLayoutVariant;
  onToggleLabels: () => void;
  focusStore: FocusStore;
}

/**
 * Per-slot wrapper that subscribes to the focus store independently,
 * so only the strip whose focus state changed re-renders — not the
 * entire ShellLayout tree.
 */
function FocusAwareStrip<T extends string>({
  focusStore: store,
  ...props
}: Omit<import('./DockTabStrip').DockTabStripProps<T>, 'isFocused'> & { focusStore: FocusStore }) {
  const focused = store.useIsDockFocused(props.slot);
  return <DockTabStrip<T> {...props} isFocused={focused} />;
}

function VerticalActivityBar<T extends string>({
  side,
  tl,
  windowMap,
  getWindows,
  dragging,
  showLabels,
  sidebarLayout,
  onToggleLabels,
  focusStore,
}: VerticalBarProps<T>) {
  const { token } = theme.useToken();
  const [upperFirstSlot, upperSecondSlot] = regionDocks(side);
  const lowerSlot: DockSlot = side === 'left' ? 'bottom-left' : 'bottom-right';

  const upperFirstWindows = getWindows(upperFirstSlot);
  const upperSecondWindows = getWindows(upperSecondSlot);
  const lowerWindows = getWindows(lowerSlot);

  const barMenu: ItemType[] = [
    {
      key: 'labels',
      label: showLabels ? 'Hide Tool Window Names' : 'Show Tool Window Names',
      onClick: onToggleLabels,
    },
  ];

  const renderStrip = (slot: DockSlot, windowsList: T[]) => (
    <FocusAwareStrip<T>
      slot={slot}
      windows={windowsList}
      activeId={tl.state.docks[slot].active}
      orientation="vertical"
      showLabels={showLabels}
      dragging={dragging}
      windowMap={windowMap}
      focusStore={focusStore}
      onActivate={tl.toggleWindow}
      onHide={tl.hideWindow}
      onMove={tl.moveWindow}
      onCloseDock={() => tl.closeDock(slot)}
      onToggleLabels={onToggleLabels}
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
            {renderStrip(upperFirstSlot, upperFirstWindows)}
          </div>
          <div className="rules-activity-subslot rules-activity-subslot--second">
            {renderStrip(upperSecondSlot, upperSecondWindows)}
          </div>
        </div>
        <div className="rules-activity-group rules-activity-group--bottom">{renderStrip(lowerSlot, lowerWindows)}</div>
      </div>
    </Dropdown>
  );
}

// ── ShellLayout ───────────────────────────────────────────────────────

function ShellLayoutInner<T extends string>({
  tl,
  windowMap,
  renderToolWindow,
  renderEditor,
  onHorizontalResize,
  onVerticalResize,
  renderEditorTabDragPreview,
  bottomPanelFullWidth,
  showToolWindowLabels,
  sidebarLayout,
  onToggleLabels,
  sizes,
  collisionDetection,
  focusStore,
}: ShellLayoutProps<T>) {
  const [draggingId, setDraggingId] = useState<T | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DockWindowsMap<T> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const getWindows = useCallback(
    (slot: DockSlot): T[] => preview?.[slot] ?? tl.state.docks[slot].windows,
    [preview, tl.state.docks],
  );

  const resolveTarget = useCallback(
    (nodeId: string, source: DockWindowsMap<T>): { slot: DockSlot; index: number } | null => {
      if (nodeId.startsWith('dock:')) {
        const slot = nodeId.slice(5) as DockSlot;
        return { slot, index: source[slot].length };
      }
      if (nodeId.startsWith('drop:')) {
        const slot = nodeId.slice(5) as DockSlot;
        return { slot, index: source[slot].length };
      }
      if (nodeId.startsWith('tw:')) {
        const twId = nodeId.slice(3) as T;
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
      const data = asDragData<T>(event.active.data.current);
      if (!data) return;
      if (data.kind === 'editor-tab') {
        setDraggingTabId(data.tabId);
        return;
      }
      setDraggingId(data.toolWindowId);
      const snapshot = {} as DockWindowsMap<T>;
      for (const slot of ALL_DOCK_SLOTS) snapshot[slot] = [...tl.state.docks[slot].windows];
      setPreview(snapshot);
    },
    [tl.state.docks],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const data = asDragData<T>(event.active.data.current);
      if (!data || data.kind === 'editor-tab') return;
      const { active, over } = event;
      if (!over) return;
      setPreview((prev) => {
        if (!prev) return prev;
        const activeLoc = resolveTarget(String(active.id), prev);
        const overLoc = resolveTarget(String(over.id), prev);
        if (!activeLoc || !overLoc) return prev;
        const activeTw = String(active.id).slice(3) as T;

        if (activeLoc.slot === overLoc.slot) {
          if (activeLoc.index === overLoc.index) return prev;
          const next = { ...prev } as DockWindowsMap<T>;
          next[activeLoc.slot] = arrayMove(prev[activeLoc.slot], activeLoc.index, overLoc.index);
          return next;
        }

        const next = { ...prev } as DockWindowsMap<T>;
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
      const data = asDragData<T>(event.active.data.current);

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
        <SideRegion<T>
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
        <SideRegion<T>
          region="right"
          tl={tl}
          renderToolWindow={renderToolWindow}
          topSize={topBottomHalves.top}
          bottomSize={topBottomHalves.bottom}
        />
      </Allotment.Pane>
    </Allotment>
  );

  const centerContent = bottomPanelFullWidth ? (
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

  const ACTIVITY_BAR_WIDTH = 52;
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

    if (bottomPanelFullWidth) {
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
  }, [
    dragging,
    shellSize,
    horizontalSizes,
    verticalSizes,
    sizes,
    bottomPanelFullWidth,
    leftOpen,
    rightOpen,
    bottomOpen,
  ]);

  const mainRow = (
    <div className="rules-main-row">
      <VerticalActivityBar<T>
        side="left"
        tl={tl}
        windowMap={windowMap}
        getWindows={getWindows}
        dragging={dragging}
        showLabels={showToolWindowLabels}
        sidebarLayout={sidebarLayout}
        onToggleLabels={onToggleLabels}
        focusStore={focusStore}
      />
      <div className="rules-main-horizontal">{centerContent}</div>
      <VerticalActivityBar<T>
        side="right"
        tl={tl}
        windowMap={windowMap}
        getWindows={getWindows}
        dragging={dragging}
        showLabels={showToolWindowLabels}
        sidebarLayout={sidebarLayout}
        onToggleLabels={onToggleLabels}
        focusStore={focusStore}
      />
    </div>
  );

  // ── DnD context + drop overlay ────────────────────────────────────

  const draggingDef = draggingId ? windowMap[draggingId] : null;
  const editorTabPreview = draggingTabId ? (renderEditorTabDragPreview?.(draggingTabId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection ?? closestCenter}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="rules-main" ref={shellRef}>
        {mainRow}
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
}

export default ShellLayoutInner;
