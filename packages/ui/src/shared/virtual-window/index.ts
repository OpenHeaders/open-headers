/**
 * Row-window virtualization — mounts only the visible slice of a list
 * whose row heights are variable but KNOWN (pinned by construction,
 * never measured). The one tested window computation shared by the
 * devtools panel's console/stream grids and the workbench's SSE event
 * list: prefix sums + binary search, a fixed pixel overscan so a fast
 * wheel fling stays painted, and a fallback for a scroller that was
 * NEVER laid out that renders the FULL list — jsdom tests keep
 * exercising every row, and a transiently unlaid-out mount shows
 * content instead of a blank. A scroller that HAD a height and lost it
 * is hidden (a kept-alive tab or tool window behind another): it keeps
 * the window it had, so a list nobody sees never mounts whole.
 *
 * Lifted from the panel's console recipe (`use-console-row-window`,
 * which now wraps this) when the workbench SSE list needed the same
 * machinery — one implementation, every surface.
 */

import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

// The window over rows of ONE height — a list of any length, no heights held (`fixed-rows.ts`).
export {
  computeFixedRowWindow,
  type FixedRowGeometry,
  type FixedRowWindow,
  fixedRowSpacerPx,
  MAX_SPACER_PX,
  scrollTopForRow,
  visibleFixedRows,
} from './fixed-rows';
export { type FixedRowWindowApi, useFixedRowWindow } from './use-fixed-row-window';

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

/**
 * The scroll position that shows row `row` whole, moved the least: the
 * position given where the row already shows, else the one that brings
 * its nearer edge to the viewport's.
 */
export function nearestScrollTopForRow(
  prefix: readonly number[],
  row: number,
  scrollTop: number,
  viewportPx: number,
): number {
  const top = prefix[row] ?? 0;
  const bottom = prefix[row + 1] ?? top;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportPx) return Math.max(0, bottom - viewportPx);
  return scrollTop;
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
  // The scroller has had a height: one without it from here on is hidden, not unlaid-out.
  const laidOut = useRef(false);

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const count = prefix.length - 1;
    if (el.clientHeight > 0) laidOut.current = true;
    setRowWindow((prev) => {
      let next: RowWindow;
      if (el.clientHeight > 0) next = computeRowWindow(prefix, el.scrollTop, el.clientHeight);
      // Hidden: the window it had, held to the rows there are now.
      else if (laidOut.current) next = { start: Math.min(prev.start, count), end: Math.min(prev.end, count) };
      // Never laid out (jsdom) → render everything.
      else next = { start: 0, end: count };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
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
