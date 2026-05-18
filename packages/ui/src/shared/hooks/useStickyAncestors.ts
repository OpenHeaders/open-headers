import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Derives the sticky-ancestor chain for a flat-rendered tree:
 * as the user scrolls, returns the keys of every ancestor of the
 * row currently at the top of the viewport. Caller renders those
 * keys however it likes (typically a stack of sticky rows pinned
 * above the tree, VS-Code-style).
 *
 * @param items         flat list of rows in render order
 * @param keyOf         row → unique key
 * @param parentKeyOf   row → parent key (null at the root)
 * @param getRowElement key → element accessor (callers usually back
 *                      this with a `useRef<Map<string, HTMLElement>>`
 *                      that's populated via row `ref` callbacks)
 * @param resolveScrollContainer returns the element whose `scroll`
 *                              events drive the derivation. Resolved
 *                              lazily inside the effect so callers can
 *                              walk up the DOM (`closest('.tab-body')`,
 *                              etc.) without a separate ref.
 * @param chromeHeightPx  total height of non-stack sticky chrome above
 *                        the tree (section summary + filter toolbar, …).
 *                        Read fresh on each tick so dynamic chrome works.
 * Algorithm: `threshold = chrome-height`. The chain is the ancestors
 * of the first row whose `bottom` crosses the threshold. Single-pass,
 * no feedback on the rendered stack height — the previous design fed
 * stack height back into the threshold, which created a convergence
 * loop the original code "fixed" by manually overriding the chain on
 * sticky-row clicks (and then needing a focus-effect hack to keep that
 * override from being clobbered).
 *
 * The "right" interpretation of the chain is "ancestors of the
 * topmost row past the chrome", even if that row is itself hidden
 * behind the resulting stack. That is exactly what VS Code does, and
 * keyboard nav / click-jump are clean because the chain depends only
 * on scroll position, not on the previous chain.
 *
 * @returns `chain` of ancestor keys (root → immediate parent).
 *          Empty when no ancestor needs to stick.
 */
export function useStickyAncestors<T>({
  items,
  keyOf,
  parentKeyOf,
  getRowElement,
  resolveScrollContainer,
  chromeHeightPx,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  parentKeyOf: (item: T) => string | null;
  getRowElement: (key: string) => Element | null | undefined;
  resolveScrollContainer: () => HTMLElement | null;
  chromeHeightPx: () => number;
}): readonly string[] {
  const [chain, setChain] = useState<readonly string[]>([]);
  const itemsByKey = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of items) m.set(keyOf(it), it);
    return m;
  }, [items, keyOf]);

  // Keep height provider + element accessor stable across renders so
  // the effect doesn't resubscribe every render. Callers usually pass
  // inline arrow functions; we capture them in refs.
  const chromeFnRef = useRef(chromeHeightPx);
  const getElFnRef = useRef(getRowElement);
  chromeFnRef.current = chromeHeightPx;
  getElFnRef.current = getRowElement;

  const resolveScrollRef = useRef(resolveScrollContainer);
  resolveScrollRef.current = resolveScrollContainer;

  useEffect(() => {
    const scroll = resolveScrollRef.current();
    if (!scroll || items.length === 0) {
      setChain((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const update = (): void => {
      const containerTop = scroll.getBoundingClientRect().top;
      const threshold = containerTop + chromeFnRef.current();
      let topmost: T | null = null;
      for (const item of items) {
        const el = getElFnRef.current(keyOf(item));
        if (!el) continue;
        if (el.getBoundingClientRect().bottom > threshold) {
          topmost = item;
          break;
        }
      }
      const next: string[] = [];
      if (topmost) {
        let cur: string | null = parentKeyOf(topmost);
        while (cur) {
          next.unshift(cur);
          const parent = itemsByKey.get(cur);
          cur = parent ? parentKeyOf(parent) : null;
        }
      }
      setChain((prev) => {
        if (prev.length === next.length && prev.every((k, i) => k === next[i])) return prev;
        return next;
      });
    };

    scroll.addEventListener('scroll', update, { passive: true });
    update();
    return () => scroll.removeEventListener('scroll', update);
  }, [items, itemsByKey, keyOf, parentKeyOf]);

  return chain;
}

/**
 * Pure helper exported for unit tests. Mirrors the single-pass
 * derivation in `useStickyAncestors` but takes plain numbers instead
 * of DOM rects, so tests can simulate scroll positions deterministically.
 *
 * Coordinate frame: `rowTops` and `chromeHeight` must be in the same
 * frame (usually the scroll container's top-left). A row sitting
 * flush against the chrome bottom at scrollTop=0 has `top = chromeHeight`.
 *
 * @returns the ancestor-key chain (root → immediate parent).
 */
export function deriveStickyChain<T>({
  items,
  keyOf,
  parentKeyOf,
  rowTops,
  rowHeight,
  chromeHeight,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  parentKeyOf: (item: T) => string | null;
  rowTops: ReadonlyMap<string, number>;
  rowHeight: number;
  chromeHeight: number;
}): readonly string[] {
  const itemsByKey = new Map<string, T>();
  for (const it of items) itemsByKey.set(keyOf(it), it);

  let topmost: T | null = null;
  for (const item of items) {
    const top = rowTops.get(keyOf(item));
    if (top === undefined) continue;
    if (top + rowHeight > chromeHeight) {
      topmost = item;
      break;
    }
  }
  const chain: string[] = [];
  if (topmost) {
    let cur: string | null = parentKeyOf(topmost);
    while (cur) {
      chain.unshift(cur);
      const parent = itemsByKey.get(cur);
      cur = parent ? parentKeyOf(parent) : null;
    }
  }
  return chain;
}
