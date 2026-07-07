/**
 * Console tool-window (CDP Control Plane, Phase G2). Renders the per-tab
 * console stream the engine captures on a Debug-mode tab — the page's own
 * `console.*` output, uncaught exceptions, and the browser's own log entries
 * (failed/blocked network requests, deprecations, violations, …) — so a user
 * debugging with Open Headers never has to leave for the browser's native
 * console.
 *
 * Chrome-parity rendering: a browser network entry joins (exactly, by the
 * shared request id) to its lifecycle row and renders `METHOD url error`
 * with the URL cross-navigating to the Network row; an entry whose event (or
 * joined request) carried a stack gets a caret that expands the
 * `function @ file:line` ladder, and its location column shows the
 * initiating frame.
 *
 * Observation-only: the entries arrive over the `oh-console:<tabId>` port
 * (owned by `useConsoleClient` at the panel root, so the buffer survives
 * tool-window switches), and the only action here is a client-local Clear that
 * empties the view without touching the engine's retained log.
 *
 * Never-silent: capture only works on a CDP-attached, in-scope tab, so when
 * the inspected tab is out of that scope the view says why and (when the master
 * switch is simply off) offers to turn Debug mode on. Any already-captured
 * entries stay readable under a "capture stopped" banner rather than vanishing.
 */

import type { ConsoleEntry, ConsoleLevel, ConsoleStackFrame } from '@openheaders/core/console-stream';
import { hostNavigation } from '@openheaders/core/navigation';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConsoleRequestJoin } from '../data/console-request-join';
import { useStickToBottom } from './detail/streams/use-stick-to-bottom';
import { formatClock } from '../data/timing/format-time';
import { useInspectedTabCdp } from '../data/use-inspected-tab-cdp';
import { IconClear } from './toolbar-icons';

interface ConsoleViewProps {
  entries: readonly ConsoleEntry[];
  /** Exact join from a browser entry's `requestId` to its network row. */
  resolveRequest: (requestId: string) => ConsoleRequestJoin | null;
  /** Cross-navigate to the entry's request in the Network plane. */
  onRequestClick: (requestId: string) => void;
  /** Client-local clear — empties the view, leaves the engine log intact. */
  onClear: () => void;
  onHide: () => void;
}

type LevelFilter = 'all' | 'warnings' | 'errors';

const LEVEL_FILTERS: ReadonlyArray<{ value: LevelFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'errors', label: 'Errors' },
];

/** Severity-threshold level filter: "Warnings" keeps warnings *and* errors. */
function passesLevel(level: ConsoleLevel, filter: LevelFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'errors') return level === 'error';
  return level === 'warning' || level === 'error';
}

/**
 * A rendered source location plus the coordinates `hostNavigation.openResource`
 * needs to open it in the host's Sources panel (same mechanism as the Network
 * panel's Initiator column and call-stack view).
 */
interface ConsoleSourceLocation {
  short: string;
  full: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
}

/** Short `file:line` label for a stack frame; CDP coordinates are 0-based. */
function frameLocation(frame: ConsoleStackFrame): ConsoleSourceLocation {
  return {
    short: `${fileLabel(frame.url)}:${frame.lineNumber + 1}`,
    full: `${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`,
    url: frame.url,
    lineNumber: frame.lineNumber,
    columnNumber: frame.columnNumber,
  };
}

/** Open a location in the host's Sources panel. */
function openLocation(loc: ConsoleSourceLocation): void {
  hostNavigation.openResource(loc.url, loc.lineNumber, loc.columnNumber);
}

function fileLabel(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last || u.hostname;
  } catch {
    // Non-URL origin (eval / anonymous) — show the raw string.
    return url;
  }
}

/** CDP frame line/column numbers are 0-based; display them 1-based. */
function sourceLocation(entry: ConsoleEntry): ConsoleSourceLocation | null {
  if (!entry.url) return null;
  const line = entry.lineNumber != null ? `:${entry.lineNumber + 1}` : '';
  const col = entry.lineNumber != null && entry.columnNumber != null ? `:${entry.columnNumber + 1}` : '';
  return {
    short: `${fileLabel(entry.url)}${line}`,
    full: `${entry.url}${line}${col}`,
    url: entry.url,
    ...(entry.lineNumber != null ? { lineNumber: entry.lineNumber } : {}),
    ...(entry.columnNumber != null ? { columnNumber: entry.columnNumber } : {}),
  };
}

