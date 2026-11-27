/**
 * The size of the workflow graph's pane, for what is drawn over it. Read
 * by the part that needs it, not by the graph: a pane that is resized
 * redraws that part alone.
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import type { Size } from './graph-minimap';

/** `null` until the pane has a size — a tab mounted hidden has none yet. */
export function usePaneSize(pane: React.RefObject<HTMLDivElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  // After the commit: a part drawn before the pane mounts with it, and
  // the pane holds its element only once the commit is whole.
  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setSize(width === 0 ? null : { width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pane]);
  return size;
}
