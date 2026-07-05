/**
 * Draggable column widths for the editable grid (Key / Value /
 * Description) — the whole concern in one place so callers only wire it.
 *
 * Owns:
 *   - per-column px overrides + the pointer-drag (Escape cancels,
 *     double-click via `resetColumn` restores flex);
 *   - which columns are resizable (every visible flex column except the
 *     last, which always flexes to absorb the remaining width);
 *   - the grow cap, so a drag-right stops before the other columns are
 *     squeezed under their minimum (no horizontal scrollbar);
 *   - the full-height divider overlays' positions, re-measured on layout
 *     and container-resize so a boundary can be grabbed from any row.
 *
 * A custom resizer, NOT Allotment (mirrors the devtools panel's
 * `components/use-column-resize`): a table's columns must stay aligned
 * across every row, which a per-pane splitter can't coordinate.
 *
 * Overrides are in-memory (per mount).
 */

import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ResizableColumn = 'key' | 'value' | 'description';

/** Class on a resizer span; CSS below paints/positions the handle. */
export const GRID_COL_RESIZER_CLASS = 'editable-grid-col-resizer';
/** Class toggled on `<body>` during a drag (keeps the col-resize cursor). */
const RESIZING_BODY_CLASS = 'oh-grid-resizing-col';

/** Fixed leading/trailing column widths (drag handle, enable checkbox,
 *  row actions) the flex columns share the remaining space around. */
const DRAG_HANDLE_WIDTH = 20;
const CHECKBOX_WIDTH = 28;
const ROW_ACTIONS_WIDTH = 32;

export interface UseGridColumnResizeParams {
  showValueColumn: boolean;
  showDescriptionColumn: boolean;
  hideEnabled: boolean;
  /** Smallest a column may be dragged / shrink to. */
  minWidth: number;
}

export interface GridColumnResize {
  /** Attach to the table container — the resize budget + the positioning
   *  origin for the divider overlays. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Attach to each visible flex column's header cell — the drag measures
   *  its start width and the overlay reads its right edge. */
  registerHeaderRef: (col: ResizableColumn) => (el: HTMLElement | null) => void;
  /** The user's px override for `col` (only non-last, resized columns),
   *  for building the grid template; undefined → keep its flex track. */
  columnPxWidth: (col: ResizableColumn) => number | undefined;
  /** Full-height divider overlays to render inside the container, each at
   *  its column's right edge (relative to the container's left). */
  dividers: { col: ResizableColumn; x: number }[];
  /** Start a pointer-drag resize of `col`; the grow cap is computed here. */
  beginResize: (e: ReactPointerEvent<HTMLElement>, col: ResizableColumn) => void;
  /** Restore `col` to its flex default. */
  resetColumn: (col: ResizableColumn) => void;
}

