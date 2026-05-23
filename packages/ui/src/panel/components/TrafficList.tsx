import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type {
  DevpanelNetworkSortBySetting,
  DevpanelNetworkSortDirSetting,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { NetworkViewMenu } from './traffic/NetworkViewMenu';
import {
  buildCustomNestedComparator,
  NETWORK_SORT_MODE_COMPARATORS,
  type NetworkSortMode,
} from '../data/network-sort-modes';
import type { NetworkCustomNestedLevel } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { FilterConfig, FilterToken } from '../data/filter-engine';
import { matchesUrlFilter, passesRowFilters } from '../data/filter-engine';
import { classifyRequestState, type RequestState, rowStateClass, statusText } from '../data/request-state';
import { formatSizeInfo, getSizeInfo, type SizeInfo } from '../data/size-info';
import { type InspectorRequest, isAppliedFire } from '../data/types';
import { FilterInput } from './FilterInput';
import { ResourceFilter } from './ResourceFilter';
import { ColumnHeaderContextMenu, type ColumnHeaderContextMenuState } from './traffic/ColumnHeaderContextMenu';
import type { ColumnDef, ColumnKey } from './traffic/columns';
import { COLUMN_DEFS, columnTrack, DEFAULT_COLUMN_MIN_WIDTH, DEFAULT_VISIBLE_COLUMNS } from './traffic/columns';
import { extractName, formatInitiator, formatTimestamp, statusClass } from './traffic/formatters';
import { derivePreflightPairs, getRole, type PreflightIndex } from './traffic/preflight-pairs';
import { RequestContextMenu, type RequestContextMenuState } from './traffic/RequestContextMenu';
import ResourceIcon from './traffic/ResourceIcon';
import { matchesResourceType, normalizeResourceType, RESOURCE_LABEL } from './traffic/resource-types';
import { WaterfallBar } from './traffic/WaterfallBar';

type SortDir = DevpanelNetworkSortDirSetting;

/**
 * Sort target. `'id'` is the synthetic leading `#` column — not part
 * of the toggleable registry but always sortable. Everything else
 * maps to a `ColumnKey` in `COLUMN_DEFS`.
 */
type SortTarget = DevpanelNetworkSortBySetting;

function sortValueOf(entry: InspectorRequest, target: SortTarget): string | number {
  if (target === 'id') return entry.arrivalIndex;
  return COLUMN_DEFS[target].getSortValue(entry);
}

interface TrafficListProps {
  entries: readonly InspectorRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
  onSaveAsHar: (entry: InspectorRequest) => void;
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
  /** When on, the header's action slot hosts the full filter row
   *  (input + (i) + compact resource pills + More ▾). When off, the
   *  header falls back to a quiet "Network" title. Toggled by the
   *  filter icon on the top toolbar. */
  showFilter: boolean;
  onHide: () => void;
  viewMenu: React.ReactNode;
}

/**
 * Network panel's header row — lives on the card itself (not the
 * top-level toolbar) so the filter input + resource pills travel with
 * the panel when it's hidden/shown. Giving the whole 32px band to
 * the filter controls saves vertical real estate. The filter row
 * mounts in the `title` slot rather than `actions`: the title slot
 * already has `flex: 1` baked into the shared stylesheet, so a
 * flex-grow input inside it expands predictably. When the user toggles
 * the filter off on the top toolbar, we collapse the header to a
 * neutral "Network" title so the card stays identifiable without
 * occupying the row with controls the user just chose to hide.
 */
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
  return sortDir === 'asc' ? ' \u25b4' : ' \u25be';
}

function sortCompare(a: InspectorRequest, b: InspectorRequest, target: SortTarget, dir: SortDir): number {
  const va = sortValueOf(a, target);
  const vb = sortValueOf(b, target);
  let cmp: number;
  if (typeof va === 'number' && typeof vb === 'number') {
    cmp = va - vb;
  } else {
    cmp = String(va).localeCompare(String(vb));
  }
  return dir === 'asc' ? cmp : -cmp;
}

interface CellContext {
  waterfall: { t0: number; tMax: number };
  preflight: PreflightIndex;
  onJumpTo: (id: string) => void;
}

/**
 * Render the cell for a specific column — kept as a function so the
 * Name column (which needs the resource icon + extracted name/detail)
 * and the Status column (which colors by status code) can branch off
 * the default `col.extract` path cleanly.
 */
