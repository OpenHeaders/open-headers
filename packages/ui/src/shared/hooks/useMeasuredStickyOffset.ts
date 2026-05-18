import { useEffect, type RefObject } from 'react';

/**
 * Publishes each element's `offsetHeight` as a CSS custom property on
 * `targetRef`, refreshed whenever any source element resizes.
 *
 * Use this to drive `position: sticky` / `scroll-margin-top` values
 * from the actual rendered height of a header/toolbar/stack instead
 * of hand-measured constants. Once published, downstream CSS can
 * `top: var(--my-toolbar-h)` and `scroll-margin-top: calc(...)` from
 * the same source of truth.
 *
 * When a ref is null the variable is removed; when an element resizes
 * to 0px the variable is set to `0px` (so consumers can always rely on
 * it being defined and well-typed for calc()).
 */
export function useMeasuredCssHeights(
  targetRef: RefObject<HTMLElement | null>,
  entries: ReadonlyArray<{ ref: RefObject<HTMLElement | null>; cssVar: string }>,
): void {
  // Stable key avoids re-subscribing when entries are passed as an
  // inline literal — we look at the CSS variable names only.
  const varKey = entries.map((e) => e.cssVar).join('|');

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observers: ResizeObserver[] = [];
    const publish = (el: HTMLElement | null, cssVar: string): void => {
      if (!el) {
        target.style.removeProperty(cssVar);
        return;
      }
      target.style.setProperty(cssVar, `${el.offsetHeight}px`);
    };

    for (const { ref, cssVar } of entries) {
      const el = ref.current;
      publish(el, cssVar);
      if (!el) continue;
      const obs = new ResizeObserver(() => publish(el, cssVar));
      obs.observe(el);
      observers.push(obs);
    }

    return () => {
      for (const o of observers) o.disconnect();
      for (const { cssVar } of entries) target.style.removeProperty(cssVar);
    };
    // entries is intentionally not in the dep array — we re-subscribe
    // when the set of variable names changes (caller-controlled), not
    // when each render produces a new array literal.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  }, [targetRef, varKey]);
}
