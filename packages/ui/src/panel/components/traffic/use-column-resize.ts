import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';
import { COLUMN_DEFS, type ColumnKey, DEFAULT_COLUMN_MIN_WIDTH } from './columns';

export interface ColumnResizeApi {
  /** Per-column user-override widths (px). Absent → the column's track default. */
  columnWidths: Partial<Record<ColumnKey, number>>;
  /** Ref callback for a header cell, used as the resize measurement anchor. */
  registerCellRef: (key: ColumnKey) => (el: HTMLDivElement | null) => void;
  /** Begin a pointer-drag resize for a column. */
  beginResize: (e: ReactPointerEvent<HTMLElement>, columnKey: ColumnKey) => void;
  /** Drop one column's override, restoring its default track. */
  resetColumnWidth: (columnKey: ColumnKey) => void;
  /** Drop every override. */
  resetAllWidths: () => void;
}

/**
 * User-resizable column widths. Tracks per-column overrides and the
 * pointer-drag interaction (live drag, Escape to cancel, double-click to
 * reset). Header cells register a ref so a drag can measure the starting
 * width from the live element.
 */
export function useColumnResize(): ColumnResizeApi {
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>({});
  const cellRefs = useRef<Map<ColumnKey, HTMLDivElement>>(new Map());

  const registerCellRef = useCallback(
    (key: ColumnKey) => (el: HTMLDivElement | null) => {
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  const beginResize = useCallback((e: ReactPointerEvent<HTMLElement>, columnKey: ColumnKey) => {
    e.preventDefault();
    e.stopPropagation();
    const cellEl = cellRefs.current.get(columnKey);
    if (!cellEl) return;
    const startWidth = cellEl.getBoundingClientRect().width;
    const startX = e.clientX;
    const colMin = COLUMN_DEFS[columnKey].minWidth ?? DEFAULT_COLUMN_MIN_WIDTH;

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
          const { [columnKey]: _discard, ...rest } = prev;
          return rest;
        });
        onUp();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('dt-resizing-col');
  }, []);

  const resetColumnWidth = useCallback((columnKey: ColumnKey) => {
    setColumnWidths((prev) => {
      if (!(columnKey in prev)) return prev;
      const { [columnKey]: _discard, ...rest } = prev;
      return rest;
    });
  }, []);

  const resetAllWidths = useCallback(() => setColumnWidths({}), []);

  return { columnWidths, registerCellRef, beginResize, resetColumnWidth, resetAllWidths };
}
