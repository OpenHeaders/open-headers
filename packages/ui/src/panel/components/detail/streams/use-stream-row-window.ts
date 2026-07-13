/**
 * Stream grid virtualization — the console recipe applied to the WS
 * Messages and SSE EventStream grids. Stream rows are a uniform pinned
 * height (STREAM_ROW_PX, mirrored by the `.dt-ws-row` / `.dt-sse-row`
 * rules in streams.css), so the windowing degenerates to the console
 * hook over a constant-height array — reused rather than re-derived,
 * keeping one tested window computation (prefix sums, 600px overscan,
 * and the zero-viewport render-all fallback that keeps jsdom tests
 * exercising every row).
 *
 * Unlike the traffic table (whose header lives outside its scroller),
 * these grids keep their sticky header row INSIDE the scroller: it
 * shifts every row down by STREAM_HEADER_PX, a uniform offset the
 * window math deliberately ignores — it rides well inside the 600px
 * overscan, and splitting the header out would cost the Wide layout's
 * shared horizontal scroll. `scrollToPos` accounts for it exactly, so
 * a keyboard-selected row outside the mounted slice lands clear of the
 * sticky band instead of beneath it.
 */

import type { RefObject } from 'react';
import { useCallback, useMemo } from 'react';
import { useConsoleRowWindow } from '../../use-console-row-window';

/** Pinned `.dt-ws-row` / `.dt-sse-row` height (border-box, incl. the
 *  1px bottom border) — see streams.css. */
export const STREAM_ROW_PX = 20;
/** Pinned `.dt-ws-row-header` / `.dt-sse-row-header` band height. */
export const STREAM_HEADER_PX = 22;

/**
 * Scroll position that brings row `pos` fully into view, or `null` when
 * it already is. Row `pos` occupies
 * [STREAM_HEADER_PX + pos·ROW, STREAM_HEADER_PX + (pos+1)·ROW) in
 * content space; the sticky header covers the viewport's top
 * STREAM_HEADER_PX, so "in view" starts below it. Pure — exported for
 * tests.
 */
export function streamScrollTarget(pos: number, scrollTop: number, viewportPx: number): number | null {
  const rowTop = STREAM_HEADER_PX + pos * STREAM_ROW_PX;
  const rowBottom = rowTop + STREAM_ROW_PX;
  if (rowTop - STREAM_HEADER_PX < scrollTop) return pos * STREAM_ROW_PX;
  if (rowBottom > scrollTop + viewportPx) return rowBottom - viewportPx;
  return null;
}

export interface StreamRowWindowApi {
  /** Scroll handler for the grid scroller (chain with stick-to-bottom's). */
  onScroll: () => void;
  /** First mounted row position (inclusive, into the visible list). */
  start: number;
  /** End of the mounted slice (exclusive). */
  end: number;
  /** Spacer height above the slice, in pixels. */
  topPadPx: number;
  /** Spacer height below the slice, in pixels. */
  bottomPadPx: number;
  /** Bring the row at a visible-list position into view, remounting it
   *  into the slice if the scroll moved (keyboard nav across unmounted
   *  rows). No-op on an unlaid-out (jsdom) viewport, where every row is
   *  mounted anyway. */
  scrollToPos: (pos: number) => void;
}

export function useStreamRowWindow(ref: RefObject<HTMLElement | null>, count: number): StreamRowWindowApi {
  const heights = useMemo(() => new Array<number>(count).fill(STREAM_ROW_PX), [count]);
  const { onScroll, start, end, topPadPx, bottomPadPx } = useConsoleRowWindow(ref, heights, count > 0);

  const scrollToPos = useCallback(
    (pos: number) => {
      const el = ref.current;
      if (!el || el.clientHeight === 0) return;
      const target = streamScrollTarget(pos, el.scrollTop, el.clientHeight);
      if (target === null) return;
      el.scrollTop = target;
      // Re-window synchronously so the row mounts in the same commit wave
      // (the async scroll event alone would paint a blank slice first).
      onScroll();
    },
    [ref, onScroll],
  );

  return { onScroll, start, end, topPadPx, bottomPadPx, scrollToPos };
}
