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

import { CheckOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { ConsoleEntry, ConsoleStackFrame } from '@openheaders/core/console-stream';
import type { JsContext } from '@openheaders/core/js-contexts';
import { hostNavigation } from '@openheaders/core/navigation';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveContextSelection, topContextKey } from '../data/console-context-selector';
import {
  DEFAULT_LEVELS,
  isCustomLevels,
  LEVEL_MENU_ITEMS,
  levelMenuLabel,
  passesLevelMask,
} from '../data/console-levels';
import { noteTopContext, setConsolePrefs, useConsolePrefs } from '../data/console-prefs';
import type { ConsoleRequestJoin } from '../data/console-request-join';
import {
  frameKey,
  type ResolvedFramePosition,
  sourceFileLabel,
  useResolvedFrames,
} from '../data/initiator/use-resolved-frames';
import { useStickToBottom } from './detail/streams/use-stick-to-bottom';
import { formatClock } from '../data/timing/format-time';
import { useInspectedTabCdp } from '../data/use-inspected-tab-cdp';
import { ConsoleContextSelector } from './ConsoleContextSelector';
import { ConsolePrompt } from './ConsolePrompt';
import { IconClear, IconCollapseAll, IconExpandAll, IconGear } from './toolbar-icons';
import { ToolbarMenuPopover } from './ToolbarMenuPopover';