function renderCell(
  col: ColumnDef,
  entry: InspectorRequest,
  state: RequestState,
  sizeInfo: SizeInfo,
  ctx: CellContext,
) {
  const role = getRole(ctx.preflight, entry.id);
  if (col.key === 'name') {
    const rawType = normalizeResourceType(entry.resourceType);
    const { name } = extractName(entry.url);
    return (
      <span className="dt-col-name">
        <ResourceIcon type={rawType} />
        <span className="dt-col-name-text">{name}</span>
      </span>
    );
  }
  if (col.key === 'method') {
    // "<METHOD> + Preflight" on the parent, with the "Preflight" text
    // linking back to the preflight row. Matches Chrome DevTools.
    if (role.kind === 'parent') {
      return (
        <span>
          {entry.method}
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
    return <span>{entry.method}</span>;
  }
  if (col.key === 'status') {
    // Text + colour derive from the state taxonomy — `(pending)`,
    // `(blocked)`, `(failed)`, `200`, `302`, etc. The compact column
    // can still overflow long `net::ERR_*` messages; the tooltip
    // surfaces the full text.
    const text = statusText(state, entry);
    return (
      <span className={statusClass(state, entry.statusCode)} title={text}>
        {text}
      </span>
    );
  }
  if (col.key === 'timestamp') {
    return <span className="dt-col-muted">{formatTimestamp(entry.timestamp)}</span>;
  }
  if (col.key === 'type') {
    const rawType = normalizeResourceType(entry.resourceType);
    return <span>{RESOURCE_LABEL[rawType] ?? rawType}</span>;
  }
  if (col.key === 'initiator') {
    // For preflight rows, Chrome shows "Preflight" linking to the
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
            title="Jump to the originating request"
          >
            Preflight
          </button>
        </span>
      );
    }
    return <span className="dt-col-muted">{formatInitiator(entry.harEntry._initiator)}</span>;
  }
  if (col.key === 'waterfall') {
    return <WaterfallBar entry={entry} t0={ctx.waterfall.t0} tMax={ctx.waterfall.tMax} />;
  }
  if (col.key === 'size') {
    // The size column collapses three concerns into one:
    //   - pending responses show `Pending…`
    //   - cached responses show `(disk cache)` / `(memory cache)` /
    //     `(ServiceWorker)` in muted italics — matches Chrome
    //   - wire responses show `transferred / resource` when
    //     compressed, or a single number otherwise
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
      // Two-number display — primary is wire-bytes, secondary is
      // decoded. Users care about both: transferred = what the network
      // paid, resource = what the page parses.
      return (
        <span className="dt-col-right" title={`Transferred: ${transferred} B · Resource: ${resource} B`}>
          {formatSizeInfo(sizeInfo)}
        </span>
      );
    }
    return <span className="dt-col-right">{formatSizeInfo(sizeInfo)}</span>;
  }
  const value = col.extract(entry);
  const className = col.align === 'right' ? 'dt-col-right' : '';
  return <span className={className}>{value == null ? '' : value}</span>;
}

