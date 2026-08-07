/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * App.tsx is a thin wiring layer: data hooks (tabs, rules, templates)
 * flow into extracted module-hooks (useTabOpeners, useWorkspaceIntentRouter,
 * useTabSyncEffects, useCommandPaletteData, useTabLifecycle), and the
 * shell is rendered via ShellLayout + EditorGroupRenderer with
 * render-prop hooks for the editor body and tool-window content.
 */

import { EnvironmentProvider } from '@openheaders/ui/context';
import { FilesProvider } from '@openheaders/ui/context';
import { LiveVariablesProvider } from '@openheaders/ui/context';
import { LiveWorkflowsProvider } from '@openheaders/ui/context';
import { OAuthBundlesProvider } from '@openheaders/ui/context';
import { PauseMarkersProvider } from '@openheaders/ui/context';
import { RequestsProvider } from '@openheaders/ui/context';
import { RuleProvider } from '@openheaders/ui/context';
import { useUiTheme } from '@openheaders/ui/context';
import { VaultProvider } from '@openheaders/ui/context';
import { WorkspaceVariablesProvider } from '@openheaders/ui/context';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useAllGrpcResponseExamples } from '@openheaders/ui/shared/hooks/readers/useGrpcResponseExamples';
import { useAllWsResponseExamples } from '@openheaders/ui/shared/hooks/readers/useWsResponseExamples';
import { useAllResponseExamples } from '@openheaders/ui/shared/hooks/readers/useResponseExamples';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { applySpecUpdate } from '@openheaders/ui/shared/sync/spec-write-client';
import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { hostBridge } from '@openheaders/core/bridge';
import type { PostmanImportSummary } from '@openheaders/core/import';
import type { CompanionRevealTarget } from '@openheaders/core/protocol';
import type { InputRef } from 'antd';
import { App as AntApp, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveEditorDirtyProvider,
  ActiveEditorLifecycleProvider,
  ActiveFieldFocusProvider,
  ActiveTabEntityProvider,
  AwarenessIdentityProvider,
  type SurfaceIdentityHandle,
  SurfaceAwarenessPublisher,
  useSetActiveTabEntity,
} from '@openheaders/ui/shared/awareness';
import 'allotment/dist/style.css';
import { createShellEventBus, ShellEventBusContext } from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { getCurrentHost, instanceLabel } from '@openheaders/ui/shared/host-vocabulary';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { computeBreadcrumbs } from './breadcrumbs';
import CommandPalette from './components/shell/CommandPalette';
import EditorGroupRenderer, { type RenderLeafHeaderContext } from './components/shell/EditorGroupRenderer';
import EmptyState, { type VariableCreateScope } from './components/shell/EmptyState';
import { viewActivityEntity } from './components/panels/activity-view-router';
import { getWorkbenchTerminalTabs } from './components/panels/terminal/terminal-instance';
import { toggleTerminalTabSearch } from './components/panels/terminal/terminal-tab-search-toggle';
import MigrationReportModal from './components/import/MigrationReportModal';
import SaveToCollectionModal from './components/save/SaveToCollectionModal';
import ShellLayout from './components/shell/ShellLayout';
import type { SidebarView } from './components/sidebar/types';
import StatusBar from './components/shell/StatusBar';
import { renderTabLabel, tabIcon } from './components/tabbar/tab-format';
import TopBar from './components/shell/TopBar';
import WorkbenchTabBody from './components/shell/WorkbenchTabBody';
import WorkbenchToolWindow from './components/shell/WorkbenchToolWindow';
import { VariablePopoverProvider } from './components/template-input/VariablePopoverHost';
import OrgWorkspaceAccessNotice from './components/workspace/OrgWorkspaceAccessNotice';
import { renderWorkspacePrefix } from './components/workspace/workspace-prefix';
import ImportExportModals, { type ImportExportModalsHandle } from './components/workspace-export/ImportExportModals';
import { findLeaf } from './editor-groups';
import {
  EditingScopeWorkspaceProvider,
  useWorkbenchEditingScopeWorkspaceId,
} from './hooks/EditingScopeWorkspaceContext';
import { ImportTextProvider } from './hooks/ImportTextContext';
import { OpenServerAdminProvider } from './hooks/OpenServerAdminContext';
import { OpenSettingsProvider } from './hooks/OpenSettingsContext';
import { OpenVaultProvider } from './hooks/OpenVaultContext';
import { useCommandPaletteData } from './hooks/useCommandPaletteData';
import { useEditingScopeWorkspaceId } from './hooks/useEditingScopeWorkspaceId';
import { useEditorGroups } from './hooks/useEditorGroups';
import { useEditorRegistrations } from './hooks/useEditorRegistrations';
import { useEntityStatusSets } from './hooks/useEntityStatusSets';
import { useFocusRegion } from './hooks/useFocusRegion';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { type ResponsiveLayout, useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useAdoptActiveWorkspaceIntoSurface } from './hooks/useAdoptActiveWorkspaceIntoSurface';
import { SurfaceWorkspaceAdoptProvider } from './hooks/SurfaceWorkspaceAdoptContext';
import { useSaveRequestFlow } from './hooks/useSaveRequestFlow';
import { useSaveRuleFlow } from './hooks/useSaveRuleFlow';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabOpeners } from './hooks/useTabOpeners';
import { useTabSyncEffects } from './hooks/useTabSyncEffects';
import { useWhatsNewAutoOpen } from './hooks/useWhatsNewAutoOpen';
import { useWorkbenchActiveTab } from './hooks/useWorkbenchActiveTab';
import {
  readWorkspaceFallThrough,
  useToolLayout,
  useWorkbenchEditingScopeViewState,
  type WorkbenchViewState,
} from './hooks/useToolLayout';
import { useUrlWorkspaceBindingMirror } from './hooks/useUrlWorkspaceBindingMirror';
import { useWorkbenchShortcutActions } from './hooks/useWorkbenchShortcutActions';
import { useWorkbenchSidebarState } from './hooks/useWorkbenchSidebarState';
import { useWorkbenchWorkspaceSlice } from './hooks/useWorkbenchWorkspaceSlice';
import { subscribeTrafficStorageReveal } from './data/traffic-storage-reveal';
import { useWorkspaceIntentRouter } from './hooks/useWorkspaceIntentRouter';
import { useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { useWorkspaceTabTitle } from './hooks/useWorkspaceTabTitle';
import { useAppUpdateTask, useMigrationPullTask } from '@openheaders/ui/shared/background-tasks';
import {
  AppUpdateToast,
  SecurityUpdateBanner,
  useAppUpdateNotification,
  useSecretsStorageNotice,
  useSeedNotifications,
  useUpdatedNotification,
} from '@openheaders/ui/shared/notifications';
import { UpdateDialog } from '@openheaders/ui/shared/updates';
import { TEMPLATES_BY_TYPE } from './rule-templates';
import { EnvSwitcherProvider } from './services/env-switcher';
import { ConnectionProvider } from './settings/ConnectionContext';
import { get as getSetting } from './settings/store';
import { SettingsModal } from './settings/ui';
import { getFocusedDock } from './stores/focus-region-store';
import type { DockSlot, ToolWindowId, WorkbenchTab } from './types';

// Companion-reveal targets → this surface's dock tool windows. The
// wire vocabulary names features; both observability features land on
// the unified Traffic Monitor window. `workbench` (bare focus) and
// `mcp` (a Settings category) are handled where the broadcast arrives.
const REVEAL_WINDOW_BY_TARGET: Partial<Record<CompanionRevealTarget, ToolWindowId>> = {
  terminal: 'terminal',
  git: 'git',
  proxy: 'traffic-monitor',
  liveNetwork: 'traffic-monitor',
};

// ── Shell loader ────────────────────────────────────────────────────

interface WorkbenchInnerProps {
  /**
   * Lifts the tab's editing-scope workspaceId up to {@link Workbench}'s
   * awareness identity provider mount so the lifeline `bind` message
   * carries the correct workspace ref. Resolved deep inside
   * {@link WorkbenchTabAware} (after `useWorkbenchWorkspaceSlice` has
   * corrected stale bindings) and propagated upward via this setter
   * (design § 4.0.7 lifeline trust contract). Lint #14 — slice resolver
   * before lifeline — stays satisfied because the slice still fires
   * lexically before the provider; the lifeline opens with `null` on
   * cold mount and re-binds when this setter fires.
   */
  onLifelineWorkspaceIdChange: (workspaceId: string | null) => void;
}

const WorkbenchInner: React.FC<WorkbenchInnerProps> = ({ onLifelineWorkspaceIdChange }) => {
  const { isDarkMode } = useUiTheme();
  const { token } = theme.useToken();
  const perTab = useWorkbenchEditingScopeViewState();

  if (!perTab.ready) {
    return (
      <div
        className="rules-shell rules-shell-loading"
        data-theme={isDarkMode ? 'dark' : 'light'}
        style={{ background: token.colorBgLayout }}
      />
    );
  }

  return <WorkbenchTabAware perTab={perTab} onLifelineWorkspaceIdChange={onLifelineWorkspaceIdChange} />;
};

/**
 * Tab-workspace-aware shell layer. Owns the slice owner (single
 * `workspaceChanged` subscriber per tab), the per-tab seam
 * (`useEditingScopeWorkspaceId`), and the per-workspace panel-ratio loader
 * (BC-MWPT-10). Mounting the layer inside-out — slice owner → tab
 * workspace id → layout → providers → RuleProvider with override —
 * gives every descendant a per-tab-correct view of "which workspace
 * is this tab editing right now" before the rule data binds.
 */
const WorkbenchTabAware: React.FC<{
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
  onLifelineWorkspaceIdChange: (workspaceId: string | null) => void;
}> = ({ perTab, onLifelineWorkspaceIdChange }) => {
  const { isDarkMode } = useUiTheme();
  const { token } = theme.useToken();
  useWorkbenchWorkspaceSlice(perTab);
  // After a back-end switch repoints the active workspace to the new
  // host's default, snap THIS surface (and its URL) onto it. Scoped to
  // the tab that ran the switch via context — other tabs keep their
  // bindings.
  const adoptActiveWorkspaceIntoSurface = useAdoptActiveWorkspaceIntoSurface(perTab);
  const editingScopeWorkspaceId = useEditingScopeWorkspaceId(perTab);
  // Mirror the editing-scope workspace into the URL hash via
  // history.replaceState. Cold mount: resolver already boots from
  // `/ws/<wsId>/` if present. Warm gestures (in-tab switcher,
  // cross-workspace inheritance, runtime deletion fallback): URL
  // catches up here so address bar / bookmarks / tab-restore always
  // reflect the actual binding.
  useUrlWorkspaceBindingMirror(editingScopeWorkspaceId);
  const layout = useResponsiveLayout(editingScopeWorkspaceId);

  // Push the editing-scope workspaceId up to {@link Workbench}'s
  // awareness identity provider so the lifeline binds (and rebinds on
  // tab-workspace divergence) to the right WorkspaceServiceState. The
  // slice resolver above has already corrected stale bindings, so the
  // lifeline trust contract (§ 4.0.7) holds.
  useEffect(() => {
    onLifelineWorkspaceIdChange(editingScopeWorkspaceId);
  }, [editingScopeWorkspaceId, onLifelineWorkspaceIdChange]);

  if (!layout.ready) {
    return (
      <div
        className="rules-shell rules-shell-loading"
        data-theme={isDarkMode ? 'dark' : 'light'}
        style={{ background: token.colorBgLayout }}
      />
    );
  }

  return (
    <SurfaceWorkspaceAdoptProvider adopt={adoptActiveWorkspaceIntoSurface}>
      <EditingScopeWorkspaceProvider workspaceId={editingScopeWorkspaceId}>
        <PauseMarkersProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
          <RuleProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
            <EnvironmentProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
              <WorkspaceVariablesProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                <VaultProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                  <LiveVariablesProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                    <LiveWorkflowsProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                      <RequestsProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                        <FilesProvider activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                          <OAuthBundlesProvider surfaceId="workbench" activeWorkspaceIdOverride={editingScopeWorkspaceId}>
                            <InspectorNavProvider>
                              <WorkbenchShell layout={layout} perTab={perTab} />
                            </InspectorNavProvider>
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
      </EditingScopeWorkspaceProvider>
    </SurfaceWorkspaceAdoptProvider>
  );
};

// ── Workspace component (needs RuleContext + loaded layout) ─────────

interface WorkbenchShellProps {
  layout: ResponsiveLayout;
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
}

/**
 * Thin wrapper that owns the shell-event bus and publishes it via context
 * so `WorkbenchContent` (which calls useFocusRegion and
 * useWorkspaceShortcuts) can subscribe without the hooks reaching into the
 * DOM themselves. The attach side effect lives inside the content component
 * because that's where `shellRef` is populated on first paint.
 */
const WorkbenchShell: React.FC<WorkbenchShellProps> = ({ layout, perTab }) => {
  const busHandleRef = useRef<ReturnType<typeof createShellEventBus> | null>(null);
  if (!busHandleRef.current) busHandleRef.current = createShellEventBus();
  return (
    <ShellEventBusContext.Provider value={busHandleRef.current.bus}>
      <WorkbenchContent layout={layout} perTab={perTab} attachBus={busHandleRef.current.attach} />
    </ShellEventBusContext.Provider>
  );
};

interface WorkbenchContentProps {
  layout: ResponsiveLayout;
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
  attachBus: (root: HTMLElement | null) => () => void;
}

const WorkbenchContent: React.FC<WorkbenchContentProps> = ({ layout, perTab, attachBus }) => {
  const { isDarkMode } = useUiTheme();
  const { token } = theme.useToken();
  const t = useT();
  const {
    rules,
    isStatusLoaded,
    isConnected,
    deleteLocalRule,
    updateLocalRule,
    localCollections,
    localCollectionTrees,
    createLocalCollection,
    createLocalFolder,
    pausedUids,
    renameLocalCollection,
    renameLocalFolder,
    templates,
    templateCollections,
    templateCollectionTrees,
  } = useRules();
  const workspacesApi = useWorkspaces();
  const envApi = useEnvironments();
  const requestsApi = useRequests();
  const liveVarsApi = useLiveVariables();
  const liveWorkflowsApi = useLiveWorkflows();
  const { modal, message } = AntApp.useApp();

  // Editing-scope workspace id — owned by `WorkbenchTabAware` above;
  // mirrored into context by `EditingScopeWorkspaceProvider` so every consumer
  // (here, child editors, mutator-options builders) reads from the
  // same seam. Equals the global default in global mode; the tab's
  // slice binding in per-tab mode (MWPT § 6.2).
  const editingScopeWorkspaceId = useWorkbenchEditingScopeWorkspaceId();
  // All examples in the editing-scope workspace — feeds the live tab
  // display-label lookup for response-example viewer tabs.
  const responseExamples = useAllResponseExamples(editingScopeWorkspaceId);
  // All gRPC examples in the editing-scope workspace — the sibling feed
  // for grpc-response-example viewer tabs.
  const grpcResponseExamples = useAllGrpcResponseExamples(editingScopeWorkspaceId);
  // All WebSocket examples in the editing-scope workspace — the sibling
  // feed for ws-response-example viewer tabs.
  const wsResponseExamples = useAllWsResponseExamples(editingScopeWorkspaceId);
  // All specs in the editing-scope workspace — feeds the spec-edit tab
  // display-label lookup and the deleted-spec tab cleanup.
  const specs = useSpecs(editingScopeWorkspaceId);
  // ── Editor groups (recursive split tree) ──────────────────────
  const groups = useEditorGroups({ perTab });
  // ── Sidebar tree-expansion state (lifted into the per-tab snapshot) ─
  const sidebarState = useWorkbenchSidebarState(perTab);
  const {
    activeTabId,
    allTabs,
    addTab,
    closeTab: rawCloseTab,
    switchTab,
    updateTab,
    replaceTab,
    dirtyMap,
    saveRefMap,
  } = groups;

  const getLeafTabs = useCallback(
    (anchorTabId: string) => {
      const leafId = groups.findTabLeafId(anchorTabId);
      if (!leafId) return [];
      return findLeaf(groups.root, leafId)?.tabs ?? [];
    },
    [groups],
  );
  const getFocusedLeafTabs = useCallback(() => groups.focusedLeaf.tabs, [groups.focusedLeaf]);

  // Decoration sets — greyed method tags (unresolvable refs), dirty dots,
  // and pending-script badges — the sidebar, editor group, and drag
  // preview mirror. Derived once here so no surface re-walks the entity
  // lists per pill render.
  const {
    unresolvableRuleUids,
    unresolvableRequestUids,
    dirtyRuleUids,
    dirtyRequestUids,
    scriptsReviewPendingUids,
    dirtyWorkflowUids,
    unresolvableWorkflowUids,
  } = useEntityStatusSets({
    rules,
    localCollections,
    requests: requestsApi.requests,
    requestCollections: requestsApi.collections,
    workflows: liveWorkflowsApi.workflows,
    allTabs,
    editingScopeWorkspaceId,
  });

  // ── Tab lifecycle (dirty confirmation, leaf-scoped batch ops) ──
  const {
    handleCloseTab,
    handleCloseOther,
    handleCloseAll,
    handleCloseUnmodified,
    handleCloseToLeft,
    handleCloseToRight,
  } = useTabLifecycle({
    allTabs,
    rules,
    workspaceId: editingScopeWorkspaceId,
    getLeafTabs,
    getFocusedLeafTabs,
    closeTab: rawCloseTab,
    switchTab,
    saveRefMap,
  });

  // ── Tool-window layout state machine ───────────────────────────
  const tl = useToolLayout(perTab);

  // "Reveal in Storage" from a storage-document editor tab: activate
  // the Traffic Monitor; the mounted panel consumes the parked intent.
  useEffect(() => subscribeTrafficStorageReveal(() => tl.activateWindow('traffic-monitor')), [tl]);

  // Host-reported app updates land in the Notifications timeline
  // (no-op on hosts without the getAppUpdate capability), and the
  // updater's busy phases drive the footer's background-task indicator.
  useAppUpdateNotification();
  useAppUpdateTask();
  useSeedNotifications();
  // Locked secrets storage (denied keychain / missing keyring) surfaces
  // as a standing suggestion with the relaunch remedy; the footer's
  // status pill carries the same fact as a red `secrets` row.
  useSecretsStorageNotice();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMaximized, setSettingsMaximized] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<{ settingKey?: string; categoryId?: string }>({});
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // Auto-collapse sidebar on narrow viewports (first-open only).
  const sidebarAutoCollapsedRef = useRef(false);
  useEffect(() => {
    if (sidebarAutoCollapsedRef.current) return;
    sidebarAutoCollapsedRef.current = true;
    if (layout.shouldCollapseSidebar) {
      tl.closeDock('left-top');
      tl.closeDock('left-bottom');
    }
  }, [layout.shouldCollapseSidebar, tl]);

  // Shell root ref — attached to the bus here so the focus-region
  // tracker, shortcut loop, and future consumers see exactly one set of
  // listeners on the shell root and window.
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => attachBus(shellRef.current), [attachBus]);

  // Imperative handle for the import/export modal farm — the sidebar,
  // top-bar menu, and command-palette intents fire openers on it. The
  // modal state and the shell-wide file drop target live inside the
  // component (mounted at the bottom of the shell); the shell owns only
  // the ref.
  const importExportRef = useRef<ImportExportModalsHandle>(null);

  // Text-import routing for deep components (ImportTextContext) — e.g.
  // the URL bar hands a pasted curl command to the curl import modal.
  const importText = useCallback((text: string) => importExportRef.current?.openImportText(text), []);

  const focus = useFocusRegion({
    shellRef,
    setFocusedRegion: tl.setFocusedRegion,
    setFocusedDock: tl.setFocusedDock,
  });

  // Right-pane-open callback for useInspectorNav.
  const { onOpenDocs, openDocs, currentSectionRef: docsCurrentSectionRef } = useInspectorNav();
  onOpenDocs.current = useCallback(() => {
    if (tl.state.hidden.includes('docs')) tl.restoreWindow('docs');
    tl.activateWindow('docs');
  }, [tl]);

  // ── Keyboard / command handlers ───────────────────────────────
  // Region cycling + panel toggles, save / tab-nav / close, show-
  // shortcuts, and the +create menu opener — all consumed by the two
  // shortcut/command registries below.
  const {
    cycleRegion,
    togglePanel,
    handleSave,
    handlePrevTab,
    handleNextTab,
    handleGoToTab,
    handleCloseActiveTab,
    handleShowShortcuts,
    openCreateMenu,
  } = useWorkbenchShortcutActions({
    tl,
    focus,
    switchTab,
    activeTabId,
    saveRefMap,
    tabs: groups.tabs,
    openDocs,
    docsCurrentSectionRef,
    handleCloseTab,
    setCreateMenuOpen,
  });

  // ── Tab openers ────────────────────────────────────────────────
  const openers = useTabOpeners({
    rules,
    templates,
    localCollections,
    requestCollections: requestsApi.collections,
    workspaceId: editingScopeWorkspaceId,
    surfaceId: 'workbench',
    allTabs,
    addTab,
    switchTab,
  });
  const {
    pendingRenameTabId,
    setPendingRenameTabId,
    openCreateTab,
    openEditTab,
    openCollectionOverview,
    openFolderOverview,
    openRequestCollectionOverview,
    openRequestFolderOverview,
    openTemplateEditTab,
    openTemplateCollectionOverview,
    openTemplateFolderOverview,
    openSettingsTab,
    openWhatsNew,
    openWorkspaceManager,
    openServerAdmin,
    openEnvironmentEdit,
    openSpecEdit,
    openWorkspaceVariables,
    openVault,
    openScriptPackages,
    openLiveVariables,
    openCollectionVariables,
    openRequestCollectionVariables,
    openRequestCollectionScripts: openRequestCollectionScriptsRaw,
    openRequestFolderScripts: openRequestFolderScriptsRaw,
    openRequestCollectionAuth,
    openRequestFolderAuth,
    openTemplateCollectionVariables,
    openRequestEditTab: openRequestEditTabRaw,
    openCreateRequestTab,
    openGrpcRequestEditTab,
    openCreateGrpcRequestTab,
    openWebSocketRequestEditTab,
    openCreateWebSocketRequestTab,
    openResponseExampleTab,
    openGrpcResponseExampleTab,
    openWsResponseExampleTab,
    openDuplicateRuleScratch,
    openDuplicateRequestScratch,
    openLiveVariableEdit,
    openLiveWorkflowEdit,
    openCreateLiveVariable,
    openCreateLiveWorkflow,
    openProxyRequestInspect,
    openLiveNetworkRequestInspect,
    openLiveStorageDocInspect,
    openSessionReplayRequestInspect,
  } = openers;

  // First workbench open after a feature release auto-opens the
  // bundled What's New tab (docs/UPDATES_PLAN.md; no-op off desktop).
  useWhatsNewAutoOpen(openWhatsNew);

  // Store-updated hosts (no in-app updater): the post-update timeline
  // entry, with "See what's new" landing on the What's New tab.
  useUpdatedNotification(openWhatsNew);

  // Opening a request in the inspector clears any post-import "scripts
  // review pending" reminder for that request — the user has now seen
  // the script content firsthand. Fire-and-forget; the SW arm is a
  // no-op when the uid isn't in the pending set.
  const openRequestEditTab = useCallback(
    (uid: string, name: string, method?: string, autoRename?: boolean) => {
      if (scriptsReviewPendingUids.has(uid)) {
        void hostBridge.call('clearRequestScriptsReviewPending', { uid });
      }
      openRequestEditTabRaw(uid, name, method, autoRename);
    },
    [openRequestEditTabRaw, scriptsReviewPendingUids],
  );

  // Same clearing gesture for the ancestor slots: opening a collection's
  // or folder's Scripts editor counts as reviewing its imported scripts.
  const openRequestCollectionScripts = useCallback(
    (uid: string, name: string) => {
      if (scriptsReviewPendingUids.has(uid)) {
        void hostBridge.call('clearRequestScriptsReviewPending', { uid });
      }
      openRequestCollectionScriptsRaw(uid, name);
    },
    [openRequestCollectionScriptsRaw, scriptsReviewPendingUids],
  );

  const openRequestFolderScripts = useCallback(
    (uid: string, name: string) => {
      if (scriptsReviewPendingUids.has(uid)) {
        void hostBridge.call('clearRequestScriptsReviewPending', { uid });
      }
      openRequestFolderScriptsRaw(uid, name);
    },
    [openRequestFolderScriptsRaw, scriptsReviewPendingUids],
  );

  // Create-then-edit flow for the env selector. New envs are created
  // via the bridge RPC (which fires `environmentsChanged` → envApi
  // updates), then we open the editor in rename mode so the user can
  // name it.
  const handleCreateEnvironment = useCallback(async () => {
    const baseName = t('shared.defaults.newEnvironment');
    const existingNames = new Set(envApi.environments.map((e) => e.name));
    let name = baseName;
    let counter = 2;
    while (existingNames.has(name)) name = `${baseName} (${counter++})`;
    const env = await envApi.createEnvironment(name);
    if (!env) {
      message.error(t('workbench.shell.toast.createEnvironmentFailed'));
      return;
    }
    openEnvironmentEdit(env.uid, env.name, true);
  }, [envApi, openEnvironmentEdit, message, t]);

  // Route the empty-state "Create variable" dropdown to each scope's
  // existing create/manage surface. Collection scope is disabled in the
  // menu (it can only be authored inside a collection), so it never
  // reaches here.
  const handleCreateVariable = useCallback(
    (scope: VariableCreateScope) => {
      switch (scope) {
        case 'environment':
          void handleCreateEnvironment();
          break;
        case 'workspace':
          openWorkspaceVariables();
          break;
        case 'live':
          openCreateLiveVariable();
          break;
        case 'vault':
          openVault();
          break;
      }
    },
    [handleCreateEnvironment, openWorkspaceVariables, openCreateLiveVariable, openVault],
  );

  // ── Workspace switch with dirty-draft guard ────────────────────
  //
  // If any editor tab has unsaved changes, confirm with the user
  // before switching. The dirty tracking already lives in
  // `dirtyMap` (populated by RuleEditor via onDirtyChange), so we
  // reuse it rather than threading a second source of truth.
  const handleSwitchWorkspace = useCallback(
    (targetId: string, opts?: { makeActive?: boolean }) => {
      // Source of truth is the LIVE tab list — `dirtyMap` accumulates
      // historical entries (it's never pruned on tab close), so reading
      // it gives false positives for closed tabs and triggers the
      // discard-drafts modal when zero tabs are actually open. Use the
      // current `allTabs` array's `dirty` flag instead.
      const hasDirty = allTabs.some((t) => t.dirty);
      const targetWs = workspacesApi.workspaces.find((w) => w.id === targetId);
      const targetName = targetWs?.name;
      // The workspace prefix glyph inline before its name, so the toast
      // reads with the same icon the switcher shows.
      const switchedContent = (suffix: string): React.ReactNode => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {t('workbench.shell.appGlue.switchedTo', { unit: instanceLabel() })}
          {renderWorkspacePrefix({ icon: targetWs?.icon, color: targetWs?.color }, token, { size: 16 })}
          {`${targetName ?? ''}${suffix}`}
        </span>
      );
      const doSwitch = async (): Promise<boolean> => {
        // Switch this tab's binding — the slice update flows through to
        // the URL via `useUrlWorkspaceBindingMirror`. ACTIVE is a
        // separate axis: only written when the caller opts in via
        // `opts.makeActive` (the dropdown's pin gesture or its
        // "switch + make active" combined affordance).
        const sameBinding = targetId === perTab.initial.workspace?.workspaceId;
        if (!sameBinding) {
          const data = await readWorkspaceFallThrough(targetId);
          perTab.onPersist((prev) => ({ ...prev, workspace: { workspaceId: targetId, data } }));
        }
        if (opts?.makeActive && targetId !== workspacesApi.activeWorkspaceId) {
          const ok = await workspacesApi.setActiveWorkspace(targetId);
          if (ok) {
            if (targetName) message.success(switchedContent(t('workbench.shell.appGlue.andMadeActive')));
            return true;
          }
          if (!sameBinding && targetName) message.success(switchedContent(''));
          return false;
        }
        if (!sameBinding && targetName) message.success(switchedContent(''));
        return true;
      };
      if (hasDirty) {
        return new Promise<boolean>((resolve) => {
          modal.confirm({
            title: t('workbench.shell.appGlue.discardTitle'),
            content: t('workbench.shell.appGlue.discardBody'),
            okText: t('workbench.shell.appGlue.discardOk'),
            cancelText: t('workbench.shell.appGlue.cancel'),
            okButtonProps: { danger: true },
            onOk: async () => resolve(await doSwitch()),
            onCancel: () => resolve(false),
          });
        });
      }
      return doSwitch();
    },
    [workspacesApi, modal, message, allTabs, perTab, t],
  );

  // ── Migration pull — background-task tenant ────────────────────
  //
  // The corner entry mirrors the host's pull run; its completion
  // click-through opens the run's per-workspace report IN PLACE — the
  // user's active workspace (and any unsaved drafts) stays untouched.
  const [migrationReportSummary, setMigrationReportSummary] = useState<PostmanImportSummary | null>(null);
  const handleViewMigrationReport = useCallback((summary: PostmanImportSummary) => {
    setMigrationReportSummary(summary);
  }, []);
  useMigrationPullTask({ onViewReport: handleViewMigrationReport });

  const openSettings = useCallback(
    (target?: { settingKey?: string; categoryId?: string }) => {
      const mode = getSetting('general.settingsOpenMode');
      setSettingsTarget(target ?? {});
      if (mode === 'tab') {
        openSettingsTab(target);
        return;
      }
      setSettingsMaximized(mode === 'modal-maximized');
      setSettingsOpen(true);
    },
    [openSettingsTab],
  );

  // Host-shell navigation: the desktop main process broadcasts
  // `openSettings` for its native menu items (application menu
  // "Settings…", tray update actions). Hosts without native chrome
  // never emit it.
  useEffect(() => hostBridge.subscribe('openSettings', (target) => openSettings(target)), [openSettings]);

  // Host-shell navigation: the desktop Window menu's "Next Tab" /
  // "Previous Tab" items drive the same focused-leaf cycling as the
  // in-app chords.
  useEffect(
    () =>
      hostBridge.subscribe('tabNavigate', ({ direction }) => {
        if (direction === 'next') handleNextTab();
        else handlePrevTab();
      }),
    [handleNextTab, handlePrevTab],
  );

  // Host-shell File-menu commands (desktop native menu) — each routes to
  // the same handler its in-app chord uses, so menu and keyboard stay
  // behaviorally identical.
  useEffect(
    () =>
      hostBridge.subscribe('menuCommand', ({ command }) => {
        if (command === 'newItem') openCreateMenu();
        else if (command === 'newTab') openCreateRequestTab();
        else if (command === 'import') importExportRef.current?.openImportSource();
        else if (command === 'closeTab') handleCloseActiveTab();
      }),
    [openCreateMenu, openCreateRequestTab, handleCloseActiveTab],
  );

  // Host-shell navigation: a connected browser surface asked this app
  // to reveal a companion target (`companionReveal` peer RPC → the
  // main process fronts the window, then broadcasts). The target maps
  // onto this surface's own registries — dock tool windows for the
  // pty / git / observability features, the Settings category for MCP.
  useEffect(
    () =>
      hostBridge.subscribe('revealToolWindow', ({ target }) => {
        if (target === 'mcp') {
          openSettings({ categoryId: 'mcp' });
          return;
        }
        // The peer-execute refusal hand-off: land on the exact opt-in
        // row the refusing wire message names. Only a loopback peer can
        // reveal, so the local tier's row is always the right target.
        if (target === 'peerExecuteSetting') {
          openSettings({ settingKey: 'backend.allowLocalPeerExecute' });
          return;
        }
        const windowId = REVEAL_WINDOW_BY_TARGET[target];
        if (!windowId) return;
        if (tl.state.hidden.includes(windowId)) tl.restoreWindow(windowId);
        tl.activateWindow(windowId);
      }),
    [tl, openSettings],
  );

  // The console opens as a workbench tab — dismiss the settings overlay
  // on the way out so the navigation lands on a visible surface instead
  // of underneath the modal.
  const openServerAdminFromAnywhere = useCallback(() => {
    closeSettings();
    openServerAdmin();
  }, [closeSettings, openServerAdmin]);

  // Same dismissal on the way to the vault editor tab.
  const openVaultFromAnywhere = useCallback(() => {
    closeSettings();
    openVault();
  }, [closeSettings, openVault]);

  // ── Save-to-collection flow ────────────────────────────────────
  // Both rule-create and request-create scratch tabs hand their form
  // values to a save-flow hook that fast-paths to a preferred
  // destination or opens SaveToCollectionModal. Rule context-create
  // bypasses this entirely (immediate persist via `applyRuleCreate`).
  const requestSaveFlow = useSaveRequestFlow({
    allTabs,
    createRequest: requestsApi.createRequest,
    replaceTab,
  });
  const ruleSaveFlow = useSaveRuleFlow({
    allTabs,
    workspaceId: editingScopeWorkspaceId,
    surfaceId: 'workbench',
    localCollections,
    replaceTab,
  });

  // ── Editor mounting glue (dirty / save / duplicate registration) ─
  // Every editor `renderTabBody` mounts registers its imperative
  // handles here; the tab-bar's Duplicate reads the snapshot refs.
  const {
    handleDirtyChange,
    handleSaved,
    registerSaveRef,
    registerSaveAsTemplateRef,
    registerRuleDuplicateRef,
    registerRequestDuplicateRef,
    handleDuplicateTab,
  } = useEditorRegistrations({
    dirtyMap,
    saveRefMap,
    updateTab,
    allTabs,
    rules,
    openDuplicateRuleScratch,
    openDuplicateRequestScratch,
  });

  // Clear stale rename state on tab switch.
  useEffect(() => {
    if (pendingRenameTabId && pendingRenameTabId !== activeTabId) {
      setPendingRenameTabId(null);
    }
  }, [activeTabId, pendingRenameTabId, setPendingRenameTabId]);

  // ── Workspace Intent routing (cold-hash + warm-message) ────────
  useWorkspaceIntentRouter({
    isStatusLoaded,
    // An external surface routed the user here to look at something —
    // drop the settings modal so it doesn't cover the destination.
    // `open-settings` is the one intent whose destination IS the modal.
    onIntentDispatch: (intent) => {
      if (intent.kind !== 'open-settings') setSettingsOpen(false);
    },
    openCreateTab,
    openEditTab,
    openDocs,
    openNotifications: () => {
      if (tl.state.hidden.includes('notifications')) tl.restoreWindow('notifications');
      tl.activateWindow('notifications');
    },
    openSettings,
    openWorkspaceManager,
    openEnvironmentEdit,
    openCreateEnvironment: handleCreateEnvironment,
    openWorkspaceVariables,
    openVault,
    openLiveVariables,
    openCollectionVariables,
    openRequestCollectionVariables,
    openTemplateCollectionVariables,
    openRequestEditTab,
    openLiveVariableEdit,
    openLiveWorkflowEdit,
    openCreateLiveVariable,
    // Devpanel "Create API request" handoff: a stashed seed opens the
    // same pre-filled scratch tab as Duplicate Tab; no seed (expired
    // nonce) degrades to a blank draft request.
    openCreateApiRequest: (seed) => {
      if (seed) openDuplicateRequestScratch(seed);
      else openCreateRequestTab();
    },
    openExportModal: () => importExportRef.current?.openExportModal({ kind: 'workspace' }),
    openImportModal: () => importExportRef.current?.openImportSource(),
    openMigrateModal: () => importExportRef.current?.openMigrateTool(),
  });

  // ── Sync tab labels with rule/template changes; close on delete ─
  useTabSyncEffects({
    rules,
    templates,
    localCollectionTrees,
    environments: envApi.environments,
    requests: requestsApi.requests,
    requestCollectionTrees: requestsApi.collectionTrees,
    templateCollectionTrees,
    liveVariables: liveVarsApi.variables,
    liveWorkflows: liveWorkflowsApi.workflows,
    specs,
    allTabs,
    updateTab,
    closeTab: rawCloseTab,
  });

  const handleDeleteRule = useCallback((uid: string) => void deleteLocalRule(uid), [deleteLocalRule]);

  // Pinned-envs writes are per-family entity mutations — resolve which
  // family owns the uid here (the selector only knows the uid).
  const setCollectionPinnedEnvsByFamily = useCallback(
    (collectionUid: string, pinnedIds: string[], defaultId: string | null) => {
      const family = requestsApi.collections.some((c) => c.uid === collectionUid)
        ? ('request' as const)
        : templateCollections.some((c) => c.uid === collectionUid)
          ? ('template' as const)
          : ('rule' as const);
      return envApi.setCollectionPinnedEnvs(collectionUid, pinnedIds, defaultId, family);
    },
    [envApi.setCollectionPinnedEnvs, requestsApi.collections, templateCollections],
  );

  // ── Active-tab derivations (entity, breadcrumbs, labels, env ctx) ─
  // Everything the shell reads off "which tab is focused right now" —
  // plus the shell's single `document.title` composer, whose only
  // consumer is the title effect inside the hook.
  const {
    activeTab,
    activeTabEntity,
    getTabDisplayLabel,
    activeBreadcrumbSegments,
    activeWorkspace,
    activeTabCollectionId,
    allCollectionsForEnv,
    envSwitcherCollectionContext,
  } = useWorkbenchActiveTab({
    focusedLeaf: groups.focusedLeaf,
    rules,
    templates,
    environments: envApi.environments,
    requests: requestsApi.requests,
    localCollections,
    requestCollections: requestsApi.collections,
    templateCollections,
    localCollectionTrees,
    requestCollectionTrees: requestsApi.collectionTrees,
    templateCollectionTrees,
    liveVariables: liveVarsApi.variables,
    liveWorkflows: liveWorkflowsApi.workflows,
    responseExamples,
    grpcRequests: requestsApi.grpcRequests,
    grpcResponseExamples,
    websocketRequests: requestsApi.websocketRequests,
    wsResponseExamples,
    specs,
    workspaces: workspacesApi.workspaces,
    editingScopeWorkspaceId,
    updateTab,
  });

  const handleBreadcrumbRenameFor = useCallback(
    (tab: WorkbenchTab, newName: string) => {
      if (tab.mode === 'collection-overview' && tab.entityId) {
        void renameLocalCollection(tab.entityId, newName);
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'folder-overview' && tab.entityId) {
        void renameLocalFolder(tab.entityId, newName);
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'edit' && tab.ruleUid) {
        void updateLocalRule(tab.ruleUid, { name: newName });
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'env-edit' && tab.environmentUid) {
        void envApi.renameEnvironment(tab.environmentUid, newName);
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'spec-edit' && tab.specUid && editingScopeWorkspaceId) {
        void applySpecUpdate(
          tab.specUid,
          { name: newName },
          { workspaceId: editingScopeWorkspaceId, surfaceId: 'workbench' },
        );
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'request-edit' && tab.requestUid) {
        void requestsApi.updateRequest(tab.requestUid, { name: newName });
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'grpc-edit' && tab.grpcRequestUid) {
        void requestsApi.updateGrpcRequest(tab.grpcRequestUid, { name: newName });
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'websocket-edit' && tab.websocketRequestUid) {
        void requestsApi.updateWebSocketRequest(tab.websocketRequestUid, { name: newName });
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'request-create' || tab.mode === 'rule-create' || tab.mode === 'live-workflow-create') {
        // Draft name change — no persistence until Save. Update both
        // the tab label and the `draftName` field so the editor's
        // Save handler picks up the renamed value.
        updateTab(tab.id, { label: newName, draftName: newName });
      } else if (tab.mode === 'live-variable-edit' && tab.liveVariableUid) {
        void liveVarsApi.updateVariable(tab.liveVariableUid, { name: newName });
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'live-workflow-edit' && tab.liveWorkflowUid) {
        void liveWorkflowsApi.updateWorkflow(tab.liveWorkflowUid, { name: newName });
        updateTab(tab.id, { label: newName });
      }
      setPendingRenameTabId(null);
    },
    [
      renameLocalCollection,
      renameLocalFolder,
      updateLocalRule,
      envApi,
      requestsApi,
      liveVarsApi,
      liveWorkflowsApi,
      updateTab,
      setPendingRenameTabId,
      editingScopeWorkspaceId,
    ],
  );

  // Sidebar filter focus refs — one per sidebar-backed tool window.
  // The `/` shortcut routes to the filter in the currently focused
  // dock so it doesn't yank focus across panels (e.g. typing `/`
  // while interacting with the http-rules sidebar must focus the
  // http-rules filter, not whichever sidebar happened to mount last).
  const sidebarFilterRefs = useRef<Map<SidebarView, InputRef | null>>(new Map());

  // ── Command palette data ──────────────────────────────────────
  const { groups: cmdGroups, sections: cmdSections } = useCommandPaletteData({
    rules,
    templates,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees: requestsApi.collectionTrees,
    pausedUids,
    environments: envApi.environments,
    openEditTab,
    openCreateTab,
    openTemplateEditTab,
    openRequestEditTab,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openScriptPackages,
    openLiveVariables,
    onOpenCreateMenu: openCreateMenu,
    onTogglePanel: togglePanel,
    onToggleActivityFeed: () => tl.toggleWindow('activity'),
    onShowShortcuts: handleShowShortcuts,
    onOpenSettings: openSettings,
  });

  // TabBar publishes its tab-search toggle function here on mount so
  // the workspace shortcut registry can invoke it via `onTabSearch`
  // instead of duplicating a hardcoded `Shift+Cmd+A` window listener.
  const tabSearchToggleRef = useRef<(() => void) | null>(null);
  const registerTabSearchToggle = useCallback((toggle: () => void) => {
    tabSearchToggleRef.current = toggle;
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────────
  useWorkspaceShortcuts({
    onToggleSidebar: () => togglePanel('sidebar'),
    onToggleBottomPanel: () => togglePanel('bottomPanel'),
    onToggleInspector: () => togglePanel('inspector'),
    onToggleActivityFeed: () => tl.toggleWindow('activity'),
    onCloseTab: handleCloseActiveTab,
    onNewTab: () => openCreateRequestTab(),
    onImport: () => importExportRef.current?.openImportSource(),
    onPrevTab: handlePrevTab,
    onNextTab: handleNextTab,
    onGoToTab: handleGoToTab,
    onTabSearch: () => {
      // Region-arbitrated `mod+shift+a` (the `mod+t` pattern): when the
      // Terminal tool window is the focused dock's active panel, the
      // shortcut opens the focused terminal pane's tab search; anywhere
      // else — or with no terminal toggle live — the editor's.
      const focusedDock = getFocusedDock();
      const activePanel = focusedDock ? tl.state.docks[focusedDock]?.active : null;
      if (activePanel === 'terminal' && toggleTerminalTabSearch()) return;
      tabSearchToggleRef.current?.();
    },
    onSave: handleSave,
    onNewRule: openCreateMenu,
    onFocusFilter: () => {
      // Scope to whatever panel the user is currently focused in.
      // Look up the active tool window in the focused dock, focus
      // its registered filter ref. No mapping, no fallbacks — if
      // the panel doesn't have a filter, the shortcut is a no-op
      // and the keystroke flows through to the browser.
      const focusedDock = getFocusedDock();
      if (!focusedDock) return;
      const activeWindow = tl.state.docks[focusedDock]?.active;
      if (!activeWindow) return;
      const ref = sidebarFilterRefs.current.get(activeWindow as SidebarView);
      ref?.focus();
    },
    onTerminalNewTab: () => {
      // Region-arbitrated `mod+t`: a new terminal tab only when the
      // Terminal tool window is the focused dock's active panel;
      // any other bottom panel falls through to the editor new-tab
      // action, matching what the chord does everywhere else.
      const terminalTabs = getWorkbenchTerminalTabs();
      const focusedDock = getFocusedDock();
      const activePanel = focusedDock ? tl.state.docks[focusedDock]?.active : null;
      if (terminalTabs && activePanel === 'terminal') {
        terminalTabs.createTab();
        return;
      }
      openCreateRequestTab();
    },
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShowShortcuts: handleShowShortcuts,
    onOpenSettings: openSettings,
    onFocusRegion: (region) => cycleRegion(region),
    hasActiveTab: () => activeTabId != null,
  });

  // Allotment onChange — persist ratios via useResponsiveLayout.
  const handleHorizontalResize = useCallback((sizes: number[]) => layout.onPanelResize(sizes), [layout]);
  const handleVerticalResize = useCallback((sizes: number[]) => layout.onVerticalResize(sizes), [layout]);

  // ── Per-tab body renderer ─────────────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: WorkbenchTab }): React.ReactNode => (
      <WorkbenchTabBody
        tab={tab}
        handleSaved={handleSaved}
        handleDirtyChange={handleDirtyChange}
        registerSaveRef={registerSaveRef}
        registerSaveAsTemplateRef={registerSaveAsTemplateRef}
        registerRuleDuplicateRef={registerRuleDuplicateRef}
        registerRequestDuplicateRef={registerRequestDuplicateRef}
        openEditTab={openEditTab}
        openCreateTab={openCreateTab}
        openFolderOverview={openFolderOverview}
        openRequestFolderOverview={openRequestFolderOverview}
        openTemplateFolderOverview={openTemplateFolderOverview}
        openCollectionVariables={openCollectionVariables}
        openCreateRequestTab={openCreateRequestTab}
        openRequestCollectionVariables={openRequestCollectionVariables}
        openRequestCollectionScripts={openRequestCollectionScripts}
        openRequestFolderScripts={openRequestFolderScripts}
        openRequestCollectionAuth={openRequestCollectionAuth}
        openRequestFolderAuth={openRequestFolderAuth}
        openRequestEditTab={openRequestEditTab}
        openTemplateEditTab={openTemplateEditTab}
        openTemplateCollectionVariables={openTemplateCollectionVariables}
        openLiveWorkflowEdit={openLiveWorkflowEdit}
        openLiveVariableEdit={openLiveVariableEdit}
        openCreateLiveVariable={openCreateLiveVariable}
        openCreateLiveWorkflow={openCreateLiveWorkflow}
        openScriptPackages={openScriptPackages}
        openDuplicateRequestScratch={openDuplicateRequestScratch}
        openResponseExampleTab={openResponseExampleTab}
        openGrpcResponseExampleTab={openGrpcResponseExampleTab}
        openWsResponseExampleTab={openWsResponseExampleTab}
        openGrpcRequestEditTab={openGrpcRequestEditTab}
        openWebSocketRequestEditTab={openWebSocketRequestEditTab}
        handleSwitchWorkspace={handleSwitchWorkspace}
        onRuleSaveDraft={ruleSaveFlow.handleSaveDraft}
        onRequestSaveDraft={requestSaveFlow.handleSaveDraft}
        replaceTab={replaceTab}
        workspacesApi={workspacesApi}
        editingScopeWorkspaceId={editingScopeWorkspaceId}
        requestCollections={requestsApi.collections}
        templateCollections={templateCollections}
        localCollectionTrees={localCollectionTrees}
        requestCollectionTrees={requestsApi.collectionTrees}
        templateCollectionTrees={templateCollectionTrees}
        liveWorkflows={liveWorkflowsApi.workflows}
      />
    ),
    [
      handleSaved,
      handleDirtyChange,
      registerSaveRef,
      registerSaveAsTemplateRef,
      registerRuleDuplicateRef,
      registerRequestDuplicateRef,
      openEditTab,
      openCreateTab,
      openFolderOverview,
      openRequestFolderOverview,
      openTemplateFolderOverview,
      workspacesApi,
      openCollectionVariables,
      requestSaveFlow.handleSaveDraft,
      ruleSaveFlow.handleSaveDraft,
      openLiveWorkflowEdit,
      openLiveVariableEdit,
      openCreateLiveVariable,
      openCreateLiveWorkflow,
      openDuplicateRequestScratch,
      openResponseExampleTab,
      openGrpcResponseExampleTab,
      openWsResponseExampleTab,
      openGrpcRequestEditTab,
      openWebSocketRequestEditTab,
      liveWorkflowsApi.workflows,
      replaceTab,
      editingScopeWorkspaceId,
      handleSwitchWorkspace,
      localCollectionTrees,
      openCreateRequestTab,
      openRequestCollectionVariables,
      openRequestCollectionScripts,
      openRequestFolderScripts,
      openRequestCollectionAuth,
      openRequestFolderAuth,
      openRequestEditTab,
      openTemplateCollectionVariables,
      openTemplateEditTab,
      requestsApi.collectionTrees,
      requestsApi.collections.some,
      templateCollectionTrees,
      templateCollections.some,
    ],
  );

  // Per-leaf header is empty by default — each editor renders its own
  // `EditorHeader` internally so the title slot, panel-specific actions,
  // Save, and overflow live in a single shared-shape row inside the
  // editor component.
  const renderLeafHeader = useCallback((_: RenderLeafHeaderContext): React.ReactNode => null, []);

  // "Browse all templates…" in the empty state's Use-template cascade —
  // reveals the sidebar's template tree: focus the HTTP Rules panel,
  // open its TEMPLATES section, and expand the system collection with
  // its per-type folders.
  const handleBrowseTemplates = useCallback(() => {
    if (tl.state.hidden.includes('http-rules')) tl.restoreWindow('http-rules');
    tl.activateWindow('http-rules');
    sidebarState.setSectionsForView('http-rules', (prev) => ({ ...prev, templates: true }));
    sidebarState.setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.add('sys-tpl-col');
      for (const [ruleType, templates] of Object.entries(TEMPLATES_BY_TYPE)) {
        if (templates.length > 0) next.add(`sys-tpl-${ruleType}`);
      }
      return next;
    });
  }, [tl, sidebarState]);

  // First-run migration offer (MIGRATION_STATUS.md S5 addendum): the
  // desktop opens the ladder modal, the extension the desktop hand-off
  // (the funnel) — both only while the workspace is still empty; once
  // anything exists, the permanent hub entry inside the import modal
  // takes over. The web host has no migration entry.
  const showMigrationOffer =
    getCurrentHost() !== 'web' && rules.length === 0 && requestsApi.requests.length === 0;

  const renderEmpty = useCallback(
    () => (
      <EmptyState
        onCreateRule={openCreateTab}
        onCreateRuleFromTemplate={(type, templateKey) => openCreateTab(type, undefined, templateKey)}
        onBrowseTemplates={handleBrowseTemplates}
        onCreateRequest={() => openCreateRequestTab()}
        onCreateWorkflow={() => openCreateLiveWorkflow()}
        onCreateVariable={handleCreateVariable}
        onImport={() => importExportRef.current?.openImportSource()}
        onMigrate={showMigrationOffer ? () => importExportRef.current?.openMigrateTool() : undefined}
      />
    ),
    [
      openCreateTab,
      handleBrowseTemplates,
      openCreateRequestTab,
      openCreateLiveWorkflow,
      handleCreateVariable,
      showMigrationOffer,
    ],
  );

  // Bound `View` handler for ActivityFeedPanel — routes per
  // entityType to the matching tab-opener via the pure helper in
  // `activity-view-router.ts`. Lifted out of renderToolWindow so the
  // bound callback keeps a stable identity across non-opener renders.
  const handleViewActivityEntity = useCallback(
    (entityType: string, entityId: string) => {
      viewActivityEntity(entityType, entityId, {
        openEditTab,
        openEnvironmentEdit,
        openSpecEdit,
        openRequestEditTab,
        openTemplateEditTab,
        openLiveVariableEdit,
        openLiveWorkflowEdit,
        openVault,
        openWorkspaceVariables,
        openCollectionOverview,
        openRequestCollectionOverview,
        openTemplateCollectionOverview,
        openFolderOverview,
        openRequestFolderOverview,
        openTemplateFolderOverview,
      });
    },
    [
      openEditTab,
      openEnvironmentEdit,
      openSpecEdit,
      openRequestEditTab,
      openTemplateEditTab,
      openLiveVariableEdit,
      openLiveWorkflowEdit,
      openVault,
      openWorkspaceVariables,
      openCollectionOverview,
      openRequestCollectionOverview,
      openTemplateCollectionOverview,
      openFolderOverview,
      openRequestFolderOverview,
      openTemplateFolderOverview,
    ],
  );

  // ── Tool window renderer ──────────────────────────────────────
  // Thin render prop for `ShellLayout` — the per-slot body dispatch
  // lives in `WorkbenchToolWindow`.
  const renderToolWindow = useCallback(
    (id: ToolWindowId, slot: DockSlot): React.ReactNode => (
      <WorkbenchToolWindow
        id={id}
        slot={slot}
        tl={tl}
        activeTabId={activeTabId}
        allTabs={allTabs}
        switchTab={switchTab}
        openEditTab={openEditTab}
        openCreateTab={openCreateTab}
        openCollectionOverview={openCollectionOverview}
        openFolderOverview={openFolderOverview}
        openRequestCollectionOverview={openRequestCollectionOverview}
        openRequestFolderOverview={openRequestFolderOverview}
        openTemplateEditTab={openTemplateEditTab}
        openTemplateCollectionOverview={openTemplateCollectionOverview}
        openTemplateFolderOverview={openTemplateFolderOverview}
        openEnvironmentEdit={openEnvironmentEdit}
        openSpecEdit={openSpecEdit}
        openCreateEnvironment={() => {
          void handleCreateEnvironment();
        }}
        openWorkspaceVariables={openWorkspaceVariables}
        openVault={openVault}
        openScriptPackages={openScriptPackages}
        openLiveVariables={openLiveVariables}
        openCollectionVariables={openCollectionVariables}
        openRequestCollectionVariables={openRequestCollectionVariables}
        openTemplateCollectionVariables={openTemplateCollectionVariables}
        openLiveWorkflowEdit={openLiveWorkflowEdit}
        openCreateLiveWorkflow={openCreateLiveWorkflow}
        openRequestEditTab={openRequestEditTab}
        openCreateRequestTab={openCreateRequestTab}
        openGrpcRequestEditTab={openGrpcRequestEditTab}
        openCreateGrpcRequestTab={openCreateGrpcRequestTab}
        openWebSocketRequestEditTab={openWebSocketRequestEditTab}
        openCreateWebSocketRequestTab={openCreateWebSocketRequestTab}
        openResponseExampleTab={openResponseExampleTab}
        openGrpcResponseExampleTab={openGrpcResponseExampleTab}
        openWsResponseExampleTab={openWsResponseExampleTab}
        openLiveVariableEdit={openLiveVariableEdit}
        openProxyRequestInspect={openProxyRequestInspect}
        openLiveNetworkRequestInspect={openLiveNetworkRequestInspect}
        openLiveStorageDocInspect={openLiveStorageDocInspect}
        openSessionReplayRequestInspect={openSessionReplayRequestInspect}
        openSettingsTab={openSettingsTab}
        handleDeleteRule={handleDeleteRule}
        handleCloseTab={handleCloseTab}
        handleViewActivityEntity={handleViewActivityEntity}
        importExportRef={importExportRef}
        sidebarFilterRefs={sidebarFilterRefs}
        dirtyRuleUids={dirtyRuleUids}
        dirtyRequestUids={dirtyRequestUids}
        scriptsReviewPendingUids={scriptsReviewPendingUids}
        dirtyWorkflowUids={dirtyWorkflowUids}
        unresolvableWorkflowUids={unresolvableWorkflowUids}
        sidebarState={sidebarState}
        activeTab={activeTab}
        liveWorkflows={liveWorkflowsApi.workflows}
      />
    ),
    [
      activeTabId,
      openEditTab,
      openCreateTab,
      handleDeleteRule,
      openCollectionOverview,
      openFolderOverview,
      openRequestCollectionOverview,
      openRequestFolderOverview,
      openTemplateEditTab,
      openTemplateCollectionOverview,
      openTemplateFolderOverview,
      tl,
      activeTab,
      openEnvironmentEdit,
      openSpecEdit,
      handleCreateEnvironment,
      openVault,
      openWorkspaceVariables,
      openLiveVariables,
      openCollectionVariables,
      openRequestCollectionVariables,
      openTemplateCollectionVariables,
      openRequestEditTab,
      openCreateRequestTab,
      openGrpcRequestEditTab,
      openCreateGrpcRequestTab,
      openWebSocketRequestEditTab,
      openCreateWebSocketRequestTab,
      openResponseExampleTab,
      openGrpcResponseExampleTab,
      openWsResponseExampleTab,
      openLiveWorkflowEdit,
      openCreateLiveWorkflow,
      liveWorkflowsApi.workflows,
      dirtyRuleUids,
      dirtyRequestUids,
      scriptsReviewPendingUids,
      dirtyWorkflowUids,
      unresolvableWorkflowUids,
      allTabs,
      switchTab,
      handleCloseTab,
      sidebarState,
      openLiveVariableEdit,
      openProxyRequestInspect,
      openLiveNetworkRequestInspect,
      openLiveStorageDocInspect,
      openSessionReplayRequestInspect,
      openSettingsTab,
      handleViewActivityEntity,
    ],
  );

  return (
    <EnvSwitcherProvider collectionContext={envSwitcherCollectionContext}>
      <OpenSettingsProvider openSettings={openSettings}>
      <OpenServerAdminProvider openServerAdmin={openServerAdminFromAnywhere}>
      <OpenVaultProvider openVault={openVaultFromAnywhere}>
      <ImportTextProvider importText={importText}>
      <VariablePopoverProvider>
        <ActiveTabEntityWriter value={activeTabEntity} />
        {/* BC-MWPT-11 — awareness publishes editing-scope so peers see
            "B is editing X" when B's tab is bound to X. SW continues
            to forward the renderer-stamped payload as opaque bytes;
            no SW code change. */}
        <SurfaceAwarenessPublisher
          workspaceId={editingScopeWorkspaceId}
          migratedEntityTypes={[
            RULE_ENTITY_TYPE,
            TEMPLATE_ENTITY_TYPE,
            REQUEST_ENTITY_TYPE,
            ENVIRONMENT_ENTITY_TYPE,
            WORKSPACE_VARIABLES_ENTITY_TYPE,
            VAULT_ENTITY_TYPE,
            COLLECTION_ENTITY_TYPE,
            REQUEST_COLLECTION_ENTITY_TYPE,
            TEMPLATE_COLLECTION_ENTITY_TYPE,
            LIVE_VARIABLE_ENTITY_TYPE,
            LIVE_WORKFLOW_ENTITY_TYPE,
          ]}
        />
        <div
          ref={shellRef}
          className="rules-shell"
          data-theme={isDarkMode ? 'dark' : 'light'}
          style={{ background: token.colorBgLayout }}
        >
          <TopBar
            tl={tl}
            perTab={perTab}
            onCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenSettings={openSettings}
            workspaces={workspacesApi.workspaces}
            activeWorkspaceId={editingScopeWorkspaceId}
            onSwitchWorkspace={handleSwitchWorkspace}
            onSetActiveWorkspace={workspacesApi.setActiveWorkspace}
            onOpenWorkspaceManager={openWorkspaceManager}
            onOpenBackendSettings={() => openSettings({ categoryId: 'backend' })}
            onExportWorkspace={() => importExportRef.current?.openExportModal({ kind: 'workspace' })}
            onImportWorkspace={() => importExportRef.current?.openImportSource()}
            environments={envApi.environments}
            activeEnvironmentId={envApi.activeEnvironmentId}
            onCreateEnvironment={() => void handleCreateEnvironment()}
            onOpenEnvironment={(uid) => {
              const env = envApi.environments.find((e) => e.uid === uid);
              openEnvironmentEdit(uid, env?.name ?? t('workbench.shell.fallback.environment'));
            }}
            onOpenWorkspaceVariables={openWorkspaceVariables}
            onOpenCollectionVariables={() => {
              if (!activeTabCollectionId) return;
              // Dispatch to the right opener per family — the active
              // tab's collectionId may belong to any of the three.
              const ruleCol = localCollections.find((c) => c.uid === activeTabCollectionId);
              if (ruleCol) {
                openCollectionVariables(ruleCol.uid, ruleCol.name);
                return;
              }
              const reqCol = requestsApi.collections.find((c) => c.uid === activeTabCollectionId);
              if (reqCol) {
                openRequestCollectionVariables(reqCol.uid, reqCol.name);
                return;
              }
              const tmplCol = templateCollections.find((c) => c.uid === activeTabCollectionId);
              if (tmplCol) {
                openTemplateCollectionVariables(tmplCol.uid, tmplCol.name);
              }
            }}
            onOpenVault={openVault}
            onOpenLiveVariables={openLiveVariables}
            activeCollectionId={activeTabCollectionId}
            allCollections={allCollectionsForEnv}
            onSetCollectionPinnedEnvs={setCollectionPinnedEnvsByFamily}
          />

          <SecurityUpdateBanner onOpenUpdates={() => openSettings({ categoryId: 'updates' })} />

          <OrgWorkspaceAccessNotice
            workspaces={workspacesApi.workspaces}
            activeWorkspaceId={workspacesApi.activeWorkspaceId}
            onSwitchWorkspace={handleSwitchWorkspace}
          />

          <AppUpdateToast
            onOpenUpdateSettings={() => openSettings({ categoryId: 'updates' })}
            onOpenWhatsNew={openWhatsNew}
          />
          <UpdateDialog onConfigureUpdates={() => openSettings({ categoryId: 'updates' })} />

          <ShellLayout
            tl={tl}
            responsive={layout}
            renderToolWindow={renderToolWindow}
            renderEditor={() => (
              <EditorGroupRenderer
                groups={groups}
                rules={rules}
                templates={templates}
                requests={requestsApi.requests}
                pausedUids={pausedUids}
                unresolvableRuleUids={unresolvableRuleUids}
                unresolvableRequestUids={unresolvableRequestUids}
                liveWorkflows={liveWorkflowsApi.workflows}
                unresolvableWorkflowUids={unresolvableWorkflowUids}
                renderTabBody={renderTabBody}
                renderLeafHeader={renderLeafHeader}
                getTabPath={(tab) =>
                  computeBreadcrumbs(
                    tab,
                    getTabDisplayLabel(tab),
                    rules,
                    localCollectionTrees,
                    requestsApi.collectionTrees,
                    requestsApi.requests,
                    templateCollectionTrees,
                    t,
                  )
                }
                getDisplayLabel={getTabDisplayLabel}
                renderEmpty={renderEmpty}
                onCreateRule={openCreateTab}
                onCreateRequest={() => openCreateRequestTab()}
                createMenuOpen={createMenuOpen}
                onCreateMenuOpenChange={setCreateMenuOpen}
                registerTabSearchToggle={registerTabSearchToggle}
                onTabDoubleClick={tl.toggleZenMode}
                onDuplicate={handleDuplicateTab}
                onCloseTab={handleCloseTab}
                onCloseOther={handleCloseOther}
                onCloseAll={handleCloseAll}
                onCloseUnmodified={handleCloseUnmodified}
                onCloseToLeft={handleCloseToLeft}
                onCloseToRight={handleCloseToRight}
                recentlyClosed={groups.recentlyClosed}
              />
            )}
            onHorizontalResize={handleHorizontalResize}
            onVerticalResize={handleVerticalResize}
            renderEditorTabDragPreview={(tabId) => {
              const tab = allTabs.find((t) => t.id === tabId);
              if (!tab) return null;
              return (
                <div className="rules-drag-preview">
                  <span className="rules-drag-preview-icon">
                    {tabIcon(
                      tab,
                      rules,
                      templates,
                      pausedUids,
                      requestsApi.requests,
                      unresolvableRequestUids,
                      unresolvableRuleUids,
                      liveWorkflowsApi.workflows,
                      unresolvableWorkflowUids,
                    )}
                  </span>
                  <span className="rules-drag-preview-label">{renderTabLabel(tab, getTabDisplayLabel(tab))}</span>
                </div>
              );
            }}
          />

          <StatusBar
            workspace={
              activeWorkspace
                ? { name: activeWorkspace.name, icon: activeWorkspace.icon, color: activeWorkspace.color }
                : undefined
            }
            segments={activeBreadcrumbSegments}
            provenance={
              activeTab?.mode === 'request-create' && activeTab.seedFromExampleName
                ? `from “${activeTab.seedFromExampleName}”`
                : undefined
            }
            onRename={
              activeTab &&
              (activeTab.mode === 'edit' ||
                activeTab.mode === 'collection-overview' ||
                activeTab.mode === 'folder-overview' ||
                activeTab.mode === 'env-edit' ||
                activeTab.mode === 'spec-edit' ||
                activeTab.mode === 'request-edit' ||
                activeTab.mode === 'grpc-edit' ||
                activeTab.mode === 'websocket-edit' ||
                activeTab.mode === 'request-create' ||
                activeTab.mode === 'rule-create' ||
                activeTab.mode === 'live-variable-edit' ||
                activeTab.mode === 'live-workflow-edit' ||
                activeTab.mode === 'live-workflow-create')
                ? (newName) => handleBreadcrumbRenameFor(activeTab, newName)
                : undefined
            }
            autoRenameKey={activeTab && pendingRenameTabId === activeTab.id ? activeTab.id : null}
          />

          <SaveToCollectionModal
            open={requestSaveFlow.saveModalOpen}
            entityName={requestSaveFlow.saveModalEntityName}
            collectionTrees={requestsApi.collectionTrees}
            collections={requestsApi.collections}
            onSave={(params) => void requestSaveFlow.handleSaveModalConfirm(params)}
            onCreateCollection={requestsApi.createCollection}
            onCreateFolder={requestsApi.createFolder}
            onCancel={requestSaveFlow.closeSaveModal}
            defaultNewCollectionName={t('shared.defaults.newRequestsCollection')}
          />

          <SaveToCollectionModal
            open={ruleSaveFlow.saveModalOpen}
            entityName={ruleSaveFlow.saveModalEntityName}
            rules={rules}
            pausedUids={pausedUids}
            unresolvableRuleUids={unresolvableRuleUids}
            collectionTrees={localCollectionTrees}
            collections={localCollections}
            onSave={(params) => void ruleSaveFlow.handleSaveModalConfirm(params)}
            onCreateCollection={createLocalCollection}
            onCreateFolder={createLocalFolder}
            onCancel={ruleSaveFlow.closeSaveModal}
          />

          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            groups={cmdGroups}
            sections={cmdSections}
          />

          <ImportExportModals
            ref={importExportRef}
            onSwitchWorkspace={handleSwitchWorkspace}
            onOpenRequest={openRequestEditTab}
            dropTargetRef={shellRef}
          />

          <MigrationReportModal
            open={migrationReportSummary !== null}
            summary={migrationReportSummary}
            onClose={() => setMigrationReportSummary(null)}
            onOpenWorkspace={(workspaceId) => {
              setMigrationReportSummary(null);
              void handleSwitchWorkspace(workspaceId, { makeActive: true });
            }}
          />

          <ConnectionProvider value={{ isConnected }}>
            <SettingsModal
              open={settingsOpen}
              onClose={closeSettings}
              initialSettingKey={settingsTarget.settingKey}
              initialCategoryId={settingsTarget.categoryId}
              initialMaximized={settingsMaximized}
              onPromoteToTab={() => openSettingsTab(settingsTarget)}
            />
          </ConnectionProvider>
        </div>
      </VariablePopoverProvider>
      </ImportTextProvider>
      </OpenVaultProvider>
      </OpenServerAdminProvider>
      </OpenSettingsProvider>
    </EnvSwitcherProvider>
  );
};

