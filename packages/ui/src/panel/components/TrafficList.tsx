import type { Page } from '@openheaders/core/page-stream';
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FilterConfig } from '../data/filter-engine';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import { WATERFALL_METRIC_ABBR, waterfallSortValue } from '../data/network-columns';
import { pageMarkers, waterfallWindow } from '../data/waterfall-geometry';
import { ColumnHeaderContextMenu, type ColumnHeaderContextMenuState } from './traffic/ColumnHeaderContextMenu';
import type { ColumnDef, ColumnKey } from './traffic/columns';
import { ALL_COLUMN_KEYS, COLUMN_DEFS, columnTrack, DEFAULT_VISIBLE_COLUMNS } from './traffic/columns';
import { extractName } from './traffic/formatters';
import { NetworkPanelHeader } from './traffic/NetworkPanelHeader';
import { derivePreflightPairs } from './traffic/preflight-pairs';
import { type CellContext } from './traffic/render-cell';
import { RequestContextMenu, type RequestContextMenuState } from './traffic/RequestContextMenu';
import { NetworkColumnInfo } from './traffic/NetworkColumnInfo';
import { sortIndicator } from './traffic/sort';
import { TrafficRow } from './traffic/TrafficRow';
import { useColumnResize } from './traffic/use-column-resize';
import { useNetworkView } from './traffic/use-network-view';
import { useRowWindow } from './traffic/use-row-window';
import type { WaterfallScale } from './traffic/WaterfallBar';
import { WidthAnchorRow } from './traffic/WidthAnchorRow';

/** Column-header height — mirrors `.dt-table-header { height }` in
 * panel-traffic.css; the page-marker lines start below it. */
const HEADER_ROW_PX = 22;

interface TrafficListProps {
  /** Full in-view row set — drives preflight pairing, the waterfall window, and
   * the empty-vs-no-match hero (browser-parity: those read the unfiltered log). */
  rows: readonly InspectorRowWithFires[];
  /** Filtered subset to render in the table — computed once in the parent (the
   * filter-state owner) and shared with the footer so the displayed rows and
   * the footer `subset / total` can never drift. */
  filteredRows: readonly InspectorRowWithFires[];
  /** Navigations on this tab — source the DOMContentLoaded / Load marker lines. */
  pages: readonly Page[];
  /** CDP provenance — drives the in-flight waterfall popover (live model vs an
   *  explainer when CDP is off). */
  cdpEnhanced: boolean;
  selectedId: string | null;
  onSelect: (requestId: string) => void;
  filter: ReadonlySet<string>;
  onFilterChange: (next: Set<string>) => void;
  filterConfig: FilterConfig;
  onFilterConfigChange: (cfg: FilterConfig) => void;
  urlFilter: string;
  onUrlFilterChange: (v: string) => void;
  filterError: boolean;
  onToggleDocs: () => void;
  docsActive: boolean;
  /** Mirrors the filter-toggle icon in the top toolbar — when false,
   *  the panel header collapses to a plain "Network" title. */
  showFilter: boolean;
  recording: boolean;
  onStartRecording: () => void;
  onReloadPage: () => void;
  visibleColumns: ReadonlySet<ColumnKey>;
  onVisibleColumnsChange: (next: Set<ColumnKey>) => void;
  onCopyAsHar: (row: InspectorRowWithFires, sanitize?: boolean) => void;
  onSaveAsHar: (row: InspectorRowWithFires, sanitize?: boolean) => void;
  onSaveAllAsHar: (sanitize?: boolean) => void;
  onCopyAllAsHar: (sanitize?: boolean) => void;
  onHide: () => void;
}