export function TrafficList({
  entries,
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
  // Custom-nested levels are session-scoped scratch state (the
  // settings registry doesn't carry arbitrary JSON). If the persisted
  // sortKind is 'customNested' but the levels array is empty after a
  // panel reload, the comparator falls back to plain arrival.
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

  const [rowMenu, setRowMenu] = useState<RequestContextMenuState | null>(null);
  const [colMenu, setColMenu] = useState<ColumnHeaderContextMenuState | null>(null);

  // ── Column widths (user-resizable) ──────────────────────────
  //
  // We store user overrides as `Partial<Record<ColumnKey, number>>`.
  // A column with no override uses its registry default (or `1fr` for
  // stretchy columns). Resetting via the column menu clears overrides,
  // which restores the stretch-based layout. Widths are session-scoped
  // — matches Chrome's Network tab behaviour where resizes don't
  // persist across DevTools re-opens.
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>({});

  const columns = useMemo<ColumnDef[]>(() => {
    // Preserve the order defined in DEFAULT_VISIBLE_COLUMNS so we get
    // Timestamp → Method → Name → ... regardless of toggle order. Any
    // column not in the default list (e.g. Path, URL, Scheme) appends
    // after the defaults in registry order.
    const order: ColumnKey[] = [];
    for (const k of DEFAULT_VISIBLE_COLUMNS) if (visibleColumns.has(k)) order.push(k);
    for (const k of Object.keys(COLUMN_DEFS) as ColumnKey[]) {
      if (!order.includes(k) && visibleColumns.has(k)) order.push(k);
    }
    return order.map((k) => COLUMN_DEFS[k]);
  }, [visibleColumns]);

  const gridTemplate = useMemo(() => {
    // Leading fixed columns: rule-fire dot (empty or colored, gated by
    // the showFireDots setting) then the sequential display id. Keep
    // them narrow — status surface only, not content-driven.
    const tracks: string[] = [];
    if (showFireDots) tracks.push('14px');
    tracks.push('32px');
    for (const c of columns) tracks.push(columnTrack(c, columnWidths[c.key], compact));
    return tracks.join(' ');
  }, [columns, columnWidths, compact, showFireDots]);

  // Per-column-header refs. A Map rather than an object so the "set
  // callback ref" closure doesn't depend on the key set at compile
  // time — this lets us register a ref for any ColumnKey as columns
  // become visible. The ref is the header-cell wrapper, whose rendered
  // width is authoritative for stretchy columns (their width is
  // browser-computed from `1fr`, not registry-default).
  const cellRefs = useRef<Map<ColumnKey, HTMLDivElement>>(new Map());
  const registerCellRef = useCallback(
    (key: ColumnKey) => (el: HTMLDivElement | null) => {
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  // Resize a column by dragging its right-edge grip. We measure the
  // live rendered width from the cell's ref (so stretchy columns
  // convert to their actual pixel size at the moment drag starts, not
  // their registry default) and apply deltas live. Esc aborts.
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
    // Any column-header click pulls the table out of mode-sort and
    // into column-sort. The previously-active mode is left intact so
    // the user can switch back to it from the View menu.
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
    return entries.filter((e) => {
      if (!passesRowFilters(e, filterConfig)) return false;
      if (!matchesResourceType(e.resourceType, filter)) return false;
      if (filterTokens.length > 0 && !matchesUrlFilter(e, filterTokens, filterConfig)) return false;
      return true;
    });
  }, [entries, filter, filterTokens, filterConfig]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortKind === 'column') {
      arr.sort((a, b) => sortCompare(a, b, sortKey, sortDir));
    } else if (sortKind === 'customNested' && customNested.length > 0) {
      arr.sort(buildCustomNestedComparator(customNested));
    } else {
      // 'mode', or 'customNested' with an empty level list (e.g. after
      // a panel reload that lost the session state) — fall back to the
      // configured mode comparator.
      arr.sort(NETWORK_SORT_MODE_COMPARATORS[sortMode]);
    }
    return arr;
  }, [filtered, sortKind, sortKey, sortDir, sortMode, customNested]);

  // Preflight pairing — derived from all entries (not filtered) so a
  // preflight whose parent is filtered out still renders as "preflight"
  // with a dead link resolver. Kept at the full-entry scope so the
  // parent lookup is stable across filter changes.
  const preflight = useMemo(() => derivePreflightPairs(entries), [entries]);

  // Waterfall reference window: earliest start vs. latest finish across
  // the visible, sorted rows. Recomputed with the rows so the bars
  // re-scale as filters change.
  const [t0, tMax] = useMemo(() => {
    if (sorted.length === 0) return [0, 1];
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const e of sorted) {
      if (e.timestamp < min) min = e.timestamp;
      const end = e.timestamp + (e.duration && e.duration > 0 ? e.duration : 0);
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
    // Name is mandatory — safety net even though the menu disables it.
    next.add('name');
    onVisibleColumnsChange(next);
  };

  const resetColumns = () => {
    onVisibleColumnsChange(new Set(DEFAULT_VISIBLE_COLUMNS));
    setColumnWidths({});
  };

  if (filtered.length === 0) {
    if (entries.length === 0) {
      return (
        <div className="dt-panel">
          <NetworkPanelHeader {...headerProps} />
          <div className="dt-empty-hero">
            <strong>{recording ? 'Recording network activity\u2026' : 'No network activity recorded'}</strong>
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

  const selectedEntry = rowMenu ? sorted.find((e) => e.id === rowMenu.requestId) : undefined;

  return (
    <div className="dt-panel">
      <NetworkPanelHeader {...headerProps} />
      {/* Header + rows share one scroll container so horizontal scroll
          moves them in lockstep — the header uses `position: sticky`
          on its top edge to stay pinned against vertical scroll. */}
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
              {/* Resize grip — every column is resizable; double-click
                  restores the registry default width. Modeled as a
                  presentation-role button so it's focusable for keyboard
                  navigation without participating in the header's semantic
                  grid row. */}
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
        {sorted.map((entry) => {
          // One classifier pass per row; cells + row class branch off
          // the same `RequestState` so they can never disagree. Size
          // info is a companion derivation that reuses the state.
          const state = classifyRequestState(entry);
          const sizeInfo = getSizeInfo(entry, state);
          const stateClass = rowStateClass(state);
          return (
            <button
              key={entry.id}
              type="button"
              className={`dt-row dt-cols${stateClass ? ` ${stateClass}` : ''}`}
              data-selected={entry.id === selectedId}
              onClick={() => onSelect(entry.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setRowMenu({ x: e.clientX, y: e.clientY, requestId: entry.id });
              }}
              title={entry.url}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {showFireDots && (
                <span className="dt-col-dot">
                  {entry.fires.length > 0 && (
                    <span
                      className={`dt-fire-dot ${entry.fires.some(isAppliedFire) ? 'dt-fire-dot--auth' : 'dt-fire-dot--inferred'}`}
                    />
                  )}
                </span>
              )}
              <span className="dt-col-muted" style={{ textAlign: 'right' }}>
                {entry.displayId}
              </span>
              {columns.map((col) => (
                <span key={col.key}>
                  {renderCell(col, entry, state, sizeInfo, { waterfall: { t0, tMax }, preflight, onJumpTo: onSelect })}
                </span>
              ))}
            </button>
          );
        })}
      </div>
      {rowMenu && selectedEntry && (
        <RequestContextMenu
          state={rowMenu}
          request={selectedEntry}
          allEntries={entries}
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
