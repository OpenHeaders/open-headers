import 'allotment/dist/style.css';
import { GlobalOutlined } from '@ant-design/icons';
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
import { useT } from '@openheaders/ui/context/LocaleContext';
import DocsPanel from '@openheaders/ui/shared/docs/DocsPanel';
import {
  getNotificationsPanelInfo,
  NotificationsPanel,
  useAppUpdateNotification,
  useSeedNotifications,
} from '@openheaders/ui/shared/notifications';
import { InfoPopoverContainerProvider } from '@openheaders/ui/shared/info-popover';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import { DocsNavProvider, useDocsNav } from '@openheaders/ui/shared/docs/use-docs-nav';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { VariablePopoverProvider } from '@openheaders/ui/workbench/components/template-input/VariablePopoverHost';
import { EnvSwitcherProvider, useEnvSwitcher } from '@openheaders/ui/workbench/services/env-switcher';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type ConsoleRevealRequest, ConsoleView } from './components/ConsoleView';
import { PANEL_DEFAULT_SECTION_ID, PANEL_DOC_GROUPS } from './components/docs/registry';
import { InspectorDetailContent } from './components/InspectorDetailContent';
import { InspectorEditorGroupRenderer } from './components/InspectorEditorGroupRenderer';
import { MatchedRulesPanel } from './components/MatchedRulesPanel';
import PanelStatusBar from './components/PanelStatusBar';
import { PanelToolbar } from './components/PanelToolbar';
import { RuleExecutions } from './components/RuleExecutions';
import { RulePopoverProvider } from './components/RulePopoverHost';
import { SearchPanel } from './components/SearchPanel';
import { CacheEntryEditorTab } from './components/storage/CacheEntryEditorTab';
import { CookieEditorTab } from './components/storage/CookieEditorTab';
import { DomStorageEntryEditorTab } from './components/storage/DomStorageEntryEditorTab';
import { IdbRecordEditorTab } from './components/storage/IdbRecordEditorTab';
import type { OpenIdbRecordRequest } from './components/storage/IndexedDbSection';
import {
  type OpenCacheEntryRequest,
  type OpenCookieRequest,
  type OpenDomStorageEntryRequest,
  StoragePanel,
  type StorageRevealRequest,
} from './components/storage/StoragePanel';
import type { FilterHiddenHint } from './components/FilterHiddenNote';
import { TrafficList } from './components/TrafficList';
import type { ColumnKey } from './components/traffic/columns';
import { DEFAULT_VISIBLE_COLUMNS } from './components/traffic/columns';
import { matchesPanelFilters } from './components/traffic/row-filter';
import { type ConsoleRequestJoin, consoleRequestJoin } from './data/console-request-join';
import type { SearchFooterStatus } from './data/footer-status';
import { deriveXhrLogEntries } from './data/console-xhr-log';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import { focusStore, setFocusedDock, setFocusedRegion } from './data/stores/focus-store';
import type { InspectorRowWithFires } from './data/inspector-row-projection';
import {
  buildCacheEntryTab,
  buildCookieTab,
  buildDomStorageEntryTab,
  buildIdbRecordTab,
  buildRuleValueTab,
  type InspectorTab,
  tabPillLabel,
} from './data/inspector-tab';
import {
  type RuleValueDocumentTarget,
  useRegisterValueDocumentOpener,
  ValueDocumentIntentProvider,
} from './data/value-document-intent';
import { ValueDocumentTab } from './components/value-document/ValueDocumentTab';
import { jarCookieToKey } from './data/cookies/cookie-edit';
import type { JarCookieKey } from './data/cookies/cookie-jar-cache';
import type { DomStorageArea } from './data/storage/storage-inspector-host';
import { tabBadge } from './components/method-color';
import { TabToolIcon } from './components/TabToolIcon';
import { useParityDebugHook } from './data/parity-debug-hook';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from './data/tool-windows';
import { useConsoleClient } from './data/stores/use-console-client';
import { useFireClient } from './data/stores/use-fire-client';
import { useJsContexts } from './data/stores/use-js-contexts';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { type TabSaveRefMap, useTabCloseGuard } from './data/use-tab-close-guard';
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
import { consoleDocInputs } from './data/search/console-search-docs';
import type { SearchTarget } from './data/search/search-doc';
import { enumerateStorageDocs } from './data/search/storage-search-docs';
import type { SearchDocProviders } from './data/search/use-search';
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
                                    {/* DocsNav must wrap the popover providers: the rule/variable
                                        popover bodies render docs `(i)` affordances (ConditionEditor's
                                        DocInfo), and the hover-host Provider renders them from ITS tree
                                        position — below DocsNav or `useDocsNav` throws. */}
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
                                        <VariablePopoverProvider>
                                          {/* Above the rule popover host: its editor bodies render
                                              from the host's tree position and reach the editor
                                              tab group only through this intent seam. */}
                                          <ValueDocumentIntentProvider>
                                            <RulePopoverProvider>
                                              <PanelContent />
                                            </RulePopoverProvider>
                                          </ValueDocumentIntentProvider>
                                        </VariablePopoverProvider>
                                      </InfoPopoverContainerProvider>
                                    </DocsNavProvider>
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
  const t = useT();
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
  // Live JS execution contexts (JS contexts Phase C) — same root-owned port
  // pattern; the registry is replace-semantics live state, replayed on
  // reconnect, and feeds the Console's context selector.
  const jsContexts = useJsContexts();

  // Host-reported app updates land in the Notifications timeline
  // (no-op on hosts without the getAppUpdate capability).
  useAppUpdateNotification();
  useSeedNotifications();
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
  // Product telemetry: an active tool window is the panel feature in
  // use — network on first paint (the panel IS the traffic view),
  // console/storage when their tab activates. `noteFeatureUsed` guards
  // per document; the host session latch dedupes per browser session.
  useEffect(() => {
    for (const dock of Object.values(tl.state.docks)) {
      if (dock.active === 'network') noteFeatureUsed('traffic-panel');
      if (dock.active === 'console') noteFeatureUsed('console-panel');
      if (dock.active === 'storage') noteFeatureUsed('storage-panel');
    }
  }, [tl.state.docks]);
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
  // Footprint chip → Matched Rules tool window. Same restore-then-
  // activate shape as `openDocs` above: never a toggle, so clicking the
  // chip with the window already open just focuses it.
  const showMatchedRules = useCallback(() => {
    if (tl.state.hidden.includes('matched-rules')) tl.restoreWindow('matched-rules');
    tl.activateWindow('matched-rules');
  }, [tl]);
  const panelSizes = useMemo(getPanelSizes, []);
  // Search session lives at the panel level — SearchPanel itself
  // mounts/unmounts as the user toggles the Search tool window, and
  // we don't want that to discard the user's query and results.
  // Providers for the non-network sources: Console reads the live
  // buffer through a ref (identity-stable provider object, fresh data
  // at run time); Storage enumerates over the host RPCs on demand.
  const consoleEntriesRef = useRef(consoleClient.snapshot.entries);
  consoleEntriesRef.current = consoleClient.snapshot.entries;
  const searchProviders = useMemo<SearchDocProviders>(
    () => ({
      console: () => consoleDocInputs(consoleEntriesRef.current),
      storage: enumerateStorageDocs,
    }),
    [],
  );
  const searchSession = useSearchSession(data.rows, searchProviders);
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
    () => data.rows.filter((r) => matchesPanelFilters(r.lifecycle, { filter, filterTokens, filterConfig }, r.fires)),
    [data.rows, filter, filterTokens, filterConfig],
  );

  // "Revealed but filtered" note for the network grid: a search jump
  // opened the request's document, but the active filter hides its
  // grid row. Filters are never auto-cleared — the note offers it.
  const [networkFilterHint, setNetworkFilterHint] = useState<FilterHiddenHint | null>(null);
  const dismissNetworkFilterHint = useCallback(() => setNetworkFilterHint(null), []);
  const clearNetworkFilter = useCallback(() => {
    setUrlFilter('');
    setFilter(new Set());
    setNetworkFilterHint(null);
  }, []);

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

  // ── Storage-document editor tabs (open + reveal-back) ───────
  // Save actions the editor bodies register — the close guard's
  // "Save changes" path routes through them.
  const storageSaveRefs = useRef<TabSaveRefMap>(new Map());
  const closeGuard = useTabCloseGuard(groups, storageSaveRefs);
  const [revealStorage, setRevealStorage] = useState<StorageRevealRequest | null>(null);
  const [revealConsole, setRevealConsole] = useState<ConsoleRevealRequest | null>(null);
  const handleConsoleRevealConsumed = useCallback(() => setRevealConsole(null), []);
  const openIdbRecord = useCallback(
    (request: OpenIdbRecordRequest & { frameId: number }) => {
      groups.addTab(buildIdbRecordTab({ ...request, timestamp: Date.now() }));
    },
    [groups],
  );
  const openDomStorageEntry = useCallback(
    (request: OpenDomStorageEntryRequest & { frameId: number }) => {
      groups.addTab(buildDomStorageEntryTab({ ...request, timestamp: Date.now() }));
    },
    [groups],
  );
  const openCookieDocument = useCallback(
    (request: OpenCookieRequest) => {
      groups.addTab(
        buildCookieTab({
          cookieKey: jarCookieToKey(request.cookie),
          scopeUrl: request.scopeUrl,
          timestamp: Date.now(),
        }),
      );
    },
    [groups],
  );
  // Key-shaped twin for surfaces that hold a jar identity but not the
  // full jar row (the Cookies tab's edit-popover escalation).
  const openCookieDocumentByKey = useCallback(
    (cookieKey: JarCookieKey, scopeUrl: string) => {
      groups.addTab(buildCookieTab({ cookieKey, scopeUrl, timestamp: Date.now() }));
    },
    [groups],
  );
  const openCacheEntry = useCallback(
    (request: OpenCacheEntryRequest & { frameId: number }) => {
      groups.addTab(buildCacheEntryTab({ ...request, timestamp: Date.now() }));
    },
    [groups],
  );
  // Rule-value documents open through the intent seam — the quick-editor
  // popovers render outside this component's tree (see
  // `value-document-intent`), so they can't take the opener as a prop.
  const openValueDocument = useCallback(
    (target: RuleValueDocumentTarget) => {
      groups.addTab(buildRuleValueTab({ ...target, timestamp: Date.now() }));
    },
    [groups],
  );
  useRegisterValueDocumentOpener(openValueDocument);
  // The ACTIVE editor tab's document identity — the Storage window
  // highlights exactly that one row, tracking tab switches.
  const activeStorageTabId = useMemo(() => {
    const active = groups.focusedLeaf.tabs.find((t) => t.id === groups.activeTabId);
    return active !== undefined && active.kind !== 'request' ? active.id : null;
  }, [groups.focusedLeaf, groups.activeTabId]);
  const showStorageWindow = useCallback(() => {
    if (tl.state.hidden.includes('storage')) tl.restoreWindow('storage');
    tl.activateWindow('storage');
  }, [tl]);
  const revealInStorage = useCallback(
    (database: string, store: string) => {
      showStorageWindow();
      setRevealStorage({ kind: 'idb', database, store });
    },
    [showStorageWindow],
  );
  const revealDomInStorage = useCallback(
    (area: DomStorageArea) => {
      showStorageWindow();
      setRevealStorage({ kind: 'dom', area });
    },
    [showStorageWindow],
  );
  const revealCookiesInStorage = useCallback(() => {
    showStorageWindow();
    setRevealStorage({ kind: 'cookies' });
  }, [showStorageWindow]);
  const revealCacheInStorage = useCallback(
    (cache: string) => {
      showStorageWindow();
      setRevealStorage({ kind: 'cache', cache });
    },
    [showStorageWindow],
  );
  const handleRevealConsumed = useCallback(() => setRevealStorage(null), []);

  // Search-result activation routes by the group's target: a network
  // match opens the request tab (highlight plumbing included), a
  // storage match rides the same reveal seam the editor tabs use —
  // with the matched line's row key attached, so the section opens the
  // exact row's document — and a console match focuses the Console
  // tool window and scrolls to the matched message (the doc's line
  // number IS the buffer position).
  const handleSearchTarget = useCallback(
    (target: SearchTarget, highlight: string, section: string, lineNumber: number, matchIndex: number) => {
      if (target.kind === 'request') {
        handleSearchResult(target.requestId, highlight, section, lineNumber, matchIndex);
        if (
          data.lookupByRequestId.has(target.requestId) &&
          !filteredRows.some((r) => r.lifecycle.requestId === target.requestId)
        ) {
          setNetworkFilterHint((prev) => ({ nonce: (prev?.nonce ?? 0) + 1 }));
        }
        return;
      }
      if (target.kind === 'storage') {
        showStorageWindow();
        const row = target.rowKeys[lineNumber - 1];
        setRevealStorage(row !== undefined && row !== '' ? { ...target.reveal, row } : target.reveal);
        return;
      }
      if (tl.state.hidden.includes('console')) tl.restoreWindow('console');
      tl.activateWindow('console');
      setRevealConsole((prev) => ({ entryIndex: lineNumber - 1, nonce: (prev?.nonce ?? 0) + 1 }));
    },
    [handleSearchResult, showStorageWindow, tl, data.lookupByRequestId, filteredRows],
  );

  // ── Editor group tab body ──────────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: InspectorTab; leafId: string; isFocusedLeaf: boolean }) => {
      if (tab.kind === 'idb-record') {
        return (
          <IdbRecordEditorTab
            tab={tab}
            onRevealInStorage={revealInStorage}
            isActiveDocument={tab.id === groups.activeTabId}
            onDirtyChange={(dirty) => groups.updateTab(tab.id, { dirty })}
            registerSave={(save) => {
              if (save) storageSaveRefs.current.set(tab.id, save);
              else storageSaveRefs.current.delete(tab.id);
            }}
          />
        );
      }
      if (tab.kind === 'dom-storage-entry') {
        return (
          <DomStorageEntryEditorTab
            tab={tab}
            onRevealInStorage={revealDomInStorage}
            isActiveDocument={tab.id === groups.activeTabId}
            onDirtyChange={(dirty) => groups.updateTab(tab.id, { dirty })}
            // A committed rename moved the entry — re-key the tab so its
            // id/label follow (the body remounts and re-fetches).
            onRenamed={(newKey) => groups.updateTab(tab.id, { entryKey: newKey, dirty: false })}
            registerSave={(save) => {
              if (save) storageSaveRefs.current.set(tab.id, save);
              else storageSaveRefs.current.delete(tab.id);
            }}
          />
        );
      }
      if (tab.kind === 'cache-entry') {
        return <CacheEntryEditorTab tab={tab} onRevealInStorage={revealCacheInStorage} />;
      }
      if (tab.kind === 'rule-value') {
        return (
          <ValueDocumentTab
            tab={tab}
            isActiveDocument={tab.id === groups.activeTabId}
            onDirtyChange={(dirty) => groups.updateTab(tab.id, { dirty })}
            registerSave={(save) => {
              if (save) storageSaveRefs.current.set(tab.id, save);
              else storageSaveRefs.current.delete(tab.id);
            }}
          />
        );
      }
      if (tab.kind === 'cookie') {
        return (
          <CookieEditorTab
            tab={tab}
            onRevealInStorage={revealCookiesInStorage}
            isActiveDocument={tab.id === groups.activeTabId}
            onDirtyChange={(dirty) => groups.updateTab(tab.id, { dirty })}
            // A committed identity change moved the cookie — re-key the
            // tab so its id/label follow (the body remounts and re-fetches).
            onRekeyed={(newKey) => groups.updateTab(tab.id, { cookieKey: newKey, dirty: false })}
            registerSave={(save) => {
              if (save) storageSaveRefs.current.set(tab.id, save);
              else storageSaveRefs.current.delete(tab.id);
            }}
          />
        );
      }
      const row = data.lookupByRequestId.get(tab.requestId);
      if (!row) {
        return <div className="dt-editor-empty">{t('panel.inspector.detailEmpty.requestGone')}</div>;
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
          onShowMatchedRules={showMatchedRules}
          onOpenCookieDocument={openCookieDocumentByKey}
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
      showMatchedRules,
      openCookieDocumentByKey,
      revealInStorage,
      revealDomInStorage,
      revealCookiesInStorage,
      revealCacheInStorage,
      searchHighlight,
      searchSection,
      searchLineNumber,
      searchMatchIndex,
      t,
    ],
  );

  const renderEmpty = useCallback(
    () => (
      <div className="dt-editor-empty">
        {/* Single span: the container is a flex centerer, which would
          * swallow the whitespace between its anonymous text items. */}
        <span>
          {t('panel.inspector.detailEmpty.selectPrefix')} <GlobalOutlined aria-hidden="true" />{' '}
          {t('panel.inspector.detailEmpty.selectSuffix')}
        </span>
      </div>
    ),
    [t],
  );

  const activeTab = groups.focusedLeaf.tabs.find((t) => t.id === groups.activeTabId);
  const selectedId = activeTab?.kind === 'request' ? activeTab.requestId : null;
  const footer = useFooterSummary(data, filteredRows);
  // Search summary for the focused-tool footer. Derived here because the
  // search session lives at App level (already re-rendering per stream
  // flush); Storage/Console publish theirs through the footer-status store.
  const searchFooterStatus = useMemo<SearchFooterStatus>(() => {
    const st = searchSession.search.state;
    let streamed = 0;
    for (const g of st.results) streamed += g.matches.length;
    return {
      status: st.status,
      done: st.progress.done,
      total: st.progress.total,
      matches: st.progress.totalMatchCount ?? streamed,
      files: st.progress.matchedFileCount ?? st.results.length,
      elapsedMs: st.progress.elapsedMs,
    };
  }, [searchSession.search.state]);

  // ── HAR export helpers ─────────────────────────────────────
  const { handleSaveAllAsHar, handleSaveAsHar, handleCopyAllAsHar, handleCopyAsHar } = useHarExport({
    rows: data.rows,
    pages: data.pages,
  });

  // Exact console↔network join: a browser console entry carries the same
  // session-namespaced request id the lifecycle rows are keyed by.
  const resolveConsoleRequest = useCallback(
    (requestId: string): ConsoleRequestJoin | null => {
      const row = data.lookupByRequestId.get(requestId);
      return row ? consoleRequestJoin(row.lifecycle) : null;
    },
    [data.lookupByRequestId],
  );

  // "Log XMLHttpRequests" rows, derived from the network plane (the pref
  // gates them inside ConsoleView, where the console settings live).
  const xhrLogEntries = useMemo(() => deriveXhrLogEntries(data.rows), [data.rows]);

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
              filterHiddenHint={networkFilterHint}
              onFilterHintClear={clearNetworkFilter}
              onFilterHintDismiss={dismissNetworkFilterHint}
            />
          );
        case 'console':
          return (
            <ConsoleView
              entries={consoleClient.snapshot.entries}
              xhrLogEntries={xhrLogEntries}
              contexts={jsContexts.snapshot.contexts}
              resolveRequest={resolveConsoleRequest}
              onRequestClick={handleCrossNav}
              onClear={() => consoleClient.store.clear()}
              onHide={() => tl.toggleWindow('console')}
              reveal={revealConsole}
              onRevealConsumed={handleConsoleRevealConsumed}
            />
          );
        case 'storage':
          return (
            <StoragePanel
              onHide={() => tl.toggleWindow('storage')}
              onOpenIdbRecord={openIdbRecord}
              onOpenDomEntry={openDomStorageEntry}
              onOpenCookie={openCookieDocument}
              onOpenCacheEntry={openCacheEntry}
              reveal={revealStorage}
              onRevealConsumed={handleRevealConsumed}
              activeStorageTabId={activeStorageTabId}
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
              onResultClick={handleSearchTarget}
              docsActive={iconState('docs') !== undefined}
              onToggleDocs={() => tl.toggleWindow('docs')}
            />
          );
        case 'notifications':
          return (
            <NotificationsPanel
              info={getNotificationsPanelInfo(t)}
              onClose={() => tl.toggleWindow('notifications')}
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
      resolveConsoleRequest,
      xhrLogEntries,
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
      handleSearchTarget,
      handleAnnotationJump,
      openIdbRecord,
      openDomStorageEntry,
      openCookieDocument,
      revealStorage,
      handleRevealConsumed,
      activeStorageTabId,
      tl,
      iconState,
      visibleColumns,
      handleSaveAsHar,
      handleSaveAllAsHar,
      handleCopyAllAsHar,
      searchSession,
      rulesByUid,
      t,
    ],
  );

  // ── Editor content ─────────────────────────────────────────
  const renderEditor = useCallback(
    () => (
      <InspectorEditorGroupRenderer
        groups={groups}
        renderTabBody={renderTabBody}
        renderEmpty={renderEmpty}
        onCloseTab={closeGuard.closeTab}
        onCloseOther={closeGuard.closeOtherTabs}
        onCloseAll={closeGuard.closeAllTabs}
        onCloseToLeft={closeGuard.closeTabsToLeft}
        onCloseToRight={closeGuard.closeTabsToRight}
        recentlyClosed={groups.recentlyClosed}
      />
    ),
    [groups, closeGuard, renderTabBody, renderEmpty],
  );

  const renderEditorTabDragPreview = useCallback(
    (tabId: string): React.ReactNode => {
      const tab = groups.allTabs.find((t) => t.id === tabId);
      if (!tab) return null;
      const badge = tabBadge(tab);
      return (
        <div className="dt-editor-tab active" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)', opacity: 0.9 }}>
          <TabToolIcon tab={tab} />
          <span className="dt-method-badge" style={{ color: badge.color }}>
            {badge.text}
          </span>
          <span className="dt-editor-tab-label">{tabPillLabel(tab)}</span>
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
        tl={tl}
        searchStatus={searchFooterStatus}
      />
    </div>
  );
}
