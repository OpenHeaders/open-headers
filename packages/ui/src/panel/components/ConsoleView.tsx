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

import { CheckOutlined, SettingOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { ConsoleEntry, ConsoleStackFrame } from '@openheaders/core/console-stream';
import type { JsContext } from '@openheaders/core/js-contexts';
import { hostNavigation } from '@openheaders/core/navigation';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveContextSelection, topContextKey } from '../data/console-context-selector';
import {
  DEFAULT_LEVELS,
  isCustomLevels,
  LEVEL_MENU_ITEMS,
  levelMenuLabel,
  passesLevelMask,
} from '../data/console-levels';
import { noteTopContext, setConsolePrefs, useConsolePrefs } from '../data/console-prefs';
import { type ConsoleFooterStatus, countConsoleLevels } from '../data/footer-status';
import { setConsoleFooterStatus } from '../data/stores/footer-status-store';
import type { ConsoleRequestJoin } from '../data/console-request-join';
import { isXhrLogEntry, type XhrLogConsoleEntry } from '../data/console-xhr-log';
import {
  frameKey,
  type ResolvedFramePosition,
  sourceFileLabel,
  useResolvedFrames,
} from '../data/initiator/use-resolved-frames';
import { useStickToBottom } from './detail/streams/use-stick-to-bottom';
import { CONSOLE_ROW_PX, consoleStackPx, useConsoleRowWindow } from './use-console-row-window';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '../data/text-match';
import { formatClock } from '../data/timing/format-time';
import { type FilterHiddenHint, FilterHiddenNote } from './FilterHiddenNote';
import { FilterInput } from './FilterInput';
import { useInspectedTabCdp } from '../data/use-inspected-tab-cdp';
import { ConsoleContextSelector } from './ConsoleContextSelector';
import { ConsolePrompt } from './ConsolePrompt';
import { ConsoleSettingInfo } from './ConsoleSettingInfo';
import { IconClear, IconCollapseAll, IconExpandAll } from './toolbar-icons';
import { ToolbarMenuPopover } from './ToolbarMenuPopover';

/** A search-jump into the console — scroll to and flash the matched
 *  message. Consumed exactly once via `onRevealConsumed`. */
export interface ConsoleRevealRequest {
  /** Buffer index of the matched entry (the search doc's line − 1). */
  entryIndex: number;
  /** Distinguishes repeat jumps to the same entry. */
  nonce: number;
}

interface ConsoleViewProps {
  entries: readonly ConsoleEntry[];
  /** Synthesized "finished/failed loading" rows derived from the network
   *  plane ("Log XMLHttpRequests"); the pref gates them here. */
  xhrLogEntries: readonly XhrLogConsoleEntry[];
  /** Live JS execution contexts of the inspected tab (the selector's list). */
  contexts: readonly JsContext[];
  /** Exact join from a browser entry's `requestId` to its network row. */
  resolveRequest: (requestId: string) => ConsoleRequestJoin | null;
  /** Cross-navigate to the entry's request in the Network plane. */
  onRequestClick: (requestId: string) => void;
  /** Client-local clear — empties the view, leaves the engine log intact. */
  onClear: () => void;
  onHide: () => void;
  /** Pending search-jump — consumed exactly once via `onRevealConsumed`. */
  reveal: ConsoleRevealRequest | null;
  onRevealConsumed: () => void;
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
  /** Stable row key — the buffer index for real entries, the request id for
   *  synthesized XHR-log rows — so expansion survives filter changes. */
  rowKey: string;
  /** Full display text — what the text filter matches and the row titles. */
  displayText: string;
  /** Joined network row, when the entry carries a resolvable request id. */
  request: ConsoleRequestJoin | null;
  /** Error text shown after the method + URL of a joined network entry. */
  requestTail: string;
  /** Expandable ladder — the entry's own stack, else the request initiator's. */
  stack: readonly ConsoleStackFrame[] | null;
  location: ConsoleSourceLocation | null;
  /** How many identical consecutive entries this row stands for ("Group
   *  similar messages" — the browser's repeat-count badge). */
  repeat: number;
}

