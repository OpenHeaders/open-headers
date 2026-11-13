/**
 * useEntryExtents — the widths of a toolbar's entries as they stand in
 * the bar, for a bar whose entries are not all one size (a chip is as
 * wide as the value it names). Each entry's wrapper is a direct child
 * of the bar carrying `data-overflow-key`; after every render the
 * wrappers in the bar are read and a changed width is kept, before
 * paint. An entry folded away keeps the last width it had and is read
 * again the moment it returns; one never read (and anything a host
 * that lays nothing out reports as zero) is absent — the caller's
 * default stands for it.
 */

import { type RefObject, useLayoutEffect, useState } from 'react';

const NONE: ReadonlyMap<string, number> = new Map();

export function useEntryExtents(ref: RefObject<HTMLElement | null>): ReadonlyMap<string, number> {
  const [extents, setExtents] = useState(NONE);

  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    let next: Map<string, number> | null = null;
    for (const child of bar.children) {
      if (!(child instanceof HTMLElement)) continue;
      const key = child.dataset.overflowKey;
      const width = child.offsetWidth;
      if (key === undefined || width === 0 || extents.get(key) === width) continue;
      next ??= new Map(extents);
      next.set(key, width);
    }
    if (next !== null) setExtents(next);
  });

  return extents;
}
