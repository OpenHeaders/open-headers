import { hostNavigation } from '@openheaders/core/navigation';
import type { ConnectionOpener } from '../../data/connection-openers';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import {
  hasObservedResponseData,
  isDimStatusCell,
  isPreservedUnknown,
  PRESERVED_UNKNOWN_LABEL,
  PRESERVED_UNKNOWN_TITLE,
  type SupersessionAnchor,
  statusCellText,
  statusCellTitle,
} from '../../data/request-state';
import type { RowAnnotationContext } from '../../data/row-annotations';
import { formatBytesToKb, formatSizeInfo, type SizeInfo } from '../../data/size-info';
import type { ColumnDef } from './columns';
import { extractName, formatInitiator, getInitiatorFrame } from './formatters';
import { durationMs } from '../../data/network-columns';
import { getRole, type PreflightIndex } from './preflight-pairs';
import ResourceIcon from './ResourceIcon';
import { normalizeResourceType, RESOURCE_LABEL } from './resource-types';
import { WaterfallBar, type WaterfallScale } from './WaterfallBar';

export interface CellContext {
  waterfall: WaterfallScale;
  preflight: PreflightIndex;
  onJumpTo: (requestId: string) => void;
  /**
   * The latest in-view committed top-level navigation — the supersession
   * anchor. A non-terminal row bound to an earlier page (by loader id, or by
   * start-time floor when no loader id is known) is a preserved-unknown (its
   * page unloaded mid-flight).
   */
  superseded: SupersessionAnchor;
  /** CDP provenance — the in-flight waterfall popover reads the live request
   *  model with CDP, or explains the gap without it. */
  cdpEnhanced: boolean;
  /** Physical connection id → the request that opened it, so a reused-connection
   *  row's Waterfall popover can attribute the socket to its opener. */
  connectionOpeners: ReadonlyMap<string, ConnectionOpener>;
  /** Classifier context for the OH annotation rail — the same supersession
   *  anchor plus provenance, bundled once per render pass. */
  annotationCtx: RowAnnotationContext;
  /** Open the row's inspector tab at the annotation's detail section. */
  onAnnotationJump: (requestId: string) => void;
}

/**
 * Render the cell for a specific column.
 */
export function renderCell(col: ColumnDef, row: InspectorRowWithFires, sizeInfo: SizeInfo, ctx: CellContext) {
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
    // A preserved row whose page unloaded mid-flight reads "(unknown)" unless its
    // response is confirmed by streamed body data. No data → the outcome is
    // unknowable: no status, a header-only status, or a navigation-abort artifact
    // (a net-process `200`/`ERR_ABORTED` the browser's own renderer-coupled panel
    // never recorded). With data, it keeps its real status — its response is
    // confirmed, exactly as the host keeps a navigated-away download's status.
    const preserved = isPreservedUnknown(lc, ctx.superseded);
    const preservedUnknown = preserved && !hasObservedResponseData(lc);
    // The status shows the moment it is known — never held back by the Time
    // column. The browser's own cell decides purely from the response signals
    // (a held-open WebSocket reads 101 while its Time stays Pending);
    // "(pending)" is only the cascade's last resort when no status exists.
    const label = preservedUnknown ? PRESERVED_UNKNOWN_LABEL : statusCellText(lc);
    const title = preservedUnknown ? PRESERVED_UNKNOWN_TITLE : statusCellTitle(lc);
    // Grey the cell for an unknown row, a cache hit, or any no-status row
    // (pending / opaque) — browser parity is a dimmed cell, not a coloured
    // one. Everything else is plain: the browser tints no status range.
    return (
      <span
        className={preservedUnknown || isDimStatusCell(lc) ? 'dt-col-status--dim' : undefined}
        title={title}
      >
        {label}
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
    return (
      <WaterfallBar
        row={row}
        scale={ctx.waterfall}
        cdpEnhanced={ctx.cdpEnhanced}
        superseded={ctx.superseded}
        connectionOpeners={ctx.connectionOpeners}
      />
    );
  }
  if (col.key === 'time') {
    const dur = durationMs(lc);
    if (isPreservedUnknown(lc, ctx.superseded) && (dur < 0 || !hasObservedResponseData(lc))) {
      // Host precedence (renderTimeCell): a positive, data-backed duration wins.
      // A preserved row that received data has an advancing endTime (our
      // `lastActivityAtMs`), so it keeps reading its elapsed time, frozen at last
      // activity — exactly as the host shows a navigated-away download. Otherwise
      // it reads "(unknown)": no streamed data (so any terminal timestamp it
      // carries — e.g. a navigation-abort instant — is not a real duration), or
      // no measurable positive duration at all. The host recorded none either.
      return (
        <span className="dt-col-cache" title={PRESERVED_UNKNOWN_TITLE}>
          {PRESERVED_UNKNOWN_LABEL}
        </span>
      );
    }
    if (dur < 0) {
      // Browser parity: an in-flight request with no measurable duration reads
      // "Pending" in the Time column (and 0.0 kB in Size), not a blank cell —
      // coupled with the Status cell's held "(pending)" above. The preserved
      // "(unknown)" branch ran first, so this only catches current-page rows.
      return (
        <span className="dt-col-cache" title="Request not finished yet">
          Pending
        </span>
      );
    }
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
