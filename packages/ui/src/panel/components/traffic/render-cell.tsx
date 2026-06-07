import { hostNavigation } from '@openheaders/core/navigation';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import {
  effectiveStatusCode,
  isDimStatusCell,
  isPreservedUnknown,
  PRESERVED_UNKNOWN_LABEL,
  PRESERVED_UNKNOWN_TITLE,
  type RequestState,
  statusCellText,
  statusCellTitle,
} from '../../data/request-state';
import { formatBytesToKb, formatSizeInfo, type SizeInfo } from '../../data/size-info';
import type { ColumnDef } from './columns';
import { extractName, formatInitiator, getInitiatorFrame } from './formatters';
import { getRole, type PreflightIndex } from './preflight-pairs';
import ResourceIcon from './ResourceIcon';
import { normalizeResourceType, RESOURCE_LABEL } from './resource-types';
import { WaterfallBar, type WaterfallScale } from './WaterfallBar';

export interface CellContext {
  waterfall: WaterfallScale;
  preflight: PreflightIndex;
  onJumpTo: (requestId: string) => void;
  /**
   * `startedAtMs` of the latest in-view committed top-level navigation — the
   * supersession floor. A non-terminal row that started before it is a
   * preserved-unknown (its page unloaded mid-flight); `-1` when no navigation
   * is in view.
   */
  supersededFloorMs: number;
}

/**
 * Render the cell for a specific column.
 */
export function renderCell(
  col: ColumnDef,
  row: InspectorRowWithFires,
  state: RequestState,
  sizeInfo: SizeInfo,
  ctx: CellContext,
) {
  const lc = row.lifecycle;
  const requestId = lc.requestId;
  const role = getRole(ctx.preflight, requestId);
  if (col.key === 'requestNumber') {
    return <span className="dt-col-muted">{row.displayId}</span>;
  }
  if (col.key === 'name') {
    const rawType = normalizeResourceType(lc.resourceType);
    const { name } = extractName(lc.url);
    return (
      <span className="dt-col-name">
        <ResourceIcon type={rawType} />
        <span className="dt-col-name-text">{name}</span>
      </span>
    );
  }
  if (col.key === 'method') {
    // "<METHOD> + Preflight" on the parent, with the "Preflight" text
    // linking back to the preflight row.
    if (role.kind === 'parent') {
      return (
        <span>
          {lc.method}
          {' + '}
          <button
            type="button"
            className="dt-btn-link"
            onClick={(e) => {
              e.stopPropagation();
              ctx.onJumpTo(role.peerId);
            }}
            title="Jump to preflight request"
          >
            Preflight
          </button>
        </span>
      );
    }
    return <span>{lc.method}</span>;
  }
  if (col.key === 'status') {
    // A preserved row whose page unloaded mid-flight with no status reads
    // "(unknown)" — but a real status precedes preservation (host parity: a
    // streaming row that already had a status keeps it).
    const preservedUnknown = effectiveStatusCode(lc) == null && isPreservedUnknown(lc, ctx.supersededFloorMs);
    // Grey the cell for a cache hit or any no-status row (pending / opaque /
    // unknown) — browser parity is a dimmed cell, not a coloured one.
    // Everything else is plain: the browser tints no status range.
    return (
      <span
        className={isDimStatusCell(lc) ? 'dt-col-status--dim' : undefined}
        title={preservedUnknown ? PRESERVED_UNKNOWN_TITLE : statusCellTitle(lc)}
      >
        {preservedUnknown ? PRESERVED_UNKNOWN_LABEL : statusCellText(lc)}
      </span>
    );
  }
  if (col.key === 'type') {
    const rawType = normalizeResourceType(lc.resourceType);
    const label = RESOURCE_LABEL[rawType] ?? rawType;
    // A redirect leg reads "<type> / Redirect" — host parity.
    return <span>{row.isRedirectHop ? `${label} / Redirect` : label}</span>;
  }
  if (col.key === 'initiator') {
    // Preflight rows take priority: show "Preflight" linking to the
    // parent CORS request instead of the JS stack that initiated it.
    if (role.kind === 'preflight') {
      return (
        <span className="dt-col-muted">
          <button
            type="button"
            className="dt-btn-link"
            onClick={(e) => {
              e.stopPropagation();
              ctx.onJumpTo(role.peerId);
            }}
            title="Select the request that initiated this preflight"
          >
            Preflight
          </button>
          <span
            className="dt-preflight-info"
            aria-hidden="true"
            title="Select the request that initiated this preflight"
          >
            ⓘ
          </span>
        </span>
      );
    }
    // JS-initiated rows: render the call-site as a clickable link that
    // opens the host's Sources panel at the right line.
    const har = currentHarEntry(lc);
    const initiator = har?._initiator;
    const frame = getInitiatorFrame(initiator);
    if (frame) {
      const label = formatInitiator(initiator);
      return (
        <span className="dt-col-muted">
          <button
            type="button"
            className="dt-btn-link"
            onClick={(e) => {
              e.stopPropagation();
              hostNavigation.openResource(frame.url, frame.lineNumber, frame.columnNumber);
            }}
            title={frame.url}
          >
            {label}
          </button>
        </span>
      );
    }
    return <span className="dt-col-muted">{formatInitiator(initiator)}</span>;
  }
  if (col.key === 'waterfall') {
    return <WaterfallBar row={row} scale={ctx.waterfall} />;
  }
  if (col.key === 'time' && isPreservedUnknown(lc, ctx.supersededFloorMs)) {
    // The issuing page unloaded mid-flight, so no terminal event will arrive
    // and the duration is unknowable — "(unknown)", not a frozen running time
    // (host parity: preserved precedes the pending fallback in the Time cell,
    // and a row whose status was already known still reads unknown here).
    return (
      <span className="dt-col-cache" title={PRESERVED_UNKNOWN_TITLE}>
        {PRESERVED_UNKNOWN_LABEL}
      </span>
    );
  }
  if (col.key === 'time' && state.kind === 'pending') {
    // Browser parity: an in-flight request reads "Pending" in the Time
    // column (and 0.0 kB in Size), not a blank cell.
    return (
      <span className="dt-col-cache" title="Request not finished yet">
        Pending
      </span>
    );
  }
  if (col.key === 'size') {
    if (sizeInfo.kind === 'cached') {
      const label = formatSizeInfo(sizeInfo);
      return (
        <span className="dt-col-cache" title={`Served from ${sizeInfo.source} cache`}>
          {label}
        </span>
      );
    }
    const { transferred, resource } = sizeInfo;
    if (transferred == null && resource == null) return <span />;
    const title =
      transferred != null && resource != null
        ? `${formatBytesToKb(transferred)} over the wire · ${formatBytesToKb(resource)} decoded`
        : undefined;
    return <span title={title}>{formatSizeInfo(sizeInfo)}</span>;
  }
  const value = col.extract(row);
  return <span>{value == null ? '' : value}</span>;
}
