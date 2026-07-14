/**
 * Bring the active storage-grid row into view after a search-jump opens
 * a row's document. The row renders active only once the editor tab is
 * registered AND the section's data has landed, so the reveal retries
 * per frame until the active row exists (or the deadline lapses — the
 * row may have disappeared from live storage since the search ran).
 */

import { type RefObject, useCallback, useEffect, useRef } from 'react';

const DEADLINE_MS = 2000;

export function useActiveRowScroll(rootRef: RefObject<HTMLElement | null>): () => void {
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const startedAt = performance.now();
    const tick = (): void => {
      const row = rootRef.current?.querySelector('.dt-storage-row--active');
      if (row !== null && row !== undefined) {
        row.scrollIntoView({ block: 'center' });
        rafRef.current = null;
        return;
      }
      if (performance.now() - startedAt > DEADLINE_MS) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [rootRef]);
}