interface ConsoleViewProps {
  entries: readonly ConsoleEntry[];
  /** Live JS execution contexts of the inspected tab (the selector's list). */
  contexts: readonly JsContext[];
  /** Exact join from a browser entry's `requestId` to its network row. */
  resolveRequest: (requestId: string) => ConsoleRequestJoin | null;
  /** Cross-navigate to the entry's request in the Network plane. */
  onRequestClick: (requestId: string) => void;
  /** Client-local clear — empties the view, leaves the engine log intact. */
  onClear: () => void;
  onHide: () => void;
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

type ResolvedFrames = ReadonlyMap<string, ResolvedFramePosition>;

/**
 * A frame's display location, source-map resolved when the map is in — the
 * browser's console shows `hydro-analytics.ts:120`, not the generated
 * `environment-…js:2`. The click target stays the GENERATED position: the
 * host's Sources panel applies the source map itself (same contract as the
 * Network call-stack view).
 */
function resolvedFrameLocation(frame: ConsoleStackFrame, resolved: ResolvedFrames): ConsoleSourceLocation {
  const pos = resolved.get(frameKey(frame));
  if (pos?.source != null && pos.line != null) {
    return {
      short: `${sourceFileLabel(pos.source)}:${pos.line + 1}`,
      full: `${pos.source}:${pos.line + 1} (generated: ${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1})`,
      url: frame.url,
      lineNumber: frame.lineNumber,
      columnNumber: frame.columnNumber,
    };
  }
  return frameLocation(frame);
}

/** A frame's display name — the source-map original when resolved, else the
 *  V8 name, else `(anonymous)`. */
function resolvedFrameName(frame: ConsoleStackFrame, resolved: ResolvedFrames): string {
  const pos = resolved.get(frameKey(frame));
  return pos?.name ?? (frame.functionName || '(anonymous)');
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
 * the entry is joined to its request, the browser's console replaces that
 * whole text with `METHOD url <failure>` — `POST https://…
 * net::ERR_BLOCKED_BY_CLIENT` for a blocked request, `GET https://… 404
 * (Not Found)` for an HTTP error. Reduce the wire text to that failure tail.
 */
function networkErrorTail(text: string): string {
  const status = /^Failed to load resource: the server responded with a status of (.*)$/.exec(text);
  if (status) return status[1];
  const failure = /^Failed to load resource:?\s*(.*)$/.exec(text);
  return failure ? failure[1] : text;
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

export function ConsoleView({ entries, contexts, resolveRequest, onRequestClick, onClear, onHide }: ConsoleViewProps) {
  const [textFilter, setTextFilter] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const { hasCdpCapability, cdpEnabled, cdpOwned } = useInspectedTabCdp();
  const [, setCdpEnabled] = useSetting('inspection.cdpEnabled');

  // Console settings + level mask live in a panel-session store (the view
  // unmounts on tool-window switches; the settings must not reset with it).
  const prefs = useConsolePrefs();

  // Context selection (Phase C): an explicit pick holds while its context is
  // live, then falls back to `top` (navigation clears the picked context, so
  // the browser's reset-on-nav comes for free). Selection drives evaluation
  // (Phase D) and the highlight; hiding other contexts' rows is the separate
  // "Selected context only" toggle in the settings pane.
  const [pickedContextKey, setPickedContextKey] = useState<string | null>(null);
  const effectiveContextKey = resolveContextSelection(contexts, pickedContextKey);
  useEffect(() => {
    // Drop a pick whose context died so the next explicit pick starts clean.
    if (pickedContextKey !== null && !contexts.some((c) => c.contextKey === pickedContextKey)) {
      setPickedContextKey(null);
    }
  }, [contexts, pickedContextKey]);

  // Preserve-log semantics: a recreated `top` context is a navigation —
  // without "Preserve log" the view cuts to the entries arriving from there.
  // A shrinking buffer (client-local Clear) re-bases the cutoff.
  const topKey = topContextKey(contexts);
  useEffect(() => {
    noteTopContext(topKey, entries.length);
  }, [topKey, entries.length]);
  useEffect(() => {
    if (entries.length < prefs.cutoff) setConsolePrefs({ cutoff: entries.length });
  }, [entries.length, prefs.cutoff]);
  const cutoff = Math.min(prefs.cutoff, entries.length);

  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<ConsoleRow[]>(() => {
    const needle = textFilter.trim().toLowerCase();
    const result: ConsoleRow[] = [];
    for (let i = cutoff; i < entries.length; i++) {
      const entry = entries[i];
      if (!passesLevelMask(entry.level, prefs.levels)) continue;
      // "Hide network" hides the browser's own network log entries (failed /
      // blocked requests) — the page's console.* output always stays.
      if (prefs.hideNetwork && entry.source === 'browser' && entry.category === 'network') continue;
      // "Selected context only" hides rows from other contexts by their
      // `contextKey` join; entries with no key (browser-plane log entries,
      // pre-upgrade backlog) are never hidden.
      if (
        prefs.selectedContextOnly &&
        effectiveContextKey !== null &&
        entry.contextKey !== undefined &&
        entry.contextKey !== effectiveContextKey
      ) {
        continue;
      }
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
  }, [
    entries,
    cutoff,
    prefs.levels,
    prefs.hideNetwork,
    prefs.selectedContextOnly,
    textFilter,
    resolveRequest,
    effectiveContextKey,
  ]);

  // Source-map resolution over every distinct frame the visible rows carry —
  // the same cache + host fetcher the Network call-stack view uses, so
  // labels read `hydro-analytics.ts:120`, not the generated bundle position.
  const allFrames = useMemo<ConsoleStackFrame[]>(() => {
    const byKey = new Map<string, ConsoleStackFrame>();
    for (const row of rows) {
      if (row.stack === null) continue;
      for (const frame of row.stack) byKey.set(frameKey(frame), frame);
    }
    return [...byKey.values()];
  }, [rows]);
  const resolvedFrames = useResolvedFrames(allFrames);

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

  // Expand-all / collapse-all toggle over the visible rows that carry a
  // stack — the browser's single toolbar button beside Clear.
  const expandableIndexes = useMemo(
    () => rows.filter((row) => row.stack !== null && row.stack.length > 0).map((row) => row.entryIndex),
    [rows],
  );
  const allExpanded = expandableIndexes.length > 0 && expandableIndexes.every((i) => expanded.has(i));
  const toggleAllExpanded = (): void => {
    setExpanded(allExpanded ? new Set() : new Set(expandableIndexes));
  };

  const { onScroll } = useStickToBottom(bodyRef, rows.length);

  // Capture is live only on a CDP-attached, in-scope tab. "Debug mode off" is
  // the one out-of-scope case we can resolve in place (flip the master switch);
  // an in-scope-but-unpinned tab is steered from Debug mode itself.
  const capturing = cdpOwned;
  const canEnableDebug = hasCdpCapability && !cdpEnabled;

  const enableDebug = (): void => setCdpEnabled(true);

  // REPL dispatch (Phase D): the echo pair (command + result entries) comes
  // back on the console stream, so submission is fire-and-forget here.
  const evaluate = (expression: string): void => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null || effectiveContextKey === null) return;
    void hostBridge.call('consoleEval', { tabId, contextKey: effectiveContextKey, expression }).catch(() => {});
  };

  return (
    <div className="dt-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <div className="dt-header-filter-row">
            <strong className="dt-header-panel-name">Console</strong>
            <div className="dt-filter-separator" />
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={onClear}
              title="Clear console"
              aria-label="Clear console"
            >
              <IconClear />
            </button>
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={toggleAllExpanded}
              disabled={expandableIndexes.length === 0}
              title={allExpanded ? 'Collapse all' : 'Expand all'}
              aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
            >
              {allExpanded ? <IconCollapseAll /> : <IconExpandAll />}
            </button>
            <div className="dt-filter-separator" />
            <ConsoleContextSelector
              contexts={contexts}
              effectiveKey={effectiveContextKey}
              onSelect={setPickedContextKey}
            />
            {contexts.length > 0 && <div className="dt-filter-separator" />}
            <input
              type="text"
              className="dt-filter-input dt-filter-input--grow"
              placeholder="Filter"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
            <div className="dt-filter-separator" />
            <span
              className={`dt-console-levels${isCustomLevels(prefs.levels) ? ' dt-console-levels--warn' : ''}`}
              title={`Log level: ${levelMenuLabel(prefs.levels)}`}
            >
              <ToolbarMenuPopover
                label={levelMenuLabel(prefs.levels)}
                activeCount={0}
                active={false}
                placement="bottomRight"
                menuClassName="dt-console-levels-menu"
              >
                <button
                  type="button"
                  className="dt-sortmode-item dt-console-levels-item"
                  onClick={() => setConsolePrefs({ levels: DEFAULT_LEVELS })}
                >
                  <span className="dt-console-levels-check" aria-hidden="true" />
                  <div className="dt-sortmode-item-title">Default</div>
                </button>
                <div className="dt-console-levels-sep" />
                {LEVEL_MENU_ITEMS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className="dt-sortmode-item dt-console-levels-item"
                    onClick={() => setConsolePrefs({ levels: { ...prefs.levels, [key]: !prefs.levels[key] } })}
                  >
                    <span className="dt-console-levels-check" aria-hidden="true">
                      {prefs.levels[key] && <CheckOutlined />}
                    </span>
                    <div className="dt-sortmode-item-title">{label}</div>
                  </button>
                ))}
              </ToolbarMenuPopover>
            </span>
            <div className="dt-filter-separator" />
            <button
              type="button"
              className="dt-toolbar-icon"
              data-active={prefs.settingsOpen}
              onClick={() => setConsolePrefs({ settingsOpen: !prefs.settingsOpen })}
              title="Console settings"
              aria-label="Console settings"
            >
              <IconGear />
            </button>
          </div>
        }
      />

