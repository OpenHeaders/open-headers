/**
 * useFixedRowWindow — the window over rows of one height
 * (`fixed-rows.ts`) read off a scroller: the rows to mount and where to
 * draw them, re-made on scroll and on the scroller's resize, and the
 * scroll position that brings a row into view from where it stands.
 *
 * The height the engine gave the spacer is read back from the scroller
 * every time, so an engine that clamps lower than the one asked for is
 * followed, not assumed. A scroller with no height yet (an unlaid-out
 * mount, jsdom) mounts the list's first rows.
 */

import { type RefObject, useCallback, useLayoutEffect, useState } from 'react';
import {
  computeFixedRowWindow,
  type FixedRowGeometry,
  type FixedRowWindow,
  fixedRowSpacerPx,
  scrollTopForRow,
} from './fixed-rows';

/** Rows mounted while the scroller has no height yet. */
const UNLAID_ROWS = 200;

export interface FixedRowWindowApi extends FixedRowWindow {
  /** Scroll handler for the list container (chain with the caller's). */
  onScroll: () => void;
  /** The spacer's height to give the scroller's content. */
  spacerPx: number;
  /** The scroll position that brings a row into view from where the scroller stands; null before it is laid out. */
  scrollTopFor: (row: number, align: 'center' | 'nearest') => number | null;
}

export function useFixedRowWindow(ref: RefObject<HTMLElement | null>, count: number, rowPx: number): FixedRowWindowApi {
  const [rowWindow, setRowWindow] = useState<FixedRowWindow>({ start: 0, end: 0, offsetPx: 0 });
  const spacerPx = fixedRowSpacerPx(count, rowPx);

  const geometryOf = useCallback(
    (el: HTMLElement): FixedRowGeometry => ({
      count,
      rowPx,
      viewportPx: el.clientHeight,
      // What the engine gave the spacer — less than asked where its own clamp is lower.
      heightPx: Math.min(el.scrollHeight, count * rowPx),
    }),
    [count, rowPx],
  );

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next =
      el.clientHeight === 0
        ? { start: 0, end: Math.min(count, UNLAID_ROWS), offsetPx: 0 }
        : computeFixedRowWindow(geometryOf(el), el.scrollTop);
    setRowWindow((prev) =>
      prev.start === next.start && prev.end === next.end && prev.offsetPx === next.offsetPx ? prev : next,
    );
  }, [ref, count, geometryOf]);

  // Measured before paint, so the first populated frame is already windowed; the observer tracks the pane's resizes.
  useLayoutEffect(() => {
    recompute();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(el);
    return () => observer.disconnect();
  }, [recompute, ref]);

  const scrollTopFor = useCallback(
    (row: number, align: 'center' | 'nearest'): number | null => {
      const el = ref.current;
      if (!el || el.clientHeight === 0) return null;
      return scrollTopForRow(geometryOf(el), row, align, el.scrollTop);
    },
    [ref, geometryOf],
  );

  return { ...rowWindow, onScroll: recompute, spacerPx, scrollTopFor };
}