export function TrafficList({
  rows,
  filteredRows,
  pages,
  cdpEnhanced,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  filterConfig,
  onFilterConfigChange,
  urlFilter,
  onUrlFilterChange,
  filterError,
  onToggleDocs,
  docsActive,
  showFilter,
  recording,
  onStartRecording,
  onReloadPage,
  visibleColumns,
  onVisibleColumnsChange,
  onCopyAsHar,
  onSaveAsHar,
  onSaveAllAsHar,
  onCopyAllAsHar,
  onHide,
}: TrafficListProps) {
  const {
    compact,
    showFireDots,
    waterfallValues,
    waterfallValueFormat,
    waterfallTimestampTz,
    waterfallExplainValue,
    sortKey,
    sortDir,
    waterfallMetric,
    setWaterfallMetric,
    columnSortActive,
    viewMenu,
    sortMenu,
    handleSort,
    sortRows,
  } = useNetworkView();
  const { columnWidths, registerCellRef, beginResize, resetColumnWidth, resetAllWidths } = useColumnResize();

  const [rowMenu, setRowMenu] = useState<RequestContextMenuState | null>(null);
  const [colMenu, setColMenu] = useState<ColumnHeaderContextMenuState | null>(null);

  // Measured Waterfall column geometry — width drives the in/out/hidden
  // placement of the Duration/Latency value labels (which need pixels, not
  // percentages); the content-space left offset positions the DOMContentLoaded
  // / Load marker overlay onto the column itself rather than the table's right
  // edge (the two diverge in compact mode once the column is clipped offscreen).
  const waterfallColElRef = useRef<HTMLDivElement | null>(null);
  const [waterfallColPx, setWaterfallColPx] = useState(0);
  const [waterfallColLeftPx, setWaterfallColLeftPx] = useState(0);

  // ── Row flash (cross-row jumps: preflight ⇄ parent) ─────────
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimerRef.current != null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Columns always render in canonical registry order (Chrome parity);
  // toggling visibility never reorders — a shown column slots into its
  // fixed position. Waterfall is last in the registry, so it stays last.
  const columns = useMemo<ColumnDef[]>(
    () => ALL_COLUMN_KEYS.filter((k) => visibleColumns.has(k)).map((k) => COLUMN_DEFS[k]),
    [visibleColumns],
  );

  const gridTemplate = useMemo(() => {
    const tracks: string[] = [];
    if (showFireDots) tracks.push('14px');
    for (const c of columns) tracks.push(columnTrack(c, columnWidths[c.key], compact));
    return tracks.join(' ');
  }, [columns, columnWidths, compact, showFireDots]);

  const sorted = useMemo(() => sortRows(filteredRows), [filteredRows, sortRows]);
  const hasTable = filteredRows.length > 0;

  const { tableRef, onScroll, scrollToRow, visibleRows, topPadPx, bottomPadPx } = useRowWindow(sorted, hasTable);

  // Visible height of the scroll body — sets how far the page-marker lines
  // (DOMContentLoaded / Load) extend down the waterfall column.
  const [tableViewportPx, setTableViewportPx] = useState(0);

  // Measure the Waterfall column's width and its left edge in the table's
  // content coordinate space (scroll-independent: viewport offset cancelled
  // by scrollLeft). The marker overlay positions off this left rather than
  // the table's right edge, so it tracks the real column even when compact
  // mode clips the column past the viewport's right edge.
  const measureWaterfall = useCallback(() => {
    const cell = waterfallColElRef.current;
    const table = tableRef.current;
    if (!cell || !table) return;
    const cellRect = cell.getBoundingClientRect();
    const width = cellRect.width;
    const left = cellRect.left - table.getBoundingClientRect().left + table.scrollLeft;
    setWaterfallColPx((prev) => (Math.abs(prev - width) < 1 ? prev : width));
    setWaterfallColLeftPx((prev) => (Math.abs(prev - left) < 1 ? prev : left));
  }, [tableRef]);

  // Header-cell callback ref: store the element and (dis)connect a size
  // observer as it mounts across the panel's render-state branches. The
  // observer fires on width reflow (e.g. a stretchy neighbour absorbing slack).
  const waterfallRoRef = useRef<ResizeObserver | null>(null);
  const waterfallCellRef = useCallback(
    (el: HTMLDivElement | null) => {
      waterfallRoRef.current?.disconnect();
      waterfallRoRef.current = null;
      waterfallColElRef.current = el;
      if (!el) return;
      const ro = new ResizeObserver(() => measureWaterfall());
      ro.observe(el);
      waterfallRoRef.current = ro;
    },
    [measureWaterfall],
  );

  // Observe the scroll body: its height feeds the marker line length, and a
  // panel-width drag (which leaves height untouched) still reflows the columns,
  // so re-measure the waterfall geometry on every table resize.
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setTableViewportPx((prev) => (Math.abs(prev - h) < 1 ? prev : h));
      measureWaterfall();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableRef, measureWaterfall]);

  // Column reflows that don't resize the table (visibility toggles, a column
  // drag, compact toggle, the fire-dot rail) still shift the waterfall column,
  // so re-measure after each such commit.
  useLayoutEffect(() => {
    measureWaterfall();
  }, [measureWaterfall, columnWidths, visibleColumns, compact, showFireDots]);

  const handleJumpTo = useCallback(
    (requestId: string) => {
      onSelect(requestId);
      scrollToRow(requestId);
      setFlashId(requestId);
      if (flashTimerRef.current != null) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashId(null), 1000);
    },
    [onSelect, scrollToRow],
  );

  const handleRowContextMenu = useCallback((e: ReactMouseEvent, requestId: string) => {
    e.preventDefault();
    setRowMenu({ x: e.clientX, y: e.clientY, requestId });
  }, []);

  // Width anchor for the virtualized list. In the (non-compact) layout
  // the table grows horizontally to its widest Name cell; with only a
  // slice of rows mounted, that width would shift as you scroll. A single
  // zero-height ghost row carrying the globally-longest name pins the
  // Name column so the table width stays put. Compact never scrolls
  // horizontally, so it needs no anchor.
  const widestNameRow = useMemo(() => {
    if (compact || !visibleColumns.has('name')) return null;
    let best: InspectorRowWithFires | null = null;
    let bestLen = -1;
    for (const r of sorted) {
      const len = extractName(r.lifecycle.url).name.length;
      if (len > bestLen) {
        bestLen = len;
        best = r;
      }
    }
    return best;
  }, [sorted, compact, visibleColumns]);

  // Preflight pairing — derived from all rows (not filtered) so a
  // preflight whose parent is filtered out still renders as "preflight"
  // with a dead link resolver.
  const preflight = useMemo(() => derivePreflightPairs(rows), [rows]);

  // Waterfall reference window — over the full (unfiltered) row set so a
  // search/type filter never re-anchors the zero (a filtered request keeps its
  // true offset rather than reading "Queued at 0").
  const [t0, tMax] = useMemo(() => waterfallWindow(rows), [rows]);

  // Bar geometry follows the active metric: Duration / Latency zero-align
  // the bars against the largest value in view; the timeline metrics place
  // them on the absolute `[t0, tMax]` window.
  const waterfallScale = useMemo<WaterfallScale>(() => {
    if (waterfallMetric === 'duration' || waterfallMetric === 'latency') {
      // Both metrics draw the same zero-aligned bar — full duration split
      // at the response point — so the scale is always the largest duration
      // in view, not the largest latency.
      let max = 1;
      for (const r of sorted) {
        const v = waterfallSortValue(r, 'duration');
        if (v > max) max = v;
      }
      return {
        mode: 'duration',
        metric: waterfallMetric,
        max,
        colPx: waterfallColPx,
        t0,
        valuesMode: waterfallValues,
        valueFormat: waterfallValueFormat,
        timestampTz: waterfallTimestampTz,
        explainValue: waterfallExplainValue,
      };
    }
    return {
      mode: 'timeline',
      metric: waterfallMetric,
      t0,
      tMax,
      valuesMode: waterfallValues,
      valueFormat: waterfallValueFormat,
      timestampTz: waterfallTimestampTz,
      explainValue: waterfallExplainValue,
    };
  }, [
    waterfallMetric,
    sorted,
    t0,
    tMax,
    waterfallColPx,
    waterfallValues,
    waterfallValueFormat,
    waterfallTimestampTz,
    waterfallExplainValue,
  ]);

  // DOMContentLoaded / Load lines — only on the timeline window (the
  // zero-aligned duration view has no shared axis to place them on) and only
  // when the Waterfall column is showing.
  const markerLines = useMemo(
    () => (waterfallScale.mode === 'timeline' && visibleColumns.has('waterfall') ? pageMarkers(pages, t0, tMax) : []),
    [waterfallScale.mode, visibleColumns, pages, t0, tMax],
  );

  // Supersession floor: the latest in-view navigation's start. A non-terminal
  // row that started before it is a preserved-unknown — its issuing page
  // unloaded mid-flight, so it reads "(unknown)" rather than "Pending" forever
  // (Preserve-log off already scopes such rows out via the nav-clear floor).
  const supersededFloorMs = pages.length > 0 ? pages[pages.length - 1].startedAtMs : -1;

  // Stable per-row render context — referentially constant across a pure
  // scroll so the memoized rows on screen skip re-render.
  const cellContext = useMemo<CellContext>(
    () => ({ waterfall: waterfallScale, preflight, onJumpTo: handleJumpTo, supersededFloorMs, cdpEnhanced }),
    [waterfallScale, preflight, handleJumpTo, supersededFloorMs, cdpEnhanced],
  );

  const toggleColumn = (key: ColumnKey) => {
    const next = new Set(visibleColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    next.add('name');
    onVisibleColumnsChange(next);
  };

  const resetColumns = () => {
    onVisibleColumnsChange(new Set(DEFAULT_VISIBLE_COLUMNS));
    resetAllWidths();
  };

  const headerProps = {
    urlFilter,
    onUrlFilterChange,
    filterConfig,
    onFilterConfigChange,
    filterError,
    docsActive,
    onToggleDocs,
    filter,
    onFilterChange,
    showFilter,
    onHide,
    viewMenu,
    sortMenu,
  };

  const hasRows = filteredRows.length > 0;
  const selectedRow = rowMenu ? sorted.find((r) => r.lifecycle.requestId === rowMenu.requestId) : undefined;

  return (
    <div className="dt-panel">
      <NetworkPanelHeader {...headerProps} />
      {/* The column header always renders — even with no rows — so the empty
          state still shows the table's columns (browser-parity). When empty
          the table shrinks to the header and the hero below fills the rest. */}
      <div
        className={`dt-table${compact ? ' dt-table--compact' : ''}${hasRows ? '' : ' dt-table--empty'}`}
        ref={tableRef}
        onScroll={onScroll}
      >
        {markerLines.length > 0 && (
          // Sticky zero-height anchor at the scrollport top: pins the lines
          // vertically while they flow horizontally with the (last) Waterfall
          // column. The inner box is right-aligned to the column and drops from
          // below the sticky header to the bottom of the visible body.
          <div className="dt-wf-markers-anchor" aria-hidden="true">
            <div
              className="dt-wf-markers"
              style={{
                left: `${waterfallColLeftPx}px`,
                width: `${waterfallColPx}px`,
                height: `${Math.max(tableViewportPx - HEADER_ROW_PX, 0)}px`,
              }}
            >
              {markerLines.map((m) => (
                <span key={m.key} className={`dt-wf-marker dt-wf-marker--${m.kind}`} style={{ left: `${m.pct}%` }} />
              ))}
            </div>
          </div>
        )}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: header row has a right-click menu but no primary action */}
        <div
          className="dt-table-header dt-cols"
          style={{ gridTemplateColumns: gridTemplate }}
          onContextMenu={(e) => {
            e.preventDefault();
            setColMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {showFireDots && <span />}
          {columns.map((col) => (
            <div
              key={col.key}
              ref={(el) => {
                registerCellRef(col.key)(el);
                if (col.key === 'waterfall') waterfallCellRef(el);
              }}
              className="dt-col-header-cell"
            >
              <NetworkColumnInfo infoKey={col.key} />
              <button
                type="button"
                className="dt-col-sort"
                onClick={() => handleSort(col)}
                disabled={!col.sortable}
              >
                {col.key === 'waterfall' ? `Waterfall (${WATERFALL_METRIC_ABBR[waterfallMetric]})` : col.label}
                {col.sortable && sortIndicator(col.key, sortKey, sortDir, columnSortActive)}
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="dt-col-resizer"
                aria-label={`Resize ${col.label} column`}
                onPointerDown={(e) => beginResize(e, col.key)}
                onDoubleClick={() => resetColumnWidth(col.key)}
              />
            </div>
          ))}
        </div>
        {hasRows && (
          <>
            {widestNameRow && (
              <WidthAnchorRow
                row={widestNameRow}
                columns={columns}
                gridTemplate={gridTemplate}
                showFireDots={showFireDots}
                ctx={cellContext}
              />
            )}
            {topPadPx > 0 && <div aria-hidden="true" style={{ height: topPadPx }} />}
            {visibleRows.map((row) => (
              <TrafficRow
                key={row.lifecycle.requestId}
                row={row}
                columns={columns}
                gridTemplate={gridTemplate}
                showFireDots={showFireDots}
                selected={row.lifecycle.requestId === selectedId}
                flash={row.lifecycle.requestId === flashId}
                onSelect={onSelect}
                onContextMenu={handleRowContextMenu}
                ctx={cellContext}
              />
            ))}
            {bottomPadPx > 0 && <div aria-hidden="true" style={{ height: bottomPadPx }} />}
          </>
        )}
      </div>
      {!hasRows &&
        (rows.length === 0 ? (
          <div className="dt-empty-hero">
            <strong>{recording ? 'Recording network activity…' : 'No network activity recorded'}</strong>
            <span className="dt-empty-hero-sub">
              {recording ? 'Perform a request or reload the page.' : 'Record network log to display network activity.'}
            </span>
            <button
              type="button"
              className="dt-btn dt-btn-primary"
              onClick={recording ? onReloadPage : onStartRecording}
            >
              {recording ? 'Reload page' : 'Start recording'}
            </button>
          </div>
        ) : (
          <div className="dt-empty">No matching requests.</div>
        ))}
      {rowMenu && selectedRow && (
        <RequestContextMenu
          state={rowMenu}
          row={selectedRow}
          allRows={rows}
          onClose={() => setRowMenu(null)}
          onCopyAsHar={onCopyAsHar}
          onSaveAsHar={onSaveAsHar}
          onSaveAllAsHar={onSaveAllAsHar}
          onCopyAllAsHar={onCopyAllAsHar}
        />
      )}

      {colMenu && (
        <ColumnHeaderContextMenu
          state={colMenu}
          columns={Object.values(COLUMN_DEFS)}
          visible={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
          onClose={() => setColMenu(null)}
          waterfallMetric={waterfallMetric}
          onWaterfallMetricChange={setWaterfallMetric}
        />
      )}
    </div>
  );
}