// Push the workbench's computed active-tab entity into the shared
// `ActiveTabEntity` context. Lives as a tiny child component so the
// setter is consumed inside the Provider boundary mounted in
// `Workbench` (the top-level), without WorkbenchInner having to
// thread the setter call through its main return tree.
function ActiveTabEntityWriter({ value }: { value: { entityType: string; entityId: string } | null }): null {
  const setActiveTabEntity = useSetActiveTabEntity();
  useEffect(() => {
    setActiveTabEntity(value);
  }, [value, setActiveTabEntity]);
  return null;
}

interface WorkbenchProps {
  /**
   * Host-supplied surface identity resolver. The chrome
   * `tabs.getCurrent` lookup lives in the extension host
   * (`resolveWorkbenchIdentity`); this component stays host-agnostic.
   */
  resolveIdentity: () => SurfaceIdentityHandle;
}

const Workbench: React.FC<WorkbenchProps> = ({ resolveIdentity }) => {
  // Per-tab identity — each workbench tab opens a fresh React realm, so
  // resolving once at the root via the host resolver is exactly per-tab.
  const [workbenchIdentity] = useState(resolveIdentity);
  // Lifeline workspaceId — driven by {@link WorkbenchTabAware}'s
  // editing-scope read once `useWorkbenchWorkspaceSlice` has finished
  // correcting stale bindings. Starts `null` so the cold-mount lifeline
  // opens liveness-only (SW skips refcount acquire); flips to the
  // editing-scope id on first effect, which dispatches a clean
  // bind-then-acquire on the SW side. Per § 4.0.7 trust contract.
  const [lifelineWorkspaceId, setLifelineWorkspaceId] = useState<string | null>(null);
  return (
    <AwarenessIdentityProvider value={workbenchIdentity} workspaceId={lifelineWorkspaceId}>
      {/*
       * `ActiveFieldFocusProvider` lifts the "currently focused field"
       * state above every workbench surface (editor body, sidebar
       * inline-rename, breadcrumb inline-rename) so any of them can
       * publish presence on the same wire. The matching
       * `<SurfaceAwarenessPublisher>` mounts inside `WorkbenchInner`
       * because it needs the active workspace id, which lives in the
       * rule store. `<ActiveEditorDirtyProvider>` is the third workspace
       * context the publisher composes from (alongside `ActiveTabEntity`
       * and `ActiveFieldFocus`); editors call `useEditorDirty` to
       * contribute their dirty marker when they are the active tab.
       */}
      <ActiveFieldFocusProvider>
        <ActiveEditorDirtyProvider>
          <ActiveEditorLifecycleProvider>
            <ActiveTabEntityProvider>
              {/* RuleProvider mounts inside `WorkbenchTabAware` (called via
                `WorkbenchInner`) so it can take the tab's editing-scope
                workspace id as a prop (BC-MWPT-5). The `InspectorNavProvider`
                followed it down for the same reason — a per-tab-correct
                tree start at the seam. */}
              <WorkbenchInner onLifelineWorkspaceIdChange={setLifelineWorkspaceId} />
            </ActiveTabEntityProvider>
          </ActiveEditorLifecycleProvider>
        </ActiveEditorDirtyProvider>
      </ActiveFieldFocusProvider>
    </AwarenessIdentityProvider>
  );
};

export default Workbench;
