/**
 * Scroll-spy for vertically-stacked sections in a scrollable container.
 *
 * Sections register via `registerSection(id)` ref callbacks, so adding
 * or removing sections (search filters, deep-link mounts) is tracked
 * automatically — no observer to re-attach.
 *
 * Active section = the last one whose top has crossed `topOffset` below
 * the container's top edge. This is a position check, not a visibility
 * ratio: a tall section filling most of the viewport correctly beats a
 * short one peeking in below it, which a ratio-based IntersectionObserver
 * gets wrong.
 *
 * Programmatic scroll uses `container.scrollTo` (not `scrollIntoView`,
 * which walks ancestor scrollers — a real problem inside a Modal) and
 * suppresses spy updates until `scrollend` fires, with a timeout fallback.
 */

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

interface UseScrollSpyOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** Pixels below the container's top edge that count as the "active line". */
  topOffset?: number;
  initialId?: string | null;
}

export interface UseScrollSpyResult {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  registerSection: (id: string) => (el: HTMLElement | null) => void;
  scrollToSection: (id: string, behavior?: ScrollBehavior) => void;
  scrollToElement: (el: HTMLElement, behavior?: ScrollBehavior, block?: 'start' | 'center') => void;
}

export function useScrollSpy({
  containerRef,
  topOffset = 0,
  initialId = null,
}: UseScrollSpyOptions): UseScrollSpyResult {
  const sectionsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const suppressedRef = useRef(false);
  const rafPendingRef = useRef(false);

  const recompute = useCallback(() => {
    if (suppressedRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    if (sectionsRef.current.size === 0) return;

    const line = container.getBoundingClientRect().top + topOffset;
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;

    let best: { id: string; top: number } | null = null;
    let firstId: string | null = null;
    let lastId: string | null = null;
    for (const [id, el] of sectionsRef.current) {
      if (firstId === null) firstId = id;
      lastId = id;
      const top = el.getBoundingClientRect().top;
      if (top <= line + 1 && (!best || top > best.top)) {
        best = { id, top };
      }
    }

    // Bottom-edge case: a final section shorter than topOffset never
    // crosses the line — pin it as active when the container is scrolled
    // to the bottom.
    const next = atBottom && lastId ? lastId : (best?.id ?? firstId);
    setActiveId((prev) => (prev === next ? prev : next));
  }, [containerRef, topOffset]);

  const schedule = useCallback(() => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      recompute();
    });
  }, [recompute]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => schedule();
    container.addEventListener('scroll', onScroll, { passive: true });
    schedule();
    return () => container.removeEventListener('scroll', onScroll);
  }, [containerRef, schedule]);

  const suppressUntilSettled = useCallback(() => {
    suppressedRef.current = true;
    const container = containerRef.current;
    let cleared = false;
    const clear = () => {
      if (cleared) return;
      cleared = true;
      suppressedRef.current = false;
      container?.removeEventListener('scrollend', clear);
      window.clearTimeout(timer);
      schedule();
    };
    container?.addEventListener('scrollend', clear, { once: true });
    const timer = window.setTimeout(clear, 700);
  }, [containerRef, schedule]);

  // Per-id ref callbacks are cached so the same function identity is
  // returned on every render — otherwise React tears down and re-attaches
  // the ref each commit, churning the section map.
  const refCallbacksRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());
  const registerSection = useCallback(
    (id: string) => {
      const cache = refCallbacksRef.current;
      const cached = cache.get(id);
      if (cached) return cached;
      const cb = (el: HTMLElement | null) => {
        const map = sectionsRef.current;
        if (el) map.set(id, el);
        else {
          map.delete(id);
          cache.delete(id);
        }
        schedule();
      };
      cache.set(id, cb);
      return cb;
    },
    [schedule],
  );

  const scrollToElement = useCallback(
    (el: HTMLElement, behavior: ScrollBehavior = 'smooth', block: 'start' | 'center' = 'start') => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetWithinContainer = elRect.top - containerRect.top + container.scrollTop;
      const target =
        block === 'center'
          ? offsetWithinContainer - container.clientHeight / 2 + elRect.height / 2
          : offsetWithinContainer - topOffset;
      suppressUntilSettled();
      container.scrollTo({ top: Math.max(0, target), behavior });
    },
    [containerRef, suppressUntilSettled, topOffset],
  );

  const scrollToSection = useCallback(
    (id: string, behavior: ScrollBehavior = 'smooth') => {
      const el = sectionsRef.current.get(id);
      if (!el) return;
      setActiveId(id);
      scrollToElement(el, behavior, 'start');
    },
    [scrollToElement],
  );

  return { activeId, setActiveId, registerSection, scrollToSection, scrollToElement };
}
