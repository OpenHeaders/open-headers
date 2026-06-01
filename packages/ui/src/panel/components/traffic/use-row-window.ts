import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';

/**
 * Row virtualization geometry. Rows are a fixed height (mirrors the
 * `.dt-row` rule), so only the visible slice plus a small overscan is
 * mounted — the rest is represented by two zero-content spacers that
 * preserve the scroll height. This keeps the DOM at a few dozen rows
 * regardless of how many thousand requests have been recorded.
 */
const ROW_HEIGHT_PX = 20;
const TABLE_HEADER_HEIGHT_PX = 22;
const ROW_OVERSCAN = 12;

interface RowWindow {
  start: number;
  end: number;
}

export interface RowWindowApi {
  /** Attach to the scroll container (the `.dt-table` element). */
  tableRef: RefObject<HTMLDivElement | null>;
  /** Scroll handler for the container. */
  onScroll: () => void;
  /** Bring a row into view by request id, even if it is not mounted. */
  scrollToRow: (requestId: string) => void;
  /** The mounted slice of `rows`. */
  visibleRows: readonly InspectorRowWithFires[];
  /** Spacer height above the slice, in pixels. */
  topPadPx: number;
  /** Spacer height below the slice, in pixels. */
  bottomPadPx: number;
}

/**
 * Fixed-height row virtualization for the traffic table. Owns the scroll
 * element ref, the mounted window, and the effects that keep it in sync
 * with the viewport (panel resize, divider drag) and the streaming row
 * count.
 *
 * `hasTable` reflects whether the scroll element is currently mounted —
 * the panel opens on an empty hero, so the observer must (re)attach once
 * rows first arrive.
 */
export function useRowWindow(rows: readonly InspectorRowWithFires[], hasTable: boolean): RowWindowApi {
  const tableRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<readonly InspectorRowWithFires[]>(rows);
  rowsRef.current = rows;
  const prevCountRef = useRef(0);
  const [rowWindow, setRowWindow] = useState<RowWindow>({ start: 0, end: 0 });

  const recomputeWindow = useCallback((el: HTMLDivElement, count: number) => {
    const viewport = el.clientHeight;
    // A hidden panel (DevTools tab switched away) reports a zero-height,
    // zero-scroll box. Recomputing from that collapses the window to the
    // top of the list; on re-show the browser restores the real scroll
    // position, leaving the mounted rows scrolled out of view (blank
    // table). Skip while unlaid-out — the window re-syncs on the next
    // measurement, and the restored scroll already matches it.
    if (viewport === 0) return;
    const top = el.scrollTop;
    const first = Math.max(0, Math.floor((top - TABLE_HEADER_HEIGHT_PX) / ROW_HEIGHT_PX) - ROW_OVERSCAN);
    const last = Math.min(count, Math.ceil((top - TABLE_HEADER_HEIGHT_PX + viewport) / ROW_HEIGHT_PX) + ROW_OVERSCAN);
    setRowWindow((prev) => (prev.start === first && prev.end === last ? prev : { start: first, end: last }));
  }, []);

  const onScroll = useCallback(() => {
    const el = tableRef.current;
    if (el) recomputeWindow(el, rowsRef.current.length);
  }, [recomputeWindow]);

  const scrollToRow = useCallback(
    (requestId: string) => {
      const el = tableRef.current;
      const idx = rowsRef.current.findIndex((r) => r.lifecycle.requestId === requestId);
      if (!el || idx < 0) return;
      const rowTop = TABLE_HEADER_HEIGHT_PX + idx * ROW_HEIGHT_PX;
      const viewport = el.clientHeight;
      const aboveFold = rowTop < el.scrollTop + TABLE_HEADER_HEIGHT_PX;
      const belowFold = rowTop + ROW_HEIGHT_PX > el.scrollTop + viewport;
      // The target may be outside the mounted slice — scroll by computed
      // offset (centered) rather than `scrollIntoView`, which only works
      // on already-rendered rows.
      if (aboveFold || belowFold) {
        el.scrollTop = Math.max(0, rowTop - viewport / 2);
        recomputeWindow(el, rowsRef.current.length);
      }
    },
    [recomputeWindow],
  );

  // Stick to the bottom when new rows arrive and the user is already there.
  useEffect(() => {
    const el = tableRef.current;
    if (!el || rows.length <= prevCountRef.current) {
      prevCountRef.current = rows.length;
      return;
    }
    prevCountRef.current = rows.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [rows.length]);

  // Keep the window in sync with the viewport size (panel resize, divider
  // drag). Re-runs when the table mounts so the observer tracks the live
  // element. Measured before paint so the first populated frame is right.
  useLayoutEffect(() => {
    const el = tableRef.current;
    if (!el || !hasTable) return;
    recomputeWindow(el, rowsRef.current.length);
    const observer = new ResizeObserver(() => recomputeWindow(el, rowsRef.current.length));
    observer.observe(el);
    return () => observer.disconnect();
  }, [recomputeWindow, hasTable]);

  // Re-window as the row count changes (clamps the slice when a filter
  // shrinks the list, extends it as requests stream in).
  useEffect(() => {
    const el = tableRef.current;
    if (el) recomputeWindow(el, rows.length);
  }, [rows.length, recomputeWindow]);

  return {
    tableRef,
    onScroll,
    scrollToRow,
    visibleRows: rows.slice(rowWindow.start, rowWindow.end),
    topPadPx: rowWindow.start * ROW_HEIGHT_PX,
    bottomPadPx: Math.max(0, (rows.length - rowWindow.end) * ROW_HEIGHT_PX),
  };
}
