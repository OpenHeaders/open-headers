import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { FilterConfig } from '../data/filter-engine';
import { buildResultView, type DisplayRow } from '../data/search-display';
import { type SearchGroup, sectionHasLineColumn } from '../data/search-engine';
import type { SearchSession } from '../data/use-search-session';
import { FilterInput } from './FilterInput';

interface SearchPanelProps {
  /** Persistent search session — owned by a stable parent so the
   *  user's query, draft config, and streamed results survive panel
   *  toggling. */
  session: SearchSession;
  onClose: () => void;
  onResultClick: (entryId: string, highlight: string, section: string, lineNumber: number, matchIndex: number) => void;
  docsActive: boolean;
  onToggleDocs: () => void;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function highlightParts(text: string, query: string, config: FilterConfig): Array<{ text: string; hl: boolean }> {
  if (!query) return [{ text, hl: false }];

  if (config.regexMode) {
    try {
      const re = new RegExp(`(${query})`, config.matchCase ? 'g' : 'gi');
      const parts: Array<{ text: string; hl: boolean }> = [];
      let lastIndex = 0;
      for (const match of text.matchAll(re)) {
        const idx = match.index;
        if (idx > lastIndex) parts.push({ text: text.slice(lastIndex, idx), hl: false });
        parts.push({ text: match[0], hl: true });
        lastIndex = idx + match[0].length;
      }
      if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), hl: false });
      return parts.length > 0 ? parts : [{ text, hl: false }];
    } catch {
      return [{ text, hl: false }];
    }
  }

  const lower = config.matchCase ? text : text.toLowerCase();
  const needle = config.matchCase ? query : query.toLowerCase();
  const parts: Array<{ text: string; hl: boolean }> = [];
  let pos = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(needle, pos);
    if (idx === -1) {
      parts.push({ text: text.slice(pos), hl: false });
      break;
    }
    if (idx > pos) parts.push({ text: text.slice(pos, idx), hl: false });
    parts.push({ text: text.slice(idx, idx + query.length), hl: true });
    pos = idx + query.length;
  }
  return parts;
}

function HighlightedText({ text, query, config }: { text: string; query: string; config: FilterConfig }) {
  const parts = highlightParts(text, query, config);
  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <mark key={i} className="dt-search-highlight">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function SearchProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
  return (
    <div className="dt-search-progress">
      <div className="dt-search-progress-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SearchSkeleton() {
  // Three placeholder rows — gives the user an immediate "something is
  // happening" signal without implying a specific count of matches.
  return (
    <div className="dt-search-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="dt-search-skeleton-row">
          <div className="dt-search-skeleton-bar dt-search-skeleton-bar--wide" />
          <div className="dt-search-skeleton-bar dt-search-skeleton-bar--narrow" />
        </div>
      ))}
    </div>
  );
}

interface ResultRowProps {
  group: SearchGroup;
  rows: readonly DisplayRow[];
  query: string;
  config: FilterConfig;
  onResultClick: SearchPanelProps['onResultClick'];
  /** Absolute index of this group's first display row in the flat
   *  result list — used to derive per-row global indices for
   *  keyboard navigation. */
  firstFlatIndex: number;
  /** The currently-selected global row index (for arrow-key nav). */
  activeGlobalIndex: number;
}

