/**
 * ShellLayout — generic tool-window shell shared between workbench.html
 * and the DevTools Inspector panel.
 *
 * Renders the six tool-window docks across three visual regions (left
 * column, right column, bottom bar) plus a central editor area. Four
 * bottom-panel alignments switch at runtime:
 *
 *   - center  — bottom nested inside the middle column only (sidebars
 *               run full height; this is the classic IDE look)
 *   - left    — bottom spans [left sidebar + editor]; right sidebar
 *               runs full height
 *   - right   — bottom spans [editor + right sidebar]; left sidebar
 *               runs full height
 *   - justify — bottom spans the full viewport width (below both
 *               sidebars + editor)
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
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Allotment, LayoutPriority } from 'allotment';
import { Dropdown, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ALL_DOCK_SLOTS, regionDocks } from './constants';
import DockTabStrip from './DockTabStrip';
import DropZoneOverlay from './DropZoneOverlay';
import type { FocusStore } from './focus-store';
import type { BottomPanelAlignment, DockSlot, DropZoneRect, SidebarLayoutVariant, ToolWindowDef } from './types';
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
  bottomPanelAlignment: BottomPanelAlignment;
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

/**
 * Dock body wrapper that subscribes to the focus store and adds
 * `.rules-dock-body--focused` when this slot is the focused dock. The
 * CSS rule layers on the persistent "actions visible" state — matches
 * the IDE behavior where clicking into a panel (blue activity-bar
 * chip) keeps its action row shown even after the mouse leaves.
 */
interface FocusAwareDockBodyProps {
  slot: DockSlot;
  focusStore: FocusStore;
  baseClass: string;
  children?: React.ReactNode;
}

function FocusAwareDockBody({ slot, focusStore, baseClass, children }: FocusAwareDockBodyProps) {
  const focused = focusStore.useIsDockFocused(slot);
  return (
    <div className={`${baseClass}${focused ? ' rules-dock-body--focused' : ''}`} data-dock-slot={slot}>
      {children}
    </div>
  );
}

interface SideRegionProps<T extends string> {
  region: 'left' | 'right';
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  topSize: { preferred: number; min: number };
  bottomSize: { preferred: number; min: number };
  focusStore: FocusStore;
}

function SideRegion<T extends string>({
  region,
  tl,
  renderToolWindow,
  topSize,
  bottomSize,
  focusStore,
}: SideRegionProps<T>) {
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
      <Allotment vertical proportionalLayout>
        <Allotment.Pane preferredSize={topSize.preferred} minSize={topSize.min} visible={topActive !== null} snap>
          {topActive && (
            <FocusAwareDockBody slot={topSlot} focusStore={focusStore} baseClass="rules-dock-body">
              {renderToolWindow(topActive, topSlot)}
            </FocusAwareDockBody>
          )}
        </Allotment.Pane>
        <Allotment.Pane
          preferredSize={bottomSize.preferred}
          minSize={bottomSize.min}
          visible={bottomActive !== null}
          snap
        >
          {bottomActive && (
            <FocusAwareDockBody slot={bottomSlot} focusStore={focusStore} baseClass="rules-dock-body">
              {renderToolWindow(bottomActive, bottomSlot)}
            </FocusAwareDockBody>
          )}
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}

interface BottomRegionProps<T extends string> {
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  focusStore: FocusStore;
}

