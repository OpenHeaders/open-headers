import { hostNavigation } from '@openheaders/core/navigation';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type {
  DevpanelNetworkSortBySetting,
  DevpanelNetworkSortDirSetting,
  NetworkCustomNestedLevel,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterConfig, FilterToken } from '../data/filter-engine';
import { matchesUrlFilter, passesRowFilters } from '../data/filter-engine';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import { lifecycleDurationMs } from '../data/inspector-row-projection';
import {
  buildCustomNestedComparator,
  NETWORK_SORT_MODE_COMPARATORS,
  type NetworkSortMode,
} from '../data/network-sort-modes';
import { classifyRequestState, type RequestState, rowStateClass, statusText } from '../data/request-state';
import { formatSizeInfo, getSizeInfo, type SizeInfo } from '../data/size-info';
import { isAppliedFire } from '../data/types';
import { FilterInput } from './FilterInput';
import { ResourceFilter } from './ResourceFilter';
import { ColumnHeaderContextMenu, type ColumnHeaderContextMenuState } from './traffic/ColumnHeaderContextMenu';
import type { ColumnDef, ColumnKey } from './traffic/columns';
import { COLUMN_DEFS, columnTrack, DEFAULT_COLUMN_MIN_WIDTH, DEFAULT_VISIBLE_COLUMNS } from './traffic/columns';
import { extractName, formatInitiator, formatTimestamp, getInitiatorFrame, statusClass } from './traffic/formatters';
import { NetworkViewMenu } from './traffic/NetworkViewMenu';
import { derivePreflightPairs, getRole, type PreflightIndex } from './traffic/preflight-pairs';
import { RequestContextMenu, type RequestContextMenuState } from './traffic/RequestContextMenu';
import ResourceIcon from './traffic/ResourceIcon';
import { matchesResourceType, normalizeResourceType, RESOURCE_LABEL } from './traffic/resource-types';
import { currentHarEntry } from '../data/inspector-row-projection';
import { WaterfallBar } from './traffic/WaterfallBar';

type SortDir = DevpanelNetworkSortDirSetting;

/**
 * Sort target. `'id'` is the synthetic leading `#` column — not part
 * of the toggleable registry but always sortable. Everything else
 * maps to a `ColumnKey` in `COLUMN_DEFS`.
 */
type SortTarget = DevpanelNetworkSortBySetting;

function sortValueOf(row: InspectorRowWithFires, target: SortTarget): string | number {
  if (target === 'id') return row.displayId;
  return COLUMN_DEFS[target].getSortValue(row);
}

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

interface NetworkPanelHeaderProps {
  urlFilter: string;
  onUrlFilterChange: (v: string) => void;
  filterConfig: FilterConfig;
  onFilterConfigChange: (cfg: FilterConfig) => void;
  filterError: boolean;
  docsActive: boolean;
  onToggleDocs: () => void;
  filter: ReadonlySet<string>;
  onFilterChange: (next: Set<string>) => void;
  showFilter: boolean;
  onHide: () => void;
  viewMenu: React.ReactNode;
}

function NetworkPanelHeader({
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
}: NetworkPanelHeaderProps) {
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  if (!showFilter) {
    return <PanelHeader wiring={headerWiring} title={<strong>Network</strong>} />;
  }

  return (
    <PanelHeader
      wiring={headerWiring}
      title={
        <div className="dt-network-filter-row">
          <FilterInput
            value={urlFilter}
            onChange={onUrlFilterChange}
            config={filterConfig}
            onConfigChange={onFilterConfigChange}
            hasError={filterError}
            placeholder="Filter"
          />
          <button
            type="button"
            className="dt-toolbar-icon"
            data-active={docsActive}
            onClick={onToggleDocs}
            title="Filter syntax help"
          >
            <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <text
                x="8"
                y="12"
                textAnchor="middle"
                fill="currentColor"
                fontSize="10"
                fontFamily="serif"
                fontStyle="italic"
              >
                i
              </text>
            </svg>
          </button>
          <div className="dt-filter-separator" />
          <ResourceFilter value={filter} onChange={onFilterChange} compact />
          {viewMenu}
        </div>
      }
    />
  );
}

function sortIndicator(
  col: SortTarget,
  sortKey: SortTarget,
  sortDir: SortDir,
  active: boolean,
): string {
  if (!active || col !== sortKey) return '';
  return sortDir === 'asc' ? ' ▴' : ' ▾';
}