/**
 * The browser's network log text is "Failed to load resource: <error>"; once
 * the entry is joined to its request the method + URL replace that prefix
 * (Chrome renders `POST https://… net::ERR_BLOCKED_BY_CLIENT`).
 */
function networkErrorTail(text: string): string {
  const match = /^Failed to load resource:?\s*(.*)$/.exec(text);
  return match ? match[1] : text;
}

interface ConsoleRow {
  entry: ConsoleEntry;
  /** Index into the source `entries` array — stable across filter changes. */
  entryIndex: number;
  /** Full display text — what the text filter matches and the row titles. */
  displayText: string;
  /** Joined network row, when the entry carries a resolvable request id. */
  request: ConsoleRequestJoin | null;
  /** Error text shown after the method + URL of a joined network entry. */
  requestTail: string;
  /** Expandable ladder — the entry's own stack, else the request initiator's. */
  stack: readonly ConsoleStackFrame[] | null;
  location: ConsoleSourceLocation | null;
}

function buildRow(entry: ConsoleEntry, entryIndex: number, resolveRequest: ConsoleViewProps['resolveRequest']): ConsoleRow {
  const text = entry.args.map((a) => a.text).join(' ');
  const request = entry.requestId !== undefined ? resolveRequest(entry.requestId) : null;
  const requestTail = request !== null ? networkErrorTail(text) : '';
  const stack = entry.stackTrace ?? request?.stack ?? null;
  const location = stack !== null && stack.length > 0 ? frameLocation(stack[0]) : sourceLocation(entry);
  const displayText = request !== null ? `${request.method} ${request.url} ${requestTail}`.trimEnd() : text;
  return { entry, entryIndex, displayText, request, requestTail, stack, location };
}

