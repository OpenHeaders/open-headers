/**
 * ShellLayout — generic tool-window shell shared between workbench.html
 * and the DevTools Inspector panel.
 *
 * ONE CSS grid (see track-model.ts) places the six tool-window docks
 * across three visual regions (left column, right column, bottom bar),
 * the central editor area, and the two activity bars. The four bottom-
 * panel alignments are four `grid-template-areas` strings, selected by
 * a class — no tree is remounted when the user switches:
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
 * A window resize is resolved by the layout engine alone. JavaScript
 * runs only during a sash drag (one custom-property write per pointer
 * move) and reports the resulting sizes to the host on release.
 *
 * Drag-and-drop is wired through dnd-kit: DockTabStrip tabs are draggable,
 * DropZoneOverlay renders six drop targets during a drag, and onDragEnd
 * resolves to a moveWindow() call on the layout state machine.
 *
 * Host props keep this component pure and render-prop driven so the host
 * App can pass arbitrary editor / sidebar / panel content into the right
 * slots without ShellLayout knowing anything about domain data.
 */

import { type CollisionDetection, closestCenter, DndContext, DragOverlay, MeasuringStrategy } from '@dnd-kit/core';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { BAR_COMPACT_WIDTH, BAR_LABELED_MAX, BAR_LABELED_MIN } from './constants';
import { BottomRegion, SideRegion } from './DockRegions';
import { computeDropZoneRects } from './drop-zone-rects';
import DropZoneOverlay from './DropZoneOverlay';
import type { FocusStore } from './focus-store';
import Sash, { type SashSession } from './Sash';
import { SHELL_TRACK_VARS, trackValue } from './track-model';
import type {
  BottomPanelAlignment,
  BottomPanelSplit,
  DockSlot,
  DropZoneRect,
  ShellSurface,
  SidebarLayoutVariant,
  ToolWindowDef,
} from './types';
import { resolveToolWindowLabel } from './tool-window-copy';
import { useDockDrag } from './use-dock-drag';
import type { DockLayoutApi } from './use-dock-layout';
import { useNativeDragGuard } from './use-native-drag-guard';
import VerticalActivityBar from './VerticalActivityBar';

// ── Props ─────────────────────────────────────────────────────────────