      {prefs.settingsOpen && (
        <div className="dt-console-settings-pane" role="group" aria-label="Console settings">
          <label className="dt-console-setting" title="Hide the browser's network log entries (failed and blocked requests)">
            <input
              type="checkbox"
              checked={prefs.hideNetwork}
              onChange={(e) => setConsolePrefs({ hideNetwork: e.target.checked })}
            />
            Hide network
          </label>
          <label className="dt-console-setting" title="Do not clear the log on navigation">
            <input
              type="checkbox"
              checked={prefs.preserveLog}
              onChange={(e) => setConsolePrefs({ preserveLog: e.target.checked })}
            />
            Preserve log
          </label>
          <label className="dt-console-setting" title="Only show messages from the selected context">
            <input
              type="checkbox"
              checked={prefs.selectedContextOnly}
              onChange={(e) => setConsolePrefs({ selectedContextOnly: e.target.checked })}
            />
            Selected context only
          </label>
        </div>
      )}

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
                  resolvedFrames={resolvedFrames}
                  expanded={expanded.has(row.entryIndex)}
                  onToggleExpanded={toggleExpanded}
                  onRequestClick={onRequestClick}
                />
              ))
            )}
          </>
        )}
      </div>
      {capturing && <ConsolePrompt contextKey={effectiveContextKey} onSubmit={evaluate} />}
    </div>
  );
}

interface ConsoleRowViewProps {
  row: ConsoleRow;
  resolvedFrames: ResolvedFrames;
  expanded: boolean;
  onToggleExpanded: (entryIndex: number) => void;
  onRequestClick: (requestId: string) => void;
}

function ConsoleRowView({ row, resolvedFrames, expanded, onToggleExpanded, onRequestClick }: ConsoleRowViewProps) {
  const { entry, stack, request } = row;
  const requestId = entry.requestId;
  const expandable = stack !== null && stack.length > 0;
  const location = expandable ? resolvedFrameLocation(stack[0], resolvedFrames) : row.location;
  return (
    <>
      <div className="dt-console-row" data-level={entry.level} data-source={entry.source}>
        {entry.source === 'command' || (entry.source === 'result' && entry.level !== 'error') ? (
          // REPL echo pair (Phase D): `›` marks the typed command, `‹` its
          // value — the browser's chevron vocabulary. An error result keeps
          // the standard error badge below.
          <span className="dt-console-dot dt-console-glyph" aria-hidden="true">
            {entry.source === 'command' ? '›' : '‹'}
          </span>
        ) : entry.level === 'error' ? (
          // Chrome's error badge: a red disc with a white ✕.
          <svg className="dt-console-dot dt-console-dot--error" viewBox="0 0 12 12" role="img" aria-hidden="true">
            <circle cx="6" cy="6" r="6" fill="var(--dt-icon-error)" />
            <path d="M3.8 3.8 L8.2 8.2 M8.2 3.8 L3.8 8.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ) : (
          <span className="dt-console-dot" />
        )}
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
            const loc = resolvedFrameLocation(frame, resolvedFrames);
            return (
              <div key={`${frame.url}:${frame.lineNumber}:${i}`} className="dt-console-frame">
                <span className="dt-console-frame-fn">{resolvedFrameName(frame, resolvedFrames)}</span>
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