function ResultGroup({ group, rows, query, config, onResultClick, firstFlatIndex, activeGlobalIndex }: ResultRowProps) {
  return (
    <details className="dt-search-group" open>
      <summary>
        <span className="dt-search-group-time">{formatTimestamp(group.timestamp)}</span>
        <span className="dt-search-group-file">
          #{group.displayId} {group.filename}
        </span>
        <span className="dt-search-group-origin">{group.origin}</span>
        <span className="dt-search-group-count" title={`${group.matches.length} matches in this file`}>
          {group.matches.length}
        </span>
      </summary>
      {rows.map((r, i) => {
        const globalIndex = firstFlatIndex + i;
        const isActive = globalIndex === activeGlobalIndex;
        // Line:col coordinates are only meaningful for sections the
        // engine flags as having them (see `sectionHasLineColumn`).
        // Headers / general / query params render as tables where
        // the column has no visual analogue.
        const showLineCol = sectionHasLineColumn(r.section);
        const ordinalLabel = r.count > 1 ? `#${r.firstOrdinal}-#${r.lastOrdinal}` : `#${r.firstOrdinal}`;
        const titleParts = [
          showLineCol ? `Line ${r.lineNumber}, Col ${r.column}` : `Line ${r.lineNumber}`,
          r.count > 1 ? `${r.count} matches on this line` : null,
        ].filter(Boolean);
        return (
          <button
            key={`${r.section}-${r.lineNumber}-${r.sectionIndex}`}
            type="button"
            className={`dt-search-match${isActive ? ' dt-search-match--active' : ''}`}
            data-global-index={globalIndex}
            title={titleParts.join(' · ')}
            onClick={() => onResultClick(group.entryId, query, r.section, r.lineNumber, r.sectionIndex)}
          >
            <span className="dt-search-match-line">{ordinalLabel}</span>
            {showLineCol && (
              <span className="dt-search-match-pos">
                {r.lineNumber}:{r.column}
              </span>
            )}
            <span className="dt-search-match-text">
              <HighlightedText text={r.lineText.slice(0, 200)} query={query} config={config} />
            </span>
            <span className="dt-search-match-section">{r.section}</span>
          </button>
        );
      })}
    </details>
  );
}