export function ConsoleView({ entries, resolveRequest, onRequestClick, onClear, onHide }: ConsoleViewProps) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [textFilter, setTextFilter] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const { hasCdpCapability, cdpEnabled, cdpOwned } = useInspectedTabCdp();
  const [, setCdpEnabled] = useSetting('inspection.cdpEnabled');

  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<ConsoleRow[]>(() => {
    const needle = textFilter.trim().toLowerCase();
    const result: ConsoleRow[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!passesLevel(entry.level, levelFilter)) continue;
      const row = buildRow(entry, i, resolveRequest);
      if (
        needle &&
        !row.displayText.toLowerCase().includes(needle) &&
        !(row.location?.full.toLowerCase().includes(needle) ?? false)
      ) {
        continue;
      }
      result.push(row);
    }
    return result;
  }, [entries, levelFilter, textFilter, resolveRequest]);

  // Expansion is keyed by entry index; a cleared stream restarts at 0, so
  // stale keys must not pre-expand fresh entries.
  useEffect(() => {
    if (entries.length === 0) setExpanded((prev) => (prev.size > 0 ? new Set() : prev));
  }, [entries.length]);

  const toggleExpanded = (entryIndex: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(entryIndex)) next.add(entryIndex);
      return next;
    });
  };

  const { onScroll } = useStickToBottom(bodyRef, rows.length);

  // Capture is live only on a CDP-attached, in-scope tab. "Debug mode off" is
  // the one out-of-scope case we can resolve in place (flip the master switch);
  // an in-scope-but-unpinned tab is steered from Debug mode itself.
  const capturing = cdpOwned;
  const canEnableDebug = hasCdpCapability && !cdpEnabled;

  const enableDebug = (): void => setCdpEnabled(true);

  return (
    <div className="dt-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <div className="dt-header-filter-row">
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={onClear}
              title="Clear console"
              aria-label="Clear console"
            >
              <IconClear />
            </button>
            <div className="dt-filter-separator" />
            <input
              type="text"
              className="dt-filter-input dt-filter-input--grow"
              placeholder="Filter"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
            <div className="dt-filter-separator" />
            <div className="dt-filter-pills">
              {LEVEL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className="dt-filter-pill"
                  data-active={levelFilter === f.value}
                  onClick={() => setLevelFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="dt-console-body" ref={bodyRef} onScroll={onScroll}>
        {entries.length === 0 ? (
          <ConsoleEmpty
            hasCdpCapability={hasCdpCapability}
            cdpEnabled={cdpEnabled}
            capturing={capturing}
            onEnableDebug={canEnableDebug ? enableDebug : undefined}
          />
        ) : (
          <>
            {!capturing && (
              <div className="dt-console-banner">
                <span>
                  Capture stopped —{' '}
                  {cdpEnabled
                    ? 'this tab left Debug mode’s scope. Showing the last captured output.'
                    : 'Debug mode is off. Showing the last captured output.'}
                </span>
                {canEnableDebug && (
                  <button type="button" className="dt-btn" onClick={enableDebug}>
                    Enable Debug mode
                  </button>
                )}
              </div>
            )}
            {rows.length === 0 ? (
              <div className="dt-empty">No console entries match your filter.</div>
            ) : (
              rows.map((row) => (
                <ConsoleRowView
                  key={row.entryIndex}
                  row={row}
                  expanded={expanded.has(row.entryIndex)}
                  onToggleExpanded={toggleExpanded}
                  onRequestClick={onRequestClick}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConsoleRowViewProps {
  row: ConsoleRow;
  expanded: boolean;
  onToggleExpanded: (entryIndex: number) => void;
  onRequestClick: (requestId: string) => void;
}

function ConsoleRowView({ row, expanded, onToggleExpanded, onRequestClick }: ConsoleRowViewProps) {
  const { entry, stack, request, location } = row;
  const requestId = entry.requestId;
  const expandable = stack !== null && stack.length > 0;
  return (
    <>
      <div className="dt-console-row" data-level={entry.level} data-source={entry.source}>
        <span className="dt-console-dot" />
        {expandable ? (
          <button
            type="button"
            className="dt-console-caret"
            data-expanded={expanded}
            onClick={() => onToggleExpanded(row.entryIndex)}
            aria-label={expanded ? 'Collapse stack trace' : 'Expand stack trace'}
            aria-expanded={expanded}
          >
            <svg viewBox="0 0 8 8" role="img" aria-hidden="true">
              <path d="M2 0 L6 4 L2 8 Z" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <span className="dt-console-caret" />
        )}
        <span className="dt-console-time">{formatClock(entry.timestamp, 'local')}</span>
        <span className="dt-console-msg" title={row.displayText}>
          {request !== null && requestId !== undefined ? (
            <>
              {request.method}{' '}
              <button type="button" className="dt-console-req-link" onClick={() => onRequestClick(requestId)}>
                {request.url}
              </button>
              {row.requestTail.length > 0 ? ` ${row.requestTail}` : ''}
            </>
          ) : (
            row.displayText
          )}
        </span>
        {location && (
          <button
            type="button"
            className="dt-console-loc dt-console-loc--link"
            title={location.full}
            onClick={() => openLocation(location)}
          >
            {location.short}
          </button>
        )}
      </div>
      {expandable && expanded && (
        <div className="dt-console-stack" data-level={entry.level}>
          {stack.map((frame, i) => {
            const loc = frameLocation(frame);
            return (
              <div key={`${frame.url}:${frame.lineNumber}:${i}`} className="dt-console-frame">
                <span className="dt-console-frame-fn">{frame.functionName || '(anonymous)'}</span>
                <span className="dt-console-frame-at">@</span>
                <button
                  type="button"
                  className="dt-console-frame-loc dt-console-loc--link"
                  title={loc.full}
                  onClick={() => openLocation(loc)}
                >
                  {loc.short}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

interface ConsoleEmptyProps {
  hasCdpCapability: boolean;
  cdpEnabled: boolean;
  capturing: boolean;
  onEnableDebug?: () => void;
}

function ConsoleEmpty({ hasCdpCapability, cdpEnabled, capturing, onEnableDebug }: ConsoleEmptyProps) {
  if (!hasCdpCapability) {
    return (
      <div className="dt-empty-hero">
        <strong>Console capture needs Debug mode</strong>
        <span className="dt-empty-hero-sub">Debug-mode inspection isn’t available in this browser.</span>
      </div>
    );
  }
  if (capturing) {
    return (
      <div className="dt-empty-hero">
        <strong>No console output yet</strong>
        <span className="dt-empty-hero-sub">
          This tab’s log messages and uncaught exceptions will appear here as they happen.
        </span>
      </div>
    );
  }
  if (!cdpEnabled) {
    return (
      <div className="dt-empty-hero">
        <strong>Enable Debug mode to view console logs</strong>
        <span className="dt-empty-hero-sub">
          Open Headers captures this tab’s console output and uncaught exceptions while Debug mode is on.
        </span>
        {onEnableDebug && (
          <button type="button" className="dt-btn dt-btn-primary" onClick={onEnableDebug}>
            Enable Debug mode
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="dt-empty-hero">
      <strong>This tab is outside Debug mode’s scope</strong>
      <span className="dt-empty-hero-sub">
        Bring it into scope from Debug mode — change the scope or pin this tab — to capture its console output.
      </span>
    </div>
  );
}
