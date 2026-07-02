/**
 * OverlayScrollThumb — Gecko-only 3 px scroll indicator for the tab
 * strip. Chromium gets the same treatment natively via the
 * `::-webkit-scrollbar` pseudos in rules.less; Firefox ignores those
 * and its thinnest native scrollbar (`scrollbar-width: thin`, ~8 px)
 * eats into the 32 px bar, so there the native scrollbar is hidden
 * (`scrollbar-width: none`) and this element mirrors the webkit thumb:
 * 3 px tall, flush with the bar's divider, transparent at rest,
 * fading in while the bar is hovered (see `.rules-tabs-overlay-thumb`).
 *
 * Geometry is written straight to the DOM from scroll events — no
 * React state, so wheel-speed scrolling never re-renders the bar.
 */

import type React from 'react';
import { useLayoutEffect, useRef } from 'react';

/** True only in Gecko — the same capability probe the stylesheet uses
 *  (`@supports (-moz-appearance: none)`), so the JS and CSS gates can
 *  never disagree about which engine owns the thumb. */
const isGecko = typeof CSS !== 'undefined' && CSS.supports('-moz-appearance', 'none');

interface OverlayScrollThumbProps {
  /** The `.rules-tabs-scroll` element this thumb mirrors. Must share
   *  an `offsetParent` with the thumb (both live in `.rules-tabs-bar`,
   *  which is `position: relative`). */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const OverlayScrollThumb: React.FC<OverlayScrollThumbProps> = ({ scrollRef }) => {
  const thumbRef = useRef<HTMLDivElement>(null);

  // No dep array on purpose: tab opens/closes change `scrollWidth`
  // without firing the ResizeObserver (the strip's box is clamped by
  // the bar), so the geometry is re-synced after every render — same
  // pattern as the bar's `hasOverflow` measurement.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    const sync = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollWidth <= clientWidth + 1) {
        thumb.style.width = '0px';
        return;
      }
      const ratio = clientWidth / scrollWidth;
      thumb.style.left = `${el.offsetLeft + scrollLeft * ratio}px`;
      thumb.style.width = `${clientWidth * ratio}px`;
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      resizeObserver.disconnect();
    };
  });

  if (!isGecko) return null;
  return <div className="rules-tabs-overlay-thumb" ref={thumbRef} aria-hidden="true" />;
};

export default OverlayScrollThumb;
