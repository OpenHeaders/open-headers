import { type MouseEvent as ReactMouseEvent, memo } from 'react';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { classifyRequestState, rowStateClass } from '../../data/request-state';
import { getSizeInfo } from '../../data/size-info';
import { isAppliedFire } from '../../data/types';
import type { ColumnDef } from './columns';
import { type CellContext, renderCell } from './render-cell';

interface TrafficRowProps {
  row: InspectorRowWithFires;
  columns: ColumnDef[];
  gridTemplate: string;
  showFireDots: boolean;
  selected: boolean;
  flash: boolean;
  onSelect: (requestId: string) => void;
  onContextMenu: (e: ReactMouseEvent, requestId: string) => void;
  ctx: CellContext;
}

/**
 * One request row. Memoized: while requests stream in only the rows whose
 * data actually changed re-render, and a pure scroll (which only shifts
 * the mounted window) re-renders nothing already on screen — `columns`,
 * `gridTemplate`, and `ctx` are referentially stable across those frames.
 */
function TrafficRowImpl({
  row,
  columns,
  gridTemplate,
  showFireDots,
  selected,
  flash,
  onSelect,
  onContextMenu,
  ctx,
}: TrafficRowProps) {
  const state = classifyRequestState(row.lifecycle);
  const sizeInfo = getSizeInfo(row.lifecycle, state);
  const stateClass = rowStateClass(state);
  const requestId = row.lifecycle.requestId;
  return (
    <button
      type="button"
      className={`dt-row dt-cols${stateClass ? ` ${stateClass}` : ''}${flash ? ' dt-row--flash' : ''}`}
      data-selected={selected}
      data-row-id={requestId}
      onClick={() => onSelect(requestId)}
      onContextMenu={(e) => onContextMenu(e, requestId)}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {showFireDots && (
        <span className="dt-col-dot">
          {row.fires.length > 0 && (
            <span
              className={`dt-fire-dot ${row.fires.some(isAppliedFire) ? 'dt-fire-dot--auth' : 'dt-fire-dot--inferred'}`}
            />
          )}
        </span>
      )}
      {columns.map((col) => (
        <span key={col.key} className={col.align === 'right' ? 'dt-col-right' : undefined}>
          {renderCell(col, row, state, sizeInfo, ctx)}
        </span>
      ))}
    </button>
  );
}

export const TrafficRow = memo(TrafficRowImpl);
