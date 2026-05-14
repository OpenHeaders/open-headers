import 'allotment/dist/style.css';
import { hostNavigation } from '@openheaders/core/navigation';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  EnvironmentProvider,
  FilesProvider,
  LiveVariablesProvider,
  LiveWorkflowsProvider,
  OAuthBundlesProvider,
  PauseMarkersProvider,
  RequestsProvider,
  VaultProvider,
  WorkspaceVariablesProvider,
} from '@openheaders/ui/context';
import {
  ActiveEditorDirtyProvider,
  ActiveFieldFocusProvider,
  ActiveTabEntityProvider,
  AwarenessIdentityProvider,
  SurfaceAwarenessPublisher,
  type SurfaceIdentityHandle,
} from '@openheaders/ui/shared/awareness';
import type { BottomPanelAlignment, DockSlot, SidebarLayoutVariant } from '@openheaders/ui/shared/dock-layout';
import {
  createShellEventBus,
  makeEditorTabCollisionDetection,
  ShellEventBusContext,
  ShellLayout,
  useFocusRegion,
} from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useEnvironments } from '@openheaders/ui/shared/hooks/useEnvironments';
import { VariablePopoverProvider } from '@openheaders/ui/workbench/components/template-input/VariablePopoverHost';
import { EnvSwitcherProvider, useEnvSwitcher } from '@openheaders/ui/workbench/services/env-switcher';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FilterDocs } from './components/FilterDocs';
import { InspectorDetailContent } from './components/InspectorDetailContent';
import { InspectorEditorGroupRenderer } from './components/InspectorEditorGroupRenderer';
import { MatchedRulesPanel } from './components/MatchedRulesPanel';
import PanelStatusBar from './components/PanelStatusBar';
import { PanelToolbar } from './components/PanelToolbar';
import { RuleExecutions } from './components/RuleExecutions';
import { RulePopoverProvider } from './components/RulePopoverHost';
import { SearchPanel } from './components/SearchPanel';
import { TrafficList } from './components/TrafficList';
import type { ColumnKey } from './components/traffic/columns';
import { DEFAULT_VISIBLE_COLUMNS } from './components/traffic/columns';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import { focusStore, setFocusedDock, setFocusedRegion } from './data/focus-store';
import { serializeHar, suggestHarFilename } from './data/har-export';
import type { DetailSection } from './data/inspector-tab';
import { buildInspectorTab } from './data/inspector-tab';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from './data/tool-windows';
import type { InspectorRequest } from './data/types';
import { useCacheBypass } from './data/use-cache-bypass';
import { useInspector } from './data/use-inspector';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { type PanelViewState, usePanelEditingScopeViewState, usePanelToolLayout } from './data/use-panel-tool-layout';
import { useRulesLookup } from './data/use-rules-lookup';
import { useSearchSession } from './data/use-search-session';

// ── Helpers ──────────────────────────────────────────────────────────

function sectionToTab(section: string): DetailSection {
  if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
  if (section === 'Query Params' || section === 'Request Body') return 'payload';
  if (section === 'Response') return 'response';
  return 'headers';
}