function buildRow(entry: ConsoleEntry, rowKey: string, resolveRequest: ConsoleViewProps['resolveRequest']): ConsoleRow {
  const text = entry.args.map((a) => a.text).join(' ');
  const request = entry.requestId !== undefined ? resolveRequest(entry.requestId) : null;
  // A synthesized XHR-log row keeps the browser's own phrasing (the URL is
  // linkified inside it); only a real network log entry reduces to the
  // `METHOD url <failure>` form.
  const joinRewrites = request !== null && !isXhrLogEntry(entry);
  const requestTail = joinRewrites ? networkErrorTail(text) : '';
  const stack = entry.stackTrace ?? request?.stack ?? null;
  const location = stack !== null && stack.length > 0 ? frameLocation(stack[0]) : sourceLocation(entry);
  const displayText = joinRewrites && request !== null ? `${request.method} ${request.url} ${requestTail}`.trimEnd() : text;
  return { entry, rowKey, displayText, request, requestTail, stack, location, repeat: 1 };
}

/**
 * The visible entry sequence — the buffered entries from the navigation
 * cutoff, with the synthesized XHR-log rows merged in by timestamp when
 * "Log XMLHttpRequests" is on. Keys stay stable: a buffered entry keeps its
 * buffer index, a derived row its request id.
 */
function mergeXhrLogEntries(
  entries: readonly ConsoleEntry[],
  cutoff: number,
  xhrLogEntries: readonly XhrLogConsoleEntry[],
  cutoffMs: number,
): ReadonlyArray<{ entry: ConsoleEntry; key: string }> {
  const merged: { entry: ConsoleEntry; key: string }[] = [];
  let j = 0;
  // Derived rows honor the same cut as buffered ones — by instant, since
  // they have no buffer index.
  while (j < xhrLogEntries.length && xhrLogEntries[j].timestamp < cutoffMs) j++;
  for (let i = cutoff; i < entries.length; i++) {
    while (j < xhrLogEntries.length && xhrLogEntries[j].timestamp <= entries[i].timestamp) {
      merged.push({ entry: xhrLogEntries[j], key: `x${xhrLogEntries[j].requestId}` });
      j++;
    }
    merged.push({ entry: entries[i], key: `e${i}` });
  }
  for (; j < xhrLogEntries.length; j++) {
    merged.push({ entry: xhrLogEntries[j], key: `x${xhrLogEntries[j].requestId}` });
  }
  return merged;
}

/** The browser's CORS explanation messages ("Access to fetch at … has been
 *  blocked by CORS policy: …") — what "Show CORS errors in console" hides. */
function isCorsMessage(entry: ConsoleEntry): boolean {
  return entry.args.some((a) => a.text.includes('blocked by CORS policy'));
}

/** Whether two entries render identically — the "Group similar" collapse
 *  key. Command/result echo rows never group (a transcript stays literal). */
function isSameMessage(a: ConsoleEntry, b: ConsoleEntry): boolean {
  return (
    a.source === b.source &&
    a.level === b.level &&
    a.contextKey === b.contextKey &&
    a.url === b.url &&
    a.args.map((arg) => arg.text).join(' ') === b.args.map((arg) => arg.text).join(' ')
  );
}

function isGroupable(entry: ConsoleEntry): boolean {
  return entry.source !== 'command' && entry.source !== 'result';
}

