/**
 * Row-window virtualization — mounts only the visible slice of a list
 * whose row heights are variable but KNOWN (pinned by construction,
 * never measured). The one tested window computation shared by the
 * devtools panel's console/stream grids and the workbench's SSE event
 * list: prefix sums + binary search, a fixed pixel overscan so a fast
 * wheel fling stays painted, and a zero-height-viewport fallback that
 * renders the FULL list — jsdom tests keep exercising every row, and a
 * transiently unlaid-out mount shows content instead of a blank.
 *
 * Lifted from the panel's console recipe (`use-console-row-window`,
 * which now wraps this) when the workbench SSE list needed the same
 * machinery — one implementation, every surface.
 */

import { type RefObject, useCallback, useLayoutEffect, useMemo, useState } from 'react';

/** Extra rows' worth of pixels mounted beyond each viewport edge, so a
 *  fast wheel fling stays painted while the window catches up. */
const OVERSCAN_PX = 600;

interface RowWindow {
  start: number;
  end: number;
}

export interface VirtualRowWindowApi {
  /** Scroll handler for the list container (chain with the caller's). */
  onScroll: () => void;
  /** First mounted row index (inclusive). */
  start: number;
  /** End of the mounted slice (exclusive). */
  end: number;
  /** Spacer height above the slice, in pixels. */
  topPadPx: number;
  /** Spacer height below the slice, in pixels. */
  bottomPadPx: number;
  /** Prefix sums — `prefix[i]` = pixels above row `i`, `prefix[n]` =
   *  total height. Exposed for callers that anchor scroll positions to
   *  row identities across list mutations. */
  prefix: readonly number[];
}

/**
 * Pure window computation over a prefix-sum array (`prefix[i]` = pixels
 * above row `i`; `prefix[n]` = total height). Exported for tests.
 */
export function computeRowWindow(prefix: readonly number[], scrollTop: number, viewportPx: number): RowWindow {
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

export function useVirtualRowWindow(
  ref: RefObject<HTMLElement | null>,
  heights: readonly number[],
  hasList: boolean,
): VirtualRowWindowApi {
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
        : computeRowWindow(prefix, el.scrollTop, el.clientHeight);
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
    prefix,
  };
}