function formatBytes(total: number): string {
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} kB`;
  return `${(total / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTransferredSize(entries: readonly InspectorRequest[]): string {
  let total = 0;
  for (const e of entries) {
    const bs = e.harEntry.response?.bodySize;
    if (typeof bs === 'number' && bs > 0) {
      total += bs;
    } else if (e.responseSize && e.responseSize > 0) {
      total += e.responseSize;
    }
  }
  return formatBytes(total);
}

function formatResourceSize(entries: readonly InspectorRequest[]): string {
  let total = 0;
  for (const e of entries) {
    const size = e.harEntry.response?.content?.size;
    if (typeof size === 'number' && size > 0) total += size;
  }
  return formatBytes(total);
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

// Scope editor-tab collisions to the devpanel's tab-bar selector so an
// in-flight tab drag doesn't light up activity bars / tool-window sidebars.
const editorTabCollisionDetection = makeEditorTabCollisionDetection('.dt-editor-tab-bar');

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

interface AppProps {
  /**
   * Host-supplied surface identity resolver. The chrome
   * `devtools.inspectedWindow` / `tabs` lookups live in the extension
   * host (`resolveDevPanelIdentity`); this component stays host-agnostic.
   */
  resolveIdentity: () => SurfaceIdentityHandle;
}

export default function App({ resolveIdentity }: AppProps) {
  // Per-panel identity. Each DevTools panel page is its own JS realm, so
  // the host resolver runs once per panel lifetime. Its navigation
  // handle resolves the inspected tab so other surfaces can switch the
  // user back to the page whose DevTools hosts this panel.
  const devPanelIdentity = useMemo(() => resolveIdentity(), [resolveIdentity]);
  // Active workspace drives the lifeline `bind` message so the SW
  // refcount-acquires this surface's `WorkspaceServiceState` while the
  // DevTools panel is open (design § 4.0.7). DevPanel always reads
  // Active per § 4.0.3 — no per-tab editing scope here.
  const workspaceId = useActiveWorkspaceId();
  return (
    <AwarenessIdentityProvider value={devPanelIdentity} workspaceId={workspaceId}>
      {/*
       * Devpanel awareness foundation — same shape as the workbench
       * (Session 1+):
       *   - `ActiveTabEntity`     ← `RuleHoverPopover` writes when
       *                             visible+rule, clears on unmount
       *   - `ActiveFieldFocus`    ← `<EntityField>` focus capture in
       *                             popover inputs
       *   - `ActiveEditorDirty`   ← `useEditorDirty` from the popover
       *
       * `<SurfaceAwarenessPublisher>` is the sole `useAwareness` caller
       * for this surface — drops the popover's per-component publish.
       */}
      <ActiveFieldFocusProvider>
        <ActiveEditorDirtyProvider>
          <ActiveTabEntityProvider>
            <DevPanelAwarenessPublisher />
            <ShellEventBusContext.Provider value={busHandle.bus}>
              <PauseMarkersProvider surfaceId="panel">
                <EnvironmentProvider surfaceId="panel">
                  <WorkspaceVariablesProvider surfaceId="panel">
                    <VaultProvider surfaceId="panel">
                      <LiveVariablesProvider surfaceId="panel">
                        <LiveWorkflowsProvider surfaceId="panel">
                          <RequestsProvider surfaceId="panel">
                            <FilesProvider>
                              <OAuthBundlesProvider surfaceId="panel">
                                <EnvSwitcherProvider>
                                  <VariablePopoverProvider>
                                    <RulePopoverProvider>
                                      <PanelContent />
                                    </RulePopoverProvider>
                                  </VariablePopoverProvider>
                                </EnvSwitcherProvider>
                              </OAuthBundlesProvider>
                            </FilesProvider>
                          </RequestsProvider>
                        </LiveWorkflowsProvider>
                      </LiveVariablesProvider>
                    </VaultProvider>
                  </WorkspaceVariablesProvider>
                </EnvironmentProvider>
              </PauseMarkersProvider>
            </ShellEventBusContext.Provider>
          </ActiveTabEntityProvider>
        </ActiveEditorDirtyProvider>
      </ActiveFieldFocusProvider>
    </AwarenessIdentityProvider>
  );
}

// Pulls the active workspace id from the same hook the popover uses,
// so the publisher's `workspaceId` follows the panel's environment.
function DevPanelAwarenessPublisher(): React.ReactElement {
  const workspaceId = useActiveWorkspaceId();
  return <SurfaceAwarenessPublisher workspaceId={workspaceId} migratedEntityTypes={[RULE_ENTITY_TYPE]} />;
}

// ── PanelContent (consumes the event bus via useFocusRegion) ─────────

function PanelContent() {
  const perTab = usePanelEditingScopeViewState();
  if (!perTab.ready) {
    return <div className="rules-shell rules-shell-loading" />;
  }
  return <PanelContentReady perTab={perTab} />;
}

function PanelContentReady({ perTab }: { perTab: EditingScopeViewStateApi<PanelViewState> }) {
  const {
    entries,
    danglingFires,
    navTiming,
    clear: clearStore,
    preserveLog,
    setPreserveLog,
    recording,
    setRecording,
  } = useInspector();
  const groups = useInspectorEditorGroups({ perTab });
  const tl = usePanelToolLayout(perTab);
  const panelSizes = useMemo(getPanelSizes, []);
  // Search session lives at the panel level — SearchPanel itself
  // mounts/unmounts as the user toggles the Search tool window, and
  // we don't want that to discard the user's query and results.
  const searchSession = useSearchSession(entries);
  // Rules registry — needed to attribute which request/response
  // headers were added / modified / removed by an Open Headers rule.
  const rulesByUid = useRulesLookup();
  // "Disable Cache" toolbar toggle — panel-scoped, auto-cleans on unmount.
  const cacheBypass = useCacheBypass();
  // Live Rules Mode setting — drives per-rule cache-bypass attribution
  // (yellow) for request headers on any request that matched a user
  // header rule without explicit Cache-Control handling.
  const [liveRulesMode] = useSetting('rulesEngine.liveRulesMode');
  // Environment switcher feed for the panel top bar. Panel mounts the
  // env-switcher provider without `collectionContext`, so the service
  // degrades to plain manual-pick (setManualEnv + setActiveEnvironment)
  // which is exactly what the panel needs — it has no collection/tab
  // navigation and thus no collection-mode side effects to apply.
  const envApi = useEnvironments();
  const { pickActiveEnvironment: handlePanelSwitchEnv } = useEnvSwitcher();

  const clear = useCallback(() => {
    clearStore();
    groups.closeAllTabs();
  }, [clearStore, groups]);

  // ── Layout settings (persisted via settings store) ────────────
  // The panel has its own namespace (`devpanelLayout.*`) so the user
  // can keep the workspace's wider defaults while the narrower DevTools
  // surface stays compact. Labels default to off here for that reason.
  const [activityLabels, setActivityLabels] = useSetting('devpanelLayout.showToolWindowLabels');
  const [bottomPanelAlignment] = useSetting('devpanelLayout.bottomPanelAlignment');
  const [sidebarLayout] = useSetting('devpanelLayout.sidebarLayout');
  const [barWidthLeft, setBarWidthLeft] = useSetting('devpanelLayout.activityBarWidthLeft');
  const [barWidthRight, setBarWidthRight] = useSetting('devpanelLayout.activityBarWidthRight');
  const toggleLabels = useCallback(() => setActivityLabels(!activityLabels), [activityLabels, setActivityLabels]);
  const handleBarResize = useCallback(
    (sizes: { left: number; right: number }) => {
      setBarWidthLeft(sizes.left);
      setBarWidthRight(sizes.right);
    },
    [setBarWidthLeft, setBarWidthRight],
  );

  // ── Panel-level state ──────────────────────────────────────
  const lastSectionRef = useRef<DetailSection>('headers');
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [showFilter, setShowFilter] = useState(true);
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  /** N-th match within the searched section (0-based). Lets the viewer
   *  scroll to this specific occurrence, not just the first. */
  const [searchMatchIndex, setSearchMatchIndex] = useState<number | undefined>(undefined);
  const [, setSearchNonce] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));

  // Sync inspected-window origin into filter config so "Hide 3rd party"
  // has a baseline to compare against. Coming from the nav-timing port
  // message avoids a second round-trip over inspectedWindow.eval.
  useLayoutEffect(() => {
    if (!navTiming) return;
    setFilterConfig((prev) =>
      prev.pageOrigin === navTiming.pageOrigin ? prev : { ...prev, pageOrigin: navTiming.pageOrigin },
    );
  }, [navTiming]);

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
    (entryId: string, highlight: string, section: string, lineNumber: number, matchIndex: number) => {
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
      setSearchMatchIndex(matchIndex);
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
          rulesByUid={rulesByUid}
          cacheBypassEnabled={cacheBypass.enabled}
          liveRulesMode={liveRulesMode}
          activeSection={tab.activeSection}
          onSectionChange={(s) => {
            lastSectionRef.current = s;
            groups.updateTab(tab.id, { activeSection: s });
          }}
          searchHighlight={isActiveTab ? searchHighlight : undefined}
          searchSection={isActiveTab ? searchSection : undefined}
          searchLineNumber={isActiveTab ? searchLineNumber : undefined}
          searchMatchIndex={isActiveTab ? searchMatchIndex : undefined}
        />
      );
    },
    [
      entries,
      groups,
      rulesByUid,
      cacheBypass.enabled,
      liveRulesMode,
      searchHighlight,
      searchSection,
      searchLineNumber,
      searchMatchIndex,
    ],
  );

  const renderEmpty = useCallback(
    () => <div className="dt-editor-empty">Select a request from the sidebar to inspect</div>,
    [],
  );

  const activeTab = groups.focusedLeaf.tabs.find((t) => t.id === groups.activeTabId);
  const selectedId = activeTab?.requestId ?? null;
  const transferredSize = useMemo(() => formatTransferredSize(entries), [entries]);
  const resourceSize = useMemo(() => formatResourceSize(entries), [entries]);
  const finishTime = useMemo(() => formatFinishTime(entries), [entries]);

  // ── HAR export helpers ─────────────────────────────────────
  const downloadHar = useCallback((subset: readonly InspectorRequest[], filename: string) => {
    const json = serializeHar(subset);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const handleSaveAllAsHar = useCallback(() => {
    downloadHar(entries, suggestHarFilename(entries));
  }, [entries, downloadHar]);

  const handleSaveAsHar = useCallback(
    (entry: InspectorRequest) => {
      const single: readonly InspectorRequest[] = [entry];
      downloadHar(single, suggestHarFilename(single));
    },
    [downloadHar],
  );

  const handleCopyAllAsHar = useCallback(async () => {
    const json = serializeHar(entries);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // Best-effort — clipboard may be gated in some DevTools contexts.
    }
  }, [entries]);

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
              onFilterChange={setFilter}
              filterTokens={filterTokens}
              filterConfig={filterConfig}
              onFilterConfigChange={setFilterConfig}
              urlFilter={urlFilter}
              onUrlFilterChange={setUrlFilter}
              filterError={filterError}
              onToggleDocs={() => tl.toggleWindow('docs')}
              docsActive={iconState('docs') !== undefined}
              showFilter={showFilter}
              recording={recording}
              onStartRecording={() => setRecording(true)}
              onReloadPage={() => hostNavigation.reloadInspectedTab()}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
              onSaveAsHar={handleSaveAsHar}
              onSaveAllAsHar={handleSaveAllAsHar}
              onCopyAllAsHar={handleCopyAllAsHar}
              onHide={() => tl.toggleWindow('network')}
            />
          );
        case 'rules':
          return (
            <RuleExecutions
              entries={entries}
              danglingFires={danglingFires}
              onRequestClick={handleCrossNav}
              onHide={() => tl.toggleWindow('rules')}
            />
          );
        case 'search':
          return (
            <SearchPanel
              session={searchSession}
              onClose={() => tl.toggleWindow('search')}
              onResultClick={handleSearchResult}
              docsActive={iconState('docs') !== undefined}
              onToggleDocs={() => tl.toggleWindow('docs')}
            />
          );
        case 'docs':
          return <FilterDocs onClose={() => tl.toggleWindow('docs')} />;
        case 'matched-rules': {
          const selectedRequest = selectedId ? (entries.find((e) => e.id === selectedId) ?? null) : null;
          return (
            <MatchedRulesPanel
              request={selectedRequest}
              rulesByUid={rulesByUid}
              onClose={() => tl.toggleWindow('matched-rules')}
            />
          );
        }
      }
    },
    [
      entries,
      selectedId,
      handleSelect,
      filter,
      filterTokens,
      filterConfig,
      filterError,
      showFilter,
      urlFilter,
      recording,
      setRecording,
      danglingFires,
      handleCrossNav,
      handleSearchResult,
      tl,
      iconState,
      visibleColumns,
      handleSaveAsHar,
      handleSaveAllAsHar,
      handleCopyAllAsHar,
      searchSession,
      rulesByUid,
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
        filterConfig={filterConfig}
        onFilterConfigChange={setFilterConfig}
        onExportHar={handleSaveAllAsHar}
        onCopyAllHar={handleCopyAllAsHar}
        canExport={entries.length > 0}
        cacheBypassEnabled={cacheBypass.enabled}
        onToggleCacheBypass={cacheBypass.toggle}
        showToolWindowLabels={activityLabels}
        tl={tl}
        perTab={perTab}
        environments={envApi.environments}
        activeEnvironmentId={envApi.activeEnvironmentId}
        onSwitchEnvironment={handlePanelSwitchEnv}
      />

      <ShellLayout<PanelToolWindowId>
        tl={tl}
        windowMap={PANEL_TOOL_WINDOW_MAP}
        renderToolWindow={renderToolWindow}
        renderEditor={renderEditor}
        onHorizontalResize={noopResize}
        onVerticalResize={noopResize}
        renderEditorTabDragPreview={renderEditorTabDragPreview}
        bottomPanelAlignment={bottomPanelAlignment as BottomPanelAlignment}
        showToolWindowLabels={activityLabels}
        sidebarLayout={sidebarLayout as SidebarLayoutVariant}
        onToggleLabels={toggleLabels}
        activityBarWidths={{ left: barWidthLeft, right: barWidthRight }}
        onActivityBarResize={handleBarResize}
        sizes={panelSizes}
        collisionDetection={editorTabCollisionDetection}
        focusStore={focusStore}
      />

      <PanelStatusBar
        requestCount={entries.length}
        transferredSize={transferredSize}
        resourceSize={resourceSize}
        finishTime={finishTime}
        dclMs={navTiming?.dclMs}
        loadMs={navTiming?.loadMs}
        tabCount={groups.allTabs.length}
      />
    </div>
  );
}
