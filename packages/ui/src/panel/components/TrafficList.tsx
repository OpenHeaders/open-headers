import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterConfig, FilterToken } from '../data/filter-engine';
import { matchesUrlFilter, passesRowFilters } from '../data/filter-engine';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import { lifecycleDurationMs } from '../data/inspector-row-projection';
import { WATERFALL_METRIC_LABELS, waterfallSortValue } from '../data/network-columns';
import { ColumnHeaderContextMenu, type ColumnHeaderContextMenuState } from './traffic/ColumnHeaderContextMenu';
import type { ColumnDef, ColumnKey } from './traffic/columns';
import { COLUMN_DEFS, columnTrack, DEFAULT_VISIBLE_COLUMNS } from './traffic/columns';
import { extractName } from './traffic/formatters';
import { NetworkPanelHeader } from './traffic/NetworkPanelHeader';
import { derivePreflightPairs } from './traffic/preflight-pairs';
import { type CellContext } from './traffic/render-cell';
import { RequestContextMenu, type RequestContextMenuState } from './traffic/RequestContextMenu';
import { matchesResourceType } from './traffic/resource-types';
import { sortIndicator } from './traffic/sort';
import { TrafficRow } from './traffic/TrafficRow';
import { useColumnResize } from './traffic/use-column-resize';
import { useNetworkView } from './traffic/use-network-view';
import { useRowWindow } from './traffic/use-row-window';
import type { WaterfallScale } from './traffic/WaterfallBar';
import { WidthAnchorRow } from './traffic/WidthAnchorRow';

interface TrafficListProps {
  rows: readonly InspectorRowWithFires[];
  selectedId: string | null;
  onSelect: (requestId: string) => void;
  filter: ReadonlySet<string>;
  onFilterChange: (next: Set<string>) => void;
  filterTokens: FilterToken[];
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
  onSaveAsHar: (row: InspectorRowWithFires) => void;
  onSaveAllAsHar: () => void;
  onCopyAllAsHar: () => void;
  onHide: () => void;
}

export function TrafficList({
  rows,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  filterTokens,
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
  onSaveAsHar,
  onSaveAllAsHar,
  onCopyAllAsHar,
  onHide,
}: TrafficListProps) {
  const {
    compact,
    showFireDots,
    sortKey,
    sortDir,
    waterfallMetric,
    columnSortActive,
    viewMenu,
    handleSortTarget,
    handleSort,
    sortRows,
  } = useNetworkView();
  const { columnWidths, registerCellRef, beginResize, resetColumnWidth, resetAllWidths } = useColumnResize();

  const [rowMenu, setRowMenu] = useState<RequestContextMenuState | null>(null);
  const [colMenu, setColMenu] = useState<ColumnHeaderContextMenuState | null>(null);

  // ── Row flash (cross-row jumps: preflight ⇄ parent) ─────────
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimerRef.current != null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const columns = useMemo<ColumnDef[]>(() => {
    const order: ColumnKey[] = [];
    for (const k of DEFAULT_VISIBLE_COLUMNS) if (visibleColumns.has(k)) order.push(k);
    for (const k of Object.keys(COLUMN_DEFS) as ColumnKey[]) {
      if (!order.includes(k) && visibleColumns.has(k)) order.push(k);
    }
    return order.map((k) => COLUMN_DEFS[k]);
  }, [visibleColumns]);

  const gridTemplate = useMemo(() => {
    const tracks: string[] = [];
    if (showFireDots) tracks.push('14px');
    tracks.push('32px');
    for (const c of columns) tracks.push(columnTrack(c, columnWidths[c.key], compact));
    return tracks.join(' ');
  }, [columns, columnWidths, compact, showFireDots]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const lc = r.lifecycle;
      if (!passesRowFilters(lc, filterConfig)) return false;
      if (!matchesResourceType(lc.resourceType, filter)) return false;
      if (filterTokens.length > 0 && !matchesUrlFilter(lc, filterTokens, filterConfig)) return false;
      return true;
    });
  }, [rows, filter, filterTokens, filterConfig]);

  const sorted = useMemo(() => sortRows(filtered), [filtered, sortRows]);
  const hasTable = filtered.length > 0;

  const { tableRef, onScroll, scrollToRow, visibleRows, topPadPx, bottomPadPx } = useRowWindow(sorted, hasTable);

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

  // Waterfall reference window.
  const [t0, tMax] = useMemo(() => {
    if (sorted.length === 0) return [0, 1];
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const r of sorted) {
      const start = r.lifecycle.startedAtMs;
      if (start < min) min = start;
      const dur = lifecycleDurationMs(r.lifecycle) ?? 0;
      const end = start + (dur > 0 ? dur : 0);
      if (end > max) max = end;
    }
    if (!Number.isFinite(min)) min = 0;
    if (max <= min) max = min + 1;
    return [min, max];
  }, [sorted]);

  // Bar geometry follows the active metric: Duration / Latency zero-align
  // the bars against the largest value in view; the timeline metrics place
  // them on the absolute `[t0, tMax]` window.
  const waterfallScale = useMemo<WaterfallScale>(() => {
    if (waterfallMetric === 'duration' || waterfallMetric === 'latency') {
      let max = 1;
      for (const r of sorted) {
        const v = waterfallSortValue(r, waterfallMetric);
        if (v > max) max = v;
      }
      return { mode: 'duration', metric: waterfallMetric, max };
    }
    return { mode: 'timeline', metric: waterfallMetric, t0, tMax };
  }, [waterfallMetric, sorted, t0, tMax]);

  // Stable per-row render context — referentially constant across a pure
  // scroll so the memoized rows on screen skip re-render.
  const cellContext = useMemo<CellContext>(
    () => ({ waterfall: waterfallScale, preflight, onJumpTo: handleJumpTo }),
    [waterfallScale, preflight, handleJumpTo],
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
  };

  if (filtered.length === 0) {
    if (rows.length === 0) {
      return (
        <div className="dt-panel">
          <NetworkPanelHeader {...headerProps} />
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
        </div>
      );
    }
    return (
      <div className="dt-panel">
        <NetworkPanelHeader {...headerProps} />
        <div className="dt-empty">No matching requests.</div>
      </div>
    );
  }

  const selectedRow = rowMenu ? sorted.find((r) => r.lifecycle.requestId === rowMenu.requestId) : undefined;

  return (
    <div className="dt-panel">
      <NetworkPanelHeader {...headerProps} />
      <div className={`dt-table${compact ? ' dt-table--compact' : ''}`} ref={tableRef} onScroll={onScroll}>
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
          <button
            type="button"
            className="dt-col-sort dt-col-sort--hash"
            onClick={() => handleSortTarget('id')}
            title="Sort by request number"
          >
            #{sortIndicator('id', sortKey, sortDir, columnSortActive)}
          </button>
          {columns.map((col) => (
            <div key={col.key} ref={registerCellRef(col.key)} className="dt-col-header-cell">
              <button
                type="button"
                className={`dt-col-sort ${col.align === 'right' ? 'dt-col-right' : ''}`}
                onClick={() => handleSort(col)}
                disabled={!col.sortable}
              >
                {col.key === 'waterfall' ? `Waterfall (${WATERFALL_METRIC_LABELS[waterfallMetric]})` : col.label}
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
      </div>
      {rowMenu && selectedRow && (
        <RequestContextMenu
          state={rowMenu}
          row={selectedRow}
          allRows={rows}
          onClose={() => setRowMenu(null)}
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
        />
      )}
    </div>
  );
}
