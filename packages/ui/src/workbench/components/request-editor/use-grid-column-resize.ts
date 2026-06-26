/**
 * Draggable column widths for the editable grid (Key / Value /
 * Description). Tracks a per-column pixel override and the pointer-drag
 * interaction; a header cell registers a ref so a drag can measure its
 * starting width. Escape cancels the in-progress drag, double-click
 * resets a column to its flex default (handled by the caller via
 * `resetColumn`). Overrides are in-memory (per mount).
 *
 * Mirrors the devtools panel's `traffic/use-column-resize` so resizable
 * tables behave consistently across surfaces — a custom resizer, not
 * Allotment: a table's columns must stay aligned across every row, which
 * a per-pane splitter can't coordinate.
 */

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';

export type ResizableColumn = 'key' | 'value' | 'description';

export const GRID_RESIZING_BODY_CLASS = 'oh-grid-resizing-col';

export interface GridColumnResize {
  /** Per-column px overrides; absent → the column keeps its flex track. */
  widths: Partial<Record<ResizableColumn, number>>;
  /** Ref for a resizable header cell — the drag measures its start width. */
  registerHeaderRef: (col: ResizableColumn) => (el: HTMLElement | null) => void;
  /** Start a pointer-drag resize for `col`. `maxWidth` is the largest the
   *  column may grow before the remaining columns would be squeezed below
   *  their minimums (i.e. before the table overflows) — the drag stops
   *  there instead of introducing a horizontal scrollbar. */
  beginResize: (e: ReactPointerEvent<HTMLElement>, col: ResizableColumn, maxWidth: number) => void;
  /** Drop one column's override, restoring its flex default. */
  resetColumn: (col: ResizableColumn) => void;
}

export function useGridColumnResize(minWidth: number): GridColumnResize {
  const [widths, setWidths] = useState<Partial<Record<ResizableColumn, number>>>({});
  const refs = useRef<Map<ResizableColumn, HTMLElement>>(new Map());

  const registerHeaderRef = useCallback(
    (col: ResizableColumn) => (el: HTMLElement | null) => {
      if (el) refs.current.set(col, el);
      else refs.current.delete(col);
    },
    [],
  );

  const beginResize = useCallback(
    (e: ReactPointerEvent<HTMLElement>, col: ResizableColumn, maxWidth: number) => {
      e.preventDefault();
      e.stopPropagation();
      const el = refs.current.get(col);
      if (!el) return;
      const startWidth = el.getBoundingClientRect().width;
      const startX = e.clientX;
      const clampMax = Math.max(maxWidth, minWidth);

      const onMove = (ev: PointerEvent) => {
        const raw = Math.round(startWidth + (ev.clientX - startX));
        const next = Math.min(Math.max(raw, minWidth), clampMax);
        setWidths((prev) => (prev[col] === next ? prev : { ...prev, [col]: next }));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey);
        document.body.classList.remove(GRID_RESIZING_BODY_CLASS);
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return;
        setWidths((prev) => {
          const { [col]: _drop, ...rest } = prev;
          return rest;
        });
        onUp();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('keydown', onKey);
      document.body.classList.add(GRID_RESIZING_BODY_CLASS);
    },
    [minWidth],
  );

  const resetColumn = useCallback((col: ResizableColumn) => {
    setWidths((prev) => {
      if (!(col in prev)) return prev;
      const { [col]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  return { widths, registerHeaderRef, beginResize, resetColumn };
}
