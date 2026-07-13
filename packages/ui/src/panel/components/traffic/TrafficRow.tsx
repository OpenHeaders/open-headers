import { type MouseEvent as ReactMouseEvent, memo } from 'react';
import { type FireDotTier, rowFireTier } from '../../data/fire-evidence';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { classifyRequestState, rowStateClass } from '../../data/request-state';
import { getSizeInfo } from '../../data/size-info';
import type { ColumnDef } from './columns';
import { type CellContext, renderCell } from './render-cell';
import { RowAnnotationCell } from './RowAnnotationCell';

const DOT_CLASS: Record<FireDotTier, string> = {
  applied: 'dt-fire-dot--auth',
  contradicted: 'dt-fire-dot--contradicted',
  inferred: 'dt-fire-dot--inferred',
};

const DOT_TITLE: Record<FireDotTier, string> = {
  applied: 'Rule applied — confirmed by the engine, the in-page reporter, or the captured headers',
  contradicted: 'Rule contradicted — a claimed header change is disproven by the captured headers',
  inferred: 'Rule matched — application not verifiable for this request',
};

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
  const stateClass = rowStateClass(row.lifecycle);
  const requestId = row.lifecycle.requestId;
  const dotTier = showFireDots ? rowFireTier(row.lifecycle, row.fires) : null;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`dt-row dt-cols${stateClass ? ` ${stateClass}` : ''}${flash ? ' dt-row--flash' : ''}`}
      data-selected={selected}
      data-row-id={requestId}
      onClick={() => onSelect(requestId)}
      onContextMenu={(e) => onContextMenu(e, requestId)}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {showFireDots && (
        <span className="dt-col-dot">
          {dotTier !== null && <span className={`dt-fire-dot ${DOT_CLASS[dotTier]}`} title={DOT_TITLE[dotTier]} />}
        </span>
      )}
      <RowAnnotationCell
        lifecycle={row.lifecycle}
        ctx={ctx.annotationCtx}
        redirectRewrite={row.redirectRewrite}
        onJump={ctx.onAnnotationJump}
      />
      {columns.map((col) => (
        <span key={col.key} className={col.align === 'right' ? 'dt-col-right' : undefined}>
          {renderCell(col, row, sizeInfo, ctx)}
        </span>
      ))}
    </button>
  );
}

export const TrafficRow = memo(TrafficRowImpl);
