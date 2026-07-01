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
import { Allotment, type AllotmentHandle, LayoutPriority } from 'allotment';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useDockDrag } from './use-dock-drag';
import type { DockLayoutApi } from './use-dock-layout';
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

// Activity-bar size constants — kept in one place so the Pane min/max,
// the host settings schema, and the render path agree. Compact (icon-
// only) mode pins the bar; labeled mode allows free resize within
// [BAR_LABELED_MIN, BAR_LABELED_MAX] driven by the user's settings.
const BAR_COMPACT_WIDTH = 36;
const BAR_LABELED_MIN = 64;
const BAR_LABELED_MAX = 160;

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
  const [shellSize, setShellSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [horizontalSizes, setHorizontalSizes] = useState<number[] | null>(null);
  const [verticalSizes, setVerticalSizes] = useState<number[] | null>(null);
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

  // Bar pane sizing. In icon-only (compact) mode, both rails are
  // locked to BAR_COMPACT_WIDTH by setting min == max; the user can't
  // drag the sash. With labels visible, the user can drag between
  // BAR_LABELED_MIN and BAR_LABELED_MAX, persisted per-rail via the
  // host settings.
  const barMin = showToolWindowLabels ? BAR_LABELED_MIN : BAR_COMPACT_WIDTH;
  const barMax = showToolWindowLabels ? BAR_LABELED_MAX : BAR_COMPACT_WIDTH;
  const leftBarPreferred = showToolWindowLabels ? activityBarWidths.left : BAR_COMPACT_WIDTH;
  const rightBarPreferred = showToolWindowLabels ? activityBarWidths.right : BAR_COMPACT_WIDTH;

  // The bars Allotment never unmounts — toggling labels just shifts
  // pane min/max bounds and we re-apply each pane's `preferredSize`
  // imperatively via the ref below. A `key` swap here would cause
  // the entire tree to unmount/remount (visible flash on every label
  // toggle); reusing the same instance keeps the transition seamless,
  // the way it behaves in mature IDE shells.
  const barsAllotmentRef = useRef<AllotmentHandle>(null);
  const barsMountedRef = useRef(false);

  useLayoutEffect(() => {
    // First mount: rely on each pane's `preferredSize` prop to lay
    // out the bars; calling into Allotment before its children have
    // registered with the layout service throws (`undefined.minimumSize`).
    if (!barsMountedRef.current) {
      barsMountedRef.current = true;
      return;
    }
    // Subsequent updates (label toggle changes leftBarPreferred /
    // rightBarPreferred): Allotment doesn't auto-re-apply preferredSize
    // on prop change, so without a nudge the bars stay clamped to the
    // previous mode's min/max. Use `resize()` (not `reset()`) — we
    // ship `onReset={handleBarsReset}` to make sash-dblclick snap to
    // min, and `ref.reset()` delegates to that onReset, which would
    // snap the bars to min on every prop change (e.g. right after the
    // user releases a drag and the persisted width flows back in via
    // preferredSize). Bypassing `reset()` keeps prop-driven sizing
    // independent of dblclick-driven sizing.
    const row = barsRowRef.current;
    if (!row) return;
    const total = row.clientWidth;
    if (total <= 0) return;
    const middleW = Math.max(0, total - leftBarPreferred - rightBarPreferred);
    barsAllotmentRef.current?.resize([leftBarPreferred, middleW, rightBarPreferred]);
  }, [leftBarPreferred, rightBarPreferred]);

  // Allotment fires `onChange` for many things beyond user drags —
  // remount fit-passes, container resizes, pane prop changes — and
  // each event can land a few pixels off the user's stored width.
  // Persisting from `onChange` lets that drift accumulate across
  // toggles and eventually overwrites both rails with the same value.
  // Instead, persist only when an actual sash drag ENDS: bind mouse
  // listeners scoped to the outer bars Allotment, snapshot the live
  // bar widths on mouseup, and write them once.
  const barsRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = barsRowRef.current;
    if (!root) return;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Only count drags on sashes that belong to the outer bars
      // Allotment (direct child of `.rules-main-row`), not the
      // nested per-alignment Allotments inside the center pane.
      const sash = target.closest('.sash');
      if (!sash) return;
      const outerSplitView = root.firstElementChild;
      if (!outerSplitView || !outerSplitView.contains(sash)) return;
      dragging = true;
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      if (!showToolWindowLabels) return;
      const leftBar = root.querySelector<HTMLElement>('.rules-activity-bar--left');
      const rightBar = root.querySelector<HTMLElement>('.rules-activity-bar--right');
      if (!leftBar || !rightBar) return;
      const nextLeft = Math.round(leftBar.getBoundingClientRect().width);
      const nextRight = Math.round(rightBar.getBoundingClientRect().width);
      if (nextLeft === activityBarWidths.left && nextRight === activityBarWidths.right) return;
      onActivityBarResize({ left: nextLeft, right: nextRight });
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
    };
  }, [activityBarWidths.left, activityBarWidths.right, onActivityBarResize, showToolWindowLabels]);

  // Sash double-click on the activity-bar sashes snaps both rails to
  // BAR_LABELED_MIN; the middle column absorbs the slack. We compute
  // sizes from the live DOM so the snap respects the user's middle
  // column width instead of overwriting it.
  //
  // ⚠ Allotment's `sashreset` listener (allotment.tsx:289) is registered
  // in a useIsomorphicLayoutEffect with empty deps, so it captures the
  // `onReset` prop ONCE at mount and never refreshes. A plain useCallback
  // here would be invoked with stale closure values (e.g. an early
  // `showToolWindowLabels === false` if labels were toggled on later).
  // Use a ref shim: the `onReset` prop we hand to Allotment is stable;
  // it just dispatches to the latest implementation stored in the ref.
  const barsResetImplRef = useRef<() => void>(() => {});
  barsResetImplRef.current = () => {
    if (!showToolWindowLabels) return;
    const row = barsRowRef.current;
    if (!row) return;
    const total = row.clientWidth;
    if (total <= 0) return;
    const leftW = BAR_LABELED_MIN;
    const rightW = BAR_LABELED_MIN;
    const middleW = Math.max(0, total - leftW - rightW);
    barsAllotmentRef.current?.resize([leftW, middleW, rightW]);
    if (leftW !== activityBarWidths.left || rightW !== activityBarWidths.right) {
      onActivityBarResize({ left: leftW, right: rightW });
    }
  };
  const handleBarsReset = useCallback(() => barsResetImplRef.current(), []);

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