export function ConsoleView({
  entries,
  xhrLogEntries,
  contexts,
  resolveRequest,
  onRequestClick,
  onClear,
  onHide,
  reveal,
  onRevealConsumed,
}: ConsoleViewProps) {
  const [textFilter, setTextFilter] = useState('');
  const [filterConfig, setFilterConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
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

  const visibleEntries = useMemo(
    () => mergeXhrLogEntries(entries, cutoff, prefs.logXhr ? xhrLogEntries : [], prefs.cutoffMs),
    [entries, cutoff, prefs.logXhr, xhrLogEntries, prefs.cutoffMs],
  );

  const filterPredicate = useMemo(() => buildTextPredicate(textFilter, filterConfig), [textFilter, filterConfig]);

  const rows = useMemo<ConsoleRow[]>(() => {
    const result: ConsoleRow[] = [];
    for (const { entry, key } of visibleEntries) {
      if (!passesLevelMask(entry.level, prefs.levels)) continue;
      // "Hide network" hides the browser's own network log entries (failed /
      // blocked requests) — the page's console.* output always stays.
      if (prefs.hideNetwork && entry.source === 'browser' && entry.category === 'network') continue;
      // "Show CORS errors in console" off hides the CORS explanations.
      if (!prefs.showCorsErrors && isCorsMessage(entry)) continue;
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
      const row = buildRow(entry, key, resolveRequest);
      if (
        !filterPredicate.empty &&
        !filterPredicate.test(row.displayText) &&
        !(row.location ? filterPredicate.test(row.location.full) : false)
      ) {
        continue;
      }
      // "Group similar" collapses a repeat of the previous visible row into
      // its count badge (the browser's repeat counter).
      const previous = result[result.length - 1];
      if (
        prefs.groupSimilar &&
        previous !== undefined &&
        isGroupable(entry) &&
        isGroupable(previous.entry) &&
        isSameMessage(previous.entry, entry)
      ) {
        previous.repeat += 1;
        continue;
      }
      result.push(row);
    }
    return result;
  }, [
    visibleEntries,
    prefs.levels,
    prefs.hideNetwork,
    prefs.selectedContextOnly,
    prefs.groupSimilar,
    prefs.showCorsErrors,
    filterPredicate,
    resolveRequest,
    effectiveContextKey,
  ]);

  // ── Focused-tool footer status (published to the status bar) ──────
  // Total = the current log window before any filtering; visible = the
  // rendered rows with grouped repeats expanded back to message counts;
  // error/warning tallies over the unfiltered window (the browser's
  // level counters don't shrink under a text filter).
  const footerStatus = useMemo<ConsoleFooterStatus>(() => {
    const { errors, warnings } = countConsoleLevels(visibleEntries.map(({ entry }) => entry.level));
    return {
      visibleCount: rows.reduce((n, row) => n + row.repeat, 0),
      totalCount: visibleEntries.length,
      errorCount: errors,
      warningCount: warnings,
    };
  }, [visibleEntries, rows]);
  useEffect(() => {
    setConsoleFooterStatus(footerStatus);
  }, [footerStatus]);
  useEffect(() => () => setConsoleFooterStatus(null), []);

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

  // Expansion is keyed by row key; a cleared stream restarts the buffer
  // indices at 0, so stale keys must not pre-expand fresh entries.
  useEffect(() => {
    if (entries.length === 0) setExpanded((prev) => (prev.size > 0 ? new Set() : prev));
  }, [entries.length]);

  const toggleExpanded = (rowKey: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(rowKey)) next.add(rowKey);
      return next;
    });
  };

  // Expand-all / collapse-all toggle over the visible rows that carry a
  // stack — the browser's single toolbar button beside Clear.
  const expandableKeys = useMemo(
    () => rows.filter((row) => row.stack !== null && row.stack.length > 0).map((row) => row.rowKey),
    [rows],
  );
  const allExpanded = expandableKeys.length > 0 && expandableKeys.every((key) => expanded.has(key));
  const toggleAllExpanded = (): void => {
    setExpanded(allExpanded ? new Set() : new Set(expandableKeys));
  };

  const { onScroll: onStickScroll } = useStickToBottom(bodyRef, rows.length);

  // Virtualized log: only the visible slice mounts. Heights are a closed
  // formula per row (pinned row line + expanded ladder by frame count), so
  // the window needs no measurement — see use-console-row-window.
  const rowHeights = useMemo(
    () =>
      rows.map(
        (row) =>
          CONSOLE_ROW_PX +
          (row.stack !== null && expanded.has(row.rowKey) ? consoleStackPx(row.stack.length) : 0),
      ),
    [rows, expanded],
  );
  const { onScroll: onWindowScroll, start, end, topPadPx, bottomPadPx } = useConsoleRowWindow(
    bodyRef,
    rowHeights,
    rows.length > 0,
  );
  const onScroll = useCallback(() => {
    onStickScroll();
    onWindowScroll();
  }, [onStickScroll, onWindowScroll]);

  // ── Search-jump reveal ─────────────────────────────────────────────
  // The matched entry's row key is its buffer index (`e${i}`). External
  // reveals are consumed immediately into a local parked jump so that a
  // "Clear filter" from the hidden-by-filter note can still land it.
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [pendingJump, setPendingJump] = useState<{ entryIndex: number; hinted: boolean } | null>(null);
  const [filterHint, setFilterHint] = useState<FilterHiddenHint | null>(null);
  useEffect(() => {
    if (reveal === null) return;
    setPendingJump({ entryIndex: reveal.entryIndex, hinted: false });
    onRevealConsumed();
  }, [reveal, onRevealConsumed]);

  // When the row is visible, center the virtualized scroller on it
  // (heights are the closed per-row formula, so the offset is a prefix
  // sum) and flash it. A row hidden SOLELY by the text filter keeps the
  // jump parked and shows the "revealed but filtered" note — clearing
  // the filter re-runs this effect and lands the jump. Every other
  // hiding cause (level mask, prefs, a "group similar" head, cutoff)
  // degrades to the window focus the jump already performed.
  useEffect(() => {
    if (pendingJump === null) return;
    const targetKey = `e${pendingJump.entryIndex}`;
    const rowIndex = rows.findIndex((r) => r.rowKey === targetKey);
    if (rowIndex >= 0) {
      const body = bodyRef.current;
      if (body !== null) {
        let offset = 0;
        for (let i = 0; i < rowIndex; i++) offset += rowHeights[i];
        body.scrollTop = Math.max(0, offset - body.clientHeight / 2 + CONSOLE_ROW_PX / 2);
      }
      setFlashKey(targetKey);
      setPendingJump(null);
      setFilterHint(null);
      return;
    }
    if (filterPredicate.empty) {
      setPendingJump(null);
      return;
    }
    const target = visibleEntries.find((v) => v.key === targetKey);
    if (target === undefined) {
      setPendingJump(null);
      return;
    }
    const entry = target.entry;
    const hiddenByPrefs =
      !passesLevelMask(entry.level, prefs.levels) ||
      (prefs.hideNetwork && entry.source === 'browser' && entry.category === 'network') ||
      (!prefs.showCorsErrors && isCorsMessage(entry)) ||
      (prefs.selectedContextOnly &&
        effectiveContextKey !== null &&
        entry.contextKey !== undefined &&
        entry.contextKey !== effectiveContextKey);
    if (hiddenByPrefs) {
      setPendingJump(null);
      return;
    }
    const row = buildRow(entry, target.key, resolveRequest);
    const textBlocked =
      !filterPredicate.test(row.displayText) && !(row.location ? filterPredicate.test(row.location.full) : false);
    if (!textBlocked) {
      setPendingJump(null);
      return;
    }
    if (!pendingJump.hinted) {
      setFilterHint((prev) => ({ nonce: (prev?.nonce ?? 0) + 1 }));
      setPendingJump({ entryIndex: pendingJump.entryIndex, hinted: true });
    }
  }, [pendingJump, rows, rowHeights, visibleEntries, filterPredicate, prefs, effectiveContextKey, resolveRequest]);

  const dismissFilterHint = useCallback(() => {
    setFilterHint(null);
    setPendingJump(null);
  }, []);
  const clearFilterForHint = useCallback(() => {
    setTextFilter('');
    setFilterHint(null);
  }, []);
  useEffect(() => {
    if (flashKey === null) return;
    const timer = setTimeout(() => setFlashKey(null), 1800);
    return () => clearTimeout(timer);
  }, [flashKey]);

  // Capture is live only on a CDP-attached, in-scope tab. "Debug mode off" is
  // the one out-of-scope case we can resolve in place (flip the master switch);
  // an in-scope-but-unpinned tab is steered from Debug mode itself.
  const capturing = cdpOwned;
  const canEnableDebug = hasCdpCapability && !cdpEnabled;

  const enableDebug = (): void => setCdpEnabled(true);

  // Clear also cuts the DERIVED rows (they have no buffer index to shrink).
  const clearConsole = (): void => {
    setConsolePrefs({ cutoffMs: Date.now() });
    onClear();
  };

  // REPL dispatch (Phase D): the echo pair (command + result entries) comes
  // back on the console stream, so submission is fire-and-forget here.
  const evaluate = (expression: string): void => {
    const tabId = hostNavigation.inspectedTabId();
    if (tabId == null || effectiveContextKey === null) return;
    void hostBridge
      .call('consoleEval', {
        tabId,
        contextKey: effectiveContextKey,
        expression,
        userGesture: prefs.evalUserGesture,
      })
      .catch(() => {});
  };

  // Eager evaluation (the prompt debounces): a silent, side-effect-free
  // preview in the same effective context. Memoized — the prompt's debounce
  // effect keys on it.
  const previewExpression = useCallback(
    (expression: string): Promise<string | null> => {
      const tabId = hostNavigation.inspectedTabId();
      if (tabId == null || effectiveContextKey === null) return Promise.resolve(null);
      return hostBridge
        .call('consoleEvalPreview', { tabId, contextKey: effectiveContextKey, expression })
        .then((res) => (res.success && res.text !== undefined ? res.text : null))
        .catch(() => null);
    },
    [effectiveContextKey],
  );

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
              onClick={clearConsole}
              title="Clear console"
              aria-label="Clear console"
            >
              <IconClear />
            </button>
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={toggleAllExpanded}
              disabled={expandableKeys.length === 0}
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
            <FilterInput
              value={textFilter}
              onChange={setTextFilter}
              config={filterConfig}
              onConfigChange={setFilterConfig}
              hasError={filterPredicate.error}
              ariaLabel="Filter console messages"
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
              <SettingOutlined />
            </button>
          </div>
        }
      />
      <FilterHiddenNote
        hint={filterHint}
        message="Revealed message is hidden by the active filter"
        onClearFilter={clearFilterForHint}
        onDismiss={dismissFilterHint}
      />

      {prefs.settingsOpen && (
        // Rows in the browser's settings-pane order. The (i) trigger sits
        // beside — not inside — each label so its glyph never leaks into the
        // checkbox's accessible name and its click can't toggle the checkbox.
        <div className="dt-console-settings-pane" role="group" aria-label="Console settings">
          <div className="dt-console-setting">
            <label title="Hide the browser's network log entries (failed and blocked requests)">
              <input
                type="checkbox"
                checked={prefs.hideNetwork}
                onChange={(e) => setConsolePrefs({ hideNetwork: e.target.checked })}
              />
              Hide network
            </label>
            <ConsoleSettingInfo infoKey="hideNetwork" />
          </div>
          <div className="dt-console-setting">
            <label title="Log a message when an XHR, fetch, or EventSource request finishes or fails">
              <input
                type="checkbox"
                checked={prefs.logXhr}
                onChange={(e) => setConsolePrefs({ logXhr: e.target.checked })}
              />
              Log XMLHttpRequests
            </label>
            <ConsoleSettingInfo infoKey="logXhr" />
          </div>
          <div className="dt-console-setting">
            <label title="Do not clear the log on navigation">
              <input
                type="checkbox"
                checked={prefs.preserveLog}
                onChange={(e) => setConsolePrefs({ preserveLog: e.target.checked })}
              />
              Preserve log
            </label>
            <ConsoleSettingInfo infoKey="preserveLog" />
          </div>
          <div className="dt-console-setting">
            <label title="Eagerly evaluate text in the prompt (side-effect-free preview)">
              <input
                type="checkbox"
                checked={prefs.eagerEval}
                onChange={(e) => setConsolePrefs({ eagerEval: e.target.checked })}
              />
              Eager evaluation
            </label>
            <ConsoleSettingInfo infoKey="eagerEval" />
          </div>
          <div className="dt-console-setting">
            <label title="Only show messages from the selected context">
              <input
                type="checkbox"
                checked={prefs.selectedContextOnly}
                onChange={(e) => setConsolePrefs({ selectedContextOnly: e.target.checked })}
              />
              Selected context only
            </label>
            <ConsoleSettingInfo infoKey="selectedContextOnly" />
          </div>
          <div className="dt-console-setting">
            <label title="Suggest commands you ran before as you type in the prompt">
              <input
                type="checkbox"
                checked={prefs.autocompleteHistory}
                onChange={(e) => setConsolePrefs({ autocompleteHistory: e.target.checked })}
              />
              Autocomplete from history
            </label>
            <ConsoleSettingInfo infoKey="autocompleteHistory" />
          </div>
          <div className="dt-console-setting">
            <label title="Collapse repeated identical messages into one row with a count">
              <input
                type="checkbox"
                checked={prefs.groupSimilar}
                onChange={(e) => setConsolePrefs({ groupSimilar: e.target.checked })}
              />
              Group similar messages in console
            </label>
            <ConsoleSettingInfo infoKey="groupSimilar" />
          </div>
          <div className="dt-console-setting">
            <label title="Evaluate with a user gesture, so APIs gated on user activation work from the prompt">
              <input
                type="checkbox"
                checked={prefs.evalUserGesture}
                onChange={(e) => setConsolePrefs({ evalUserGesture: e.target.checked })}
              />
              Treat code evaluation as user action
            </label>
            <ConsoleSettingInfo infoKey="evalUserGesture" />
          </div>
          <div className="dt-console-setting">
            <label title="Show CORS policy errors alongside the page's own output">
              <input
                type="checkbox"
                checked={prefs.showCorsErrors}
                onChange={(e) => setConsolePrefs({ showCorsErrors: e.target.checked })}
              />
              Show CORS errors in console
            </label>
            <ConsoleSettingInfo infoKey="showCorsErrors" />
          </div>
        </div>
      )}

      <div className="dt-console-body" ref={bodyRef} onScroll={onScroll}>
        {entries.length === 0 && visibleEntries.length === 0 ? (
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
              <>
                {topPadPx > 0 && <div aria-hidden="true" style={{ height: topPadPx, flex: '0 0 auto' }} />}
                {rows.slice(start, end).map((row) => (
                  <ConsoleRowView
                    key={row.rowKey}
                    row={row}
                    resolvedFrames={resolvedFrames}
                    expanded={expanded.has(row.rowKey)}
                    onToggleExpanded={toggleExpanded}
                    onRequestClick={onRequestClick}
                    flash={row.rowKey === flashKey}
                  />
                ))}
                {bottomPadPx > 0 && <div aria-hidden="true" style={{ height: bottomPadPx, flex: '0 0 auto' }} />}
              </>
            )}
          </>
        )}
      </div>
      {capturing && <ConsolePrompt contextKey={effectiveContextKey} onSubmit={evaluate} onPreview={previewExpression} />}
    </div>
  );
}

