/**
 * useFixedRowWindow — the window over rows of one height
 * (`fixed-rows.ts`) read off a scroller: the rows to mount and where to
 * draw them, and the rows the viewport itself shows, re-made on scroll
 * and on the scroller's resize, and the scroll position that brings a
 * row into view from where it stands.
 *
 * The height the engine gave the spacer is read back from the scroller
 * every time, so an engine that clamps lower than the one asked for is
 * followed, not assumed. A scroller with no height yet (an unlaid-out
 * mount, jsdom) mounts the list's first rows, and has them all in view.
 */

import { type RefObject, useCallback, useLayoutEffect, useState } from 'react';
import {
  computeFixedRowWindow,
  type FixedRowGeometry,
  type FixedRowWindow,
  fixedRowSpacerPx,
  scrollTopForRow,
  visibleFixedRows,
} from './fixed-rows';

/** Rows mounted while the scroller has no height yet. */
const UNLAID_ROWS = 200;

/** The rows the viewport itself shows: `[first, last]`, both inclusive. */
interface FixedRowsInView {
  first: number;
  last: number;
}

interface Measured {
  rowWindow: FixedRowWindow;
  inView: FixedRowsInView;
}

const NOTHING_MEASURED: Measured = { rowWindow: { start: 0, end: 0, offsetPx: 0 }, inView: { first: 0, last: -1 } };

const sameMeasure = (a: Measured, b: Measured): boolean =>
  a.rowWindow.start === b.rowWindow.start &&
  a.rowWindow.end === b.rowWindow.end &&
  a.rowWindow.offsetPx === b.rowWindow.offsetPx &&
  a.inView.first === b.inView.first &&
  a.inView.last === b.inView.last;

export interface FixedRowWindowApi extends FixedRowWindow {
  /** The rows the viewport shows — no overscan. */
  inView: FixedRowsInView;
  /** Scroll handler for the list container (chain with the caller's). */
  onScroll: () => void;
  /** The spacer's height to give the scroller's content. */
  spacerPx: number;
  /** The scroll position that brings a row into view from where the scroller stands; null before it is laid out. */
  scrollTopFor: (row: number, align: 'center' | 'nearest') => number | null;
}

export function useFixedRowWindow(ref: RefObject<HTMLElement | null>, count: number, rowPx: number): FixedRowWindowApi {
  const [measured, setMeasured] = useState<Measured>(NOTHING_MEASURED);
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
    let next: Measured;
    if (el.clientHeight === 0) {
      const end = Math.min(count, UNLAID_ROWS);
      next = { rowWindow: { start: 0, end, offsetPx: 0 }, inView: { first: 0, last: end - 1 } };
    } else {
      const geometry = geometryOf(el);
      next = {
        rowWindow: computeFixedRowWindow(geometry, el.scrollTop),
        inView: visibleFixedRows(geometry, el.scrollTop),
      };
    }
    setMeasured((prev) => (sameMeasure(prev, next) ? prev : next));
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

  return { ...measured.rowWindow, inView: measured.inView, onScroll: recompute, spacerPx, scrollTopFor };
}