function BottomRegion<T extends string>({ tl, renderToolWindow, focusStore }: BottomRegionProps<T>) {
  const leftDock = tl.state.docks['bottom-left'];
  const rightDock = tl.state.docks['bottom-right'];
  const leftActive = leftDock.active;
  const rightActive = rightDock.active;

  const renderBottomSub = (slot: DockSlot) => {
    const dock = tl.state.docks[slot];
    const active = dock.active;
    if (!active) return null;
    return (
      <FocusAwareDockBody slot={slot} focusStore={focusStore} baseClass="rules-dock-body rules-dock-body--bottom">
        <div className="rules-dock-content">{renderToolWindow(active, slot)}</div>
      </FocusAwareDockBody>
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
  /** Passed into the Dynamic height-mirror hook so it re-runs — and
      re-binds its ResizeObserver — whenever the layout restructures and
      the dock-body DOM nodes remount under a new subtree. */
  layoutRevision: string;
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

/**
 * Dynamic mode — mirror the heights of the two adjacent docks on this
 * side onto the upper subslots' flex-grow weights. Uses ResizeObserver on
 * the live `.rules-dock-body` elements (located via `data-dock-slot`) so
 * the mirror tracks Allotment's own drag updates without us having to tap
 * into Allotment's internals.
 *
 * - Only attaches when `enabled` (sidebarLayout === 'dynamic').
 * - If a dock is closed (`active === null`), there is no dock-body element
 *   in the DOM; the corresponding subslot carries `--empty` (which flips
 *   to `flex: 0 0 auto` in CSS) and no grow weight is written.
 * - Runs on a rAF to coalesce multiple RO callbacks during a drag.
 */
function useDynamicActivityMirror(
  enabled: boolean,
  side: 'left' | 'right',
  barRef: React.RefObject<HTMLDivElement | null>,
  activeSignal: string,
) {
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const firstSubslot = bar.querySelector<HTMLElement>('.rules-activity-subslot--first');
    const secondSubslot = bar.querySelector<HTMLElement>('.rules-activity-subslot--second');
    const topGroup = bar.querySelector<HTMLElement>('.rules-activity-group--top');
    const bottomGroup = bar.querySelector<HTMLElement>('.rules-activity-group--bottom');

    const clear = () => {
      for (const el of [firstSubslot, secondSubslot]) {
        if (!el) continue;
        el.style.removeProperty('--mirror-grow');
        el.style.removeProperty('height');
        el.style.removeProperty('flex');
      }
      if (topGroup) topGroup.style.flex = '';
      if (bottomGroup) {
        bottomGroup.style.top = '';
        bottomGroup.style.bottom = '';
      }
    };

    if (!enabled) {
      clear();
      return;
    }

    const shell = bar.closest('.rules-main') ?? document.body;
    const topDock = shell.querySelector<HTMLElement>(`.rules-dock-body[data-dock-slot="${side}-top"]`);
    const bottomDock = shell.querySelector<HTMLElement>(`.rules-dock-body[data-dock-slot="${side}-bottom"]`);
    // The side region — activity bar total height ≠ region height in
    // justify / left / right alignments (the bottom panel pushes the
    // region up). Measuring the region lets us clamp the bar's top group
    // to match, so subslot dividers align with pane dividers absolutely.
    const sideRegion = shell.querySelector<HTMLElement>(`.rules-region-${side}`);

    if (!topDock && !bottomDock && !sideRegion) {
      clear();
      return;
    }

    let raf = 0;
    const sync = () => {
      raf = 0;
      // Only pin exact subslot heights when BOTH side-panes are live.
      // If one side is empty (active === null), the CSS empty-migration
      // (flex: 0 0 auto on the live subslot via :has) keeps both
      // subslots content-sized and tabs stack at the top — pinning
      // here would force the live subslot to fill topGroup, pushing
      // the empty subslot's inactive icons off the bottom of the bar.
      const bothLive = !!topDock && !!bottomDock;
      if (firstSubslot) {
        if (bothLive && topDock) {
          const h = Math.max(1, topDock.getBoundingClientRect().height + 6);
          firstSubslot.style.height = `${h}px`;
          firstSubslot.style.flex = '0 0 auto';
        } else {
          firstSubslot.style.removeProperty('height');
          firstSubslot.style.removeProperty('flex');
        }
        firstSubslot.style.removeProperty('--mirror-grow');
      }
      if (secondSubslot) {
        if (bothLive && bottomDock) {
          const h = Math.max(1, bottomDock.getBoundingClientRect().height + 6);
          secondSubslot.style.height = `${h}px`;
          secondSubslot.style.flex = '0 0 auto';
        } else {
          secondSubslot.style.removeProperty('height');
          secondSubslot.style.removeProperty('flex');
        }
        secondSubslot.style.removeProperty('--mirror-grow');
      }

      // Clamp the top group to the side region's height so subslot
      // dividers align with pane dividers absolutely. Only applies when
      // the region is actually shorter than the bar (justify mode on
      // either side, and the side adjacent to the bottom panel in
      // left/right modes). When the region == bar height (center mode,
      // or the "non-aligned" side in left/right modes), we clear the
      // inline styles so the default CSS — top group fills bar, bottom
      // group absolute `bottom: 0` — keeps the lower chip cluster at
      // the bar's bottom edge instead of pushing it off-screen.
      if (sideRegion && topGroup && bottomGroup && bar) {
        const regionH = sideRegion.getBoundingClientRect().height;
        const barH = bar.getBoundingClientRect().height;
        // Subtract the bar's top padding so topGroup's bottom edge
        // still lands exactly at side-region bottom (and the bottom
        // group at top: regionH stays flush with the side region).
        // Float values throughout — rounding here pushed the bottom
        // group ~1px off from the bottom panel's header.
        const barPadTop = parseFloat(getComputedStyle(bar).paddingTop) || 0;
        if (regionH > 0 && regionH < barH - 4) {
          topGroup.style.flex = `0 0 ${Math.max(0, regionH - barPadTop)}px`;
          bottomGroup.style.top = `${regionH}px`;
          bottomGroup.style.bottom = 'auto';
        } else {
          topGroup.style.flex = '';
          bottomGroup.style.top = '';
          bottomGroup.style.bottom = '';
        }
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(sync);
    };

    sync();
    const ro = new ResizeObserver(schedule);
    if (topDock) ro.observe(topDock);
    if (bottomDock) ro.observe(bottomDock);
    if (sideRegion) ro.observe(sideRegion);
    // Observe the bar itself so the clamp-vs-default decision re-runs
    // when the shell resizes (e.g. window resize changes barH).
    ro.observe(bar);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, [enabled, side, barRef, activeSignal]);
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
  layoutRevision,
}: VerticalBarProps<T>) {
  const { token } = theme.useToken();
  const [upperFirstSlot, upperSecondSlot] = regionDocks(side);
  const lowerSlot: DockSlot = side === 'left' ? 'bottom-left' : 'bottom-right';

  const upperFirstWindows = getWindows(upperFirstSlot);
  const upperSecondWindows = getWindows(upperSecondSlot);
  const lowerWindows = getWindows(lowerSlot);

  // `--empty` migration: when a dock's `active` is null its content panel
  // isn't rendered, so its chip cluster should collapse to content-size
  // and let the live neighbor absorb the space. This is the first half of
  // Dynamic; the height-mirror hook below adds the second half.
  const upperFirstEmpty = tl.state.docks[upperFirstSlot].active === null;
  const upperSecondEmpty = tl.state.docks[upperSecondSlot].active === null;
  const lowerEmpty = tl.state.docks[lowerSlot].active === null;

  // Encoded dock activity across this side — whenever any of the three
  // docks opens/closes the mirror hook re-runs and re-binds to the newly
  // mounted / unmounted `.rules-dock-body` nodes. `layoutRevision` covers
  // layout restructures (e.g. toggling bottomPanelAlignment) that remount
  // the dock bodies under a new subtree without changing active ids.
  const activeSignal = `${tl.state.docks[upperFirstSlot].active ?? ''}|${tl.state.docks[upperSecondSlot].active ?? ''}|${tl.state.docks[lowerSlot].active ?? ''}|${layoutRevision}`;

  const barRef = useRef<HTMLDivElement | null>(null);
  useDynamicActivityMirror(sidebarLayout === 'dynamic', side, barRef, activeSignal);

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
        ref={barRef}
        className={`rules-activity-bar rules-activity-bar--${side} ${showLabels ? '' : 'rules-activity-bar--compact'} rules-activity-bar--layout-${sidebarLayout}${lowerEmpty ? ' rules-activity-bar--lower-empty' : ''}`}
        style={{ background: token.colorBgLayout }}
        data-side={side}
      >
        <div className="rules-activity-group rules-activity-group--top">
          <div
            className={`rules-activity-subslot rules-activity-subslot--first${upperFirstEmpty ? ' rules-activity-subslot--empty' : ''}`}
          >
            {renderStrip(upperFirstSlot, upperFirstWindows)}
          </div>
          <div
            className={`rules-activity-subslot rules-activity-subslot--second${upperSecondEmpty ? ' rules-activity-subslot--empty' : ''}`}
          >
            {renderStrip(upperSecondSlot, upperSecondWindows)}
          </div>
        </div>
        <div
          className={`rules-activity-group rules-activity-group--bottom${lowerEmpty ? ' rules-activity-group--bottom-empty' : ''}`}
        >
          {renderStrip(lowerSlot, lowerWindows)}
        </div>
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
  bottomPanelAlignment,
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

        // Same-slot reorder: do NOT mutate the preview here. The
        // SortableContext + verticalListSortingStrategy already provides
        // stable visual feedback via CSS transforms during the drag; the
        // actual reorder is applied once in handleDragEnd. Mutating the
        // items array mid-drag shifts other tabs under the cursor, which
        // makes the cursor's "closest" target flip on the next frame and
        // cascades into double-jumps and out-of-strip overflow.
        if (activeLoc.slot === overLoc.slot) return prev;

        // Cross-slot move: update the preview so the tab visually
        // "joins" the new slot during the drag.
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
      const overId = event.over?.id ? String(event.over.id) : null;
      setDraggingId(null);
      setPreview(null);
      if (!activeTw || !finalPreview) return;

      // Locate where activeTw lives in the final preview vs current
      // state. If preview moved it to a different slot during drag-over,
      // commit that cross-slot move. If preview matches state (same-slot
      // case — handleDragOver intentionally skipped it), compute the
      // target index from `over` and apply once.
      for (const slot of ALL_DOCK_SLOTS) {
        const previewIdx = finalPreview[slot].indexOf(activeTw);
        if (previewIdx < 0) continue;
        const sourceIdx = tl.state.docks[slot].windows.indexOf(activeTw);

        if (sourceIdx < 0) {
          // Cross-slot: activeTw arrived in this slot via drag-over.
          tl.moveWindow(activeTw, slot, previewIdx);
          return;
        }

        // Same slot — only reorder when dropped onto a specific tab. A
        // drop on `dock:`/`drop:` (strip empty area or drop overlay for
        // the same slot) is a no-op so dragging above/below the list
        // doesn't fling the tab to the end.
        if (overId?.startsWith('tw:')) {
          const overTw = overId.slice(3) as T;
          const overIdx = tl.state.docks[slot].windows.indexOf(overTw);
          if (overIdx >= 0 && overIdx !== sourceIdx) {
            tl.moveWindow(activeTw, slot, overIdx);
          }
        }
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
  // Measured live from the DOM — the activity bar's effective width
  // depends on which CSS wins in the host (workspace `rules.less`
  // declares 64/36, devpanel / shared `dock-layout.css` declares
  // 96/36), so hardcoding the constant drifts the drop-zone rects off
  // the real dock edges. Reading it at runtime keeps the overlay in
  // sync with whatever the host actually renders.
  const [activityBarWidth, setActivityBarWidth] = useState<number>(64);

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

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const bar = shell.querySelector<HTMLElement>('.rules-activity-bar');
    if (!bar) return;
    setActivityBarWidth(bar.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number' && w > 0) setActivityBarWidth(w);
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, [showToolWindowLabels, sidebarLayout]);

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
      // Equal ratios (both = half of viewport) paired with
      // `proportionalLayout` on the side-region Allotment produce a
      // 50/50 split on first open that stays balanced on window resize.
      // Previously 0.35 each left ~30% slack, which the first pane
      // absorbed — making the top pane visibly taller than the bottom.
      top: { preferred: Math.round(window.innerHeight * 0.5), min: 120 },
      bottom: { preferred: Math.round(window.innerHeight * 0.5), min: 120 },
    }),
    [],
  );

  // ── Editor pane ───────────────────────────────────────────────────

  const editorPane = (
    <div className="rules-region rules-region-editor" data-region="editor" tabIndex={-1}>
      {renderEditor()}
    </div>
  );

  // Reusable Allotment.Pane factories so each alignment variant stays
  // readable. They're plain JSX returns (not components) — Allotment
  // only inspects React.Children for direct Pane elements, which these
  // still are.
  const leftSidebarPane = (
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
        focusStore={focusStore}
      />
    </Allotment.Pane>
  );

  const rightSidebarPane = (
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
        focusStore={focusStore}
      />
    </Allotment.Pane>
  );

  const bottomPane = (
    <Allotment.Pane
      preferredSize={sizes.bottom.preferred}
      minSize={sizes.bottom.min}
      maxSize={sizes.bottom.max}
      visible={bottomOpen}
      snap
    >
      <BottomRegion tl={tl} renderToolWindow={renderToolWindow} focusStore={focusStore} />
    </Allotment.Pane>
  );

  // Editor stacked over bottom — used by the `center` alignment only.
  const editorOverBottom = (
    <Allotment vertical proportionalLayout={false} onChange={handleVerticalChange}>
      <Allotment.Pane>{editorPane}</Allotment.Pane>
      {bottomPane}
    </Allotment>
  );

  // Three-column row — sidebar | middle | inspector. The `middle` slot
  // differs per alignment (e.g. center stacks editor+bottom in middle).
  const threeColumnRow = (middle: React.ReactNode) => (
    <Allotment proportionalLayout={false} onChange={handleHorizontalChange}>
      {leftSidebarPane}
      <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
        {middle}
      </Allotment.Pane>
      {rightSidebarPane}
    </Allotment>
  );

  // Four alignment variants. Each gets its own React key so toggling the
  // setting cleanly remounts the Allotment tree (sizing state resets).
  let centerContent: React.ReactNode;
  if (bottomPanelAlignment === 'center') {
    // H[ left | V[editor | bottom] | right ]
    centerContent = (
      <div key="center" style={{ height: '100%', width: '100%' }}>
        {threeColumnRow(editorOverBottom)}
      </div>
    );
  } else if (bottomPanelAlignment === 'justify') {
    // V[ H[left | editor | right] | bottom ]
    centerContent = (
      <Allotment key="justify" vertical proportionalLayout={false} onChange={handleVerticalChange}>
        <Allotment.Pane>{threeColumnRow(editorPane)}</Allotment.Pane>
        {bottomPane}
      </Allotment>
    );
  } else if (bottomPanelAlignment === 'left') {
    // H[ V[ H[left | editor] | bottom(left+editor) ] | right ]
    centerContent = (
      <Allotment key="left" proportionalLayout={false} onChange={handleHorizontalChange}>
        <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
          <Allotment vertical proportionalLayout={false} onChange={handleVerticalChange}>
            <Allotment.Pane>
              <Allotment proportionalLayout={false}>
                {leftSidebarPane}
                <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
                  {editorPane}
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
            {bottomPane}
          </Allotment>
        </Allotment.Pane>
        {rightSidebarPane}
      </Allotment>
    );
  } else {
    // 'right' — H[ left | V[ H[editor | right] | bottom(editor+right) ] ]
    centerContent = (
      <Allotment key="right" proportionalLayout={false} onChange={handleHorizontalChange}>
        {leftSidebarPane}
        <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
          <Allotment vertical proportionalLayout={false} onChange={handleVerticalChange}>
            <Allotment.Pane>
              <Allotment proportionalLayout={false}>
                <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
                  {editorPane}
                </Allotment.Pane>
                {rightSidebarPane}
              </Allotment>
            </Allotment.Pane>
            {bottomPane}
          </Allotment>
        </Allotment.Pane>
      </Allotment>
    );
  }

  const dragging = draggingId !== null;
  const highlightedSlot = useMemo<DockSlot | null>(() => {
    if (!preview || !draggingId) return null;
    for (const slot of ALL_DOCK_SLOTS) {
      if (preview[slot].includes(draggingId)) return slot;
    }
    return null;
  }, [preview, draggingId]);

  const dropZoneRects = useMemo<Record<DockSlot, DropZoneRect> | null>(() => {
    if (!dragging) return null;
    const fullW = shellSize.width;
    const fullH = shellSize.height;
    if (fullW === 0 || fullH === 0) return null;

    const preferredSidebar = sizes.sidebar.preferred;
    const preferredInspector = sizes.inspector.preferred;
    const preferredBottom = sizes.bottom.preferred;

    // Drop zones reflect the layout *as if all six panels were open* —
    // not the live region rects. Per-alignment math gives each side
    // the height it would have if the bottom panel were also expanded,
    // so sidebars get pushed up by `preferredBottom` only on the
    // alignments where the bottom panel actually shares their column.
    let leftHeight: number;
    let rightHeight: number;
    let bottomLeft: number;
    let bottomWidth: number;

    if (bottomPanelAlignment === 'center') {
      leftHeight = fullH;
      rightHeight = fullH;
      bottomLeft = activityBarWidth + preferredSidebar;
      bottomWidth = Math.max(0, fullW - 2 * activityBarWidth - preferredSidebar - preferredInspector);
    } else if (bottomPanelAlignment === 'justify') {
      leftHeight = Math.max(0, fullH - preferredBottom);
      rightHeight = Math.max(0, fullH - preferredBottom);
      bottomLeft = activityBarWidth;
      bottomWidth = Math.max(0, fullW - 2 * activityBarWidth);
    } else if (bottomPanelAlignment === 'left') {
      leftHeight = Math.max(0, fullH - preferredBottom);
      rightHeight = fullH;
      bottomLeft = activityBarWidth;
      bottomWidth = Math.max(0, fullW - 2 * activityBarWidth - preferredInspector);
    } else {
      // 'right'
      leftHeight = fullH;
      rightHeight = Math.max(0, fullH - preferredBottom);
      bottomLeft = activityBarWidth + preferredSidebar;
      bottomWidth = Math.max(0, fullW - 2 * activityBarWidth - preferredSidebar);
    }

    // Outer inset against the shell edges / activity bars; HALF_GAP is
    // half of the gutter rendered between the two halves of a region.
    // Adjacent zones get `2 * HALF_GAP` of clear space between them
    // (HALF_GAP from each side). Outer edges get the same OUTER inset
    // against the activity bar / window border.
    const OUTER = 4;
    const HALF_GAP = 4;

    const splitVertical = (r: { left: number; top: number; width: number; height: number }) => {
      const top: DropZoneRect = {
        left: r.left + OUTER,
        top: r.top + OUTER,
        width: Math.max(0, r.width - OUTER * 2),
        height: Math.max(0, r.height / 2 - OUTER - HALF_GAP),
      };
      const bottom: DropZoneRect = {
        left: r.left + OUTER,
        top: r.top + r.height / 2 + HALF_GAP,
        width: Math.max(0, r.width - OUTER * 2),
        height: Math.max(0, r.height / 2 - OUTER - HALF_GAP),
      };
      return [top, bottom] as const;
    };

    const splitHorizontal = (r: { left: number; top: number; width: number; height: number }) => {
      const left: DropZoneRect = {
        left: r.left + OUTER,
        top: r.top + OUTER,
        width: Math.max(0, r.width / 2 - OUTER - HALF_GAP),
        height: Math.max(0, r.height - OUTER * 2),
      };
      const right: DropZoneRect = {
        left: r.left + r.width / 2 + HALF_GAP,
        top: r.top + OUTER,
        width: Math.max(0, r.width / 2 - OUTER - HALF_GAP),
        height: Math.max(0, r.height - OUTER * 2),
      };
      return [left, right] as const;
    };

    const [lt, lb] = splitVertical({ left: activityBarWidth, top: 0, width: preferredSidebar, height: leftHeight });
    const [rt, rb] = splitVertical({
      left: fullW - activityBarWidth - preferredInspector,
      top: 0,
      width: preferredInspector,
      height: rightHeight,
    });
    const [bl, br] = splitHorizontal({
      left: bottomLeft,
      top: fullH - preferredBottom,
      width: bottomWidth,
      height: preferredBottom,
    });

    return {
      'left-top': lt,
      'left-bottom': lb,
      'right-top': rt,
      'right-bottom': rb,
      'bottom-left': bl,
      'bottom-right': br,
    };
  }, [dragging, shellSize, sizes, bottomPanelAlignment, activityBarWidth]);

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
        layoutRevision={bottomPanelAlignment}
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
        layoutRevision={bottomPanelAlignment}
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
      // Critical: freeze droppable rects at drag start. The default
      // WhileDragging strategy re-measures on every translate update,
      // and a specific transition (cursor leaving + re-entering the
      // viewport) pushes setRects past React's nested-update ceiling
      // → React #185 / white workspace.
      measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={`rules-main rules-main--layout-${sidebarLayout} rules-main--bottom-${bottomPanelAlignment}`}
        ref={shellRef}
      >
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
