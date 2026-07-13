/**
 * Console row virtualization — mounts only the visible slice of the log.
 *
 * The console's row set is unbounded: the entry buffer caps at 1000, but
 * the "Log XMLHttpRequests" rows derive one-per-request from the network
 * plane, so a heavy capture grows the list without limit. Rendering the
 * full list makes every append re-render and re-lay-out the whole log.
 *
 * Unlike the traffic table's fixed 20px rows (`use-row-window`), console
 * items have variable-but-KNOWN heights — a row is one pinned-height line,
 * and an expanded row adds a stack ladder whose height is a closed formula
 * of its frame count (all pinned in panel-console.css). Windowing therefore
 * runs on prefix sums + binary search instead of index division; nothing is
 * ever measured.
 *
 * A zero-height viewport (jsdom, transient mount) renders the FULL list —
 * the console unmounts when its tool window hides, so an unlaid-out live
 * panel is not a state this needs to protect, and the fallback keeps
 * DOM-level tests exercising every row.
 */

import { type RefObject, useCallback, useLayoutEffect, useMemo, useState } from 'react';

/** Pinned `.dt-console-row` height (border-box, incl. its bottom border). */
export const CONSOLE_ROW_PX = 17;
/** Pinned `.dt-console-frame` line height inside an expanded stack. */
export const CONSOLE_FRAME_PX = 13;

/** Height of an expanded `.dt-console-stack` block: 1px top + 3px bottom
 *  padding, 1px bottom border, N frames of 13px with 1px gaps between. */
export function consoleStackPx(frameCount: number): number {
  if (frameCount <= 0) return 0;
  return frameCount * (CONSOLE_FRAME_PX + 1) + 4;
}

/** Extra rows' worth of pixels mounted beyond each viewport edge, so a
 *  fast wheel fling stays painted while the window catches up. */
const OVERSCAN_PX = 600;

interface RowWindow {
  start: number;
  end: number;
}

export interface ConsoleRowWindowApi {
  /** Scroll handler for the log container (chain with stick-to-bottom's). */
  onScroll: () => void;
  /** First mounted row index (inclusive). */
  start: number;
  /** End of the mounted slice (exclusive). */
  end: number;
  /** Spacer height above the slice, in pixels. */
  topPadPx: number;
  /** Spacer height below the slice, in pixels. */
  bottomPadPx: number;
}

/**
 * Pure window computation over a prefix-sum array (`prefix[i]` = pixels
 * above row `i`; `prefix[n]` = total height). Exported for tests.
 */
export function computeConsoleWindow(prefix: readonly number[], scrollTop: number, viewportPx: number): RowWindow {
  const count = prefix.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const topEdge = Math.max(0, scrollTop - OVERSCAN_PX);
  const bottomEdge = scrollTop + viewportPx + OVERSCAN_PX;
  // start: last row whose top is at or above the top edge.
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (prefix[mid] <= topEdge) lo = mid;
    else hi = mid - 1;
  }
  const start = lo;
  // end: first row (exclusive) whose top is at or past the bottom edge.
  lo = start;
  hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid] < bottomEdge) lo = mid + 1;
    else hi = mid;
  }
  return { start, end: lo };
}

export function useConsoleRowWindow(
  ref: RefObject<HTMLElement | null>,
  heights: readonly number[],
  hasList: boolean,
): ConsoleRowWindowApi {
  const prefix = useMemo(() => {
    const out = new Array<number>(heights.length + 1);
    out[0] = 0;
    for (let i = 0; i < heights.length; i++) out[i + 1] = out[i] + heights[i];
    return out;
  }, [heights]);

  const [rowWindow, setRowWindow] = useState<RowWindow>({ start: 0, end: 0 });

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const count = prefix.length - 1;
    const next =
      el.clientHeight === 0
        ? { start: 0, end: count } // unlaid-out (jsdom) → render everything
        : computeConsoleWindow(prefix, el.scrollTop, el.clientHeight);
    setRowWindow((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, [ref, prefix]);

  // Initial + per-change sync, measured before paint so the first populated
  // frame is already windowed; the observer tracks container resizes
  // (dock drags). `recompute` re-binds on every prefix change, so streaming
  // appends re-window in the same commit wave they land in.
  useLayoutEffect(() => {
    if (!hasList) return;
    recompute();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(el);
    return () => observer.disconnect();
  }, [recompute, hasList, ref]);

  return {
    onScroll: recompute,
    start: rowWindow.start,
    end: rowWindow.end,
    topPadPx: prefix[rowWindow.start] ?? 0,
    bottomPadPx: (prefix[prefix.length - 1] ?? 0) - (prefix[rowWindow.end] ?? 0),
  };
}
