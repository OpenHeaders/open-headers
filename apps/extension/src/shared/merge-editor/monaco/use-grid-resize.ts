/**
 * Drag-to-resize bars for the CSS-grid layout in `MergePane`.
 *
 * Each layout's template carries fixed-pixel sash tracks between
 * resizable cells (`gridTemplateColumns: "1fr 5px 1fr 5px 1fr"`).
 * The sash elements are grid items that listen for pointer drags;
 * dragging mutates the corresponding fr ratio.
 *
 * Editor `layout()` runs on every drag frame so Monaco recomputes
 * its scrollbar / wrap geometry live.
 *
 * The hook is renderer-agnostic — no Monaco coupling. The caller
 * passes a `notifyResize` callback that fires after each ratio
 * change so editor layout() can be invoked.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GridRatios {
  /** Three column fractions; their sum is held constant. The editor
   *  uses `cols.slice(0, n)` for n-column layouts (n=2 fallback). */
  cols: [number, number, number];
  /** Two row fractions; sum constant. Single-row layouts ignore
   *  the second value. */
  rows: [number, number];
}

const MIN_FRAC = 0.08;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface UseGridResizeArgs {
  /** Container the grid lives in — used for px → fraction math. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Fires after each ratio change; consumers run `editor.layout()`. */
  onResize?: () => void;
}

export interface UseGridResizeApi {
  ratios: GridRatios;
  /** Begin dragging the col-sash between cols `i` and `i+1`. */
  onColSashPointerDown(i: 0 | 1, e: React.PointerEvent): void;
  /** Begin dragging the row-sash between rows 0 and 1. */
  onRowSashPointerDown(e: React.PointerEvent): void;
  /** Keyboard nudge for a column sash. ArrowLeft/Right shift the
   *  ratio by `step` (default 0.05). Returns `true` when the event
   *  was consumed so callers can `preventDefault`. */
  nudgeColSash(i: 0 | 1, direction: 'left' | 'right', step?: number): void;
  /** Keyboard nudge for the row sash. */
  nudgeRowSash(direction: 'up' | 'down', step?: number): void;
  /** Programmatic reset — useful after a layout switch where the
   *  prior ratios don't make sense for the new template. */
  reset(): void;
}

export function useGridResize({ containerRef, onResize }: UseGridResizeArgs): UseGridResizeApi {
  const [ratios, setRatios] = useState<GridRatios>({ cols: [1, 1, 1], rows: [0.35, 0.65] });
  const dragRef = useRef<{
    kind: 'col' | 'row';
    pivot: 0 | 1;
    startX: number;
    startY: number;
    startRatios: GridRatios;
    width: number;
    height: number;
  } | null>(null);

  const reset = useCallback(() => {
    setRatios({ cols: [1, 1, 1], rows: [0.35, 0.65] });
  }, []);

  // Global pointermove / pointerup are bound while dragging. Bound
  // on `window` so a drag that wanders out of the container still
  // tracks; pointer capture would also work but caps are per-element
  // and don't fire across iframes / portals reliably.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      if (drag.kind === 'col') {
        const dx = e.clientX - drag.startX;
        const fracDelta = (dx / drag.width) * 3; // sum of cols is 3 (1+1+1)
        const next: [number, number, number] = [...drag.startRatios.cols];
        next[drag.pivot] = clamp(next[drag.pivot] + fracDelta, MIN_FRAC, 3 - MIN_FRAC * 2);
        next[drag.pivot + 1] = clamp(next[drag.pivot + 1] - fracDelta, MIN_FRAC, 3 - MIN_FRAC * 2);
        setRatios((prev) => ({ ...prev, cols: next }));
      } else {
        const dy = e.clientY - drag.startY;
        const fracDelta = dy / drag.height;
        const top = clamp(drag.startRatios.rows[0] + fracDelta, MIN_FRAC, 1 - MIN_FRAC);
        setRatios((prev) => ({ ...prev, rows: [top, 1 - top] }));
      }
      onResize?.();
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onResize]);

  const onColSashPointerDown = useCallback(
    (i: 0 | 1, e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      dragRef.current = {
        kind: 'col',
        pivot: i,
        startX: e.clientX,
        startY: e.clientY,
        startRatios: ratios,
        width: rect.width,
        height: rect.height,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [containerRef, ratios],
  );

  const onRowSashPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      dragRef.current = {
        kind: 'row',
        pivot: 0,
        startX: e.clientX,
        startY: e.clientY,
        startRatios: ratios,
        width: rect.width,
        height: rect.height,
      };
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [containerRef, ratios],
  );

  const nudgeColSash = useCallback(
    (i: 0 | 1, direction: 'left' | 'right', step = 0.05) => {
      const delta = direction === 'right' ? step : -step;
      setRatios((prev) => {
        const next: [number, number, number] = [...prev.cols];
        next[i] = clamp(next[i] + delta, MIN_FRAC, 3 - MIN_FRAC * 2);
        next[i + 1] = clamp(next[i + 1] - delta, MIN_FRAC, 3 - MIN_FRAC * 2);
        return { ...prev, cols: next };
      });
      onResize?.();
    },
    [onResize],
  );

  const nudgeRowSash = useCallback(
    (direction: 'up' | 'down', step = 0.05) => {
      const delta = direction === 'down' ? step : -step;
      setRatios((prev) => {
        const top = clamp(prev.rows[0] + delta, MIN_FRAC, 1 - MIN_FRAC);
        return { ...prev, rows: [top, 1 - top] };
      });
      onResize?.();
    },
    [onResize],
  );

  return { ratios, onColSashPointerDown, onRowSashPointerDown, nudgeColSash, nudgeRowSash, reset };
}
