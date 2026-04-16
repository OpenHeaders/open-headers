import { Allotment, LayoutPriority } from 'allotment';
import 'allotment/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetailPane } from './components/DetailPane';
import { FilterDocs } from './components/FilterDocs';
import { FilterInput } from './components/FilterInput';
import { ResourceFilter } from './components/ResourceFilter';
import { RuleExecutions, RuleExecutionsHint } from './components/RuleExecutions';
import { SearchPanel } from './components/SearchPanel';
import { TrafficList } from './components/TrafficList';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import type { PanelRegion } from './data/focus-store';
import { setFocusedRegion, useFocusedRegion } from './data/focus-store';
import { useInspector } from './data/use-inspector';

type View = 'traffic' | 'executions';

function formatTotalSize(entries: readonly { responseSize?: number }[]): string {
  let total = 0;
  for (const e of entries) {
    if (e.responseSize != null && e.responseSize > 0) total += e.responseSize;
  }
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} kB`;
  return `${(total / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFinishTime(entries: readonly { duration?: number }[]): string {
  let max = 0;
  for (const e of entries) {
    if (e.duration != null && e.duration > max) max = e.duration;
  }
  if (max === 0) return '';
  if (max < 1000) return `${Math.round(max)} ms`;
  return `${(max / 1000).toFixed(2)} s`;
}

function IconRecord({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4.5" y1="11.5" x2="11.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path d="M1 3h14M4 8h8M6 13h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const { entries, danglingFires, clear, preserveLog, setPreserveLog, recording, setRecording } = useInspector();
  const [view, setView] = useState<View>('traffic');
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [activityLabels, setActivityLabels] = useState(true);
  const [rightActivityLabels, setRightActivityLabels] = useState(true);
  const [rightPanel, setRightPanel] = useState<'docs' | 'inspector' | null>(null);
  type DetailTab = 'headers' | 'payload' | 'response' | 'initiator' | 'timing' | 'har';
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab | undefined>(undefined);
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  const [searchNonce, setSearchNonce] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const focusedRegion = useFocusedRegion();

  const handleFocusCapture = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const regionEl = target.closest<HTMLElement>('[data-region]');
    if (!regionEl) return;
    const key = regionEl.getAttribute('data-region') as PanelRegion;
    if (key === 'left' || key === 'main' || key === 'right') {
      setFocusedRegion(key);
    }
  }, []);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    const handler = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (!next || (root && !root.contains(next))) {
        setFocusedRegion(null);
      }
    };
    root.addEventListener('focusout', handler);
    return () => root.removeEventListener('focusout', handler);
  }, []);

  const itemState = (isOpen: boolean, region: PanelRegion): 'focused' | 'active' | undefined => {
    if (!isOpen) return undefined;
    return focusedRegion === region ? 'focused' : 'active';
  };

  const filterTokens = useMemo(() => parseFilter(urlFilter, filterConfig), [urlFilter, filterConfig]);
  const filterError = useMemo(() => hasFilterError(filterTokens), [filterTokens]);

  const selected = selectedId ? (entries.find((e) => e.id === selectedId) ?? null) : null;

  const handleCrossNav = (id: string) => {
    setView('traffic');
    setSelectedId(id);
    setDetailInitialTab(undefined);
    setSearchHighlight(undefined);
    setSearchSection(undefined);
    setSearchLineNumber(undefined);
  };

  const sectionToTab = (section: string): DetailTab => {
    if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
    if (section === 'Query Params' || section === 'Request Body') return 'payload';
    if (section === 'Response') return 'response';
    return 'headers';
  };

  const handleSearchResult = (entryId: string, highlight: string, section: string, lineNumber: number) => {
    setView('traffic');
    setSelectedId(entryId);
    setDetailInitialTab(sectionToTab(section));
    setSearchHighlight(highlight);
    setSearchSection(section);
    setSearchLineNumber(lineNumber);
    setSearchNonce((n) => n + 1);
  };

  const handleSelect = (id: string) => {
    if (id === selectedId) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setDetailInitialTab(undefined);
      setSearchHighlight(undefined);
      setSearchSection(undefined);
      setSearchLineNumber(undefined);
    }
  };

  const totalSize = useMemo(() => formatTotalSize(entries), [entries]);
  const finishTime = useMemo(() => formatFinishTime(entries), [entries]);

  return (
    <div className="dt-panel" ref={shellRef} onClickCapture={handleFocusCapture} onFocusCapture={handleFocusCapture}>
      {/* Activity bar — icon+text, right-click to toggle labels */}
      <nav
        className={`dt-activity-bar ${activityLabels ? '' : 'dt-activity-bar--compact'}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setActivityLabels(!activityLabels);
        }}
      >
        <button
          type="button"
          className="dt-activity-icon"
          data-state={view === 'traffic' ? itemState(true, 'main') : undefined}
          onClick={() => {
            setView('traffic');
            setFocusedRegion('main');
          }}
          title={`Network (${entries.length})`}
        >
          <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
            <path d="M1 4h14M1 8h10M1 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {activityLabels && <span className="dt-activity-label">Network</span>}
        </button>
        <button
          type="button"
          className="dt-activity-icon"
          data-state={view === 'executions' ? itemState(true, 'main') : undefined}
          onClick={() => {
            setView('executions');
            setFocusedRegion('main');
          }}
          title="Rule Activity"
        >
          <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
            <path
              d="M3 2v12M7 4l5 4-5 4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {activityLabels && <span className="dt-activity-label">Rules</span>}
        </button>
        <button
          type="button"
          className="dt-activity-icon"
          data-state={itemState(showSearch, 'left')}
          onClick={() => {
            setShowSearch(!showSearch);
            if (!showSearch) setFocusedRegion('left');
          }}
          title="Search"
        >
          <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
            <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {activityLabels && <span className="dt-activity-label">Search</span>}
        </button>
      </nav>

      {/* Outer Allotment: search panel (snappable) + main area */}
      <Allotment proportionalLayout={false}>
        <Allotment.Pane preferredSize={280} minSize={180} maxSize={400} visible={showSearch} snap>
          <div data-region="left" style={{ height: '100%' }} tabIndex={-1}>
            <SearchPanel
              entries={entries}
              onClose={() => setShowSearch(false)}
              onResultClick={handleSearchResult}
              docsActive={rightPanel === 'docs'}
              onToggleDocs={() => {
                setRightPanel(rightPanel === 'docs' ? null : 'docs');
                if (rightPanel !== 'docs') setFocusedRegion('right');
              }}
            />
          </div>
        </Allotment.Pane>

        <Allotment.Pane priority={LayoutPriority.High}>
          <div className="dt-main" data-region="main" tabIndex={-1}>
            {/* Toolbar (row 1) */}
            <div className="dt-toolbar">
              <button
                type="button"
                className="dt-toolbar-icon dt-toolbar-icon--record"
                data-active={recording}
                onClick={() => setRecording(!recording)}
                title={recording ? 'Stop recording' : 'Record network log'}
              >
                <IconRecord active={recording} />
              </button>
              <button type="button" className="dt-toolbar-icon" onClick={clear} title="Clear network log">
                <IconClear />
              </button>
              <div className="dt-toolbar-separator" />
              <button
                type="button"
                className="dt-toolbar-icon"
                data-active={showFilter}
                onClick={() => setShowFilter(!showFilter)}
                title="Filter"
              >
                <IconFilter />
              </button>
              <button
                type="button"
                className="dt-toolbar-icon"
                data-active={showSearch}
                onClick={() => setShowSearch(!showSearch)}
                title="Search"
              >
                <IconSearch />
              </button>
              <div className="dt-toolbar-separator" />
              <label className="dt-checkbox">
                <input type="checkbox" checked={preserveLog} onChange={(e) => setPreserveLog(e.target.checked)} />
                Preserve log
              </label>
              {view === 'executions' && (
                <>
                  <div className="dt-toolbar-separator" />
                  <RuleExecutionsHint />
                </>
              )}
            </div>

            {/* Filter bar (row 2, toggleable) */}
            {showFilter && view === 'traffic' && (
              <div className="dt-filter-bar">
                <FilterInput
                  value={urlFilter}
                  onChange={setUrlFilter}
                  config={filterConfig}
                  onConfigChange={setFilterConfig}
                  hasError={filterError}
                  placeholder="Filter"
                />
                <button
                  type="button"
                  className="dt-toolbar-icon"
                  data-state={itemState(rightPanel === 'docs', 'right')}
                  onClick={() => {
                    setRightPanel(rightPanel === 'docs' ? null : 'docs');
                    if (rightPanel !== 'docs') setFocusedRegion('right');
                  }}
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
                <ResourceFilter value={filter} onChange={setFilter} />
              </div>
            )}

            {/* Content */}
            <div className="dt-content">
              {view === 'traffic' ? (
                <Allotment proportionalLayout={false}>
                  <Allotment.Pane priority={LayoutPriority.High} minSize={200}>
                    <div className="dt-traffic-pane dt-traffic-pane--full">
                      <TrafficList
                        entries={entries}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        filter={filter}
                        filterTokens={filterTokens}
                        filterConfig={filterConfig}
                        recording={recording}
                        onStartRecording={() => setRecording(true)}
                        onReloadPage={() => {
                          const dta = (chrome as unknown as { devtools?: { inspectedWindow?: { reload: () => void } } })
                            .devtools;
                          dta?.inspectedWindow?.reload();
                        }}
                      />
                    </div>
                  </Allotment.Pane>
                  <Allotment.Pane preferredSize={420} minSize={200} visible={selected != null} snap>
                    <DetailPane
                      entry={selected}
                      onClose={() => setSelectedId(null)}
                      initialTab={detailInitialTab}
                      searchHighlight={searchHighlight}
                      searchSection={searchSection}
                      searchLineNumber={searchLineNumber}
                      searchNonce={searchNonce}
                    />
                  </Allotment.Pane>
                </Allotment>
              ) : (
                <RuleExecutions entries={entries} danglingFires={danglingFires} onRequestClick={handleCrossNav} />
              )}
            </div>

            {/* Status bar */}
            {view === 'traffic' && (
              <div className="dt-status-bar">
                <span>
                  {entries.length} request{entries.length === 1 ? '' : 's'}
                </span>
                <span>{totalSize} transferred</span>
                {finishTime && <span>Finish: {finishTime}</span>}
              </div>
            )}
          </div>
        </Allotment.Pane>

        <Allotment.Pane preferredSize={400} minSize={180} maxSize={500} visible={rightPanel != null} snap>
          <div data-region="right" style={{ height: '100%' }} tabIndex={-1}>
            {rightPanel === 'docs' && <FilterDocs onClose={() => setRightPanel(null)} />}
            {rightPanel === 'inspector' && (
              <div className="dt-detail-pane">
                <div className="dt-tabs">
                  <button type="button" className="dt-tab-close" onClick={() => setRightPanel(null)} title="Close">
                    {'\u00d7'}
                  </button>
                  <span className="dt-tab dt-tab--active">Inspector</span>
                </div>
                <div className="dt-tab-body">
                  <div className="dt-empty" style={{ fontSize: 11 }}>
                    Inspector panel coming soon.
                  </div>
                </div>
              </div>
            )}
          </div>
        </Allotment.Pane>
      </Allotment>

      {/* Right activity bar */}
      <nav
        className={`dt-activity-bar dt-activity-bar--right ${rightActivityLabels ? '' : 'dt-activity-bar--compact'}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setRightActivityLabels(!rightActivityLabels);
        }}
      >
        <button
          type="button"
          className="dt-activity-icon"
          data-state={itemState(rightPanel === 'docs', 'right')}
          onClick={() => {
            setRightPanel(rightPanel === 'docs' ? null : 'docs');
            if (rightPanel !== 'docs') setFocusedRegion('right');
          }}
          title="Filter Docs"
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
          {rightActivityLabels && <span className="dt-activity-label">Docs</span>}
        </button>
        <button
          type="button"
          className="dt-activity-icon"
          data-state={itemState(rightPanel === 'inspector', 'right')}
          onClick={() => {
            setRightPanel(rightPanel === 'inspector' ? null : 'inspector');
            if (rightPanel !== 'inspector') setFocusedRegion('right');
          }}
          title="Inspector"
        >
          <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" />
            <line x1="6" y1="6" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {rightActivityLabels && <span className="dt-activity-label">Inspector</span>}
        </button>
      </nav>
    </div>
  );
}