export function SearchPanel({ session, onClose, onResultClick, docsActive, onToggleDocs }: SearchPanelProps) {
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const {
    search: { state, run, cancel },
    draftQuery,
    setDraftQuery,
    draftConfig,
    setDraftConfig,
  } = session;

  const hasError = useMemo(() => {
    if (!draftConfig.regexMode || !draftQuery.trim()) return false;
    try {
      new RegExp(draftQuery.trim());
      return false;
    } catch {
      return true;
    }
  }, [draftQuery, draftConfig.regexMode]);

  const submit = useCallback(() => {
    if (hasError) return;
    run(draftQuery, draftConfig);
  }, [hasError, draftQuery, draftConfig, run]);

  const isDirty = draftQuery.trim() !== state.committedQuery || draftConfig !== state.committedConfig;

  // Single-pass transformation from engine output to render-ready
  // view model — coalesced per-line display rows, grouped under each
  // file, with a parallel flat pointer list for arrow-key nav. Lives
  // in `search-display.ts` and is pure, so it's exhaustively tested
  // outside React.
  const view = useMemo(() => buildResultView(state.results), [state.results]);
  const { groups: groupedDisplay, flatRows, totalMatches, totalFiles } = view;

  const [activeGlobalIndex, setActiveGlobalIndex] = useState(-1);
  // Reset selection on each new search. We intentionally do NOT depend
  // on `state.results.length` — partial results stream in during a run
  // and we don't want rows to un-select mid-stream as new groups land.
  // biome-ignore lint/correctness/useExhaustiveDependencies: committedQuery is the semantic "new run" signal
  useEffect(() => {
    setActiveGlobalIndex(-1);
  }, [state.committedQuery]);

  const resultsRef = useRef<HTMLDivElement>(null);
  const activateRow = useCallback(
    (nextIndex: number) => {
      if (flatRows.length === 0) return;
      const clamped = Math.max(0, Math.min(flatRows.length - 1, nextIndex));
      setActiveGlobalIndex(clamped);
      // Defer scroll until after the row gets its --active class so
      // scrollIntoView targets the updated DOM.
      requestAnimationFrame(() => {
        const el = resultsRef.current?.querySelector<HTMLButtonElement>(`[data-global-index="${clamped}"]`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
    [flatRows.length],
  );

  const fireClickForIndex = useCallback(
    (globalIndex: number) => {
      const ptr = flatRows[globalIndex];
      if (!ptr) return;
      const groupBlock = groupedDisplay[ptr.groupIndex];
      const displayRow = groupBlock?.rows[ptr.rowIndex];
      if (!groupBlock || !displayRow) return;
      onResultClick(
        groupBlock.group.entryId,
        state.committedQuery,
        displayRow.section,
        displayRow.lineNumber,
        displayRow.sectionIndex,
      );
    },
    [flatRows, groupedDisplay, state.committedQuery, onResultClick],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        // Enter in the search box submits — unless the user is
        // navigating results, in which case Enter should jump to the
        // active match.
        if (activeGlobalIndex >= 0 && state.status === 'done' && flatRows.length > 0) {
          e.preventDefault();
          fireClickForIndex(activeGlobalIndex);
          return;
        }
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activateRow(activeGlobalIndex < 0 ? 0 : activeGlobalIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activateRow(activeGlobalIndex < 0 ? flatRows.length - 1 : activeGlobalIndex - 1);
        return;
      }
    },
    [activeGlobalIndex, activateRow, fireClickForIndex, flatRows.length, state.status, submit],
  );

  return (
    <div className="dt-panel dt-search-panel">
      <PanelHeader wiring={headerWiring} title={<strong>Search</strong>} />
      <div className="dt-search-panel-input-row">
        <FilterInput
          value={draftQuery}
          onChange={setDraftQuery}
          config={draftConfig}
          onConfigChange={setDraftConfig}
          hasError={hasError}
          placeholder="Search (press Enter)"
          onKeyDown={handleInputKeyDown}
        />
        {state.status === 'running' ? (
          <button
            type="button"
            className="dt-btn dt-btn-secondary dt-search-submit"
            onClick={cancel}
            title="Cancel search"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="dt-btn dt-btn-primary dt-search-submit"
            onClick={submit}
            disabled={hasError || draftQuery.trim().length < 2}
            title="Run search (Enter)"
          >
            Search
          </button>
        )}
        <button
          type="button"
          className="dt-toolbar-icon"
          data-active={docsActive}
          onClick={onToggleDocs}
          title="Search syntax help"
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
      </div>

      {state.status === 'running' && (
        <>
          <SearchProgressBar done={state.progress.done} total={state.progress.total} />
          <div className="dt-search-panel-status dt-search-panel-status--running">
            Searching… {state.progress.done} / {state.progress.total}
            {state.progress.currentDisplayId != null ? ` · #${state.progress.currentDisplayId}` : ''}
            {state.progress.currentSection ? ` (${state.progress.currentSection})` : ''}
            {state.progress.sectionTotal != null && state.progress.sectionTotal > 64 * 1024
              ? ` · ${Math.round(((state.progress.sectionScanned ?? 0) / state.progress.sectionTotal) * 100)}%`
              : ''}
            {state.progress.elapsedMs > 200 ? ` · ${formatElapsed(state.progress.elapsedMs)}` : ''}
          </div>
        </>
      )}

      <div
        ref={resultsRef}
        className="dt-search-panel-results"
        data-stale={(state.status !== 'idle' && isDirty) || undefined}
      >
        {state.status === 'idle' && !hasError && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            {draftQuery.trim().length < 2
              ? 'Enter a query (min 2 characters) and press Enter to search.'
              : 'Press Enter to search.'}
          </div>
        )}
        {state.status === 'running' && state.results.length === 0 && <SearchSkeleton />}
        {groupedDisplay.map(({ group, rows, firstFlatIndex }) => (
          <ResultGroup
            key={group.entryId}
            group={group}
            rows={rows}
            query={state.committedQuery}
            config={state.committedConfig}
            onResultClick={onResultClick}
            firstFlatIndex={firstFlatIndex}
            activeGlobalIndex={activeGlobalIndex}
          />
        ))}
        {state.status === 'done' && state.results.length === 0 && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            No matches found.
          </div>
        )}
      </div>

      {state.status === 'done' && (
        <div className="dt-search-panel-status">
          {totalMatches > 0
            ? `Found ${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${totalFiles} file${totalFiles === 1 ? '' : 's'} · ${formatElapsed(state.progress.elapsedMs)}`
            : `No results · ${formatElapsed(state.progress.elapsedMs)}`}
        </div>
      )}
    </div>
  );
}
