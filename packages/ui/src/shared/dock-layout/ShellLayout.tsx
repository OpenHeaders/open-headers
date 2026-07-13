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

import { type CollisionDetection, closestCenter, DndContext, DragOverlay, MeasuringStrategy } from '@dnd-kit/core';
import { Allotment, LayoutPriority } from 'allotment';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BAR_LABELED_MIN } from './constants';
import { BottomRegion, SideRegion } from './DockRegions';
import { computeDropZoneRects } from './drop-zone-rects';
import DropZoneOverlay from './DropZoneOverlay';
import type { FocusStore } from './focus-store';
import type {
  BottomPanelAlignment,
  DockSlot,
  DropZoneRect,
  SidebarLayoutVariant,
  ToolWindowDef,
} from './types';
import { useActivityBarSizing } from './use-activity-bar-sizing';
import { useDockDrag } from './use-dock-drag';
import type { DockLayoutApi } from './use-dock-layout';
import { useNativeDragGuard } from './use-native-drag-guard';
import VerticalActivityBar from './VerticalActivityBar';

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
  /** Per-rail activity-bar width in px. Applies only when
      `showToolWindowLabels` is true; in icon-only mode the bar is
      locked to a fixed 36px. Range enforced by the host's settings
      schema (typically 64–160). */
  activityBarWidths: { left: number; right: number };
  /** Persist new bar widths after the user drags a rail's resize
      handle. Called with the next pixel width for both rails. */
  onActivityBarResize: (sizes: { left: number; right: number }) => void;
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
  activityBarWidths,
  onActivityBarResize,
  sizes,
  collisionDetection,
  focusStore,
}: ShellLayoutProps<T>) {
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

  // Defer alignment-driven tree changes until the bottom region is
  // actually open. With no active bottom tool window the bottom pane
  // is `visible={false}`, so the four variants render identically;
  // remounting the entire center tree (and replaying the paint mask)
  // when the user picks a different alignment from a menu would just
  // be cost. The setting still persists — we apply it the next time
  // the bottom region opens, which itself causes a layout change so
  // the swap blends into that transition.
  const [effectiveAlignment, setEffectiveAlignment] = useState<BottomPanelAlignment>(bottomPanelAlignment);
  useEffect(() => {
    if (bottomOpen) setEffectiveAlignment(bottomPanelAlignment);
  }, [bottomOpen, bottomPanelAlignment]);

  const shellRef = useRef<HTMLDivElement>(null);
  useNativeDragGuard(shellRef);
  const [shellSize, setShellSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // Measured live from the DOM — left and right rails can be sized
  // independently (per-rail user setting in labeled mode), so we
  // track each width separately. The drop-zone overlay math below
  // reads these to position the dock-half rectangles flush with the
  // real bar edges, no matter what the user has resized them to.
  const [barWidths, setBarWidths] = useState<{ left: number; right: number }>({ left: 64, right: 64 });

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
    const leftBar = shell.querySelector<HTMLElement>('.rules-activity-bar--left');
    const rightBar = shell.querySelector<HTMLElement>('.rules-activity-bar--right');
    if (!leftBar || !rightBar) return;

    const measure = () => {
      const nextLeft = leftBar.offsetWidth;
      const nextRight = rightBar.offsetWidth;
      setBarWidths((prev) => (prev.left === nextLeft && prev.right === nextRight ? prev : { left: nextLeft, right: nextRight }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(leftBar);
    ro.observe(rightBar);
    return () => ro.disconnect();
  }, [showToolWindowLabels, sidebarLayout]);

  // Sash-drag onChange handlers forward straight to the host — no React
  // state per drag tick. Allotment owns the live pane sizes in the DOM;
  // mirroring them into state here re-rendered the entire shell (and
  // with it every keep-alive editor tab body) on every pointer move,
  // which made a divider drag lag proportionally to open-tab count.
  const handleHorizontalChange = onHorizontalResize;
  const handleVerticalChange = onVerticalResize;

  const topBottomHalves = useMemo(() => {
    const vh = window.innerHeight;
    // Equal ratios (both = half of viewport) paired with
    // `proportionalLayout` on the side-region Allotment produce a
    // 50/50 split on first open that stays balanced on window resize.
    // Previously 0.35 each left ~30% slack, which the first pane
    // absorbed — making the top pane visibly taller than the bottom.
    return {
      left: {
        top: { preferred: Math.round(vh * 0.5), min: 120 },
        bottom: { preferred: Math.round(vh * 0.5), min: 120 },
      },
      // Right region opens with a 60/40 split on a fresh profile:
      // Docs (right-top) gets the larger pane for reading width, Scope
      // (right-bottom) sits beneath at the smaller height that suits
      // its inspector density. Drag-to-resize persists per-workspace
      // via the side-region's onDragEnd path.
      right: {
        top: { preferred: Math.round(vh * 0.6), min: 120 },
        bottom: { preferred: Math.round(vh * 0.4), min: 120 },
      },
    };
  }, []);

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
      preferredSize={sizes.sidebar.min}
      minSize={sizes.sidebar.min}
      maxSize={sizes.sidebar.max}
      visible={leftOpen}
      priority={LayoutPriority.Low}
    >
      <SideRegion<T>
        region="left"
        tl={tl}
        renderToolWindow={renderToolWindow}
        topSize={topBottomHalves.left.top}
        bottomSize={topBottomHalves.left.bottom}
        focusStore={focusStore}

      />
    </Allotment.Pane>
  );

  const rightSidebarPane = (
    <Allotment.Pane
      preferredSize={sizes.inspector.min}
      minSize={sizes.inspector.min}
      maxSize={sizes.inspector.max}
      visible={rightOpen}
    >
      <SideRegion<T>
        region="right"
        tl={tl}
        renderToolWindow={renderToolWindow}
        topSize={topBottomHalves.right.top}
        bottomSize={topBottomHalves.right.bottom}
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
    >
      <BottomRegion tl={tl} renderToolWindow={renderToolWindow} focusStore={focusStore} />
    </Allotment.Pane>
  );

  // Default sizes provided to each alignment-variant Allotment so its
  // first paint is laid out at the correct sizes — without these,
  // Allotment renders panes at 0 until its internal ResizeObserver
  // fires (one frame later), which is the source of the alignment-
  // toggle flash. Computed from the live shell measurement and the
  // host's responsive `sizes`. When the shell hasn't been measured
  // yet (very first render) we fall back to the configured preferred
  // sizes, which still produces a deterministic layout.
  const verticalDefaults: [number, number] = [
    Math.max(0, (shellSize.height || 1000) - sizes.bottom.preferred),
    sizes.bottom.preferred,
  ];
  const innerHorizDefaults: [number, number, number] = [
    sizes.sidebar.preferred,
    Math.max(
      sizes.editorMin,
      (shellSize.width || 1200) - sizes.sidebar.preferred - sizes.inspector.preferred - 2 * BAR_LABELED_MIN,
    ),
    sizes.inspector.preferred,
  ];
  const leftAlignOuterDefaults: [number, number] = [
    Math.max(sizes.editorMin, (shellSize.width || 1200) - sizes.inspector.preferred - 2 * BAR_LABELED_MIN),
    sizes.inspector.preferred,
  ];
  const leftAlignInnerHorizDefaults: [number, number] = [
    sizes.sidebar.preferred,
    Math.max(sizes.editorMin, (shellSize.width || 1200) - sizes.sidebar.preferred - sizes.inspector.preferred),
  ];
  const rightAlignOuterDefaults: [number, number] = [
    sizes.sidebar.preferred,
    Math.max(sizes.editorMin, (shellSize.width || 1200) - sizes.sidebar.preferred - 2 * BAR_LABELED_MIN),
  ];
  const rightAlignInnerHorizDefaults: [number, number] = [
    Math.max(sizes.editorMin, (shellSize.width || 1200) - sizes.sidebar.preferred - sizes.inspector.preferred),
    sizes.inspector.preferred,
  ];

  // Editor stacked over bottom — used by the `center` alignment only.
  const editorOverBottom = (
    <Allotment
      vertical
      proportionalLayout={false}
      onChange={handleVerticalChange}
      defaultSizes={verticalDefaults}
    >
      <Allotment.Pane>{editorPane}</Allotment.Pane>
      {bottomPane}
    </Allotment>
  );

  // No `onReset` on the inner horizontal Allotments. Allotment's native
  // sashreset handler (allotment.tsx:289-303) already does the right
  // thing: on sash double-click it calls `resizeToPreferredSize` on the
  // left-adjacent pane first, then the right-adjacent pane, falling
  // back to `distributeViewSizes` only if neither has a `preferredSize`.
  // Since the side panes carry `preferredSize={sideResetTargetPx}` and
  // the editor pane has none, every sash (sidebar↔editor and
  // editor↔inspector) natively snaps the SIDE pane to the symmetric
  // target — exactly the behavior we want.

  // Three-column row — sidebar | middle | inspector. The `middle` slot
  // differs per alignment (e.g. center stacks editor+bottom in middle).
  const threeColumnRow = (middle: React.ReactNode) => (
    <Allotment
      proportionalLayout={false}
      onChange={handleHorizontalChange}
      defaultSizes={innerHorizDefaults}
    >
      {leftSidebarPane}
      <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
        {middle}
      </Allotment.Pane>
      {rightSidebarPane}
    </Allotment>
  );

  // Four alignment variants. Each gets its own React key so toggling
  // the setting cleanly remounts the Allotment tree (sizing state
  // resets). The `rules-center-mount` class on each wrapper masks any
  // residual single-frame paint flicker behind a sub-perceptual
  // opacity fade so the swap reads as instant in both light and dark.
  let centerContent: React.ReactNode;
  if (effectiveAlignment === 'center') {
    // H[ left | V[editor | bottom] | right ]
    centerContent = (
      <div key="center" className="rules-center-mount" style={{ height: '100%', width: '100%' }}>
        {threeColumnRow(editorOverBottom)}
      </div>
    );
  } else if (effectiveAlignment === 'justify') {
    // V[ H[left | editor | right] | bottom ]
    centerContent = (
      <div key="justify" className="rules-center-mount" style={{ height: '100%', width: '100%' }}>
        <Allotment
          vertical
          proportionalLayout={false}
          onChange={handleVerticalChange}
          defaultSizes={verticalDefaults}
        >
          <Allotment.Pane>{threeColumnRow(editorPane)}</Allotment.Pane>
          {bottomPane}
        </Allotment>
      </div>
    );
  } else if (effectiveAlignment === 'left') {
    // H[ V[ H[left | editor] | bottom(left+editor) ] | right ]
    centerContent = (
      <div key="left" className="rules-center-mount" style={{ height: '100%', width: '100%' }}>
        <Allotment
          proportionalLayout={false}
          onChange={handleHorizontalChange}
          defaultSizes={leftAlignOuterDefaults}
        >
          <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
            <Allotment
              vertical
              proportionalLayout={false}
              onChange={handleVerticalChange}
              defaultSizes={verticalDefaults}
            >
              <Allotment.Pane>
                <Allotment
                  proportionalLayout={false}
                  defaultSizes={leftAlignInnerHorizDefaults}
                >
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
      </div>
    );
  } else {
    // 'right' — H[ left | V[ H[editor | right] | bottom(editor+right) ] ]
    centerContent = (
      <div key="right" className="rules-center-mount" style={{ height: '100%', width: '100%' }}>
        <Allotment
          proportionalLayout={false}
          onChange={handleHorizontalChange}
          defaultSizes={rightAlignOuterDefaults}
        >
          {leftSidebarPane}
          <Allotment.Pane priority={LayoutPriority.High} minSize={sizes.editorMin}>
            <Allotment
              vertical
              proportionalLayout={false}
              onChange={handleVerticalChange}
              defaultSizes={verticalDefaults}
            >
              <Allotment.Pane>
                <Allotment
                  proportionalLayout={false}
                  defaultSizes={rightAlignInnerHorizDefaults}
                >
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
      </div>
    );
  }

  const dropZoneRects = useMemo<Record<DockSlot, DropZoneRect> | null>(
    () => (dragging ? computeDropZoneRects({ shellSize, sizes, bottomPanelAlignment, barWidths }) : null),
    [dragging, shellSize, sizes, bottomPanelAlignment, barWidths.left, barWidths.right],
  );

  const { barMin, barMax, leftBarPreferred, rightBarPreferred, barsAllotmentRef, barsRowRef, handleBarsReset } =
    useActivityBarSizing({ showToolWindowLabels, activityBarWidths, onActivityBarResize });

  const mainRow = (
    <div className="rules-main-row" ref={barsRowRef}>
      <Allotment ref={barsAllotmentRef} proportionalLayout={false} onReset={handleBarsReset}>
        <Allotment.Pane preferredSize={leftBarPreferred} minSize={barMin} maxSize={barMax}>
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
            layoutRevision={effectiveAlignment}
          />
        </Allotment.Pane>
        <Allotment.Pane priority={LayoutPriority.High}>
          <div className="rules-main-horizontal">{centerContent}</div>
        </Allotment.Pane>
        <Allotment.Pane preferredSize={rightBarPreferred} minSize={barMin} maxSize={barMax}>
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
            layoutRevision={effectiveAlignment}
          />
        </Allotment.Pane>
      </Allotment>
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
        className={`rules-main rules-main--layout-${sidebarLayout} rules-main--bottom-${effectiveAlignment}`}
        ref={shellRef}
      >
        {mainRow}
        <DropZoneOverlay
          visible={draggingId !== null}
          rects={dropZoneRects}
          highlightedSlot={highlightedSlot}
          leftBarWidth={barWidths.left}
          rightBarWidth={barWidths.right}
        />
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
