import 'allotment/dist/style.css';
import { hostNavigation } from '@openheaders/core/navigation';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { isFetchRealizableNow, isRuleComplete } from '@openheaders/core/utils';
import {
  EnvironmentProvider,
  FilesProvider,
  LiveVariablesProvider,
  LiveWorkflowsProvider,
  OAuthBundlesProvider,
  PauseMarkersProvider,
  RequestsProvider,
  RuleProvider,
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
import DocsPanel from '@openheaders/ui/shared/docs/DocsPanel';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import { DocsNavProvider, useDocsNav } from '@openheaders/ui/shared/docs/use-docs-nav';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { VariablePopoverProvider } from '@openheaders/ui/workbench/components/template-input/VariablePopoverHost';
import { EnvSwitcherProvider, useEnvSwitcher } from '@openheaders/ui/workbench/services/env-switcher';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ConsoleView } from './components/ConsoleView';
import { PANEL_DEFAULT_SECTION_ID, PANEL_DOC_GROUPS } from './components/docs/registry';
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
import { matchesPanelFilters } from './components/traffic/row-filter';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import { focusStore, setFocusedDock, setFocusedRegion } from './data/stores/focus-store';
import type { InspectorRowWithFires } from './data/inspector-row-projection';
import { buildInspectorTab } from './data/inspector-tab';
import { useParityDebugHook } from './data/parity-debug-hook';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from './data/tool-windows';
import { useConsoleClient } from './data/stores/use-console-client';
import { useFireClient } from './data/stores/use-fire-client';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { useLifecycleClient } from './data/stores/use-lifecycle-client';
import { useNavClearFloor } from './data/use-nav-clear-floor';
import { useRecordingWindows } from './data/use-recording-windows';
import { usePageClient } from './data/stores/use-page-client';
import { usePanelData } from './data/use-panel-data';
import { useResourceTimingClient } from './data/stores/use-resource-timing-client';
import { type PanelViewState, usePanelEditingScopeViewState, usePanelToolLayout } from './data/use-panel-tool-layout';
import { usePanelUiState } from './data/use-panel-ui-state';
import { useCacheBypass } from './data/use-cache-bypass';
import { useFooterSummary } from './data/use-footer-summary';
import { useHarExport } from './data/har/use-har-export';
import { useInspectorTabJumps } from './data/use-inspector-tab-jumps';
import { useRulesLookup } from './data/rule-create/use-rules-lookup';
import { useSearchSession } from './data/search/use-search-session';

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
  const devPanelIdentity = useMemo(() => resolveIdentity(), [resolveIdentity]);
  const workspaceId = useActiveWorkspaceId();
  return (
    <AwarenessIdentityProvider value={devPanelIdentity} workspaceId={workspaceId}>
      <ActiveFieldFocusProvider>
        <ActiveEditorDirtyProvider>
          <ActiveTabEntityProvider>
            <DevPanelAwarenessPublisher />
            <ShellEventBusContext.Provider value={busHandle.bus}>
              <PauseMarkersProvider surfaceId="panel">
                <RuleProvider surfaceId="panel">
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
                                        <DocsNavProvider>
                                          <InfoPopoverContainerProvider
                                            resolver={(trigger) =>
                                              // A trigger inside the hover-anchored waterfall popover
                                              // portals into that popover's overlay — hovering the
                                              // nested info popover then still counts as hovering the
                                              // outer content, so the outer popover stays open.
                                              trigger.closest<HTMLElement>('.dt-waterfall-pop-overlay') ??
                                              trigger.closest<HTMLElement>('.dt-panel-root') ??
                                              null
                                            }
                                          >
                                            <PanelContent />
                                          </InfoPopoverContainerProvider>
                                        </DocsNavProvider>
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
                </RuleProvider>
              </PauseMarkersProvider>
            </ShellEventBusContext.Provider>
          </ActiveTabEntityProvider>
        </ActiveEditorDirtyProvider>
      </ActiveFieldFocusProvider>
    </AwarenessIdentityProvider>
  );
}

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
  // Three port-bound clients (lifecycle / page / fire) plus
  // `usePanelUiState`, which owns the panel-local toggles
  // (preserveLog / recording) and the `clear()` action that fans out
  // to every registered store.
  const lifecycleClient = useLifecycleClient();
  const pageClient = usePageClient();
  const fireClient = useFireClient();
  const resourceTimingClient = useResourceTimingClient();
  // Console stream lives at the panel root (like the other port clients) so its
  // buffer + port survive tool-window switches — re-opening the Console tab
  // replays nothing. Clear is console-local, so it stays out of the panel-wide
  // `ui.clear()` resettables below.
  const consoleClient = useConsoleClient();
  const ui = usePanelUiState({
    resettables: useMemo(
      // Lifecycle clears via `clearSession` (local mirror + engine session
      // floor) so a Clear survives reconnects; the others clear locally.
      () => [
        { clear: lifecycleClient.clearSession },
        pageClient.store,
        fireClient.store,
        resourceTimingClient.store,
      ],
      [lifecycleClient.clearSession, pageClient.store, fireClient.store, resourceTimingClient.store],
    ),
  });
  // Preserve-log boundary: a monotonic clear floor that advances on
  // navigation while the toggle is off and freezes when on, so re-enabling
  // never resurrects the past (browser-parity).
  const navClearFloorMs = useNavClearFloor(lifecycleClient.snapshot.ordered, pageClient.snapshot.pages, ui.preserveLog);
  // Stop recording → requests that start while stopped are dropped from the
  // view (browser-parity); resuming records from that point forward.
  const recordingWindows = useRecordingWindows(ui.recording);
  const data = usePanelData({
    lifecycle: lifecycleClient.snapshot,
    page: pageClient.snapshot,
    fire: fireClient.snapshot,
    // Every observed attempt is a real row (browser-parity); retry
    // consolidation is intentionally off and no longer tied to the
    // Preserve-log toggle.
    opts: useMemo(() => ({ consolidateRetries: false }), []),
    navClearFloorMs,
    recordingWindows,
    // Renderer memory-cache hits, reconciled panel-local against real rows.
    resourceTiming: resourceTimingClient.snapshot,
    // Manual-Clear floor for the RT feed — the panel-local analog of the
    // engine clear floor that scopes real rows; without it, clearing the
    // real rows resurfaces their cached entries as `(memory cache)` rows.
    clearFloorMs: ui.clearFloorMs,
  });

  // Resolver passed down to detail panes — pure projection over the
  // panel-data lookup map, no traversal at render time.
  const getRowByUrl = useCallback(
    (url: string): InspectorRowWithFires | null => data.lookupByUrl.get(url) ?? null,
    [data.lookupByUrl],
  );

  // Parity capture loop reads the rendered rows — the same merged, scoped
  // set the list renders (including synthetic memory-cache rows), with
  // their attached fires so a capture can assert the fire-evidence plane —
  // plus the footer projection so a capture can assert the redirect-leg
  // anchoring.
  useParityDebugHook(
    data.rows,
    {
      source: lifecycleClient.source,
      footerDclMs: data.footerDclMs ?? null,
      footerLoadMs: data.footerLoadMs ?? null,
      finishTimeMs: data.finishTimeMs,
      aggregateDclMs: data.aggregateDclMs ?? null,
      aggregateLoadMs: data.aggregateLoadMs ?? null,
      aggregateFinishMs: data.aggregateFinishMs,
      footerAnchorMs: data.footerAnchorMs,
      legMs: data.legMs,
      pages: data.pages.map((p) => ({
        id: p.id,
        url: p.url,
        startedAtMs: p.startedAtMs,
        committedAtMs: p.committedAtMs ?? null,
        dclMs: p.dclMs ?? null,
        loadMs: p.loadMs ?? null,
        loaderId: p.loaderId ?? null,
        documentId: p.documentId ?? null,
      })),
    },
    ui.clear,
    data.pages,
    data.dangling,
  );

  const groups = useInspectorEditorGroups({ perTab, liveSessionToken: lifecycleClient.sessionToken });
  const tl = usePanelToolLayout(perTab);
  // Make `openDocs(sectionId)` from anywhere in the panel tree open the
  // docs tool-window. Effect runs on every `tl` identity change so the
  // ref always points at the current controller.
  const { onOpenDocs: onOpenDocsRef } = useDocsNav();
  useEffect(() => {
    onOpenDocsRef.current = () => {
      if (tl.state.hidden.includes('docs')) tl.restoreWindow('docs');
      tl.activateWindow('docs');
    };
    return () => {
      onOpenDocsRef.current = null;
    };
  }, [tl, onOpenDocsRef]);
  const panelSizes = useMemo(getPanelSizes, []);
  // Search session lives at the panel level — SearchPanel itself
  // mounts/unmounts as the user toggles the Search tool window, and
  // we don't want that to discard the user's query and results.
  const searchSession = useSearchSession(data.rows);
  // Rules registry — needed to attribute which request/response
  // headers were added / modified / removed by an Open Headers rule.
  const rulesByUid = useRulesLookup();
  // Never-silent (C3·S3): does a live debug-tier rule exist whose extended
  // reach Debug mode could realize now? Gates the footer dormant-notice chip
  // so it stays silent when there's nothing to be dormant about.
  const hasRealizableDebugRule = useMemo(
    () => [...rulesByUid.values()].some((r) => r.enabled && isRuleComplete(r) && isFetchRealizableNow(r)),
    [rulesByUid],
  );
  // "Disable Cache" toolbar toggle — panel-scoped, auto-cleans on unmount.
  const cacheBypass = useCacheBypass();
  // Live Rules Mode setting — drives per-rule cache-bypass attribution
  // (yellow) for request headers on any request that matched a user
  // header rule without explicit Cache-Control handling.
  const [liveRulesMode] = useSetting('rulesEngine.liveRulesMode');
  const envApi = useEnvironments();
  const { pickActiveEnvironment: handlePanelSwitchEnv } = useEnvSwitcher();

  const clear = useCallback(() => {
    ui.clear();
    groups.closeAllTabs();
  }, [ui, groups]);

  // ── Layout settings (persisted via settings store) ────────────
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
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [showFilter, setShowFilter] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));

  // Sync inspected-window origin into filter config so "Hide 3rd party"
  // has a baseline to compare against.
  useLayoutEffect(() => {
    const navTiming = data.navTiming;
    if (!navTiming) return;
    setFilterConfig((prev) =>
      prev.pageOrigin === navTiming.pageOrigin ? prev : { ...prev, pageOrigin: navTiming.pageOrigin },
    );
  }, [data.navTiming]);

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
  // The displayed (filtered) row set, computed once here — the filter-state
  // owner — and shared with both the table and the footer subset so the two
  // can never disagree about which rows passed.
  const filteredRows = useMemo(
    () => data.rows.filter((r) => matchesPanelFilters(r.lifecycle, { filter, filterTokens, filterConfig })),
    [data.rows, filter, filterTokens, filterConfig],
  );

  // ── Open request as tab ────────────────────────────────────
  const {
    lastSectionRef,
    handleSelect,
    handleCrossNav,
    handleAnnotationJump,
    handleSearchResult,
    searchHighlight,
    searchSection,
    searchLineNumber,
    searchMatchIndex,
  } = useInspectorTabJumps({ lookupByRequestId: data.lookupByRequestId, groups, tl });

  // ── Editor group tab body ──────────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: ReturnType<typeof buildInspectorTab>; leafId: string; isFocusedLeaf: boolean }) => {
      const row = data.lookupByRequestId.get(tab.requestId);
      if (!row) {
        return <div className="dt-editor-empty">Request no longer available (cleared or navigated away)</div>;
      }
      const isActiveTab = tab.id === groups.activeTabId;
      return (
        <InspectorDetailContent
          row={row}
          rulesByUid={rulesByUid}
          pages={data.pages}
          getInitiatorChildren={data.getInitiatorChildren}
          getConnectionReuse={data.getConnectionReuse}
          getRepeatStats={data.getRepeatStats}
          baselineMs={data.baselineMs}
          pageOrigin={filterConfig.pageOrigin}
          onOpenRequest={handleCrossNav}
          getRowByUrl={getRowByUrl}
          cacheBypassEnabled={cacheBypass.enabled}
          liveRulesMode={liveRulesMode}
          activeSection={tab.activeSection}
          onSectionChange={(s) => {
            lastSectionRef.current = s;
            groups.updateTab(tab.id, { activeSection: s });
          }}
          source={lifecycleClient.source}
          requestResponseBody={lifecycleClient.requestResponseBody}
          searchHighlight={isActiveTab ? searchHighlight : undefined}
          searchSection={isActiveTab ? searchSection : undefined}
          searchLineNumber={isActiveTab ? searchLineNumber : undefined}
          searchMatchIndex={isActiveTab ? searchMatchIndex : undefined}
        />
      );
    },
    [
      data.lookupByRequestId,
      data.pages,
      data.getInitiatorChildren,
      data.getConnectionReuse,
      data.getRepeatStats,
      data.baselineMs,
      groups,
      rulesByUid,
      filterConfig.pageOrigin,
      handleCrossNav,
      getRowByUrl,
      cacheBypass.enabled,
      liveRulesMode,
      lifecycleClient.source,
      lifecycleClient.requestResponseBody,
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
  const footer = useFooterSummary(data, filteredRows);

  // ── HAR export helpers ─────────────────────────────────────
  const { handleSaveAllAsHar, handleSaveAsHar, handleCopyAllAsHar, handleCopyAsHar } = useHarExport({
    rows: data.rows,
    pages: data.pages,
  });

  // ── Tool window content ────────────────────────────────────
  const renderToolWindow = useCallback(
    (windowId: PanelToolWindowId, _slot: DockSlot): React.ReactNode => {
      switch (windowId) {
        case 'network':
          return (
            <TrafficList
              rows={data.rows}
              filteredRows={filteredRows}
              pages={data.pages}
              cdpEnhanced={lifecycleClient.source === 'cdp'}
              selectedId={selectedId}
              onSelect={handleSelect}
              filter={filter}
              onFilterChange={setFilter}
              filterConfig={filterConfig}
              onFilterConfigChange={setFilterConfig}
              urlFilter={urlFilter}
              onUrlFilterChange={setUrlFilter}
              filterError={filterError}
              onToggleDocs={() => tl.toggleWindow('docs')}
              docsActive={iconState('docs') !== undefined}
              showFilter={showFilter}
              recording={ui.recording}
              onStartRecording={() => ui.setRecording(true)}
              onReloadPage={() => hostNavigation.reloadInspectedTab()}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
              onCopyAsHar={handleCopyAsHar}
              onSaveAsHar={handleSaveAsHar}
              onSaveAllAsHar={handleSaveAllAsHar}
              onCopyAllAsHar={handleCopyAllAsHar}
              onHide={() => tl.toggleWindow('network')}
              onAnnotationJump={handleAnnotationJump}
            />
          );
        case 'console':
          return (
            <ConsoleView
              entries={consoleClient.snapshot.entries}
              onClear={() => consoleClient.store.clear()}
              onHide={() => tl.toggleWindow('console')}
            />
          );
        case 'rules':
          return (
            <RuleExecutions
              rows={data.rows}
              danglingFires={data.dangling}
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
          return (
            <DocsPanel
              groups={PANEL_DOC_GROUPS}
              defaultSectionId={PANEL_DEFAULT_SECTION_ID}
              onClose={() => tl.toggleWindow('docs')}
            />
          );
        case 'matched-rules': {
          const selectedRow = selectedId ? data.lookupByRequestId.get(selectedId) ?? null : null;
          return (
            <MatchedRulesPanel
              row={selectedRow}
              rulesByUid={rulesByUid}
              onClose={() => tl.toggleWindow('matched-rules')}
            />
          );
        }
      }
    },
    [
      data.rows,
      data.dangling,
      data.lookupByRequestId,
      data.pages,
      consoleClient,
      lifecycleClient.source,
      selectedId,
      handleSelect,
      filter,
      filteredRows,
      filterConfig,
      filterError,
      showFilter,
      urlFilter,
      ui,
      handleCrossNav,
      handleSearchResult,
      handleAnnotationJump,
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
        recording={ui.recording}
        onToggleRecording={() => ui.setRecording(!ui.recording)}
        onClear={clear}
        showFilter={showFilter}
        onToggleFilter={() => setShowFilter(!showFilter)}
        searchActive={iconState('search') !== undefined}
        onToggleSearch={() => tl.toggleWindow('search')}
        preserveLog={ui.preserveLog}
        onPreserveLogChange={ui.setPreserveLog}
        rulesVisible={rulesVisible}
        filterConfig={filterConfig}
        onFilterConfigChange={setFilterConfig}
        onExportHar={handleSaveAllAsHar}
        onCopyAllHar={handleCopyAllAsHar}
        canExport={data.rows.length > 0}
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
        requestCount={data.rows.length}
        transferredSize={footer.transferredSize}
        resourceSize={footer.resourceSize}
        subset={footer.footerSubset}
        finishTime={footer.finishTime}
        dclMs={footer.footerDclMs}
        loadMs={footer.footerLoadMs}
        tabCount={groups.allTabs.length}
        modifiedCount={data.modifiedCount}
        failedCount={data.failedCount}
        cachedCount={data.cachedCount}
        pageCount={data.pageCount}
        pageOrigin={data.navTiming?.pageOrigin}
        hasRealizableDebugRule={hasRealizableDebugRule}
      />
    </div>
  );
}
