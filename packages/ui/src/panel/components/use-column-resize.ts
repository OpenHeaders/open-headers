import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';

export interface ColumnResizeApi<K extends string> {
  /** Per-column user-override widths (px). Absent → the column's track default. */
  columnWidths: Partial<Record<K, number>>;
  /** Ref callback for a header cell, used as the resize measurement anchor. */
  registerCellRef: (key: K) => (el: HTMLDivElement | null) => void;
  /** Begin a pointer-drag resize for a column. */
  beginResize: (e: ReactPointerEvent<HTMLElement>, columnKey: K) => void;
  /** Drop one column's override, restoring its default track. */
  resetColumnWidth: (columnKey: K) => void;
  /** Drop every override. */
  resetAllWidths: () => void;
}

/**
 * User-resizable column widths for a grid — the traffic table and the
 * Messages frame grid share this. Tracks per-column overrides and the
 * pointer-drag interaction (live drag, Escape to cancel, double-click to
 * reset). Header cells register a ref so a drag can measure the starting
 * width from the live element; `minWidthFor` supplies each column's
 * resize floor from the caller's own column model.
 */
export function useColumnResize<K extends string>(minWidthFor: (key: K) => number): ColumnResizeApi<K> {
  const [columnWidths, setColumnWidths] = useState<Partial<Record<K, number>>>({});
  const cellRefs = useRef<Map<K, HTMLDivElement>>(new Map());

  const registerCellRef = useCallback(
    (key: K) => (el: HTMLDivElement | null) => {
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  const beginResize = useCallback(
    (e: ReactPointerEvent<HTMLElement>, columnKey: K) => {
      e.preventDefault();
      e.stopPropagation();
      const cellEl = cellRefs.current.get(columnKey);
      if (!cellEl) return;
      const startWidth = cellEl.getBoundingClientRect().width;
      const startX = e.clientX;
      const colMin = minWidthFor(columnKey);

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(Math.round(startWidth + delta), colMin);
        setColumnWidths((prev) => (prev[columnKey] === next ? prev : { ...prev, [columnKey]: next }));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey);
        document.body.classList.remove('dt-resizing-col');
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          setColumnWidths((prev) => {
            const next = { ...prev };
            delete next[columnKey];
            return next;
          });
          onUp();
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('keydown', onKey);
      document.body.classList.add('dt-resizing-col');
    },
    [minWidthFor],
  );

  const resetColumnWidth = useCallback((columnKey: K) => {
    setColumnWidths((prev) => {
      if (!(columnKey in prev)) return prev;
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  }, []);

  const resetAllWidths = useCallback(() => setColumnWidths({}), []);

  return { columnWidths, registerCellRef, beginResize, resetColumnWidth, resetAllWidths };
}
