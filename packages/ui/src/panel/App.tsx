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
import DocsPanel from '@openheaders/ui/shared/docs/DocsPanel';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import { DocsNavProvider, useDocsNav } from '@openheaders/ui/shared/docs/use-docs-nav';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useEnvironments } from '@openheaders/ui/shared/hooks/useEnvironments';
import { VariablePopoverProvider } from '@openheaders/ui/workbench/components/template-input/VariablePopoverHost';
import { EnvSwitcherProvider, useEnvSwitcher } from '@openheaders/ui/workbench/services/env-switcher';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import { focusStore, setFocusedDock, setFocusedRegion } from './data/focus-store';
import { serializeHar, suggestHarFilename } from './data/har-export';
import type { InspectorRowWithFires } from './data/inspector-row-projection';
import type { DetailSection } from './data/inspector-tab';
import { buildInspectorTab } from './data/inspector-tab';
import { useParityDebugHook } from './data/parity-debug-hook';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from './data/tool-windows';
import { useFireClient } from './data/use-fire-client';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { useLifecycleClient } from './data/use-lifecycle-client';
import { useNavClearFloor } from './data/use-nav-clear-floor';
import { useRecordingWindows } from './data/use-recording-windows';
import { usePageClient } from './data/use-page-client';
import { usePanelData } from './data/use-panel-data';
import { useResourceTimingClient } from './data/use-resource-timing-client';
import { type PanelViewState, usePanelEditingScopeViewState, usePanelToolLayout } from './data/use-panel-tool-layout';
import { usePanelUiState } from './data/use-panel-ui-state';
import { useCacheBypass } from './data/use-cache-bypass';
import { useRulesLookup } from './data/use-rules-lookup';
import { useSearchSession } from './data/use-search-session';

// ── Helpers ──────────────────────────────────────────────────────────

function sectionToTab(section: string): DetailSection {
  if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
  if (section === 'Query Params' || section === 'Request Body') return 'payload';
  if (section === 'Response') return 'response';
  return 'headers';
}

// Footer totals use decimal (1000-byte) units, matching the Size column
// (`formatBytesToKb`) and the host network table's status-bar figures.
function formatBytes(total: number): string {
  if (total < 1000) return `${total} B`;
  if (total < 1000 * 1000) return `${(total / 1000).toFixed(1)} kB`;
  return `${(total / (1000 * 1000)).toFixed(1)} MB`;
}

