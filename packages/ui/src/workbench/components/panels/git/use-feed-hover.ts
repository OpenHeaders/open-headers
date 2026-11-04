/**
 * use-feed-hover — ONE delegated hover title for a whole feed. Tokens
 * that have more to say than they show carry `data-full`; the feed's
 * container reports which one the pointer rests on (after the tooltip
 * delay) together with its box inside the scroll content, and the view
 * aligns a single Tooltip to an anchor placed over that box. Hundreds
 * of rows cost no components — only the hovered token has a tooltip.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface FeedHoverAnchor {
  text: string;
  /** The token's box in the scroll container's content coordinates. */
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface FeedHover {
  anchor: FeedHoverAnchor | null;
  /** The scroll container's handlers — spread onto it. */
  handlers: {
    onMouseOver: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseOut: (event: React.MouseEvent<HTMLElement>) => void;
    onScroll: () => void;
  };
}

const HOVER_DELAY_MS = 120;

export function useFeedHover(): FeedHover {
  const [anchor, setAnchor] = useState<FeedHoverAnchor | null>(null);
  const target = useRef<Element | null>(null);
  const timer = useRef<number | null>(null);

  const cancel = useCallback((): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const leave = useCallback((): void => {
    cancel();
    target.current = null;
    setAnchor(null);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  const onMouseOver = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      const container = event.currentTarget;
      const next = event.target instanceof Element ? event.target.closest('[data-full]') : null;
      if (next === target.current) return;
      cancel();
      target.current = next;
      setAnchor(null);
      if (next === null) return;
      const text = next.getAttribute('data-full');
      if (text === null) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const box = next.getBoundingClientRect();
        const host = container.getBoundingClientRect();
        setAnchor({
          text,
          top: box.top - host.top + container.scrollTop,
          left: box.left - host.left + container.scrollLeft,
          width: box.width,
          height: box.height,
        });
      }, HOVER_DELAY_MS);
    },
    [cancel],
  );

  const onMouseOut = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      const current = target.current;
      if (current === null) return;
      const to = event.relatedTarget;
      if (to instanceof Node && current.contains(to)) return;
      leave();
    },
    [leave],
  );

  return { anchor, handlers: { onMouseOver, onMouseOut, onScroll: leave } };
}
