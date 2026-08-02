/**
 * useActivityBarSizing — the outer bars Allotment's per-rail sizing:
 * derives each rail's min/max/preferred width from labeled-vs-compact
 * mode, re-applies preferredSize imperatively on a label toggle (Allotment
 * won't on a prop change), persists a user drag only on sash-release, and
 * routes sash double-click to snap both rails to BAR_LABELED_MIN via a
 * stable ref shim (Allotment captures onReset once at mount). Extracted
 * from ShellLayout.
 */

import type { AllotmentHandle } from 'allotment';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BAR_COMPACT_WIDTH, BAR_LABELED_MAX, BAR_LABELED_MIN } from './constants';

interface ActivityBarSizingInput {
  showToolWindowLabels: boolean;
  activityBarWidths: { left: number; right: number };
  onActivityBarResize: (sizes: { left: number; right: number }) => void;
  /** The bars row mounts only after the shell has been measured, so
      effects that bind against it must re-run when this flips true —
      their first run happens against an empty shell. */
  shellMeasured: boolean;
}

export function useActivityBarSizing({
  showToolWindowLabels,
  activityBarWidths,
  onActivityBarResize,
  shellMeasured,
}: ActivityBarSizingInput) {
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
    // The bars row isn't in the DOM until the shell is measured — a
    // run before that must not consume the first-mount guard below,
    // or the first real label toggle would be swallowed by it.
    if (!shellMeasured) return;
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
  }, [leftBarPreferred, rightBarPreferred, shellMeasured]);

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
    // The row this ref binds to only mounts once the shell has been
    // measured — the pre-measurement run sees a null ref and must not
    // be the last, so gate on `shellMeasured` and re-run on its flip.
    if (!shellMeasured) return;
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
      if (!outerSplitView?.contains(sash)) return;
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
  }, [activityBarWidths.left, activityBarWidths.right, onActivityBarResize, showToolWindowLabels, shellMeasured]);

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

  return {
    barMin,
    barMax,
    leftBarPreferred,
    rightBarPreferred,
    barsAllotmentRef,
    barsRowRef,
    handleBarsReset,
  };
}