function formatFinishTime(finishMs: number): string {
  if (finishMs <= 0) return '';
  if (finishMs < 1000) return `${Math.round(finishMs)} ms`;
  return `${(finishMs / 1000).toFixed(2)} s`;
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
                                            trigger.closest<HTMLElement>('.dt-panel-root') ?? null
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
  const navClearFloorMs = useNavClearFloor(lifecycleClient.snapshot.ordered, ui.preserveLog);
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

  // Parity capture loop reads lifecycles directly — strictly better
  // signal than the denormalized rows the legacy hook took — plus the
  // footer projection so a capture can assert the redirect-leg anchoring.
  useParityDebugHook(
    lifecycleClient.snapshot.ordered,
    {
      source: lifecycleClient.source,
      footerDclMs: data.footerDclMs ?? null,
      footerLoadMs: data.footerLoadMs ?? null,
      finishTimeMs: data.finishTimeMs,
      footerAnchorMs: data.footerAnchorMs,
      legMs: data.legMs,
      pages: data.pages.map((p) => ({
        id: p.id,
        url: p.url,
        startedAtMs: p.startedAtMs,
        dclMs: p.dclMs ?? null,
        loadMs: p.loadMs ?? null,
      })),
    },
    ui.clear,
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
  const [footerTimingMode] = useSetting('devpanelLayout.footerTimingMode');
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
  const [searchMatchIndex, setSearchMatchIndex] = useState<number | undefined>(undefined);
  const [, setSearchNonce] = useState(0);
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

  // ── Open request as tab ────────────────────────────────────
  const handleSelect = useCallback(
    (requestId: string) => {
      const row = data.lookupByRequestId.get(requestId);
      if (!row) return;
      const tab = buildInspectorTab({ lifecycle: row.lifecycle, displayId: row.displayId }, 'network');
      tab.activeSection = lastSectionRef.current;
      groups.addTab(tab);
      setSearchHighlight(undefined);
      setSearchSection(undefined);
      setSearchLineNumber(undefined);
    },
    [data.lookupByRequestId, groups],
  );

  const handleCrossNav = useCallback(
    (requestId: string) => {
      tl.activateWindow('network');
      handleSelect(requestId);
    },
    [tl, handleSelect],
  );

  const handleSearchResult = useCallback(
    (requestId: string, highlight: string, section: string, lineNumber: number, matchIndex: number) => {
      const row = data.lookupByRequestId.get(requestId);
      if (!row) return;
      const tab = buildInspectorTab({ lifecycle: row.lifecycle, displayId: row.displayId }, 'network');
      tab.activeSection = sectionToTab(section);
      groups.addTab(tab);
      groups.updateTab(tab.id, { activeSection: sectionToTab(section) });
      setSearchHighlight(highlight);
      setSearchSection(section);
      setSearchLineNumber(lineNumber);
      setSearchMatchIndex(matchIndex);
      setSearchNonce((n) => n + 1);
    },
    [data.lookupByRequestId, groups],
  );

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
  const transferredSize = useMemo(() => formatBytes(data.totalBytesTransferred), [data.totalBytesTransferred]);
  const resourceSize = useMemo(() => formatBytes(data.totalResourceSize), [data.totalResourceSize]);
  // Footer timing scope: aggregate (whole preserve-log timeline, browser
  // default) vs the latest navigation only. Coincide for a single navigation.
  const aggregateTiming = footerTimingMode !== 'lastNav';
  const finishTimeMs = aggregateTiming ? data.aggregateFinishMs : data.finishTimeMs;
  const footerDclMs = aggregateTiming ? data.aggregateDclMs : data.footerDclMs;
  const footerLoadMs = aggregateTiming ? data.aggregateLoadMs : data.footerLoadMs;
  const finishTime = useMemo(() => formatFinishTime(finishTimeMs), [finishTimeMs]);

  // ── HAR export helpers ─────────────────────────────────────
  const downloadHar = useCallback(
    async (subset: readonly InspectorRowWithFires[], filename: string, sanitize: boolean) => {
      // CDP mode: the host's own devtools.network HAR is byte-identical to its
      // export, so prefer it per-entry and for the page block over our CDP
      // synthesis (null in heuristic mode / non-DevTools hosts — export stays
      // as-is).
      const hostHar = (await hostNavigation.getInspectedHar()) ?? undefined;
      // Resolve page anchors from the full row set, not just the exported
      // subset — a single non-document export still needs its page's document.
      const json = serializeHar(
        subset,
        data.pages,
        sanitize,
        data.rows.map((r) => r.lifecycle),
        hostHar,
      );
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [data.pages, data.rows],
  );

  const handleSaveAllAsHar = useCallback(
    (sanitize = false) => {
      void downloadHar(data.rows, suggestHarFilename(data.rows), sanitize);
    },
    [data.rows, downloadHar],
  );

  const handleSaveAsHar = useCallback(
    (row: InspectorRowWithFires, sanitize = false) => {
      const single: readonly InspectorRowWithFires[] = [row];
      void downloadHar(single, suggestHarFilename(single), sanitize);
    },
    [downloadHar],
  );

  const copyHar = useCallback(
    async (subset: readonly InspectorRowWithFires[], sanitize: boolean) => {
      const hostHar = (await hostNavigation.getInspectedHar()) ?? undefined;
      const json = serializeHar(
        subset,
        data.pages,
        sanitize,
        data.rows.map((r) => r.lifecycle),
        hostHar,
      );
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        // Best-effort — clipboard may be gated in some DevTools contexts.
      }
    },
    [data.pages, data.rows],
  );

  const handleCopyAllAsHar = useCallback((sanitize = false) => copyHar(data.rows, sanitize), [data.rows, copyHar]);

  const handleCopyAsHar = useCallback(
    (row: InspectorRowWithFires, sanitize = false) => copyHar([row], sanitize),
    [copyHar],
  );

  // ── Tool window content ────────────────────────────────────
  const renderToolWindow = useCallback(
    (windowId: PanelToolWindowId, _slot: DockSlot): React.ReactNode => {
      switch (windowId) {
        case 'network':
          return (
            <TrafficList
              rows={data.rows}
              pages={data.pages}
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
      selectedId,
      handleSelect,
      filter,
      filterTokens,
      filterConfig,
      filterError,
      showFilter,
      urlFilter,
      ui,
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
        transferredSize={transferredSize}
        resourceSize={resourceSize}
        finishTime={finishTime}
        dclMs={footerDclMs}
        loadMs={footerLoadMs}
        tabCount={groups.allTabs.length}
        modifiedCount={data.modifiedCount}
        failedCount={data.failedCount}
        cachedCount={data.cachedCount}
        pageCount={data.pageCount}
        pageOrigin={data.navTiming?.pageOrigin}
        cdpEnhanced={lifecycleClient.source === 'cdp'}
      />
    </div>
  );
}
