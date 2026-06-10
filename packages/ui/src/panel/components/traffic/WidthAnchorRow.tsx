import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { classifyRequestState } from '../../data/request-state';
import { getSizeInfo } from '../../data/size-info';
import type { ColumnDef } from './columns';
import { type CellContext, renderCell } from './render-cell';

interface WidthAnchorRowProps {
  row: InspectorRowWithFires;
  columns: ColumnDef[];
  gridTemplate: string;
  showFireDots: boolean;
  ctx: CellContext;
}

/**
 * Zero-height, hidden row that pins the table's horizontal size to the
 * globally-widest Name cell. The virtualized list mounts only a slice of
 * rows, so without this the `max-content` outer column would resize as
 * different-length names scroll in and out. `visibility: hidden` keeps
 * the row unseen while it still contributes its intrinsic width.
 */
export function WidthAnchorRow({ row, columns, gridTemplate, showFireDots, ctx }: WidthAnchorRowProps) {
  const state = classifyRequestState(row.lifecycle);
  const sizeInfo = getSizeInfo(row.lifecycle, state);
  return (
    <div
      className="dt-row dt-cols"
      aria-hidden="true"
      style={{ gridTemplateColumns: gridTemplate, height: 0, visibility: 'hidden', pointerEvents: 'none' }}
    >
      {showFireDots && <span />}
      {/* The always-on annotation rail's track. */}
      <span />
      {columns.map((col) => (
        <span key={col.key} className={col.align === 'right' ? 'dt-col-right' : undefined}>
          {renderCell(col, row, sizeInfo, ctx)}
        </span>
      ))}
    </div>
  );
}
