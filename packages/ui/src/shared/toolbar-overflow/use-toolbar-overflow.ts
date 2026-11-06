/**
 * useToolbarOverflow — measures a toolbar's box along its main axis
 * (ResizeObserver, first read in a layout effect so the fold lands
 * before paint) and runs `fitToolbarItems` over the caller's item
 * extents. The caller renders the leading `visible` entries in the
 * bar and the entries from `overflowStart` behind the chevron.
 */

import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fitToolbarItems, type ToolbarOverflowFit, type ToolbarOverflowItem } from './toolbar-overflow-model';

export interface UseToolbarOverflowOptions {
  items: readonly ToolbarOverflowItem[];
  axis: 'vertical' | 'horizontal';
  gap: number;
  moreExtent: number;
  /** Padding along the main axis (both ends summed) that the box's client size includes. */
  padding: number;
}

export function useToolbarOverflow<T extends HTMLElement>({
  items,
  axis,
  gap,
  moreExtent,
  padding,
}: UseToolbarOverflowOptions): { ref: RefObject<T | null>; fit: ToolbarOverflowFit } {
  const ref = useRef<T | null>(null);
  const [available, setAvailable] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const size = axis === 'vertical' ? el.clientHeight : el.clientWidth;
      setAvailable(Math.max(0, size - padding));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [axis, padding]);

  const fit = useMemo<ToolbarOverflowFit>(
    () =>
      available === null
        ? { visible: items.length, overflowStart: items.length }
        : fitToolbarItems({ items, available, gap, moreExtent }),
    [items, available, gap, moreExtent],
  );
  return { ref, fit };
}