export interface ShellLayoutProps<T extends string> {
  tl: DockLayoutApi<T>;
  windowMap: Record<T, ToolWindowDef<T>>;
  /** Renders the body of a tool window. Called for every window the user
      has activated in its dock — bodies are kept mounted (display-toggled)
      across tab switches, so this must tolerate concurrent instances. */
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  /** Renders the central editor area (tabs + breadcrumb + active tab body). */
  renderEditor: () => React.ReactNode;
  /** Called when a sash drag ends with the live px widths
      `[sidebar, editor, inspector]` (a closed pane reports 0) so the
      host can persist ratios. */
  onHorizontalResize: (sizes: number[]) => void;
  /** Called when the bottom sash drag ends with `[main, bottom]` px. */
  onVerticalResize: (sizes: number[]) => void;
  /** Render the floating drag preview for an editor tab (owned by the host). */
  renderEditorTabDragPreview?: (tabId: string) => React.ReactNode;
  /** Layout configuration — read from settings store by the host. */
  bottomPanelAlignment: BottomPanelAlignment;
  /** How the two bottom docks share the bottom panel — side-by-side
      columns (default) or stacked rows. */
  bottomPanelSplit?: BottomPanelSplit;
  showToolWindowLabels: boolean;
  sidebarLayout: SidebarLayoutVariant;
  onToggleLabels: () => void;
  /** Per-rail activity-bar width in px. Applies only when
      `showToolWindowLabels` is true; in icon-only mode the bar is
      locked to a fixed 36px. Range enforced by the host's settings
      schema (typically 64–160). */
  activityBarWidths: { left: number; right: number };
  /** Persist new bar widths after the user drags a rail's resize
      handle. Called with the next pixel width for both rails. */
  onActivityBarResize: (sizes: { left: number; right: number }) => void;
  /** Responsive sizing. `resetTarget` is the width a side pane snaps to
   *  on sash double-click; it defaults to `min` — the workbench's
   *  reset-to-narrow behavior — while the panel passes its seed so
   *  reset restores the default split. */
  sizes: {
    sidebar: { preferred: number; min: number; max: number; resetTarget?: number };
    inspector: { preferred: number; min: number; max: number; resetTarget?: number };
    bottom: { preferred: number; min: number; max: number };
    editorMin: number;
  };
  /** Custom collision detection for editor-tab drags. */
  collisionDetection?: CollisionDetection;
  /** Focus store — drives the blue accent on active tool-window tabs. */
  focusStore: FocusStore;
  /**
   * Sizing model for the horizontal splits (sidebar | editor |
   * inspector). Default (false) is pixel-stable: panes keep their px
   * width on container resize and the editor absorbs the delta — right
   * for a desktop window, where resizes are incremental. Hosts whose
   * container flips between radically different geometries (the
   * DevTools panel re-docking right ↔ bottom) pass true: panes keep
   * their FRACTION instead, so a 50/50 split is 50/50 in every dock
   * and user drags carry over as proportions. Vertical splits (bottom
   * panel height) and the activity-bar rails stay pixel-stable either
   * way — they're fixed-height/width affordances, not shares.
   */
  proportionalHorizontal?: boolean;
  /**
   * Narrow single-surface mode. When set, the center area shows ONLY
   * this surface (the editor or one tool region) instead of the
   * multi-column grid — for hosts whose container can get too narrow
   * for side-by-side panes (the DevTools panel docked left/right).
   * All surfaces stay mounted (display-toggled) so editor tab bodies
   * and region state survive switching. The activity bars remain
   * visible as the switcher. Null/omitted → normal layout.
   */
  singleSurface?: ShellSurface | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

const widthOf = (el: HTMLElement | null): number => el?.offsetWidth ?? 0;
const heightOf = (el: HTMLElement | null): number => el?.offsetHeight ?? 0;

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
  bottomPanelSplit = 'columns',
  showToolWindowLabels,
  sidebarLayout,
  onToggleLabels,
  activityBarWidths,
  onActivityBarResize,
  sizes,
  collisionDetection,
  focusStore,
  proportionalHorizontal = false,
  singleSurface = null,
}: ShellLayoutProps<T>) {
  const t = useT();
  const {
    sensors,
    draggingId,
    draggingTabId,
    dragging,
    highlightedSlot,
    getWindows,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDockDrag(tl);

  const leftOpen = tl.isRegionOpen('left');
  const rightOpen = tl.isRegionOpen('right');
  const bottomOpen = tl.isRegionOpen('bottom');

  const shellRef = useRef<HTMLDivElement>(null);
  useNativeDragGuard(shellRef);
  const gridRef = useRef<HTMLDivElement>(null);
  const barLeftRef = useRef<HTMLDivElement>(null);
  const barRightRef = useRef<HTMLDivElement>(null);
  const leftCellRef = useRef<HTMLDivElement>(null);
  const editorCellRef = useRef<HTMLDivElement>(null);
  const rightCellRef = useRef<HTMLDivElement>(null);
  const bottomCellRef = useRef<HTMLDivElement>(null);

  // ── Tracks ────────────────────────────────────────────────────────

  // In icon-only (compact) mode both rails are locked to
  // BAR_COMPACT_WIDTH and their sashes aren't rendered; with labels the
  // user drags between BAR_LABELED_MIN and BAR_LABELED_MAX, persisted
  // per rail via the host settings.
  const compactBars = !showToolWindowLabels;
  const barLeft = compactBars ? BAR_COMPACT_WIDTH : activityBarWidths.left;
  const barRight = compactBars ? BAR_COMPACT_WIDTH : activityBarWidths.right;

  // Fixed px inputs go straight onto the grid as custom properties.
  const trackStyle = useMemo(
    () =>
      ({
        [SHELL_TRACK_VARS.barLeft]: `${barLeft}px`,
        [SHELL_TRACK_VARS.barRight]: `${barRight}px`,
        [SHELL_TRACK_VARS.sidebarMin]: `${sizes.sidebar.min}px`,
        [SHELL_TRACK_VARS.inspectorMin]: `${sizes.inspector.min}px`,
        [SHELL_TRACK_VARS.editorMin]: `${sizes.editorMin}px`,
        [SHELL_TRACK_VARS.bottomMin]: `${sizes.bottom.min}px`,
      }) as React.CSSProperties,
    [barLeft, barRight, sizes],
  );

  // The three pane sizes are written from a layout effect (pre-paint)
  // rather than the style prop: in the proportional model a px seed
  // becomes a share of the grid, which needs the grid measured. The
  // host owns these values — whenever `sizes` changes (persisted drag
  // flowing back, workspace switch, panel re-dock) they're re-applied;
  // a drag in progress writes the same properties directly.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const gridW = grid.clientWidth;
    grid.style.setProperty(SHELL_TRACK_VARS.sidebar, trackValue(sizes.sidebar.preferred, proportionalHorizontal, gridW));
    grid.style.setProperty(
      SHELL_TRACK_VARS.inspector,
      trackValue(sizes.inspector.preferred, proportionalHorizontal, gridW),
    );
    grid.style.setProperty(SHELL_TRACK_VARS.bottom, trackValue(sizes.bottom.preferred, false, 0));
  }, [sizes, proportionalHorizontal]);

  // ── Sash sessions ─────────────────────────────────────────────────

  const reportColumns = useCallback(() => {
    onHorizontalResize([widthOf(leftCellRef.current), widthOf(editorCellRef.current), widthOf(rightCellRef.current)]);
  }, [onHorizontalResize]);

  const reportRows = useCallback(() => {
    const bottom = heightOf(bottomCellRef.current);
    onVerticalResize([heightOf(gridRef.current) - bottom, bottom]);
  }, [onVerticalResize]);

  // Side panes: the editor must keep `editorMin`, so the drag ceiling
  // is the pane's max or the editor's current slack, whichever is
  // smaller. The value is written in the host's sizing model.
  const beginSide = useCallback(
    (cellRef: React.RefObject<HTMLDivElement | null>, pane: 'sidebar' | 'inspector'): SashSession | null => {
      const grid = gridRef.current;
      const cell = cellRef.current;
      if (!grid || !cell) return null;
      const start = widthOf(cell);
      const slack = widthOf(editorCellRef.current) - sizes.editorMin;
      const gridW = grid.clientWidth;
      const varName = SHELL_TRACK_VARS[pane];
      return {
        start,
        min: sizes[pane].min,
        max: Math.max(sizes[pane].min, Math.min(sizes[pane].max, start + slack)),
        apply: (px) => grid.style.setProperty(varName, trackValue(px, proportionalHorizontal, gridW)),
        commit: reportColumns,
      };
    },
    [sizes, proportionalHorizontal, reportColumns],
  );
  const beginSidebar = useCallback(() => beginSide(leftCellRef, 'sidebar'), [beginSide]);
  const beginInspector = useCallback(() => beginSide(rightCellRef, 'inspector'), [beginSide]);

  const resetSide = useCallback(
    (pane: 'sidebar' | 'inspector') => {
      const grid = gridRef.current;
      if (!grid) return;
      const target = sizes[pane].resetTarget ?? sizes[pane].min;
      grid.style.setProperty(SHELL_TRACK_VARS[pane], trackValue(target, proportionalHorizontal, grid.clientWidth));
      reportColumns();
    },
    [sizes, proportionalHorizontal, reportColumns],
  );
  const resetSidebar = useCallback(() => resetSide('sidebar'), [resetSide]);
  const resetInspector = useCallback(() => resetSide('inspector'), [resetSide]);

  const beginBottom = useCallback((): SashSession | null => {
    const grid = gridRef.current;
    const cell = bottomCellRef.current;
    if (!grid || !cell) return null;
    const start = heightOf(cell);
    const slack = heightOf(grid) - start - MAIN_ROW_MIN;
    return {
      start,
      min: sizes.bottom.min,
      max: Math.max(sizes.bottom.min, Math.min(sizes.bottom.max, start + slack)),
      apply: (px) => grid.style.setProperty(SHELL_TRACK_VARS.bottom, `${px}px`),
      commit: reportRows,
    };
  }, [sizes, reportRows]);

  const resetBottom = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.style.setProperty(SHELL_TRACK_VARS.bottom, `${sizes.bottom.preferred}px`);
    reportRows();
  }, [sizes, reportRows]);

  // Activity bars: persisted only on release, never from layout
  // events, so nothing can drift the stored widths.
  const reportBars = useCallback(() => {
    onActivityBarResize({ left: widthOf(barLeftRef.current), right: widthOf(barRightRef.current) });
  }, [onActivityBarResize]);

  const beginBar = useCallback(
    (side: 'left' | 'right'): SashSession | null => {
      const grid = gridRef.current;
      const cell = side === 'left' ? barLeftRef.current : barRightRef.current;
      if (!grid || !cell) return null;
      const start = widthOf(cell);
      const slack = widthOf(editorCellRef.current) - sizes.editorMin;
      const varName = side === 'left' ? SHELL_TRACK_VARS.barLeft : SHELL_TRACK_VARS.barRight;
      return {
        start,
        min: BAR_LABELED_MIN,
        max: Math.max(BAR_LABELED_MIN, Math.min(BAR_LABELED_MAX, start + slack)),
        apply: (px) => grid.style.setProperty(varName, `${px}px`),
        commit: reportBars,
      };
    },
    [sizes.editorMin, reportBars],
  );
  const beginBarLeft = useCallback(() => beginBar('left'), [beginBar]);
  const beginBarRight = useCallback(() => beginBar('right'), [beginBar]);

  // Double-click on either rail's sash snaps BOTH rails to the labeled
  // minimum; the middle column absorbs the slack.
  const resetBars = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.style.setProperty(SHELL_TRACK_VARS.barLeft, `${BAR_LABELED_MIN}px`);
    grid.style.setProperty(SHELL_TRACK_VARS.barRight, `${BAR_LABELED_MIN}px`);
    reportBars();
  }, [reportBars]);

  // ── Drop zones ────────────────────────────────────────────────────

  // Measured once when a drag starts — matching the DndContext measuring
  // strategy below, which also freezes droppable rects at drag start.
  const dropGeometry = useMemo<{ rects: Record<DockSlot, DropZoneRect> | null; bars: { left: number; right: number } } | null>(() => {
    if (!dragging) return null;
    const grid = gridRef.current;
    if (!grid) return null;
    const bars = { left: widthOf(barLeftRef.current), right: widthOf(barRightRef.current) };
    return {
      rects: computeDropZoneRects({
        shellSize: { width: grid.clientWidth, height: grid.clientHeight },
        sizes,
        bottomPanelAlignment,
        bottomPanelSplit,
        barWidths: bars,
      }),
      bars,
    };
  }, [dragging, sizes, bottomPanelAlignment, bottomPanelSplit]);

  // ── Cells ─────────────────────────────────────────────────────────

  const single = singleSurface !== null;
  const cellVisible = (surface: ShellSurface, open: boolean) => (single ? singleSurface === surface : open);
  const cellStyle = (visible: boolean): React.CSSProperties | undefined => (visible ? undefined : { display: 'none' });

  const activityBar = (side: 'left' | 'right') => (
    <VerticalActivityBar<T>
      side={side}
      tl={tl}
      windowMap={windowMap}
      getWindows={getWindows}
      dragging={dragging}
      showLabels={showToolWindowLabels}
      sidebarLayout={sidebarLayout}
      bottomSplit={bottomPanelSplit}
      onToggleLabels={onToggleLabels}
      focusStore={focusStore}
    />
  );

  // The rails are chrome: an outer `rail | center | rail` grid keeps them
  // on screen at any window width, and the pane grid inside the center
  // column clips when the window is narrower than the panes' minimums.
  const centerClass = [
    'rules-shell-center',
    `rules-shell-center--align-${bottomPanelAlignment}`,
    single ? 'rules-shell-center--single' : '',
    leftOpen ? '' : 'rules-shell-center--left-closed',
    rightOpen ? '' : 'rules-shell-center--right-closed',
    bottomOpen ? '' : 'rules-shell-center--bottom-closed',
  ]
    .filter(Boolean)
    .join(' ');

  const grid = (
    <div className="rules-shell-grid" style={trackStyle} ref={gridRef}>
      <div className="rules-shell-bar rules-shell-bar--left" ref={barLeftRef}>
        {activityBar('left')}
        {!compactBars && <Sash axis="x" edge="end" begin={beginBarLeft} onReset={resetBars} />}
      </div>

      <div className={centerClass}>
        <div
          className="rules-shell-cell rules-shell-cell--left"
          ref={leftCellRef}
          style={cellStyle(cellVisible('left', leftOpen))}
        >
          <SideRegion<T>
            region="left"
            tl={tl}
            renderToolWindow={renderToolWindow}
            topSize={SIDE_SEED.left.top}
            bottomSize={SIDE_SEED.left.bottom}
            focusStore={focusStore}
          />
          {!single && <Sash axis="x" edge="end" begin={beginSidebar} onReset={resetSidebar} />}
        </div>

        <div
          className="rules-shell-cell rules-shell-cell--editor"
          ref={editorCellRef}
          style={cellStyle(cellVisible('editor', true))}
        >
          <div className="rules-region rules-region-editor" data-region="editor" tabIndex={-1}>
            {renderEditor()}
          </div>
        </div>

        <div
          className="rules-shell-cell rules-shell-cell--right"
          ref={rightCellRef}
          style={cellStyle(cellVisible('right', rightOpen))}
        >
          {!single && <Sash axis="x" edge="start" begin={beginInspector} onReset={resetInspector} />}
          <SideRegion<T>
            region="right"
            tl={tl}
            renderToolWindow={renderToolWindow}
            topSize={SIDE_SEED.right.top}
            bottomSize={SIDE_SEED.right.bottom}
            focusStore={focusStore}
          />
        </div>

        <div
          className="rules-shell-cell rules-shell-cell--bottom"
          ref={bottomCellRef}
          style={cellStyle(cellVisible('bottom', bottomOpen))}
        >
          {!single && <Sash axis="y" edge="start" begin={beginBottom} onReset={resetBottom} />}
          <BottomRegion tl={tl} renderToolWindow={renderToolWindow} focusStore={focusStore} split={bottomPanelSplit} />
        </div>
      </div>

      <div className="rules-shell-bar rules-shell-bar--right" ref={barRightRef}>
        {!compactBars && <Sash axis="x" edge="start" begin={beginBarRight} onReset={resetBars} />}
        {activityBar('right')}
      </div>
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
        {grid}
        <DropZoneOverlay
          visible={draggingId !== null}
          rects={dropGeometry?.rects ?? null}
          highlightedSlot={highlightedSlot}
          leftBarWidth={dropGeometry?.bars.left ?? barLeft}
          rightBarWidth={dropGeometry?.bars.right ?? barRight}
          bottomSplit={bottomPanelSplit}
        />
      </div>
      <DragOverlay>
        {draggingDef ? (
          <div className="rules-drag-preview">
            <span className="rules-drag-preview-icon">{draggingDef.icon}</span>
            <span className="rules-drag-preview-label">{resolveToolWindowLabel(draggingDef, t)}</span>
          </div>
        ) : (
          editorTabPreview
        )}
      </DragOverlay>
    </DndContext>
  );
}

// The editor row never drops below this; the bottom sash's ceiling is
// derived from it. Mirrors `--oh-main-min` in dock-layout.css.
const MAIN_ROW_MIN = 120;

// Seed splits of the side regions as flex weights. Left opens 50/50;
// right opens 60/40 — Docs (right-top) gets the larger pane for
// reading width, Scope (right-bottom) sits beneath at the smaller
// height that suits its inspector density. Both panes keep a 120px
// floor.
const SIDE_SEED = {
  left: {
    top: { preferred: 1, min: 120 },
    bottom: { preferred: 1, min: 120 },
  },
  right: {
    top: { preferred: 3, min: 120 },
    bottom: { preferred: 2, min: 120 },
  },
} as const;

export default ShellLayoutInner;
