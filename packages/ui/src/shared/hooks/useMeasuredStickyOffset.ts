import { useEffect, type RefObject } from 'react';

/**
 * Publishes each element's rendered height as a CSS custom property
 * on `targetRef`, refreshed whenever any source element resizes.
 *
 * Use this to drive `position: sticky` / `scroll-margin-top` values
 * from the actual rendered height of a header/toolbar/stack instead
 * of hand-measured constants. Once published, downstream CSS can
 * `top: var(--my-toolbar-h)` and `scroll-margin-top: calc(...)` from
 * the same source of truth.
 *
 * **Subpixel-precise.** We use `getBoundingClientRect().height` rather
 * than `offsetHeight` so the published value carries the fractional
 * part. `offsetHeight` rounds to an integer, which leaves a 0.5-1px
 * transparent hairline between stacked sticky rows whenever the real
 * content height isn't a whole pixel (common with non-integer
 * font-size / line-height / border combinations). Subpixel
 * measurement removes the rounding gap at the source — surfaces that
 * stack sticky elements no longer need the `top: calc(... - 1px)`
 * overlap trick to absorb the error.
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
      // Subpixel-precise. See the doc comment above.
      const h = el.getBoundingClientRect().height;
      target.style.setProperty(cssVar, `${h}px`);
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
