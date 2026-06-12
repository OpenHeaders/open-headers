import { type RefObject, useCallback, useEffect, useRef } from 'react';

/** Distance from the bottom (px, ~2 rows) within which the view counts as parked at the tail. */
const STICK_THRESHOLD_PX = 40;

/**
 * Pin-to-tail scrolling for a streaming list — the same semantics as the
 * main traffic table (`use-row-window`): the view follows the tail while
 * parked there, releases only when the user scrolls *up* (content growth
 * never moves `scrollTop`, so an append is never mistaken for the user
 * leaving the tail), and re-pins the instant the tail is reached again.
 * Defaults to pinned so a freshly opened tab follows a live stream.
 */
export function useStickToBottom(ref: RefObject<HTMLElement | null>, itemCount: number): { onScroll: () => void } {
  const pinnedRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const prevCountRef = useRef(0);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop;
    if (el.scrollHeight - top - el.clientHeight < STICK_THRESHOLD_PX) pinnedRef.current = true;
    else if (top < lastScrollTopRef.current) pinnedRef.current = false;
    lastScrollTopRef.current = top;
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el || itemCount <= prevCountRef.current) {
      prevCountRef.current = itemCount;
      return;
    }
    prevCountRef.current = itemCount;
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [itemCount, ref]);

  return { onScroll };
}
