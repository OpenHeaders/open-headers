import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { getNotifyScheduler } from '../../data/stores/notify-scheduler';

/**
 * Row virtualization geometry. Rows are a fixed height (mirrors the
 * `.dt-row` rule), so only the visible slice plus an overscan is
 * mounted — the rest is represented by two zero-content spacers that
 * preserve the scroll height. This keeps the DOM at ~a hundred rows
 * regardless of how many thousand requests have been recorded. The
 * column header lives OUTSIDE this scroller (`.dt-table-headwrap`), so
 * scrollTop 0 is the first row — no header offset in the math.
 *
 * The overscan buys headroom against compositor-thread scrolling: the
 * scroll glides on the compositor while the window recompute + React
 * commit run on the main thread, so a fast fling outruns the mounted
 * slice and exposes the blank spacer. 30 rows (600px) each side keeps
 * typical wheel/momentum velocities painted; the memoized rows make the
 * wider slice cheap (only edge rows mount per shift).
 */
const ROW_HEIGHT_PX = 20;
const ROW_OVERSCAN = 30;
/** Distance from the bottom (px, ~2 rows) within which the view counts as parked at the tail. */
const STICK_THRESHOLD_PX = 40;
/**
 * How long a USER scroll event holds the store notify flushes. Manual
 * scrolling rides the compositor; the main thread only catches up via
 * scroll events, and mid-capture those re-window renders queue behind the
 * ingestion flush bursts — the visible symptom is rows arriving blank and
 * painting late. Holding the flushes for a trailing beat per scroll event
 * gives the re-window commits the whole main thread; the burst fans out
 * right after the scroll settles. Programmatic scrolls (tail-follow,
 * scrollToRow) never hold — they re-window synchronously in the same task,
 * and throttling ingestion on our own tail-follow events would cap the
 * live capture's update cadence.
 */
const USER_SCROLL_HOLD_MS = 150;

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
  // Whether the view is parked at the tail. Released only when the user
  // scrolls *up* — never from an absolute distance, which would race a
  // streaming burst (appended rows grow `scrollHeight` without moving
  // `scrollTop`, and the async scroll event from our own catch-up scroll
  // sees the height already grown). Defaults to true so a fresh capture
  // follows the tail until the user scrolls away.
  const pinnedToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  // Set right before each of our own `scrollTop` writes; the resulting async
  // scroll event consumes it, so only genuine user scrolls hold the notify
  // flushes (see USER_SCROLL_HOLD_MS).
  const programmaticScrollRef = useRef(false);
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
    const first = Math.max(0, Math.floor(top / ROW_HEIGHT_PX) - ROW_OVERSCAN);
    const last = Math.min(count, Math.ceil((top + viewport) / ROW_HEIGHT_PX) + ROW_OVERSCAN);
    setRowWindow((prev) => (prev.start === first && prev.end === last ? prev : { start: first, end: last }));
  }, []);

  const onScroll = useCallback(() => {
    const el = tableRef.current;
    if (!el) return;
    if (programmaticScrollRef.current) programmaticScrollRef.current = false;
    else getNotifyScheduler().holdFor?.(USER_SCROLL_HOLD_MS);
    const top = el.scrollTop;
    // Re-pin the instant the tail is reached; release only on an upward
    // move. Content growth never moves `scrollTop`, and our catch-up
    // scroll only ever increases it, so neither is mistaken for the user
    // leaving the tail.
    if (el.scrollHeight - top - el.clientHeight < STICK_THRESHOLD_PX) pinnedToBottomRef.current = true;
    else if (top < lastScrollTopRef.current) pinnedToBottomRef.current = false;
    lastScrollTopRef.current = top;
    recomputeWindow(el, rowsRef.current.length);
  }, [recomputeWindow]);

  const scrollToRow = useCallback(
    (requestId: string) => {
      const el = tableRef.current;
      const idx = rowsRef.current.findIndex((r) => r.lifecycle.requestId === requestId);
      if (!el || idx < 0) return;
      const rowTop = idx * ROW_HEIGHT_PX;
      const viewport = el.clientHeight;
      const aboveFold = rowTop < el.scrollTop;
      const belowFold = rowTop + ROW_HEIGHT_PX > el.scrollTop + viewport;
      // The target may be outside the mounted slice — scroll by computed
      // offset (centered) rather than `scrollIntoView`, which only works
      // on already-rendered rows.
      if (aboveFold || belowFold) {
        // Flag only when the write actually moved — an unmoved scrollTop
        // fires no event, and a stale flag would swallow the next user
        // scroll's flush hold. The event is async, so post-write is safe.
        const before = el.scrollTop;
        el.scrollTop = Math.max(0, rowTop - viewport / 2);
        if (el.scrollTop !== before) programmaticScrollRef.current = true;
        recomputeWindow(el, rowsRef.current.length);
      }
    },
    [recomputeWindow],
  );

  // Stick to the bottom when new rows arrive and the view was parked there.
  // Reads the pre-arrival intent (`pinnedToBottomRef`, last set on scroll)
  // rather than re-measuring now — a batched burst has already grown
  // `scrollHeight`, so a post-arrival distance check would read far from the
  // bottom and wrongly disengage on any batch larger than the threshold.
  useEffect(() => {
    const el = tableRef.current;
    if (!el || rows.length <= prevCountRef.current) {
      prevCountRef.current = rows.length;
      return;
    }
    prevCountRef.current = rows.length;
    if (pinnedToBottomRef.current) {
      // Same moved-only flagging as scrollToRow — see the comment there.
      const before = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      if (el.scrollTop !== before) programmaticScrollRef.current = true;
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
