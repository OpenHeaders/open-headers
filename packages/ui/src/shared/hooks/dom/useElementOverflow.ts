/**
 * Tracks whether an element's content overflows its box horizontally
 * (`scrollWidth > clientWidth`) — true when a single-line value is
 * clipped by `text-overflow: ellipsis`. Re-measures on element resize
 * (via `ResizeObserver`) and whenever `dep` changes (e.g. the rendered
 * value), so callers can reveal an expand affordance only when there's
 * actually more to show.
 *
 * Measure runs in a layout effect (pre-paint), so the first measured
 * truth lands before the browser paints — no caret flash on mount.
 *
 * `active` gates measurement: pass `false` while the element is shown in
 * an alternate layout (e.g. expanded/wrapped) where the collapsed-overflow
 * question is meaningless. The last measured value is retained, so the
 * affordance doesn't flicker when toggling back.
 */

import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

export function useElementOverflow<T extends HTMLElement>(options: { dep?: unknown; active?: boolean } = {}): {
  ref: RefObject<T | null>;
  overflowing: boolean;
} {
  const { dep, active = true } = options;
  const ref = useRef<T | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const measure = (): void => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dep, active]);
  return { ref, overflowing };
}
