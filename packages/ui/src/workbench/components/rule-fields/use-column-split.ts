/**
 * useColumnSplit — one draggable boundary between the name and value
 * columns of an action-row list (header mods, query params).
 *
 * The two columns flex-grow in a `ratio : 1 - ratio` proportion, so a
 * single split is shared by every row in the list — columns stay
 * aligned like a table — and survives container resizes proportionally.
 *
 * The drag signal comes from the TemplateInputs' corner grips
 * (`onResizeX`): the name field's grip sits ON the boundary, and the
 * value field's grip (pinned to the row's right edge, which can't move)
 * shifts the boundary by the same pointer travel — so both columns'
 * grips feed the same handler. On grab, the grabbed row's two cells are
 * located through the `data-oh-split-*` markers carried by `rowProps` /
 * `*CellProps` and measured once; pointer travel then converts to a
 * ratio against that row's flexible width. Min widths are enforced at
 * drag time in both directions (the value column can never crush the
 * name column below `minLeft`, and vice versa). Double-clicking a grip
 * restores the default 50/50 split.
 */

import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { GripResizeXEvent } from '../template-input';

const ROW_ATTR = 'data-oh-split-row';
const CELL_ATTR = 'data-oh-split-cell';

interface SplitCellProps {
  'data-oh-split-cell': 'left' | 'right';
  style: React.CSSProperties;
}

export interface ColumnSplit {
  /** Spread onto each action row's flex container. */
  rowProps: { 'data-oh-split-row': string };
  /** Wraps the name column (marker + flex weight). */
  leftCellProps: SplitCellProps;
  /** Wraps the value column (marker + flex weight). */
  rightCellProps: SplitCellProps;
  /** Feed to every TemplateInput in either column. */
  onResizeX: (e: GripResizeXEvent) => void;
}

export interface ColumnSplitOptions {
  /** Drag-time floor for the name column, px. */
  minLeft: number;
  /** Drag-time floor for the value column, px. */
  minRight: number;
}

// flex-grow factors summing below 1 distribute only that fraction of
// the free space — and a lone cell (e.g. a Remove row that renders no
// value column) would stop filling its row. Scaling both weights keeps
// the r : 1-r proportion while any single cell's grow stays ≥ 1.
const GROW_SCALE = 100;

function cellStyle(grow: number): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    flex: `${GROW_SCALE * grow} 1 0px`,
    minWidth: 0,
  };
}

export function useColumnSplit({ minLeft, minRight }: ColumnSplitOptions): ColumnSplit {
  // null → default 50/50. Never persisted — like a textarea's drag
  // handle, the split is a working-session convenience, not a setting.
  const [ratio, setRatio] = useState<number | null>(null);
  const dragRef = useRef<{ startLeft: number; total: number } | null>(null);

  const onResizeX = useCallback(
    (e: GripResizeXEvent) => {
      if (e.phase === 'reset') {
        dragRef.current = null;
        setRatio(null);
        return;
      }
      if (e.phase === 'start') {
        const row = e.gripEl.closest(`[${ROW_ATTR}]`);
        const left = row?.querySelector(`[${CELL_ATTR}="left"]`);
        const right = row?.querySelector(`[${CELL_ATTR}="right"]`);
        // A row without both columns (e.g. a Remove operation) has no
        // boundary to move — its grip drives the vertical axis only.
        dragRef.current =
          left instanceof HTMLElement && right instanceof HTMLElement && left.offsetWidth + right.offsetWidth > 0
            ? { startLeft: left.offsetWidth, total: left.offsetWidth + right.offsetWidth }
            : null;
        return;
      }
      if (e.phase === 'end') {
        dragRef.current = null;
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const nextLeft = Math.min(Math.max(drag.startLeft + e.deltaX, minLeft), drag.total - minRight);
      setRatio(nextLeft / drag.total);
    },
    [minLeft, minRight],
  );

  const r = ratio ?? 0.5;
  return {
    rowProps: { [ROW_ATTR]: '' },
    leftCellProps: { [CELL_ATTR]: 'left', style: cellStyle(r) },
    rightCellProps: { [CELL_ATTR]: 'right', style: cellStyle(1 - r) },
    onResizeX,
  };
}
