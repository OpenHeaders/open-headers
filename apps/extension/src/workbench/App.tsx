/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * App.tsx is a thin wiring layer: data hooks (tabs, rules, templates)
 * flow into extracted module-hooks (useTabOpeners, useWorkspaceIntentRouter,
 * useTabSyncEffects, useCommandPaletteData, useSaveToCollectionFlow),
 * and the shell is rendered via ShellLayout + EditorGroupRenderer with
 * render-prop hooks for the editor body and tool-window content.
 */

import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { useEnvironments } from '@hooks/useEnvironments';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import { useRules } from '@hooks/useRules';
import { useVariableResolver } from '@hooks/useVariableResolver';
import { useWorkspaces } from '@hooks/useWorkspaces';
import { isRequestResolvable, isRuleResolvable, slugify } from '@openheaders/core/utils';
import { call } from '@utils/bridge';
import { focusFirstDropdownItem } from '@utils/focus-dropdown-item';
import type { InputRef } from 'antd';
import { App as AntApp, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import { createShellEventBus, ShellEventBusContext } from '@/shared/dock-layout';
import { computeBreadcrumbs, scratchLabelForMode } from './breadcrumbs';
import BottomPanel from './components/BottomPanel';
import CollectionOverview from './components/CollectionOverview';
import CollectionVariablesEditor from './components/CollectionVariablesEditor';
import CommandPalette from './components/CommandPalette';
import EditorGroupRenderer, { type RenderLeafHeaderContext } from './components/EditorGroupRenderer';
import EmptyState from './components/EmptyState';
import EnvironmentEditor from './components/EnvironmentEditor';
import FolderOverview from './components/FolderOverview';
import ImportCurlModal from './components/ImportCurlModal';
import ImportHarModal from './components/ImportHarModal';
import ImportPostmanModal from './components/ImportPostmanModal';
import LandingScreen from './components/LandingScreen';
import LiveVariablesEditor from './components/LiveVariablesEditor';
import LiveVariableEditor from './components/live/LiveVariableEditor';
import LiveWorkflowEditor from './components/live/LiveWorkflowEditor';
import WorkflowStatusPanel from './components/live/WorkflowStatusPanel';
import DocsPanel from './components/panels/DocsPanel';
import VariablesPanel from './components/panels/VariablesPanel';
import RequestEditor from './components/RequestEditor';
import RuleEditor from './components/RuleEditor';
import RuleFlow from './components/RuleFlow';
import RunReportView from './components/RunReportView';
import SaveToCollectionModal from './components/SaveToCollectionModal';
import ShellLayout from './components/ShellLayout';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { renderTabLabel, tabIcon } from './components/TabBar';
import TemplateEditor from './components/TemplateEditor';
import TopBar from './components/TopBar';
import { VariablePopoverProvider } from './components/template-input/VariablePopoverHost';
import VaultEditor from './components/VaultEditor';
import WorkspaceManager from './components/WorkspaceManager';
import WorkspaceVariablesEditor from './components/WorkspaceVariablesEditor';
import ExportModal, { type ExportModalScope } from './components/workspace-export/ExportModal';
import ImportPreviewModal, { type ImportPreviewSource } from './components/workspace-export/ImportPreviewModal';
import { findLeaf } from './editor-groups';
import { useCommandPaletteData } from './hooks/useCommandPaletteData';
import { useEditorGroups } from './hooks/useEditorGroups';
import { useFocusRegion } from './hooks/useFocusRegion';
import { useInitialLanding } from './hooks/useInitialLanding';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { type ResponsiveLayout, useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useSaveRequestFlow } from './hooks/useSaveRequestFlow';
import { useSaveToCollectionFlow } from './hooks/useSaveToCollectionFlow';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabOpeners } from './hooks/useTabOpeners';
import { useTabSyncEffects } from './hooks/useTabSyncEffects';
import { useToolLayout } from './hooks/useToolLayout';
import { useWorkspaceIntentRouter } from './hooks/useWorkspaceIntentRouter';
import { useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { useWorkspaceTabTitle } from './hooks/useWorkspaceTabTitle';
import { type EnvSwitcherCollectionContext, EnvSwitcherProvider } from './services/env-switcher';
import { ConnectionProvider } from './settings/ConnectionContext';
import { useSettingValue } from './settings/hooks';
import { get as getSetting } from './settings/store';
import { SettingsModal, SettingsTab } from './settings/ui';
import { getFocusedRegion } from './stores/focus-region-store';
import type { DockSlot, ToolWindowId, WorkbenchTab } from './types';

// ── Sidebar "Export…" — single callback shape for every entity type ─

/**
 * Argument shape for the sidebar's `onExportEntity` callback. The kind
 * decides whether the SW gatherer treats the uid as a literal pick (leaf
 * entities) or as an expander (collections / folders pull descendants
 * and parent containers).
 */
export type SidebarExportEntity =
  | { kind: 'rule' | 'request' | 'template' | 'environment' | 'liveWorkflow' | 'liveVariable'; uid: string; name: string }
  | { kind: 'collection' | 'folder'; uid: string; name: string };

/**
 * Translate a sidebar entity ref into the modal-level `ExportModalScope`.
 * Centralized here so every tree-nodes hook just yells "export this thing"
 * and the wiring around filename slugs / preview labels lives in one place.
 */
function buildEntityExportScope(entity: SidebarExportEntity): ExportModalScope {
  const slug = slugify(entity.name) || 'untitled';
  switch (entity.kind) {
    case 'rule':
      return { kind: 'selection', label: `Rule — ${entity.name}`, slug: `rule-${slug}`, selection: { rules: [entity.uid] } };
    case 'request':
      return {
        kind: 'selection',
        label: `Request — ${entity.name}`,
        slug: `request-${slug}`,
        selection: { requests: [entity.uid] },
      };
    case 'template':
      return {
        kind: 'selection',
        label: `Template — ${entity.name}`,
        slug: `template-${slug}`,
        selection: { templates: [entity.uid] },
      };
    case 'environment':
      return {
        kind: 'selection',
        label: `Environment — ${entity.name}`,
        slug: `env-${slug}`,
        selection: { environments: [entity.uid] },
      };
    case 'liveWorkflow':
      return {
        kind: 'selection',
        label: `Live workflow — ${entity.name}`,
        slug: `workflow-${slug}`,
        selection: { liveWorkflows: [entity.uid] },
      };
    case 'liveVariable':
      return {
        kind: 'selection',
        label: `Live variable — ${entity.name}`,
        slug: `live-var-${slug}`,
        selection: { liveVariables: [entity.uid] },
      };
    case 'collection':
      return {
        kind: 'selection',
        label: `Collection — ${entity.name}`,
        slug: `collection-${slug}`,
        selection: { collections: [entity.uid] },
      };
    case 'folder':
      return {
        kind: 'selection',
        label: `Folder — ${entity.name}`,
        slug: `folder-${slug}`,
        selection: { folders: [entity.uid] },
      };
  }
}

// ── Shell loader ────────────────────────────────────────────────────

const WorkbenchInner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const layout = useResponsiveLayout();

  if (!layout.ready) {
    return (
      <div
        className="rules-shell rules-shell-loading"
        data-theme={isDarkMode ? 'dark' : 'light'}
        style={{ background: token.colorBgLayout }}
      />
    );
  }

  return <WorkbenchShell layout={layout} />;
};