export function useGridColumnResize({
  showValueColumn,
  showDescriptionColumn,
  hideEnabled,
  minWidth,
}: UseGridColumnResizeParams): GridColumnResize {
  const [widths, setWidths] = useState<Partial<Record<ResizableColumn, number>>>({});
  const [dividers, setDividers] = useState<{ col: ResizableColumn; x: number }[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Map<ResizableColumn, HTMLElement>>(new Map());

  // Ordered visible flex columns; the LAST always flexes (absorbs the
  // remaining width) so only the ones before it are resizable.
  const flexColumns = useMemo<ResizableColumn[]>(() => {
    const cols: ResizableColumn[] = ['key'];
    if (showValueColumn) cols.push('value');
    if (showDescriptionColumn) cols.push('description');
    return cols;
  }, [showValueColumn, showDescriptionColumn]);
  const lastFlexColumn = flexColumns[flexColumns.length - 1];
  const fixedColumnsWidth = DRAG_HANDLE_WIDTH + (hideEnabled ? 0 : CHECKBOX_WIDTH) + ROW_ACTIONS_WIDTH;

  const registerHeaderRef = useCallback(
    (col: ResizableColumn) => (el: HTMLElement | null) => {
      if (el) headerRefs.current.set(col, el);
      else headerRefs.current.delete(col);
    },
    [],
  );

  const columnPxWidth = useCallback(
    (col: ResizableColumn) => (col !== lastFlexColumn ? widths[col] : undefined),
    [lastFlexColumn, widths],
  );

  // The most `dragged` can grow before the OTHER columns are squeezed
  // under their minimums (fixed columns at their size, already-resized
  // columns at their px, remaining flex columns at `minWidth`).
  const growCap = useCallback(
    (dragged: ResizableColumn) => {
      let othersMin = fixedColumnsWidth;
      for (const c of flexColumns) {
        if (c === dragged) continue;
        const isResized = c !== lastFlexColumn && widths[c] != null;
        othersMin += isResized ? (widths[c] as number) : minWidth;
      }
      const avail = containerRef.current?.clientWidth ?? Number.POSITIVE_INFINITY;
      return avail - othersMin;
    },
    [fixedColumnsWidth, flexColumns, lastFlexColumn, widths, minWidth],
  );

  const beginResize = useCallback(
    (e: ReactPointerEvent<HTMLElement>, col: ResizableColumn) => {
      e.preventDefault();
      e.stopPropagation();
      const el = headerRefs.current.get(col);
      if (!el) return;
      const startWidth = el.getBoundingClientRect().width;
      const startX = e.clientX;
      const clampMax = Math.max(growCap(col), minWidth);

      const onMove = (ev: PointerEvent) => {
        const next = Math.min(Math.max(Math.round(startWidth + (ev.clientX - startX)), minWidth), clampMax);
        setWidths((prev) => (prev[col] === next ? prev : { ...prev, [col]: next }));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey);
        document.body.classList.remove(RESIZING_BODY_CLASS);
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
      document.body.classList.add(RESIZING_BODY_CLASS);
    },
    [growCap, minWidth],
  );

  const resetColumn = useCallback((col: ResizableColumn) => {
    setWidths((prev) => {
      if (!(col in prev)) return prev;
      const { [col]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  // Divider x = each non-last flex column's right edge (its boundary is
  // identical down every row), relative to the container's left.
  const measureDividers = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerLeft = container.getBoundingClientRect().left;
    const next: { col: ResizableColumn; x: number }[] = [];
    for (const col of flexColumns) {
      if (col === lastFlexColumn) continue;
      const cell = headerRefs.current.get(col);
      if (cell) next.push({ col, x: cell.getBoundingClientRect().right - containerLeft });
    }
    setDividers((prev) =>
      prev.length === next.length && prev.every((p, i) => p.col === next[i].col && Math.abs(p.x - next[i].x) < 0.5)
        ? prev
        : next,
    );
  }, [flexColumns, lastFlexColumn]);

  // Re-measure after layout-affecting changes: column toggles re-key
  // `measureDividers`; `widths` is a re-run trigger (not read here — the
  // measurement reads the post-reflow DOM, which only settles after a
  // width change re-renders).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `widths` re-triggers a DOM re-measure
  useLayoutEffect(() => {
    measureDividers();
  }, [measureDividers, widths]);
  // …and on container resize (pane drag).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measureDividers());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measureDividers]);

  return { containerRef, registerHeaderRef, columnPxWidth, dividers, beginResize, resetColumn };
}

// ── Resizer styles ─────────────────────────────────────────────────
// A full-height handle straddling the boundary (`left` is set inline per
// divider); the hover/active line lands on the existing 1px border. Body
// class keeps the col-resize cursor through the drag.
const STYLE_ID = 'editable-grid-col-resize-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.${GRID_COL_RESIZER_CLASS} {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
  z-index: 3;
}
.${GRID_COL_RESIZER_CLASS}:hover::after,
body.${RESIZING_BODY_CLASS} .${GRID_COL_RESIZER_CLASS}:active::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: var(--ant-color-primary, #1677ff);
}
body.${RESIZING_BODY_CLASS} {
  cursor: col-resize !important;
  user-select: none !important;
}
  `;
  document.head.appendChild(style);
}