function sortCompare(a: InspectorRowWithFires, b: InspectorRowWithFires, target: SortTarget, dir: SortDir): number {
  const va = sortValueOf(a, target);
  const vb = sortValueOf(b, target);
  let cmp: number;
  if (typeof va === 'number' && typeof vb === 'number') {
    cmp = va - vb;
  } else {
    cmp = String(va).localeCompare(String(vb));
  }
  if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  // Stable tiebreak: arrival order via `displayId`. Always ascending so
  // a `desc` sort still presents each tie group in arrival order rather
  // than reversing it.
  return a.displayId - b.displayId;
}

interface CellContext {
  waterfall: { t0: number; tMax: number };
  preflight: PreflightIndex;
  onJumpTo: (requestId: string) => void;
}

/**
 * Render the cell for a specific column.
 */
function renderCell(
  col: ColumnDef,
  row: InspectorRowWithFires,
  state: RequestState,
  sizeInfo: SizeInfo,
  ctx: CellContext,
) {
  const lc = row.lifecycle;
  const requestId = lc.requestId;
  const role = getRole(ctx.preflight, requestId);
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
    const text = statusText(state, lc);
    return (
      <span className={statusClass(state, lc.statusCode)} title={text}>
        {text}
      </span>
    );
  }
  if (col.key === 'timestamp') {
    return <span className="dt-col-muted">{formatTimestamp(lc.startedAtMs)}</span>;
  }
  if (col.key === 'type') {
    const rawType = normalizeResourceType(lc.resourceType);
    return <span>{RESOURCE_LABEL[rawType] ?? rawType}</span>;
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
    return <WaterfallBar row={row} t0={ctx.waterfall.t0} tMax={ctx.waterfall.tMax} />;
  }
  if (col.key === 'size') {
    if (sizeInfo.kind === 'pending') {
      return (
        <span className="dt-col-right dt-col-cache" title="Response body not received yet">
          Pending…
        </span>
      );
    }
    if (sizeInfo.kind === 'cached') {
      const label = formatSizeInfo(sizeInfo);
      return (
        <span className="dt-col-right dt-col-cache" title={`Served from ${sizeInfo.source} cache`}>
          {label}
        </span>
      );
    }
    const { transferred, resource } = sizeInfo;
    if (transferred == null && resource == null) return <span className="dt-col-right" />;
    if (transferred != null && resource != null && resource > transferred) {
      return (
        <span className="dt-col-right" title={`Transferred: ${transferred} B · Resource: ${resource} B`}>
          {formatSizeInfo(sizeInfo)}
        </span>
      );
    }
    return <span className="dt-col-right">{formatSizeInfo(sizeInfo)}</span>;
  }
  const value = col.extract(row);
  const className = col.align === 'right' ? 'dt-col-right' : '';
  return <span className={className}>{value == null ? '' : value}</span>;
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
  const [layout, setLayout] = useSetting('devpanelNetwork.layout');
  const [sortKind, setSortKind] = useSetting('devpanelNetwork.sortKind');
  const [sortMode, setSortMode] = useSetting('devpanelNetwork.sortMode');
  const [sortKey, setSortKey] = useSetting('devpanelNetwork.sortBy');
  const [sortDir, setSortDir] = useSetting('devpanelNetwork.sortDir');
  const [showFireDots, setShowFireDots] = useSetting('devpanelNetwork.showFireDots');
  // Custom-nested levels are session-scoped scratch state.
  const [customNested, setCustomNested] = useState<NetworkCustomNestedLevel[]>([]);
  const compact = layout === 'compact';
  const toggleShowFireDots = useCallback(() => setShowFireDots(!showFireDots), [showFireDots, setShowFireDots]);
  const handleSortModeChange = useCallback(
    (m: NetworkSortMode) => {
      setSortKind('mode');
      setSortMode(m);
    },
    [setSortKind, setSortMode],
  );
  const handleUseColumnSort = useCallback(() => setSortKind('column'), [setSortKind]);
  const handleUseCustomNested = useCallback(() => setSortKind('customNested'), [setSortKind]);
  const sortByLabel = sortKey === 'id' ? '# (Arrival)' : COLUMN_DEFS[sortKey].label;

  const viewMenu = (
    <NetworkViewMenu
      layout={layout}
      sortKind={sortKind}
      sortMode={sortMode}
      sortBy={sortKey}
      sortDir={sortDir}
      customNested={customNested}
      showFireDots={showFireDots}
      sortByLabel={sortByLabel}
      onLayoutChange={setLayout}
      onSortModeChange={handleSortModeChange}
      onUseColumnSort={handleUseColumnSort}
      onCustomNestedChange={setCustomNested}
      onUseCustomNested={handleUseCustomNested}
      onToggleShowFireDots={toggleShowFireDots}
    />
  );

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
  const tableRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimerRef.current != null) clearTimeout(flashTimerRef.current);
    };
  }, []);
  const handleJumpTo = useCallback(
    (requestId: string) => {
      onSelect(requestId);
      const root = tableRef.current;
      if (root) {
        const r = root.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(requestId)}"]`);
        if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      setFlashId(requestId);
      if (flashTimerRef.current != null) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashId(null), 1000);
    },
    [onSelect],
  );

  const [rowMenu, setRowMenu] = useState<RequestContextMenuState | null>(null);
  const [colMenu, setColMenu] = useState<ColumnHeaderContextMenuState | null>(null);

  // ── Column widths (user-resizable) ──────────────────────────
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>({});

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

  const cellRefs = useRef<Map<ColumnKey, HTMLDivElement>>(new Map());
  const registerCellRef = useCallback(
    (key: ColumnKey) => (el: HTMLDivElement | null) => {
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  const beginResize = useCallback((e: React.PointerEvent<HTMLElement>, columnKey: ColumnKey) => {
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

  const handleSortTarget = (target: SortTarget) => {
    setSortKind('column');
    if (sortKind === 'column' && target === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(target);
      setSortDir('asc');
    }
  };

  const handleSort = (col: ColumnDef) => {
    if (!col.sortable) return;
    handleSortTarget(col.key);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const lc = r.lifecycle;
      if (!passesRowFilters(lc, filterConfig)) return false;
      if (!matchesResourceType(lc.resourceType, filter)) return false;
      if (filterTokens.length > 0 && !matchesUrlFilter(lc, filterTokens, filterConfig)) return false;
      return true;
    });
  }, [rows, filter, filterTokens, filterConfig]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortKind === 'column') {
      arr.sort((a, b) => sortCompare(a, b, sortKey, sortDir));
    } else if (sortKind === 'customNested' && customNested.length > 0) {
      arr.sort(buildCustomNestedComparator(customNested));
    } else {
      arr.sort(NETWORK_SORT_MODE_COMPARATORS[sortMode]);
    }
    return arr;
  }, [filtered, sortKind, sortKey, sortDir, sortMode, customNested]);

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

  useEffect(() => {
    const el = tableRef.current;
    if (!el || sorted.length <= prevCountRef.current) {
      prevCountRef.current = sorted.length;
      return;
    }
    prevCountRef.current = sorted.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sorted.length]);

  const toggleColumn = (key: ColumnKey) => {
    const next = new Set(visibleColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    next.add('name');
    onVisibleColumnsChange(next);
  };

  const resetColumns = () => {
    onVisibleColumnsChange(new Set(DEFAULT_VISIBLE_COLUMNS));
    setColumnWidths({});
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
      <div className={`dt-table${compact ? ' dt-table--compact' : ''}`} ref={tableRef}>
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
            title="Sort by arrival order"
          >
            #{sortIndicator('id', sortKey, sortDir, sortKind === 'column')}
          </button>
          {columns.map((col) => (
            <div key={col.key} ref={registerCellRef(col.key)} className="dt-col-header-cell">
              <button
                type="button"
                className={`dt-col-sort ${col.align === 'right' ? 'dt-col-right' : ''}`}
                onClick={() => handleSort(col)}
                disabled={!col.sortable}
              >
                {col.label}
                {col.sortable && sortIndicator(col.key, sortKey, sortDir, sortKind === 'column')}
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
        {sorted.map((row) => {
          const state = classifyRequestState(row.lifecycle);
          const sizeInfo = getSizeInfo(row.lifecycle, state);
          const stateClass = rowStateClass(state);
          const requestId = row.lifecycle.requestId;
          return (
            <button
              key={requestId}
              type="button"
              className={`dt-row dt-cols${stateClass ? ` ${stateClass}` : ''}${requestId === flashId ? ' dt-row--flash' : ''}`}
              data-selected={requestId === selectedId}
              data-row-id={requestId}
              onClick={() => onSelect(requestId)}
              onContextMenu={(e) => {
                e.preventDefault();
                setRowMenu({ x: e.clientX, y: e.clientY, requestId });
              }}
              title={row.lifecycle.url}
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
              <span className="dt-col-muted" style={{ textAlign: 'right' }}>
                {row.displayId}
              </span>
              {columns.map((col) => (
                <span key={col.key}>
                  {renderCell(col, row, state, sizeInfo, { waterfall: { t0, tMax }, preflight, onJumpTo: handleJumpTo })}
                </span>
              ))}
            </button>
          );
        })}
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