// ── Workspace component (needs RuleContext + loaded layout) ─────────

interface WorkbenchShellProps {
  layout: ResponsiveLayout;
}

/**
 * Thin wrapper that owns the shell-event bus and publishes it via context
 * so `WorkbenchContent` (which calls useFocusRegion and
 * useWorkspaceShortcuts) can subscribe without the hooks reaching into the
 * DOM themselves. The attach side effect lives inside the content component
 * because that's where `shellRef` is populated on first paint.
 */
const WorkbenchShell: React.FC<WorkbenchShellProps> = ({ layout }) => {
  const busHandleRef = useRef<ReturnType<typeof createShellEventBus> | null>(null);
  if (!busHandleRef.current) busHandleRef.current = createShellEventBus();
  return (
    <ShellEventBusContext.Provider value={busHandleRef.current.bus}>
      <WorkbenchContent layout={layout} attachBus={busHandleRef.current.attach} />
    </ShellEventBusContext.Provider>
  );
};

interface WorkbenchContentProps {
  layout: ResponsiveLayout;
  attachBus: (root: HTMLElement | null) => () => void;
}

const WorkbenchContent: React.FC<WorkbenchContentProps> = ({ layout, attachBus }) => {
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const {
    rules,
    isStatusLoaded,
    isConnected,
    deleteLocalRule,
    updateLocalRule,
    localCollections,
    localCollectionTrees,
    pausedUids,
    createLocalRule,
    createLocalCollection,
    createLocalFolder,
    renameLocalCollection,
    renameLocalFolder,
    templates,
    templateCollectionTrees,
  } = useRules();
  const workspacesApi = useWorkspaces();
  const envApi = useEnvironments();
  const requestsApi = useRequests();
  const liveVarsApi = useLiveVariables();
  const liveWorkflowsApi = useLiveWorkflows();
  const { modal, message } = AntApp.useApp();

  // Unresolvable-reference sets — used to grey the method tag on
  // tab strip + drag preview. Derived once at the shell level so we
  // don't re-walk workbench/requests per pill render. Matches the DNR
  // compile gate's discipline — workbench/requests with unresolved refs
  // can't run, so the UI treats them like draft/paused.
  const variableResolver = useVariableResolver();
  const unresolvableRuleUids = useMemo(() => {
    const out = new Set<string>();
    for (const rule of rules) {
      const collectionId = localCollections.find((c) => rule.path.startsWith(`${c.path}/`))?.uid;
      const context = collectionId ? { collectionId } : undefined;
      if (
        !isRuleResolvable(
          rule,
          (name) => variableResolver.resolve(name, context),
          (name, ns) => variableResolver.resolveScopedWithDiagnostics(name, ns, context),
        )
      )
        out.add(rule.uid);
    }
    return out;
  }, [rules, localCollections, variableResolver]);
  const unresolvableRequestUids = useMemo(() => {
    const out = new Set<string>();
    for (const request of requestsApi.requests) {
      const owner = requestsApi.collections.find((c) => request.path.startsWith(`${c.path}/`));
      const context = owner ? { collectionId: owner.uid } : undefined;
      if (
        !isRequestResolvable(
          request,
          (name) => variableResolver.resolve(name, context),
          (name, ns) => variableResolver.resolveScopedWithDiagnostics(name, ns, context),
        )
      )
        out.add(request.uid);
    }
    return out;
  }, [requestsApi.requests, requestsApi.collections, variableResolver]);

  // ── Editor groups (recursive split tree) ──────────────────────
  const groups = useEditorGroups();
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

  // Project tab-level dirty state down to per-entity sets so the
  // sidebar can mirror the tab-bar dirty dot. The tab is the source
  // of truth (`tab.dirty` is maintained by the editor via
  // `onDirtyChange`); deriving sets here keeps the Sidebar from
  // having to know tab shape. Create-mode tabs are skipped — they
  // don't map to an existing sidebar row yet.
  const dirtyRuleUids = useMemo(() => {
    const out = new Set<string>();
    for (const tab of allTabs) {
      if (tab.mode === 'edit' && tab.dirty && tab.ruleUid) out.add(tab.ruleUid);
    }
    return out;
  }, [allTabs]);
  const dirtyRequestUids = useMemo(() => {
    const out = new Set<string>();
    for (const tab of allTabs) {
      if (tab.mode === 'request-edit' && tab.dirty && tab.requestUid) out.add(tab.requestUid);
    }
    return out;
  }, [allTabs]);
  const dirtyWorkflowUids = useMemo(() => {
    const out = new Set<string>();
    for (const tab of allTabs) {
      if (tab.mode === 'live-workflow-edit' && tab.dirty && tab.liveWorkflowUid) out.add(tab.liveWorkflowUid);
    }
    return out;
  }, [allTabs]);
  // A workflow is "unresolved" if any of its step requests has
  // unresolvable template refs in the active scope chain — reuses the
  // per-request resolvability set already computed above. Structural
  // errors (cycles, unknown step refs, etc.) are NOT mixed in here;
  // those go through `isWorkflowComplete` and show as "draft".
  const unresolvableWorkflowUids = useMemo(() => {
    const out = new Set<string>();
    for (const wf of liveWorkflowsApi.workflows) {
      for (const step of wf.steps) {
        if (step.requestUid && unresolvableRequestUids.has(step.requestUid)) {
          out.add(wf.uid);
          break;
        }
      }
    }
    return out;
  }, [liveWorkflowsApi.workflows, unresolvableRequestUids]);

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
    getLeafTabs,
    getFocusedLeafTabs,
    closeTab: rawCloseTab,
    switchTab,
    saveRefMap,
  });

  // ── Tool-window layout state machine ───────────────────────────
  const tl = useToolLayout({
    initial: layout.persistedToolLayout ?? undefined,
    onPersist: layout.persistToolLayout,
  });

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMaximized, setSettingsMaximized] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<{ settingKey?: string; categoryId?: string }>({});
  const [importCurlOpen, setImportCurlOpen] = useState(false);
  const [importCurlContext, setImportCurlContext] = useState<{ collectionId?: string } | undefined>(undefined);
  const [importHarOpen, setImportHarOpen] = useState(false);
  const [importHarContext, setImportHarContext] = useState<{ collectionId?: string } | undefined>(undefined);
  const [importPostmanOpen, setImportPostmanOpen] = useState(false);
  const [exportModalState, setExportModalState] = useState<
    { open: false } | { open: true; scope: ExportModalScope }
  >({ open: false });
  const [importPreviewState, setImportPreviewState] = useState<
    | { open: false }
    | { open: true; rawText: string; initialError?: string; source: ImportPreviewSource }
    | { open: true; rawText: null; initialError: string; source: ImportPreviewSource }
  >({ open: false });
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const openImportFilePicker = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);
  const openPasteImport = useCallback(async () => {
    // Read the clipboard inline. Failures land as a banner inside the
    // preview modal so the surface stays consistent with file-drop /
    // file-pick — there's exactly one error gutter for "we couldn't
    // get your import bytes."
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        setImportPreviewState({
          open: true,
          rawText: null,
          initialError: 'Clipboard is empty. Copy a workspace export YAML first, then try Paste import again.',
          source: 'paste',
        });
        return;
      }
      setImportPreviewState({ open: true, rawText: text, source: 'paste' });
    } catch (err) {
      setImportPreviewState({
        open: true,
        rawText: null,
        initialError: `Could not read clipboard: ${(err as Error).message}`,
        source: 'paste',
      });
    }
  }, []);
  const onImportFileChosen = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setImportPreviewState({ open: true, rawText: text, source: 'file' });
    } catch (err) {
      // File-read failures (sandbox quirks, perms) — surface inline. Modal
      // will display a parse-error banner if the bytes turn out to be
      // unreadable.
      setImportPreviewState({ open: true, rawText: '', source: 'file' });
      void err;
    }
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  /**
   * Look up a prior import report by source hash (ARCHITECTURE §23).
   * Shared across every import modal so the re-import-diff panel
   * renders uniformly. Errors are swallowed to `null` — the diff is
   * a nice-to-have, not a blocker on the import flow.
   */
  const findPreviousImportReport = useCallback(async (sourceHash: string) => {
    try {
      const { report } = await call('findImportReportBySourceHash', { sourceHash });
      return report;
    } catch {
      return null;
    }
  }, []);

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

  // Workspace-export drag-and-drop. The whole shell is a drop target;
  // a `.openheaders.yaml` / `.json` file opens the import preview modal.
  // We cancel non-file drags so the browser doesn't navigate the tab.
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    const isExportFile = (file: File): boolean => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith('.openheaders.yaml') || name.endsWith('.openheaders.yml') || name.endsWith('.openheaders.json')
      );
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types);
      if (types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!isExportFile(file)) return;
      e.preventDefault();
      void file.text().then((text) => setImportPreviewState({ open: true, rawText: text, source: 'file' }));
    };
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    return () => {
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('drop', onDrop);
    };
  }, []);

  const focus = useFocusRegion({
    shellRef,
    setFocusedRegion: tl.setFocusedRegion,
    setFocusedDock: tl.setFocusedDock,
  });

  // ── Region cycling — shared semantics for clicks and Alt+1..4 ───
  const cycleRegion = useCallback(
    (region: 'left' | 'right' | 'bottom' | 'editor') => {
      if (region === 'editor') {
        focus.focusRegion('editor');
        return;
      }
      const isFocused = getFocusedRegion() === region;
      const isOpen = tl.isRegionOpen(region);
      if (isOpen && isFocused) {
        tl.toggleRegion(region);
        focus.focusRegion('editor');
        return;
      }
      if (!isOpen) tl.toggleRegion(region);
      focus.focusRegion(region);
    },
    [tl, focus],
  );

  const togglePanel = useCallback(
    (panel: 'sidebar' | 'bottomPanel' | 'inspector') => {
      const region: 'left' | 'right' | 'bottom' =
        panel === 'sidebar' ? 'left' : panel === 'inspector' ? 'right' : 'bottom';
      tl.toggleRegion(region);
    },
    [tl],
  );

  // Right-pane-open callback for useInspectorNav.
  const { onOpenInspector, openDocs } = useInspectorNav();
  onOpenInspector.current = useCallback(() => {
    if (tl.state.hidden.includes('docs')) tl.restoreWindow('docs');
    tl.activateWindow('docs');
  }, [tl]);

  // ── Tab openers ────────────────────────────────────────────────
  const openers = useTabOpeners({
    rules,
    templates,
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
    openTemplateEditTab,
    openTemplateCollectionOverview,
    openTemplateFolderOverview,
    openRunReport,
    openRuleFlow,
    openSettingsTab,
    openLandingTab,
    openWorkspaceManager,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openLiveVariables,
    openCollectionVariables,
    openRequestEditTab,
    openCreateRequestTab,
    openLiveVariableEdit,
    openLiveWorkflowEdit,
    openCreateLiveVariable,
    openCreateLiveWorkflow,
  } = openers;

  // Create-then-edit flow for the env selector. New envs are created
  // via the bridge RPC (which fires `environmentsChanged` → envApi
  // updates), then we open the editor in rename mode so the user can
  // name it.
  const handleCreateEnvironment = useCallback(async () => {
    const baseName = 'New Environment';
    const existingNames = new Set(envApi.environments.map((e) => e.name));
    let name = baseName;
    let counter = 2;
    while (existingNames.has(name)) name = `${baseName} (${counter++})`;
    const env = await envApi.createEnvironment(name);
    if (!env) {
      message.error('Failed to create environment');
      return;
    }
    openEnvironmentEdit(env.uid, env.name, true);
  }, [envApi, openEnvironmentEdit, message]);

  // ── Workspace switch with dirty-draft guard ────────────────────
  //
  // If any editor tab has unsaved changes, confirm with the user
  // before switching. The dirty tracking already lives in
  // `dirtyMap` (populated by RuleEditor via onDirtyChange), so we
  // reuse it rather than threading a second source of truth.
  const handleSwitchWorkspace = useCallback(
    (targetId: string) => {
      if (targetId === workspacesApi.activeWorkspaceId) return;
      const hasDirty = Array.from(dirtyMap.current.values()).some(Boolean);
      const doSwitch = (): void => void workspacesApi.setActiveWorkspace(targetId);
      if (hasDirty) {
        modal.confirm({
          title: 'Discard unsaved drafts?',
          content: 'Switching workspaces will close editor tabs with unsaved changes.',
          okText: 'Switch and discard',
          cancelText: 'Cancel',
          okButtonProps: { danger: true },
          onOk: doSwitch,
        });
        return;
      }
      doSwitch();
    },
    [workspacesApi, modal, dirtyMap],
  );

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

  // ── Save-to-collection flow ────────────────────────────────────
  const saveFlow = useSaveToCollectionFlow({ allTabs, createLocalRule, replaceTab });
  const requestSaveFlow = useSaveRequestFlow({
    allTabs,
    createRequest: requestsApi.createRequest,
    replaceTab,
  });

  // ── Dirty tracking / save refs ─────────────────────────────────
  const handleDirtyChange = useCallback(
    (tabId: string, dirty: boolean) => {
      dirtyMap.current.set(tabId, dirty);
      updateTab(tabId, { dirty });
    },
    [dirtyMap, updateTab],
  );

  const registerSaveRef = useCallback(
    (tabId: string, saveFn: () => void) => {
      saveRefMap.current.set(tabId, saveFn);
    },
    [saveRefMap],
  );

  const saveAsTemplateRefMap = useRef<Map<string, () => void>>(new Map());
  const registerSaveAsTemplateRef = useCallback((tabId: string, fn: () => void) => {
    saveAsTemplateRefMap.current.set(tabId, fn);
  }, []);

  // ── Handle rule saved (edit mode) ─────────────────────────────
  const handleSaved = useCallback(
    (tabId: string, uid: string) => {
      const rule = rules.find((r) => r.uid === uid);
      updateTab(tabId, { label: rule?.name ?? undefined, dirty: false });
    },
    [rules, updateTab],
  );

  // Clear stale rename state on tab switch.
  useEffect(() => {
    if (pendingRenameTabId && pendingRenameTabId !== activeTabId) {
      setPendingRenameTabId(null);
    }
  }, [activeTabId, pendingRenameTabId, setPendingRenameTabId]);

  // ── Tab-title composition (`#<n> Open Headers` when ≥2 tabs) ──
  // Must mount once at the shell; subsequent route-aware title
  // mutations flow through `setBase` on this single owner so every
  // workspace tab writes the same prefix uniformly.
  const { setBase: setTabTitleBase } = useWorkspaceTabTitle();

  // ── Workspace Intent routing (cold-hash + warm-message) ────────
  useWorkspaceIntentRouter({
    isStatusLoaded,
    openCreateTab,
    openEditTab,
    openDocs,
    openRuleFlow,
    openRunReport,
    openSettings,
    openWorkspaceManager,
    openEnvironmentEdit,
    openWorkspaceVariables,
    openVault,
    openCollectionVariables,
    openRequestEditTab,
    openLiveVariableEdit,
    openLiveWorkflowEdit,
    openCreateLiveVariable,
    openImportPreview: (args) => {
      if ('error' in args) {
        setImportPreviewState({ open: true, rawText: null, initialError: args.error, source: args.source });
      } else {
        setImportPreviewState({ open: true, rawText: args.rawText, source: args.source });
      }
    },
  });

  // ── Initial landing (openTo = home/workbench/collections) ─────────
  useInitialLanding({
    isStatusLoaded,
    allTabs,
    openLandingTab,
  });

  // ── Sync tab labels with rule/template changes; close on delete ─
  useTabSyncEffects({
    rules,
    templates,
    localCollectionTrees,
    environments: envApi.environments,
    requests: requestsApi.requests,
    requestCollectionTrees: requestsApi.collectionTrees,
    liveVariables: liveVarsApi.variables,
    liveWorkflows: liveWorkflowsApi.workflows,
    allTabs,
    updateTab,
    closeTab: rawCloseTab,
  });

  const handleDeleteRule = useCallback((uid: string) => void deleteLocalRule(uid), [deleteLocalRule]);

  // ── Active tab + breadcrumbs ──────────────────────────────────
  const activeTab = useMemo(
    () => groups.focusedLeaf.tabs.find((t) => t.id === groups.focusedLeaf.activeTabId),
    [groups.focusedLeaf],
  );

  // Breadcrumb for the focused-leaf active tab — rendered in the footer
  // (split editors still each have their own floating action cluster,
  // but the footer breadcrumb is single-valued and follows focus).
  // Scratch tabs (create modes before first save — the entity doesn't
  // exist in storage yet) get an extra "Scratch" segment injected before
  // the entity label so the footer matches the tab-tooltip treatment.
  // "Scratch" is chosen over "Draft" because persisted entities can also
  // hold a draft state, and the two concepts would collide.
  const activeBreadcrumbSegments = useMemo(() => {
    if (!activeTab) return [];
    const base = computeBreadcrumbs(
      activeTab,
      rules,
      localCollectionTrees,
      requestsApi.collectionTrees,
      requestsApi.requests,
    );
    const scratchLabel = scratchLabelForMode(activeTab.mode);
    if (scratchLabel && base.length >= 2) {
      return [...base.slice(0, -1), scratchLabel, base[base.length - 1]];
    }
    return base;
  }, [activeTab, rules, localCollectionTrees, requestsApi.collectionTrees, requestsApi.requests]);
  const activeWorkspace = useMemo(
    () => workspacesApi.workspaces.find((w) => w.id === workspacesApi.activeWorkspaceId),
    [workspacesApi.workspaces, workspacesApi.activeWorkspaceId],
  );

  const activeTabCollectionId = useMemo((): string | null => {
    if (!activeTab) return null;
    const { mode } = activeTab;
    if (mode === 'collection-overview' || mode === 'folder-overview') return activeTab.entityId ?? null;
    if (mode === 'collection-vars') return activeTab.collectionUid ?? null;
    if (mode === 'edit' && activeTab.ruleUid) {
      const rule = rules.find((r) => r.uid === activeTab.ruleUid);
      if (!rule) return null;
      return localCollections.find((c) => rule.path.startsWith(`${c.path}/`))?.uid ?? null;
    }
    if (mode === 'create' && activeTab.preferredCollectionId) return activeTab.preferredCollectionId;
    if (mode === 'request-edit' && activeTab.requestUid) {
      const req = requestsApi.requests.find((r) => r.uid === activeTab.requestUid);
      if (!req) return null;
      return requestsApi.collections.find((c) => req.path.startsWith(`${c.path}/`))?.uid ?? null;
    }
    if (mode === 'request-create' && activeTab.preferredCollectionId) return activeTab.preferredCollectionId;
    return null;
  }, [activeTab, rules, localCollections, requestsApi.requests, requestsApi.collections]);

  const collectionEnvAutoSwitch = useSettingValue('general.collectionEnvAutoSwitch');

  const allCollectionsForEnv = useMemo(
    () => [...localCollections, ...requestsApi.collections],
    [localCollections, requestsApi.collections],
  );

  // Track the active collection's default env separately so the env-
  // switcher's auto-switch effect re-runs when the user pins a new
  // default via the env-selector pin icon (vs only when they
  // navigate).
  const activeCollectionDefaultEnvId = useMemo(() => {
    if (!activeTabCollectionId) return null;
    return allCollectionsForEnv.find((c) => c.uid === activeTabCollectionId)?.defaultEnvironmentId ?? null;
  }, [activeTabCollectionId, allCollectionsForEnv]);

  // Active-env policy lives in the env-switcher service. WorkbenchContent
  // hands it the workbench-specific inputs; the service owns the
  // auto-switch effect, the apply-defaults session-override map, and
  // exposes `pickActiveEnvironment` for every UI surface (sidebar,
  // popover, env editor, command palette) via `useEnvSwitcher()`.
  const envSwitcherCollectionContext = useMemo<EnvSwitcherCollectionContext>(
    () => ({
      activeTabCollectionId,
      allCollectionsForEnv,
      collectionEnvAutoSwitch,
      activeCollectionDefaultEnvId,
      activeWorkspaceId: workspacesApi.activeWorkspaceId,
    }),
    [
      activeTabCollectionId,
      allCollectionsForEnv,
      collectionEnvAutoSwitch,
      activeCollectionDefaultEnvId,
      workspacesApi.activeWorkspaceId,
    ],
  );

  // Thread the active tab label through the shell's single
  // `document.title` composer. `setTabTitleBase` handles the `#<n>`
  // prefix rule internally — callers only pass the contextual piece
  // (e.g. `my-rule — Open Headers`), so multi-tab users see titles
  // like `#2 my-rule — Open Headers`. No other component writes
  // document.title for this surface; the invariant is enforced by
  // having exactly one `useWorkspaceTabTitle` mount at the shell
  // root. Passing `null` resets to the default "Open Headers".
  useEffect(() => {
    const label = activeTab?.label?.trim();
    setTabTitleBase(label ? `${label} — Open Headers` : null);
  }, [activeTab?.label, setTabTitleBase]);

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
      } else if (tab.mode === 'create') {
        updateTab(tab.id, { label: newName, draftName: newName });
      } else if (tab.mode === 'env-edit' && tab.environmentUid) {
        void envApi.renameEnvironment(tab.environmentUid, newName);
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'request-edit' && tab.requestUid) {
        void requestsApi.updateRequest(tab.requestUid, { name: newName });
        updateTab(tab.id, { label: newName });
      } else if (tab.mode === 'request-create') {
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
    ],
  );

  const handleSave = useCallback(() => {
    if (activeTabId) saveRefMap.current.get(activeTabId)?.();
  }, [activeTabId, saveRefMap]);

  // ── Tab navigation for shortcuts ─────────────────────────────
  const tabs = groups.tabs;

  const handlePrevTab = useCallback(() => {
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = idx > 0 ? tabs[idx - 1] : tabs[tabs.length - 1];
    switchTab(prev.id);
  }, [tabs, activeTabId, switchTab]);

  const handleNextTab = useCallback(() => {
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = idx < tabs.length - 1 ? tabs[idx + 1] : tabs[0];
    switchTab(next.id);
  }, [tabs, activeTabId, switchTab]);

  const handleCloseActiveTab = useCallback(() => {
    if (activeTabId) void handleCloseTab(activeTabId);
  }, [activeTabId, handleCloseTab]);

  // Sidebar filter focus ref
  const sidebarFilterRef = useRef<InputRef>(null);

  // Keyboard shortcuts help: toggle right pane on docs/keyboard-shortcuts.
  const handleShowShortcuts = useCallback(() => {
    const docsSlot = tl.dockOf('docs');
    if (docsSlot && tl.state.docks[docsSlot].active === 'docs') {
      tl.toggleWindow('docs');
    } else {
      openDocs('keyboard-shortcuts');
    }
  }, [tl, openDocs]);

  // The +create dropdown needs to open from multiple entry points
  // (command palette item, ⌥N shortcut). Share the "open + focus first
  // item" helper so both paths behave identically.
  const openCreateMenu = useCallback(() => {
    setCreateMenuOpen((prev) => {
      if (!prev) focusFirstDropdownItem();
      return !prev;
    });
  }, []);

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
    onOpenCreateMenu: openCreateMenu,
    onTogglePanel: togglePanel,
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
    onCloseTab: handleCloseActiveTab,
    onPrevTab: handlePrevTab,
    onNextTab: handleNextTab,
    onTabSearch: () => tabSearchToggleRef.current?.(),
    onSave: handleSave,
    onNewRule: openCreateMenu,
    onFocusFilter: () => {
      if (!tl.isRegionOpen('left')) togglePanel('sidebar');
      sidebarFilterRef.current?.focus();
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

  // ── Test run owner context ────────────────────────────────────
  const contextOwner = useMemo(() => {
    if (!activeTab?.testOwnerType || !activeTab.testOwnerId) return null;
    return { type: activeTab.testOwnerType, id: activeTab.testOwnerId };
  }, [activeTab]);

  const openTestRunsPanel = useCallback(() => {
    if (tl.state.hidden.includes('test-runs')) tl.restoreWindow('test-runs');
    tl.activateWindow('test-runs');
  }, [tl]);

  // Auto-open the bottom Test Runs tab whenever the active tab is a run
  // report. activeTab.id is in the deps so switching between two report
  // tabs re-focuses the panel even though only mode is read inside.
  // biome-ignore lint/correctness/useExhaustiveDependencies: id triggers re-run on tab switch
  useEffect(() => {
    if (activeTab?.mode === 'run-report') openTestRunsPanel();
  }, [activeTab?.mode, activeTab?.id, openTestRunsPanel]);

  const handleRunReportDeleted = useCallback(
    (tabId: string) => {
      rawCloseTab(tabId, true);
      openTestRunsPanel();
    },
    [rawCloseTab, openTestRunsPanel],
  );

  // ── Per-tab body renderer ─────────────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: WorkbenchTab }): React.ReactNode => {
      if (tab.mode === 'create' || tab.mode === 'edit') {
        return (
          <RuleEditor
            mode={tab.mode}
            ruleType={tab.createType}
            ruleUid={tab.ruleUid}
            tabId={tab.id}
            draftName={tab.draftName}
            initialTemplateKey={tab.templateKey}
            initialDraft={tab.initialDraft}
            onSaved={(uid) => handleSaved(tab.id, uid)}
            onSaveDraft={tab.mode === 'create' ? saveFlow.handleSaveDraft : undefined}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            registerSaveAsTemplateRef={(fn) => registerSaveAsTemplateRef(tab.id, fn)}
          />
        );
      }
      if (tab.mode === 'collection-overview' && tab.entityId) {
        return (
          <CollectionOverview
            collectionUid={tab.entityId}
            onSelectRule={openEditTab}
            onCreateRule={openCreateTab}
            onOpenFolderOverview={openFolderOverview}
            onOpenRuleFlow={openRuleFlow}
            onOpenTestRuns={openTestRunsPanel}
            onOpenCollectionVariables={openCollectionVariables}
          />
        );
      }
      if (tab.mode === 'folder-overview' && tab.entityId) {
        return (
          <FolderOverview
            folderUid={tab.entityId}
            onSelectRule={openEditTab}
            onCreateRule={openCreateTab}
            onOpenFolderOverview={openFolderOverview}
            onOpenRuleFlow={openRuleFlow}
            onOpenTestRuns={openTestRunsPanel}
          />
        );
      }
      if (tab.mode === 'template-edit' && tab.templateUid) {
        return (
          <TemplateEditor
            templateUid={tab.templateUid}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
          />
        );
      }
      if (tab.mode === 'rule-flow') {
        return (
          <RuleFlow
            scope={tab.flowScope ?? 'all-active'}
            entityId={tab.entityId}
            initialTabUrl={tab.flowTabUrl}
            onSelectRule={openEditTab}
            onCreateRule={openCreateTab}
          />
        );
      }
      if (tab.mode === 'run-report' && tab.testRunId) {
        return (
          <RunReportView
            runId={tab.testRunId}
            onSelectRule={openEditTab}
            onAfterDelete={() => handleRunReportDeleted(tab.id)}
          />
        );
      }
      if (tab.mode === 'settings') {
        return (
          <SettingsTab initialSettingKey={tab.settingsInitialKey} initialCategoryId={tab.settingsInitialCategory} />
        );
      }
      if (tab.mode === 'workspace-manager') {
        return <WorkspaceManager api={workspacesApi} />;
      }
      if (tab.mode === 'env-edit' && tab.environmentUid) {
        return (
          <EnvironmentEditor
            environmentUid={tab.environmentUid}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
          />
        );
      }
      if (tab.mode === 'workspace-vars') {
        return (
          <WorkspaceVariablesEditor
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
          />
        );
      }
      if (tab.mode === 'vault') {
        return (
          <VaultEditor
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
          />
        );
      }
      if (tab.mode === 'live-vars') {
        return (
          <LiveVariablesEditor
            onOpenWorkflow={openLiveWorkflowEdit}
            onEditBinding={openLiveVariableEdit}
            onCreateLiveVariable={openCreateLiveVariable}
          />
        );
      }
      if (tab.mode === 'collection-vars' && tab.collectionUid) {
        return (
          <CollectionVariablesEditor
            collectionUid={tab.collectionUid}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
          />
        );
      }
      if (tab.mode === 'request-edit' && tab.requestUid) {
        return (
          <RequestEditor
            mode="request-edit"
            requestUid={tab.requestUid}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            onExtractToWorkflow={(target, seedStep) => {
              if (target === 'new') {
                openCreateLiveWorkflow({ seedStep });
                return;
              }
              const wf = liveWorkflowsApi.workflows.find((w) => w.uid === target.workflowUid);
              openLiveWorkflowEdit(target.workflowUid, wf?.name ?? 'Workflow', seedStep);
            }}
          />
        );
      }
      if (tab.mode === 'request-create') {
        return (
          <RequestEditor
            mode="request-create"
            draftName={tab.draftName ?? tab.label}
            preferredCollectionId={tab.preferredCollectionId}
            preferredFolderPath={tab.preferredFolderPath}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            onSaveDraft={(draftData) => requestSaveFlow.handleSaveDraft(tab.id, draftData)}
          />
        );
      }
      if (tab.mode === 'landing') {
        return (
          <LandingScreen
            view={tab.landingView ?? 'home'}
            onCreateRule={openCreateTab}
            onSelectRule={openEditTab}
            onOpenCollectionOverview={openCollectionOverview}
            onOpenSettings={() => openSettings()}
          />
        );
      }
      if (tab.mode === 'live-variable-edit' && tab.liveVariableUid) {
        return (
          <LiveVariableEditor
            mode="edit"
            variableUid={tab.liveVariableUid}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            openWorkflowTab={openLiveWorkflowEdit}
          />
        );
      }
      if (tab.mode === 'live-variable-create') {
        return (
          <LiveVariableEditor
            mode="create"
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            onCreated={(lv) =>
              replaceTab(tab.id, {
                id: `live-var-${lv.uid}`,
                label: lv.name,
                ruleType: '',
                dirty: false,
                mode: 'live-variable-edit',
                liveVariableUid: lv.uid,
              })
            }
          />
        );
      }
      if (tab.mode === 'live-workflow-edit' && tab.liveWorkflowUid) {
        return (
          <LiveWorkflowEditor
            mode="edit"
            workflowUid={tab.liveWorkflowUid}
            seedStep={tab.liveWorkflowSeedStep}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
          />
        );
      }
      if (tab.mode === 'live-workflow-create') {
        return (
          <LiveWorkflowEditor
            mode="create"
            draftName={tab.draftName ?? tab.label}
            seedStep={tab.liveWorkflowSeedStep}
            onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
            registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            onCreated={(wf) =>
              replaceTab(tab.id, {
                id: `live-workflow-${wf.uid}`,
                label: wf.name,
                ruleType: '',
                dirty: false,
                mode: 'live-workflow-edit',
                liveWorkflowUid: wf.uid,
              })
            }
          />
        );
      }
      return null;
    },
    [
      handleSaved,
      saveFlow.handleSaveDraft,
      handleDirtyChange,
      registerSaveRef,
      registerSaveAsTemplateRef,
      openEditTab,
      openCreateTab,
      openCollectionOverview,
      openFolderOverview,
      openRuleFlow,
      openTestRunsPanel,
      openSettings,
      handleRunReportDeleted,
      workspacesApi,
      openCollectionVariables,
      requestSaveFlow.handleSaveDraft,
      openLiveWorkflowEdit,
      openLiveVariableEdit,
      openCreateLiveVariable,
      openCreateLiveWorkflow,
      liveWorkflowsApi.workflows,
      replaceTab,
    ],
  );

  // Per-leaf header is empty by default — each editor renders its own
  // `EditorHeader` internally so the title slot, panel-specific actions,
  // Save, and overflow live in a single shared-shape row inside the
  // editor component.
  const renderLeafHeader = useCallback((_: RenderLeafHeaderContext): React.ReactNode => null, []);

  const renderEmpty = useCallback(() => <EmptyState onCreateRule={openCreateTab} />, [openCreateTab]);

  // ── Tool window renderer ──────────────────────────────────────
  //
  // The three left-top tool windows (`http-workbench`, `api-requests`,
  // `variables`) are all powered by the same `Sidebar` component —
  // a `view` prop gates which sections render so keyboard nav,
  // filter, and toolbar stay shared behavior instead of three forks.
  const renderToolWindow = useCallback(
    (id: ToolWindowId, slot: DockSlot): React.ReactNode => {
      switch (id) {
        case 'http-rules':
        case 'api-requests':
        case 'variables':
        case 'workflows':
          return (
            <Sidebar
              view={id}
              activeTabId={activeTabId}
              onSelectRule={openEditTab}
              onCreateRule={openCreateTab}
              onDeleteRule={handleDeleteRule}
              onExportEntity={(args) =>
                setExportModalState({ open: true, scope: buildEntityExportScope(args) })
              }
              onOpenCollectionOverview={openCollectionOverview}
              onOpenFolderOverview={openFolderOverview}
              onSelectTemplate={openTemplateEditTab}
              onOpenTemplateCollectionOverview={openTemplateCollectionOverview}
              onOpenTemplateFolderOverview={openTemplateFolderOverview}
              onSelectEnvironment={openEnvironmentEdit}
              onOpenWorkspaceVariables={openWorkspaceVariables}
              onOpenVault={openVault}
              onOpenLiveVariables={openLiveVariables}
              onSelectLiveWorkflow={openLiveWorkflowEdit}
              onCreateWorkflow={(seedStep) => openCreateLiveWorkflow(seedStep ? { seedStep } : undefined)}
              onSelectRequest={openRequestEditTab}
              onCreateRequest={openCreateRequestTab}
              onImportCurl={(ctx) => {
                setImportCurlContext(ctx);
                setImportCurlOpen(true);
              }}
              onImportHar={(ctx) => {
                setImportHarContext(ctx);
                setImportHarOpen(true);
              }}
              onImportPostman={() => setImportPostmanOpen(true)}
              filterRef={sidebarFilterRef}
              dirtyRuleUids={dirtyRuleUids}
              dirtyRequestUids={dirtyRequestUids}
              dirtyWorkflowUids={dirtyWorkflowUids}
              unresolvableWorkflowUids={unresolvableWorkflowUids}
              allTabs={allTabs}
              onSwitchTab={switchTab}
              onCloseDraftTab={handleCloseTab}
              onHide={() => tl.closeDock(slot)}
            />
          );
        case 'workflow-status':
          return (
            <WorkflowStatusPanel
              onClose={() => tl.toggleWindow('workflow-status')}
              // `openLiveWorkflowEdit` expects `(uid, name, seedStep?)`.
              // The sidebar only knows the uid; look up the name from
              // the workflow list so the tab title renders correctly.
              onOpenWorkflow={(uid) => {
                const wf = liveWorkflowsApi.workflows.find((w) => w.uid === uid);
                openLiveWorkflowEdit(uid, wf?.name ?? 'Workflow');
              }}
            />
          );
        case 'docs':
          return <DocsPanel onClose={() => tl.toggleWindow('docs')} />;
        case 'var-scope':
          return <VariablesPanel onClose={() => tl.toggleWindow('var-scope')} activeTab={activeTab ?? null} />;
        case 'page-traffic':
        case 'test-runs':
          return (
            <BottomPanel
              activeTab={id === 'test-runs' ? 'test-runs' : 'traffic'}
              onTabChange={() => {
                /* BottomPanel is now slot-scoped — tab strip lives on the dock */
              }}
              contextOwner={contextOwner}
              onOpenTestRun={openRunReport}
              activeRunId={activeTab?.mode === 'run-report' ? (activeTab.testRunId ?? null) : null}
              onHide={() => tl.closeDock(slot)}
            />
          );
        default:
          return null;
      }
    },
    [
      activeTabId,
      openEditTab,
      openCreateTab,
      handleDeleteRule,
      openCollectionOverview,
      openFolderOverview,
      openTemplateEditTab,
      openTemplateCollectionOverview,
      openTemplateFolderOverview,
      tl,
      contextOwner,
      openRunReport,
      activeTab,
      openEnvironmentEdit,
      openVault,
      openWorkspaceVariables,
      openLiveVariables,
      openRequestEditTab,
      openCreateRequestTab,
      openLiveWorkflowEdit,
      openCreateLiveWorkflow,
      liveWorkflowsApi.workflows,
      dirtyRuleUids,
      dirtyRequestUids,
      dirtyWorkflowUids,
      unresolvableWorkflowUids,
      allTabs,
      switchTab,
      handleCloseTab,
    ],
  );

  return (
    <EnvSwitcherProvider collectionContext={envSwitcherCollectionContext}>
      <VariablePopoverProvider>
        <div
          ref={shellRef}
          className="rules-shell"
          data-theme={isDarkMode ? 'dark' : 'light'}
          style={{ background: token.colorBgLayout }}
        >
          <TopBar
            tl={tl}
            onCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenSettings={openSettings}
            workspaces={workspacesApi.workspaces}
            activeWorkspaceId={workspacesApi.activeWorkspaceId}
            onSwitchWorkspace={handleSwitchWorkspace}
            onOpenWorkspaceManager={openWorkspaceManager}
            onExportWorkspace={() => setExportModalState({ open: true, scope: { kind: 'workspace' } })}
            onImportWorkspace={openImportFilePicker}
            onPasteImportWorkspace={() => void openPasteImport()}
            environments={envApi.environments}
            activeEnvironmentId={envApi.activeEnvironmentId}
            onCreateEnvironment={() => void handleCreateEnvironment()}
            onOpenEnvironment={(uid) => {
              const env = envApi.environments.find((e) => e.uid === uid);
              openEnvironmentEdit(uid, env?.name ?? 'Environment');
            }}
            onOpenWorkspaceVariables={openWorkspaceVariables}
            onOpenCollectionVariables={() => {
              if (!activeTabCollectionId) return;
              const col = [...localCollections, ...requestsApi.collections].find(
                (c) => c.uid === activeTabCollectionId,
              );
              if (!col) return;
              openCollectionVariables(col.uid, col.name);
            }}
            onOpenVault={openVault}
            activeCollectionId={activeTabCollectionId}
            allCollections={[...localCollections, ...requestsApi.collections]}
            onSetCollectionPinnedEnvs={envApi.setCollectionPinnedEnvs}
          />

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
                    rules,
                    localCollectionTrees,
                    requestsApi.collectionTrees,
                    requestsApi.requests,
                  )
                }
                renderEmpty={renderEmpty}
                onCreateRule={openCreateTab}
                createMenuOpen={createMenuOpen}
                onCreateMenuOpenChange={setCreateMenuOpen}
                registerTabSearchToggle={registerTabSearchToggle}
                onTabDoubleClick={tl.toggleZenMode}
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
                  <span className="rules-drag-preview-label">{renderTabLabel(tab)}</span>
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
            onRename={
              activeTab &&
              (activeTab.mode === 'create' ||
                activeTab.mode === 'edit' ||
                activeTab.mode === 'collection-overview' ||
                activeTab.mode === 'folder-overview' ||
                activeTab.mode === 'env-edit' ||
                activeTab.mode === 'request-edit' ||
                activeTab.mode === 'request-create' ||
                activeTab.mode === 'live-variable-edit' ||
                activeTab.mode === 'live-workflow-edit' ||
                activeTab.mode === 'live-workflow-create')
                ? (newName) => handleBreadcrumbRenameFor(activeTab, newName)
                : undefined
            }
            autoRenameKey={activeTab && pendingRenameTabId === activeTab.id ? activeTab.id : null}
          />

          <SaveToCollectionModal
            open={saveFlow.saveModalOpen}
            entityName={saveFlow.saveModalEntityName}
            collectionTrees={localCollectionTrees}
            collections={localCollections}
            onSave={(params) => void saveFlow.handleSaveModalConfirm(params)}
            onCreateCollection={createLocalCollection}
            onCreateFolder={createLocalFolder}
            onCancel={saveFlow.closeSaveModal}
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
          />

          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            groups={cmdGroups}
            sections={cmdSections}
          />

          <ImportCurlModal
            open={importCurlOpen}
            collections={requestsApi.collections}
            initialCollectionId={importCurlContext?.collectionId}
            onCancel={() => setImportCurlOpen(false)}
            createRequest={async ({ name, collectionUid, seed }) => {
              // The parser's output already carries every field the
              // editor would normally enter; pass the full seed so the
              // store builds the request with the imported shape.
              const created = await requestsApi.createRequest({ name, collectionUid, seed });
              return created ? { uid: created.uid } : null;
            }}
            findPreviousReport={findPreviousImportReport}
            onImported={({ requestUid, name, method, report }) => {
              setImportCurlOpen(false);
              // Open the freshly-imported request in an editor tab so
              // the user can immediately inspect or tweak it. Use the
              // caller-chosen name + method so the tab label + method
              // glyph match the new request on first paint (avoids a
              // "Imported request / GET" flash before the hook hydrates).
              openRequestEditTab(requestUid, name, method);
              // Persist the structured import report (ARCHITECTURE §23).
              // Fire-and-forget — the request itself already landed; a
              // failure to persist the report is a nice-to-have loss,
              // not a hard error. Surfaces at triage time via the
              // observability log if it matters.
              void call('recordImportReport', { report }).catch(() => undefined);
            }}
          />

          <ImportHarModal
            open={importHarOpen}
            collections={requestsApi.collections}
            initialCollectionId={importHarContext?.collectionId}
            onCancel={() => setImportHarOpen(false)}
            createRequest={async ({ name, collectionUid, seed }) => {
              const created = await requestsApi.createRequest({ name, collectionUid, seed });
              return created ? { uid: created.uid } : null;
            }}
            findPreviousReport={findPreviousImportReport}
            onImported={({ report }) => {
              setImportHarOpen(false);
              // HAR imports can produce many requests at once — we don't
              // auto-open an editor tab (Postman / Insomnia don't either)
              // to avoid flooding the tab bar. The user browses the
              // sidebar to find their new entries. The structured report
              // still lands in storage for audit.
              void call('recordImportReport', { report }).catch(() => undefined);
            }}
          />

          <ImportPostmanModal
            open={importPostmanOpen}
            onCancel={() => setImportPostmanOpen(false)}
            createCollection={async (name) => {
              const c = await requestsApi.createCollection(name);
              return c ? { uid: c.uid, path: c.path } : null;
            }}
            createFolder={async (name, parentPath) => {
              const f = await requestsApi.createFolder(name, parentPath);
              return f ? { uid: f.uid, path: f.path } : null;
            }}
            createRequest={async ({ name, parentPath, seed }) => {
              const r = await requestsApi.createRequest({ name, parentPath, seed });
              return r ? { uid: r.uid } : null;
            }}
            createEnvironment={async ({ name, variables }) => {
              const e = await envApi.createEnvironment(name, variables);
              return e ? { uid: e.uid } : null;
            }}
            findPreviousReport={findPreviousImportReport}
            onImported={({ report }) => {
              setImportPostmanOpen(false);
              // Postman imports are multi-entity — like HAR, we don't
              // auto-open an editor tab. The user navigates to the new
              // collection from the sidebar. Structured report still
              // lands in storage for audit.
              void call('recordImportReport', { report }).catch(() => undefined);
            }}
          />

          {exportModalState.open && workspacesApi.activeWorkspace ? (
            <ExportModal
              open
              workspaceId={workspacesApi.activeWorkspace.id}
              workspaceName={workspacesApi.activeWorkspace.name}
              scope={exportModalState.scope}
              onCancel={() => setExportModalState({ open: false })}
            />
          ) : null}

          <input
            ref={importFileInputRef}
            type="file"
            accept=".yaml,.yml,.json,application/yaml,application/json,text/yaml,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void onImportFileChosen(file);
              e.currentTarget.value = '';
            }}
          />

          <ImportPreviewModal
            open={importPreviewState.open}
            rawText={importPreviewState.open ? importPreviewState.rawText : null}
            initialError={importPreviewState.open ? importPreviewState.initialError : undefined}
            source={importPreviewState.open ? importPreviewState.source : undefined}
            workspaces={workspacesApi.workspaces}
            activeWorkspaceId={workspacesApi.activeWorkspaceId}
            onCancel={() => setImportPreviewState({ open: false })}
            onImported={({ targetWorkspaceId, importedCount, sourceLabel }) => {
              setImportPreviewState({ open: false });
              const summary = `Imported ${importedCount} entit${importedCount === 1 ? 'y' : 'ies'} from "${sourceLabel}"`;
              message.success(summary);
              // If the target isn't the active workspace, offer to switch.
              if (targetWorkspaceId !== workspacesApi.activeWorkspaceId) {
                void handleSwitchWorkspace(targetWorkspaceId);
              }
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
    </EnvSwitcherProvider>
  );
};

const Workbench: React.FC = () => (
  <RuleProvider>
    <InspectorNavProvider>
      <WorkbenchInner />
    </InspectorNavProvider>
  </RuleProvider>
);

export default Workbench;