interface ConsoleRowViewProps {
  row: ConsoleRow;
  resolvedFrames: ResolvedFrames;
  expanded: boolean;
  onToggleExpanded: (rowKey: string) => void;
  onRequestClick: (requestId: string) => void;
  /** Transient search-jump emphasis on the matched row. */
  flash: boolean;
}

function ConsoleRowView({
  row,
  resolvedFrames,
  expanded,
  onToggleExpanded,
  onRequestClick,
  flash,
}: ConsoleRowViewProps) {
  const { entry, stack, request } = row;
  const requestId = entry.requestId;
  const expandable = stack !== null && stack.length > 0;
  const location = expandable ? resolvedFrameLocation(stack[0], resolvedFrames) : row.location;
  return (
    <>
      <div
        className={`dt-console-row${flash ? ' dt-console-row--flash' : ''}`}
        data-level={entry.level}
        data-source={entry.source}
      >
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
            onClick={() => onToggleExpanded(row.rowKey)}
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
        {row.repeat > 1 && (
          // The browser's repeat-count badge — this row stands for N
          // identical consecutive messages ("Group similar").
          <span className="dt-console-repeat" data-level={entry.level} title={`${row.repeat} identical messages`}>
            {row.repeat}
          </span>
        )}
        <span className="dt-console-time">{formatClock(entry.timestamp, 'local')}</span>
        <span className="dt-console-msg" title={row.displayText}>
          {request !== null && requestId !== undefined ? (
            isXhrLogEntry(entry) ? (
              // The browser's synthesized phrasing, URL linkified in place:
              // `Fetch finished loading: GET "https://…".`
              <>
                {`${entry.xhrLog.kindLabel} ${entry.xhrLog.failed ? 'failed' : 'finished'} loading: ${request.method} "`}
                <button type="button" className="dt-console-req-link" onClick={() => onRequestClick(requestId)}>
                  {request.url}
                </button>
                {'".'}
              </>
            ) : (
              <>
                {request.method}{' '}
                <button type="button" className="dt-console-req-link" onClick={() => onRequestClick(requestId)}>
                  {request.url}
                </button>
                {row.requestTail.length > 0 ? ` ${row.requestTail}` : ''}
              </>
            )
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
