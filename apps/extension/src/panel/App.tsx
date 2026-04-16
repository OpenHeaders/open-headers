import { useTheme } from '@context/ThemeContext';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Allotment, LayoutPriority } from 'allotment';
import 'allotment/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterDocs } from './components/FilterDocs';
import { FilterInput } from './components/FilterInput';
import { InspectorDetailContent } from './components/InspectorDetailContent';
import { InspectorEditorGroupRenderer } from './components/InspectorEditorGroupRenderer';
import { ResourceFilter } from './components/ResourceFilter';
import { RuleExecutions, RuleExecutionsHint } from './components/RuleExecutions';
import { SearchPanel } from './components/SearchPanel';
import { TrafficList } from './components/TrafficList';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import type { PanelRegion } from './data/focus-store';
import { setFocusedRegion, useFocusedRegion } from './data/focus-store';
import { buildInspectorTab } from './data/inspector-tab';
import type { DetailSection } from './data/inspector-tab';
import { PANEL_DOCK_LABELS, PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from './data/tool-windows';
import { usePanelToolLayout } from './data/use-panel-tool-layout';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { useInspector } from './data/use-inspector';

type SidebarView = 'traffic' | 'executions';
type ThemeMode = 'light' | 'dark' | 'auto';

// ── Region toggle SVG (same as workspace StatusBar) ──────────────

function RegionToggle({
  title,
  active,
  position,
  onClick,
}: {
  title: string;
  active: boolean;
  position: 'left' | 'bottom' | 'right';
  onClick: () => void;
}) {
  const strokeColor = 'var(--dt-text-muted)';
  const fillColor = active ? 'var(--dt-text-muted)' : 'none';

  return (
    <button
      type="button"
      className="dt-region-toggle"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 16 13" width={16} height={13} role="img" aria-hidden="true">
        <rect x="0.5" y="0.5" width="15" height="12" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={1} />
        {position === 'left' && (
          <>
            <rect x="0.5" y="0.5" width="4.5" height="12" rx="1.5" fill={fillColor} stroke={strokeColor} strokeWidth={1} opacity={active ? 0.35 : 0.15} />
            <line x1="5" y1="0.5" x2="5" y2="12.5" stroke={strokeColor} strokeWidth={1} />
          </>
        )}
        {position === 'bottom' && (
          <>
            <rect x="0.5" y="8.5" width="15" height="4" rx="1.5" fill={fillColor} stroke={strokeColor} strokeWidth={1} opacity={active ? 0.35 : 0.15} />
            <line x1="0.5" y1="8.5" x2="15.5" y2="8.5" stroke={strokeColor} strokeWidth={1} />
          </>
        )}
        {position === 'right' && (
          <>
            <rect x="11" y="0.5" width="4.5" height="12" rx="1.5" fill={fillColor} stroke={strokeColor} strokeWidth={1} opacity={active ? 0.35 : 0.15} />
            <line x1="11" y1="0.5" x2="11" y2="12.5" stroke={strokeColor} strokeWidth={1} />
          </>
        )}
      </svg>
    </button>
  );
}

// ── Layout menu icon SVGs (same patterns as workspace) ───────────

type LayoutIconKind = 'bottom-full' | 'bottom-nested' | 'show-labels' | 'hide-labels';

function LayoutIcon({ kind }: { kind: LayoutIconKind }) {
  const stroke = 'var(--dt-text-muted)';
  const fill = 'var(--dt-text)';
  const frame = <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />;

  let content: React.ReactNode;
  if (kind === 'bottom-full') {
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={8.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
        <rect x={0.5} y={8.5} width={15} height={4} rx={1.5} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.15} />
        <line x1={0.5} y1={8.5} x2={15.5} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'bottom-nested') {
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={12.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={12.5} stroke={stroke} strokeWidth={1} />
        <rect x={5} y={8.5} width={6} height={4} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.15} />
        <line x1={5} y1={8.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'show-labels') {
    content = (
      <>
        <rect x={0.5} y={0.5} width={5.5} height={12} rx={1.5} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.15} />
        <line x1={6} y1={0.5} x2={6} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else {
    content = (
      <>
        <rect x={0.5} y={0.5} width={3} height={12} rx={1.5} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.15} />
        <line x1={3.5} y1={0.5} x2={3.5} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  }

  return (
    <svg viewBox="0 0 16 13" width={16} height={13} role="img" aria-hidden="true" style={{ display: 'block' }}>
      {frame}
      {content}
    </svg>
  );
}

const THEME_DISPLAY: Record<ThemeMode, { symbol: string; text: string; color: string }> = {
  light: { symbol: '\u2600', text: 'Light', color: '#faad14' },
  dark: { symbol: '\u263E', text: 'Dark', color: '#722ed1' },
  auto: { symbol: '\u25D0', text: 'Auto', color: '#1890ff' },
};

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

function menuPositionAbove(ref: React.RefObject<HTMLElement | null>): React.CSSProperties {
  if (!ref.current) return { position: 'fixed', bottom: 24, right: 8 };
  const rect = ref.current.getBoundingClientRect();
  return {
    position: 'fixed',
    bottom: window.innerHeight - rect.top + 4,
    right: window.innerWidth - rect.right,
    zIndex: 100,
  };
}

export default function App() {
  const { entries, danglingFires, clear: clearStore, preserveLog, setPreserveLog, recording, setRecording } = useInspector();
  const groups = useInspectorEditorGroups();
  const tl = usePanelToolLayout();

  const clear = useCallback(() => {
    clearStore();
    groups.closeAllTabs();
  }, [clearStore, groups]);
  const { themeMode, setThemeMode } = useTheme();

  const [sidebarView, setSidebarView] = useState<SidebarView>('traffic');
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [showFilter, setShowFilter] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBottom, setShowBottom] = useState(false);
  const [activityLabels, setActivityLabels] = useState(true);
  const [rightActivityLabels, setRightActivityLabels] = useState(true);
  const [rightPanel, setRightPanel] = useState<'docs' | null>(null);
  const [bottomFullWidth, setBottomFullWidth] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  const [searchNonce, setSearchNonce] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  const focusedRegion = useFocusedRegion();

  // DnD sensors — same activation constraint as workspace
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleFocusCapture = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const regionEl = target.closest<HTMLElement>('[data-region]');
    if (!regionEl) return;
    const key = regionEl.getAttribute('data-region') as PanelRegion;
    if (key === 'left' || key === 'search' || key === 'main' || key === 'right') {
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

  // ── Tab ↔ sidebar association ──────────────────────────────────
  // When the active tab changes, auto-activate the matching sidebar.
  const activeTab = groups.focusedLeaf.tabs.find((t) => t.id === groups.activeTabId);
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab.source === 'network' && sidebarView !== 'traffic') {
      setSidebarView('traffic');
    } else if (activeTab.source === 'rules' && sidebarView !== 'executions') {
      setSidebarView('executions');
    }
  }, [activeTab, sidebarView]);

  // ── Open request as tab ────────────────────────────────────────
  const handleSelect = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const tab = buildInspectorTab(entry, 'network');
      tab.statusCode = entry.statusCode;
      groups.addTab(tab);
      setSearchHighlight(undefined);
      setSearchSection(undefined);
      setSearchLineNumber(undefined);
    },
    [entries, groups],
  );

  // ── Cross-navigation from rule activity / search ───────────────
  const handleCrossNav = useCallback(
    (id: string) => {
      setSidebarView('traffic');
      setShowSidebar(true);
      handleSelect(id);
    },
    [handleSelect],
  );

  const sectionToTab = (section: string): DetailSection => {
    if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
    if (section === 'Query Params' || section === 'Request Body') return 'payload';
    if (section === 'Response') return 'response';
    return 'headers';
  };

  const handleSearchResult = useCallback(
    (entryId: string, highlight: string, section: string, lineNumber: number) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const tab = buildInspectorTab(entry, 'network');
      tab.activeSection = sectionToTab(section);
      tab.statusCode = entry.statusCode;
      groups.addTab(tab);
      // Set the active section on the tab (in case it already existed)
      groups.updateTab(tab.id, { activeSection: sectionToTab(section) });
      setSearchHighlight(highlight);
      setSearchSection(section);
      setSearchLineNumber(lineNumber);
      setSearchNonce((n) => n + 1);
    },
    [entries, groups],
  );

  // ── Editor group tab body renderer ─────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: ReturnType<typeof buildInspectorTab>; leafId: string; isFocusedLeaf: boolean }) => {
      const request = entries.find((e) => e.id === tab.requestId);
      if (!request) {
        return (
          <div className="dt-editor-empty">
            Request no longer available (cleared or navigated away)
          </div>
        );
      }
      const isActiveTab = tab.id === groups.activeTabId;
      return (
        <InspectorDetailContent
          request={request}
          activeSection={tab.activeSection}
          onSectionChange={(s) => groups.updateTab(tab.id, { activeSection: s })}
          searchHighlight={isActiveTab ? searchHighlight : undefined}
          searchSection={isActiveTab ? searchSection : undefined}
          searchLineNumber={isActiveTab ? searchLineNumber : undefined}
        />
      );
    },
    [entries, groups, searchHighlight, searchSection, searchLineNumber],
  );

  const renderEmpty = useCallback(
    () => (
      <div className="dt-editor-empty">
        Select a request from the sidebar to inspect
      </div>
    ),
    [],
  );

  // The selected entry in the sidebar — highlight the row matching
  // the active tab's request.
  const selectedId = activeTab?.requestId ?? null;

  const totalSize = useMemo(() => formatTotalSize(entries), [entries]);
  const finishTime = useMemo(() => formatFinishTime(entries), [entries]);

  // ── DnD drag overlay ──────────────────────────────────────────
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const dragTab = dragTabId ? groups.allTabs.find((t) => t.id === dragTabId) ?? null : null;

  return (
    <div className="dt-panel-root" ref={shellRef} onClickCapture={handleFocusCapture} onFocusCapture={handleFocusCapture}>
      <div className="dt-panel">
      {/* Left activity bar */}
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
          data-state={sidebarView === 'traffic' && showSidebar ? itemState(true, 'left') : undefined}
          onClick={() => {
            if (sidebarView === 'traffic') {
              setShowSidebar(!showSidebar);
            } else {
              setSidebarView('traffic');
              setShowSidebar(true);
            }
            setFocusedRegion('left');
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
          data-state={sidebarView === 'executions' && showSidebar ? itemState(true, 'left') : undefined}
          onClick={() => {
            if (sidebarView === 'executions') {
              setShowSidebar(!showSidebar);
            } else {
              setSidebarView('executions');
              setShowSidebar(true);
            }
            setFocusedRegion('left');
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
          data-state={itemState(showSearch, 'search')}
          onClick={() => {
            setShowSearch(!showSearch);
            if (!showSearch) setFocusedRegion('search');
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

      {/* Main layout — vertical split for full-width bottom, wraps the horizontal layout */}
      <Allotment vertical={bottomFullWidth && showBottom} proportionalLayout={false} key={bottomFullWidth ? 'full' : 'nested'}>
      <Allotment.Pane priority={LayoutPriority.High} minSize={120}>
      <Allotment proportionalLayout={false}>
        {/* Search panel (snappable left drawer) */}
        <Allotment.Pane preferredSize={280} minSize={180} maxSize={400} visible={showSearch} snap>
          <div data-region="search" style={{ height: '100%' }} tabIndex={-1}>
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

        {/* Center — toolbar + (sidebar + editor groups) */}
        <Allotment.Pane priority={LayoutPriority.High}>
          <div className="dt-main" data-region="main" tabIndex={-1}>
            {/* Toolbar */}
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
              {sidebarView === 'executions' && showSidebar && (
                <>
                  <div className="dt-toolbar-separator" />
                  <RuleExecutionsHint />
                </>
              )}
            </div>

            {/* Filter bar */}
            {showFilter && (
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
                    <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="10" fontFamily="serif" fontStyle="italic">i</text>
                  </svg>
                </button>
                <div className="dt-filter-separator" />
                <ResourceFilter value={filter} onChange={setFilter} />
              </div>
            )}

            {/* Content: sidebar + editor groups, with nested bottom panel when not full-width */}
            <div className="dt-content">
              {bottomFullWidth ? (
                /* Full-width bottom: sidebar+editor only, bottom is outside dt-main */
                <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
                  <DndContext
                    sensors={sensors}
                    onDragStart={(e) => {
                      const data = e.active.data.current as { kind?: unknown; tabId?: unknown } | undefined;
                      if (data?.kind === 'editor-tab' && typeof data.tabId === 'string') {
                        setDragTabId(data.tabId);
                      }
                    }}
                    onDragEnd={() => setDragTabId(null)}
                    onDragCancel={() => setDragTabId(null)}
                  >
                    <Allotment proportionalLayout defaultSizes={[40, 60]}>
                      <Allotment.Pane minSize={180} visible={showSidebar} snap>
                        <div className="dt-traffic-pane dt-traffic-pane--full" data-region="left">
                          {sidebarView === 'traffic' ? (
                            <TrafficList entries={entries} selectedId={selectedId} onSelect={handleSelect} filter={filter} filterTokens={filterTokens} filterConfig={filterConfig} recording={recording} onStartRecording={() => setRecording(true)} onReloadPage={() => { (chrome as unknown as { devtools?: { inspectedWindow?: { reload: () => void } } }).devtools?.inspectedWindow?.reload(); }} />
                          ) : (
                            <RuleExecutions entries={entries} danglingFires={danglingFires} onRequestClick={handleCrossNav} />
                          )}
                        </div>
                      </Allotment.Pane>
                      <Allotment.Pane priority={LayoutPriority.High} minSize={300}>
                        <InspectorEditorGroupRenderer groups={groups} renderTabBody={renderTabBody} renderEmpty={renderEmpty} onCloseTab={groups.closeTab} onCloseOther={groups.closeOtherTabs} onCloseAll={groups.closeAllTabs} onCloseToLeft={groups.closeTabsToLeft} onCloseToRight={groups.closeTabsToRight} recentlyClosed={groups.recentlyClosed} />
                      </Allotment.Pane>
                    </Allotment>
                    <DragOverlay dropAnimation={null}>
                      {dragTab && (
                        <div className="dt-editor-tab active" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)', opacity: 0.9 }}>
                          <span className="dt-method-badge" style={{ color: dragTab.method === 'GET' ? '#61affe' : dragTab.method === 'POST' ? '#49cc90' : '#fca130' }}>{dragTab.method}</span>
                          <span className="dt-editor-tab-label">{dragTab.label.replace(/^[A-Z]+ /, '')}</span>
                        </div>
                      )}
                    </DragOverlay>
                  </DndContext>
                </div>
              ) : (
                /* Nested bottom: vertical split inside dt-content */
                <Allotment vertical proportionalLayout={false}>
                  <Allotment.Pane priority={LayoutPriority.High} minSize={120}>
                    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
                      <DndContext
                        sensors={sensors}
                        onDragStart={(e) => {
                          const data = e.active.data.current as { kind?: unknown; tabId?: unknown } | undefined;
                          if (data?.kind === 'editor-tab' && typeof data.tabId === 'string') {
                            setDragTabId(data.tabId);
                          }
                        }}
                        onDragEnd={() => setDragTabId(null)}
                        onDragCancel={() => setDragTabId(null)}
                      >
                        <Allotment proportionalLayout defaultSizes={[40, 60]}>
                          <Allotment.Pane minSize={180} visible={showSidebar} snap>
                            <div className="dt-traffic-pane dt-traffic-pane--full" data-region="left">
                              {sidebarView === 'traffic' ? (
                                <TrafficList entries={entries} selectedId={selectedId} onSelect={handleSelect} filter={filter} filterTokens={filterTokens} filterConfig={filterConfig} recording={recording} onStartRecording={() => setRecording(true)} onReloadPage={() => { (chrome as unknown as { devtools?: { inspectedWindow?: { reload: () => void } } }).devtools?.inspectedWindow?.reload(); }} />
                              ) : (
                                <RuleExecutions entries={entries} danglingFires={danglingFires} onRequestClick={handleCrossNav} />
                              )}
                            </div>
                          </Allotment.Pane>
                          <Allotment.Pane priority={LayoutPriority.High} minSize={300}>
                            <InspectorEditorGroupRenderer groups={groups} renderTabBody={renderTabBody} renderEmpty={renderEmpty} onCloseTab={groups.closeTab} onCloseOther={groups.closeOtherTabs} onCloseAll={groups.closeAllTabs} onCloseToLeft={groups.closeTabsToLeft} onCloseToRight={groups.closeTabsToRight} recentlyClosed={groups.recentlyClosed} />
                          </Allotment.Pane>
                        </Allotment>
                        <DragOverlay dropAnimation={null}>
                          {dragTab && (
                            <div className="dt-editor-tab active" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)', opacity: 0.9 }}>
                              <span className="dt-method-badge" style={{ color: dragTab.method === 'GET' ? '#61affe' : dragTab.method === 'POST' ? '#49cc90' : '#fca130' }}>{dragTab.method}</span>
                              <span className="dt-editor-tab-label">{dragTab.label.replace(/^[A-Z]+ /, '')}</span>
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                    </div>
                  </Allotment.Pane>
                  <Allotment.Pane preferredSize={160} minSize={80} visible={showBottom} snap>
                    <div className="dt-bottom-panel">
                      <div className="dt-bottom-panel-header">
                        <span className="dt-bottom-panel-title">Console</span>
                        <button type="button" className="dt-bottom-panel-close" onClick={() => setShowBottom(false)} title="Close panel">{'\u00d7'}</button>
                      </div>
                      <div className="dt-bottom-panel-body">
                        <div className="dt-editor-empty">Bottom panel — content coming soon</div>
                      </div>
                    </div>
                  </Allotment.Pane>
                </Allotment>
              )}
            </div>

          </div>
        </Allotment.Pane>

        {/* Right panel (docs) */}
        <Allotment.Pane preferredSize={400} minSize={180} maxSize={500} visible={rightPanel != null} snap>
          <div data-region="right" style={{ height: '100%' }} tabIndex={-1}>
            {rightPanel === 'docs' && <FilterDocs onClose={() => setRightPanel(null)} />}
          </div>
        </Allotment.Pane>
      </Allotment>
      </Allotment.Pane>

      {/* Full-width bottom panel (only rendered in full-width mode) */}
      {bottomFullWidth && (
        <Allotment.Pane preferredSize={160} minSize={80} visible={showBottom} snap>
          <div className="dt-bottom-panel">
            <div className="dt-bottom-panel-header">
              <span className="dt-bottom-panel-title">Console</span>
              <button type="button" className="dt-bottom-panel-close" onClick={() => setShowBottom(false)} title="Close panel">{'\u00d7'}</button>
            </div>
            <div className="dt-bottom-panel-body">
              <div className="dt-editor-empty">Bottom panel — content coming soon</div>
            </div>
          </div>
        </Allotment.Pane>
      )}
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
            <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="10" fontFamily="serif" fontStyle="italic">i</text>
          </svg>
          {rightActivityLabels && <span className="dt-activity-label">Docs</span>}
        </button>
      </nav>
      </div>

      {/* Status bar — full width, outside activity bars and Allotment */}
      <div className="dt-status-bar">
        <div className="dt-status-bar-left">
          <span>{entries.length} request{entries.length === 1 ? '' : 's'}</span>
          <span>{totalSize} transferred</span>
          {finishTime && <span>Finish: {finishTime}</span>}
          {groups.allTabs.length > 0 && (
            <span>{groups.allTabs.length} tab{groups.allTabs.length === 1 ? '' : 's'}</span>
          )}
        </div>
        <div className="dt-status-bar-right">
          {/* Theme switcher */}
          <div>
            <button
              ref={themeButtonRef}
              type="button"
              className="dt-status-bar-item"
              style={{ color: THEME_DISPLAY[themeMode as ThemeMode]?.color, cursor: 'pointer' }}
              onClick={() => setThemeMenuOpen((v) => !v)}
              title={`Theme: ${THEME_DISPLAY[themeMode as ThemeMode]?.text}`}
            >
              <span style={{ fontSize: 12 }}>{THEME_DISPLAY[themeMode as ThemeMode]?.symbol}</span>
              <span style={{ fontSize: 10 }}>{THEME_DISPLAY[themeMode as ThemeMode]?.text}</span>
            </button>
            {themeMenuOpen && (
              <>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setThemeMenuOpen(false)} />
                <div className="dt-theme-menu" style={menuPositionAbove(themeButtonRef)}>
                  {(['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className="dt-ctx-item"
                      onClick={() => { setThemeMode(mode); setThemeMenuOpen(false); }}
                    >
                      <span style={{ color: THEME_DISPLAY[mode].color, marginRight: 6 }}>{THEME_DISPLAY[mode].symbol}</span>
                      {THEME_DISPLAY[mode].text}
                      {themeMode === mode && <span style={{ marginLeft: 'auto' }}>{'\u2713'}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="dt-status-bar-divider" />
          {/* Region toggles */}
          <div className="dt-region-toggles">
            <RegionToggle title="Left sidebar" active={showSidebar} position="left" onClick={() => setShowSidebar((v) => !v)} />
            <RegionToggle title="Bottom panel" active={showBottom} position="bottom" onClick={() => setShowBottom((v) => !v)} />
            <RegionToggle title="Right panel" active={rightPanel != null} position="right" onClick={() => setRightPanel((v) => v ? null : 'docs')} />
          </div>
          <div className="dt-status-bar-divider" />
          {/* Layout options menu */}
          <div>
            <button
              ref={layoutButtonRef}
              type="button"
              className="dt-region-toggle"
              onClick={() => setLayoutMenuOpen((v) => !v)}
              title="Layout options"
              aria-label="Layout options"
            >
              <svg viewBox="0 0 16 16" width={14} height={14} role="img" aria-hidden="true" style={{ display: 'block' }}>
                <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1" />
                <line x1="6" y1="5" x2="6" y2="15" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            {layoutMenuOpen && (
              <>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setLayoutMenuOpen(false)} />
                <div className="dt-layout-menu" style={menuPositionAbove(layoutButtonRef)}>
                  <button type="button" className="dt-ctx-item" onClick={() => { setBottomFullWidth((v) => !v); setLayoutMenuOpen(false); }}>
                    <span className="dt-layout-menu-icon"><LayoutIcon kind={bottomFullWidth ? 'bottom-full' : 'bottom-nested'} /></span>
                    <span>{bottomFullWidth ? '\u2713' : '\u2003'}</span>
                    Bottom panel full width
                  </button>
                  <button type="button" className="dt-ctx-item" onClick={() => { setActivityLabels((v) => !v); setRightActivityLabels((v) => !v); setLayoutMenuOpen(false); }}>
                    <span className="dt-layout-menu-icon"><LayoutIcon kind={activityLabels ? 'show-labels' : 'hide-labels'} /></span>
                    <span>{activityLabels ? '\u2713' : '\u2003'}</span>
                    Show activity bar labels
                  </button>
                  <div className="dt-ctx-sep" />
                  <button
                    type="button"
                    className={`dt-ctx-item${tl.state.hidden.length === 0 ? ' disabled' : ''}`}
                    disabled={tl.state.hidden.length === 0}
                    onClick={() => {
                      for (const id of tl.state.hidden) tl.restoreWindow(id);
                      setLayoutMenuOpen(false);
                    }}
                  >
                    Restore all hidden panels
                    {tl.state.hidden.length > 0 && <span style={{ marginLeft: 'auto', color: 'var(--dt-text-muted)' }}>({tl.state.hidden.length})</span>}
                  </button>
                  {tl.state.hidden.map((id) => {
                    const def = PANEL_TOOL_WINDOW_MAP[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        className="dt-ctx-item"
                        onClick={() => { tl.restoreWindow(id); setLayoutMenuOpen(false); }}
                      >
                        <span style={{ marginLeft: 12 }}>{def.label}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--dt-text-muted)', fontSize: 10 }}>
                          {'\u2192'} {PANEL_DOCK_LABELS[def.defaultSlot]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
