import 'allotment/dist/style.css';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSetting } from '@/rules/settings/hooks';
import type { DockSlot, SidebarLayoutVariant } from '@/shared/dock-layout';
import { createShellEventBus, ShellEventBusContext, ShellLayout, useFocusRegion } from '@/shared/dock-layout';
import { FilterDocs } from './components/FilterDocs';
import { InspectorDetailContent } from './components/InspectorDetailContent';
import { InspectorEditorGroupRenderer } from './components/InspectorEditorGroupRenderer';
import PanelStatusBar from './components/PanelStatusBar';
import { PanelToolbar } from './components/PanelToolbar';
import { RuleExecutions } from './components/RuleExecutions';
import { SearchPanel } from './components/SearchPanel';
import { TrafficList } from './components/TrafficList';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import { focusStore, setFocusedDock, setFocusedRegion } from './data/focus-store';
import type { DetailSection } from './data/inspector-tab';
import { buildInspectorTab } from './data/inspector-tab';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from './data/tool-windows';
import { useInspector } from './data/use-inspector';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { usePanelToolLayout } from './data/use-panel-tool-layout';

// ── Helpers ──────────────────────────────────────────────────────────

function sectionToTab(section: string): DetailSection {
  if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
  if (section === 'Query Params' || section === 'Request Body') return 'payload';
  if (section === 'Response') return 'response';
  return 'headers';
}

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

// ── Shell event bus (created once, stable across renders) ────────────

const busHandle = createShellEventBus();

// ── Panel sizes ──────────────────────────────────────────────────────

function getPanelSizes() {
  const half = Math.round(window.innerWidth * 0.5);
  return {
    sidebar: { preferred: half, min: 180, max: Math.round(window.innerWidth * 0.65) },
    inspector: { preferred: 400, min: 180, max: 500 },
    bottom: { preferred: 160, min: 80, max: 400 },
    editorMin: 120,
  };
}

// ── App (provides the event bus context) ─────────────────────────────

export default function App() {
  return (
    <ShellEventBusContext.Provider value={busHandle.bus}>
      <PanelContent />
    </ShellEventBusContext.Provider>
  );
}

// ── PanelContent (consumes the event bus via useFocusRegion) ─────────

function PanelContent() {
  const {
    entries,
    danglingFires,
    clear: clearStore,
    preserveLog,
    setPreserveLog,
    recording,
    setRecording,
  } = useInspector();
  const groups = useInspectorEditorGroups();
  const tl = usePanelToolLayout();
  const panelSizes = useMemo(getPanelSizes, []);

  const clear = useCallback(() => {
    clearStore();
    groups.closeAllTabs();
  }, [clearStore, groups]);

  // ── Layout settings (persisted via settings store) ────────────
  // The panel defaults to compact activity bars (no labels) since the
  // devtools panel is narrower than the workspace. The user can toggle
  // labels on via the layout menu or activity-bar right-click.
  const [activityLabels, setActivityLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const [bottomFullWidth] = useSetting('workspaceLayout.bottomPanelFullWidth');
  const [sidebarLayout] = useSetting('workspaceLayout.sidebarLayout');
  const toggleLabels = useCallback(() => setActivityLabels(!activityLabels), [activityLabels, setActivityLabels]);

  // ── Panel-level state ──────────────────────────────────────
  const lastSectionRef = useRef<DetailSection>('headers');
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [showFilter, setShowFilter] = useState(true);
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  const [, setSearchNonce] = useState(0);

  // ── Shell event bus + focus region ─────────────────────────
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => busHandle.attach(shellRef.current), []);

  useFocusRegion({
    shellRef,
    setFocusedRegion,
    setFocusedDock,
  });

  // ── Derived ────────────────────────────────────────────────

  const iconState = useCallback(
    (windowId: PanelToolWindowId): 'focused' | 'active' | undefined => {
      const slot = tl.dockOf(windowId);
      if (!slot) return undefined;
      if (tl.state.docks[slot].active !== windowId) return undefined;
      return 'active';
    },
    [tl],
  );

  // ── Filter ─────────────────────────────────────────────────
  const filterTokens = useMemo(() => parseFilter(urlFilter, filterConfig), [urlFilter, filterConfig]);
  const filterError = useMemo(() => hasFilterError(filterTokens), [filterTokens]);

  // ── Open request as tab ────────────────────────────────────
  const handleSelect = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const tab = buildInspectorTab(entry, 'network');
      tab.statusCode = entry.statusCode;
      tab.activeSection = lastSectionRef.current;
      groups.addTab(tab);
      setSearchHighlight(undefined);
      setSearchSection(undefined);
      setSearchLineNumber(undefined);
    },
    [entries, groups],
  );

  const handleCrossNav = useCallback(
    (id: string) => {
      tl.activateWindow('network');
      handleSelect(id);
    },
    [tl, handleSelect],
  );

  const handleSearchResult = useCallback(
    (entryId: string, highlight: string, section: string, lineNumber: number) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const tab = buildInspectorTab(entry, 'network');
      tab.activeSection = sectionToTab(section);
      tab.statusCode = entry.statusCode;
      groups.addTab(tab);
      groups.updateTab(tab.id, { activeSection: sectionToTab(section) });
      setSearchHighlight(highlight);
      setSearchSection(section);
      setSearchLineNumber(lineNumber);
      setSearchNonce((n) => n + 1);
    },
    [entries, groups],
  );

  // ── Editor group tab body ──────────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: ReturnType<typeof buildInspectorTab>; leafId: string; isFocusedLeaf: boolean }) => {
      const request = entries.find((e) => e.id === tab.requestId);
      if (!request) {
        return <div className="dt-editor-empty">Request no longer available (cleared or navigated away)</div>;
      }
      const isActiveTab = tab.id === groups.activeTabId;
      return (
        <InspectorDetailContent
          request={request}
          activeSection={tab.activeSection}
          onSectionChange={(s) => {
            lastSectionRef.current = s;
            groups.updateTab(tab.id, { activeSection: s });
          }}
          searchHighlight={isActiveTab ? searchHighlight : undefined}
          searchSection={isActiveTab ? searchSection : undefined}
          searchLineNumber={isActiveTab ? searchLineNumber : undefined}
        />
      );
    },
    [entries, groups, searchHighlight, searchSection, searchLineNumber],
  );

  const renderEmpty = useCallback(
    () => <div className="dt-editor-empty">Select a request from the sidebar to inspect</div>,
    [],
  );

  const activeTab = groups.focusedLeaf.tabs.find((t) => t.id === groups.activeTabId);
  const selectedId = activeTab?.requestId ?? null;
  const totalSize = useMemo(() => formatTotalSize(entries), [entries]);
  const finishTime = useMemo(() => formatFinishTime(entries), [entries]);

  // ── Tool window content ────────────────────────────────────
  const renderToolWindow = useCallback(
    (windowId: PanelToolWindowId, _slot: DockSlot): React.ReactNode => {
      switch (windowId) {
        case 'network':
          return (
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
                (
                  chrome as unknown as { devtools?: { inspectedWindow?: { reload: () => void } } }
                ).devtools?.inspectedWindow?.reload();
              }}
            />
          );
        case 'rules':
          return <RuleExecutions entries={entries} danglingFires={danglingFires} onRequestClick={handleCrossNav} />;
        case 'search':
          return (
            <SearchPanel
              entries={entries}
              onClose={() => tl.toggleWindow('search')}
              onResultClick={handleSearchResult}
              docsActive={iconState('docs') !== undefined}
              onToggleDocs={() => tl.toggleWindow('docs')}
            />
          );
        case 'docs':
          return <FilterDocs onClose={() => tl.toggleWindow('docs')} />;
        case 'console':
          return <div className="dt-editor-empty">Console — content coming soon</div>;
      }
    },
    [
      entries,
      selectedId,
      handleSelect,
      filter,
      filterTokens,
      filterConfig,
      recording,
      setRecording,
      danglingFires,
      handleCrossNav,
      handleSearchResult,
      tl,
      iconState,
    ],
  );

  // ── Editor content ─────────────────────────────────────────
  const renderEditor = useCallback(
    () => (
      <InspectorEditorGroupRenderer
        groups={groups}
        renderTabBody={renderTabBody}
        renderEmpty={renderEmpty}
        onCloseTab={groups.closeTab}
        onCloseOther={groups.closeOtherTabs}
        onCloseAll={groups.closeAllTabs}
        onCloseToLeft={groups.closeTabsToLeft}
        onCloseToRight={groups.closeTabsToRight}
        recentlyClosed={groups.recentlyClosed}
      />
    ),
    [groups, renderTabBody, renderEmpty],
  );

  const renderEditorTabDragPreview = useCallback(
    (tabId: string): React.ReactNode => {
      const tab = groups.allTabs.find((t) => t.id === tabId);
      if (!tab) return null;
      return (
        <div className="dt-editor-tab active" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)', opacity: 0.9 }}>
          <span
            className="dt-method-badge"
            style={{
              color: tab.method === 'GET' ? '#61affe' : tab.method === 'POST' ? '#49cc90' : '#fca130',
            }}
          >
            {tab.method}
          </span>
          <span className="dt-editor-tab-label">{tab.label.replace(/^[A-Z]+ /, '')}</span>
        </div>
      );
    },
    [groups.allTabs],
  );

  const rulesVisible = iconState('rules') !== undefined;

  // ── No-op resize handlers (panel doesn't persist sizes) ────
  const noopResize = useCallback((_sizes: number[]) => {}, []);

  // ── Layout ─────────────────────────────────────────────────

  return (
    <div className="dt-panel-root" ref={shellRef}>
      <PanelToolbar
        recording={recording}
        onToggleRecording={() => setRecording(!recording)}
        onClear={clear}
        showFilter={showFilter}
        onToggleFilter={() => setShowFilter(!showFilter)}
        searchActive={iconState('search') !== undefined}
        onToggleSearch={() => tl.toggleWindow('search')}
        preserveLog={preserveLog}
        onPreserveLogChange={setPreserveLog}
        rulesVisible={rulesVisible}
        urlFilter={urlFilter}
        onUrlFilterChange={setUrlFilter}
        filterConfig={filterConfig}
        onFilterConfigChange={setFilterConfig}
        filterError={filterError}
        docsState={iconState('docs')}
        onToggleDocs={() => tl.toggleWindow('docs')}
        filter={filter}
        onFilterChange={setFilter}
      />

      <ShellLayout<PanelToolWindowId>
        tl={tl}
        windowMap={PANEL_TOOL_WINDOW_MAP}
        renderToolWindow={renderToolWindow}
        renderEditor={renderEditor}
        onHorizontalResize={noopResize}
        onVerticalResize={noopResize}
        renderEditorTabDragPreview={renderEditorTabDragPreview}
        bottomPanelFullWidth={bottomFullWidth}
        showToolWindowLabels={activityLabels}
        sidebarLayout={sidebarLayout as SidebarLayoutVariant}
        onToggleLabels={toggleLabels}
        sizes={panelSizes}
        focusStore={focusStore}
      />

      <PanelStatusBar
        tl={tl}
        requestCount={entries.length}
        totalSize={totalSize}
        finishTime={finishTime}
        tabCount={groups.allTabs.length}
      />
    </div>
  );
}
