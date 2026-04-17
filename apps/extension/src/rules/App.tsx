/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * App.tsx is a thin wiring layer: data hooks (tabs, rules, templates)
 * flow into extracted module-hooks (useTabOpeners, useInitialHashRoute,
 * useTabSyncEffects, useCommandPaletteData, useSaveToCollectionFlow),
 * and the shell is rendered via ShellLayout + EditorGroupRenderer with
 * render-prop hooks for the editor body and tool-window content.
 */

import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { useRules } from '@hooks/useRules';
import { focusFirstDropdownItem } from '@utils/focus-dropdown-item';
import type { InputRef } from 'antd';
import { theme } from 'antd';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import { computeBreadcrumbs } from './breadcrumbs';
import BottomPanel from './components/BottomPanel';
import BreadcrumbBar from './components/BreadcrumbBar';
import CollectionOverview from './components/CollectionOverview';
import CommandPalette from './components/CommandPalette';
import EditorGroupRenderer from './components/EditorGroupRenderer';
import EmptyState from './components/EmptyState';
import FolderOverview from './components/FolderOverview';
import LandingScreen from './components/LandingScreen';
import DocsPanel from './components/panels/DocsPanel';
import VariablesPanel from './components/panels/VariablesPanel';
import RuleEditor from './components/RuleEditor';

// Rare tab-body components are lazy-loaded so they don't bloat the
// workspace entry chunk. Each opens into its own Vite chunk the first
// time the user lands on one of these modes; the Suspense boundary
// around `renderTabBody` swallows the one-frame flash during load.
const RuleFlow = lazy(() => import('./components/RuleFlow'));
const RunReportView = lazy(() => import('./components/RunReportView'));
const TemplateEditor = lazy(() => import('./components/TemplateEditor'));

import SaveToCollectionModal from './components/SaveToCollectionModal';
import ShellLayout from './components/ShellLayout';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { renderTabLabel, tabIcon } from './components/TabBar';
import TopBar from './components/TopBar';
import { findLeaf } from './editor-groups';
import { createShellEventBus, ShellEventBusContext } from './events/shell-event-bus';
import { useCommandPaletteData } from './hooks/useCommandPaletteData';
import { useEditorGroups } from './hooks/useEditorGroups';
import { useFocusRegion } from './hooks/useFocusRegion';
import { useInitialHashRoute } from './hooks/useInitialHashRoute';
import { useInitialLanding } from './hooks/useInitialLanding';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { type ResponsiveLayout, useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useSaveToCollectionFlow } from './hooks/useSaveToCollectionFlow';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabOpeners } from './hooks/useTabOpeners';
import { useTabSyncEffects } from './hooks/useTabSyncEffects';
import { useToolLayout } from './hooks/useToolLayout';
import { useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { SettingsModal, SettingsTab } from './settings';
import { ConnectionProvider } from './settings/ConnectionContext';
import { get as getSetting } from './settings/store';
import { getFocusedRegion } from './stores/focus-region-store';
import type { DockSlot, RulesTab, ToolWindowId } from './types';

// ── Shell loader ────────────────────────────────────────────────────

const RulesAppInner: React.FC = () => {
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

  return <RulesAppWorkspace layout={layout} />;
};

// ── Workspace component (needs RuleContext + loaded layout) ─────────

interface RulesAppWorkspaceProps {
  layout: ResponsiveLayout;
}

/**
 * Thin wrapper that owns the shell-event bus and publishes it via context
 * so `RulesAppWorkspaceContent` (which calls useFocusRegion and
 * useWorkspaceShortcuts) can subscribe without the hooks reaching into the
 * DOM themselves. The attach side effect lives inside the content component
 * because that's where `shellRef` is populated on first paint.
 */
const RulesAppWorkspace: React.FC<RulesAppWorkspaceProps> = ({ layout }) => {
  const busHandleRef = useRef<ReturnType<typeof createShellEventBus> | null>(null);
  if (!busHandleRef.current) busHandleRef.current = createShellEventBus();
  return (
    <ShellEventBusContext.Provider value={busHandleRef.current.bus}>
      <RulesAppWorkspaceContent layout={layout} attachBus={busHandleRef.current.attach} />
    </ShellEventBusContext.Provider>
  );
};

interface RulesAppWorkspaceContentProps {
  layout: ResponsiveLayout;
  attachBus: (root: HTMLElement | null) => () => void;
}

const RulesAppWorkspaceContent: React.FC<RulesAppWorkspaceContentProps> = ({ layout, attachBus }) => {
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
  } = openers;

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

  // ── Initial hash routing (deferred until data is loaded) ───────
  useInitialHashRoute({
    isStatusLoaded,
    openCreateTab,
    openEditTab,
    openDocs,
    openRuleFlow,
    openRunReport,
    openSettings,
  });

  // ── Initial landing (openTo = home/rules/collections) ─────────
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

  const handleBreadcrumbRenameFor = useCallback(
    (tab: RulesTab, newName: string) => {
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
      }
      setPendingRenameTabId(null);
    },
    [renameLocalCollection, renameLocalFolder, updateLocalRule, updateTab, setPendingRenameTabId],
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
    pausedUids,
    openEditTab,
    openCreateTab,
    openTemplateEditTab,
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
  //
  // `RuleFlow`, `RunReportView`, and `TemplateEditor` are React.lazy —
  // each becomes its own chunk fetched on first use. Wrap every lazy
  // result in its own Suspense boundary so one suspending tab can't
  // block the whole editor body (each tab panel is independently
  // display:none / block via the keep-mounted pattern in
  // EditorGroupRenderer, so an inner Suspense is the correct scope).
  const renderTabBody = useCallback(
    ({ tab }: { tab: RulesTab }): React.ReactNode => {
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
          <Suspense fallback={null}>
            <TemplateEditor
              templateUid={tab.templateUid}
              onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
              registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
            />
          </Suspense>
        );
      }
      if (tab.mode === 'rule-flow') {
        return (
          <Suspense fallback={null}>
            <RuleFlow
              scope={tab.flowScope ?? 'all-active'}
              entityId={tab.entityId}
              initialTabUrl={tab.flowTabUrl}
              onSelectRule={openEditTab}
              onCreateRule={openCreateTab}
            />
          </Suspense>
        );
      }
      if (tab.mode === 'run-report' && tab.testRunId) {
        return (
          <Suspense fallback={null}>
            <RunReportView
              runId={tab.testRunId}
              onSelectRule={openEditTab}
              onAfterDelete={() => handleRunReportDeleted(tab.id)}
            />
          </Suspense>
        );
      }
      if (tab.mode === 'settings') {
        return (
          <SettingsTab initialSettingKey={tab.settingsInitialKey} initialCategoryId={tab.settingsInitialCategory} />
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
    ],
  );

  // ── Per-leaf header (breadcrumb + save/rename) ───────────────
  const renderLeafHeader = useCallback(
    ({
      isFocusedLeaf,
      activeTab: leafActiveTab,
    }: {
      isFocusedLeaf: boolean;
      activeTab: RulesTab | undefined;
    }): React.ReactNode => {
      if (!leafActiveTab) return null;
      const segments = computeBreadcrumbs(leafActiveTab, rules, localCollectionTrees);
      const isEditable = leafActiveTab.mode === 'create' || leafActiveTab.mode === 'edit';
      return (
        <BreadcrumbBar
          segments={segments}
          isDirty={leafActiveTab.mode === 'create' || leafActiveTab.dirty}
          onSave={isEditable ? () => saveRefMap.current.get(leafActiveTab.id)?.() : undefined}
          onSaveAsTemplate={isEditable ? () => saveAsTemplateRefMap.current.get(leafActiveTab.id)?.() : undefined}
          onRename={(newName) => handleBreadcrumbRenameFor(leafActiveTab, newName)}
          autoRenameKey={pendingRenameTabId === leafActiveTab.id && isFocusedLeaf ? leafActiveTab.id : null}
        />
      );
    },
    [rules, localCollectionTrees, saveRefMap, pendingRenameTabId, handleBreadcrumbRenameFor],
  );

  const renderEmpty = useCallback(() => <EmptyState onCreateRule={openCreateTab} />, [openCreateTab]);

  // ── Tool window renderer ──────────────────────────────────────
  const renderToolWindow = useCallback(
    (id: ToolWindowId, _slot: DockSlot): React.ReactNode => {
      switch (id) {
        case 'items':
          return (
            <Sidebar
              activeTabId={activeTabId}
              onSelectRule={openEditTab}
              onCreateRule={openCreateTab}
              onDeleteRule={handleDeleteRule}
              onOpenCollectionOverview={openCollectionOverview}
              onOpenFolderOverview={openFolderOverview}
              onSelectTemplate={openTemplateEditTab}
              onOpenTemplateCollectionOverview={openTemplateCollectionOverview}
              onOpenTemplateFolderOverview={openTemplateFolderOverview}
              filterRef={sidebarFilterRef}
            />
          );
        case 'docs':
          return <DocsPanel onClose={() => tl.toggleWindow('docs')} />;
        case 'variables':
          return <VariablesPanel onClose={() => tl.toggleWindow('variables')} />;
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
    ],
  );

  return (
    <div
      ref={shellRef}
      className="rules-shell"
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{ background: token.colorBgLayout }}
    >
      <TopBar onCommandPalette={() => setCommandPaletteOpen(true)} onOpenSettings={openSettings} />

      <ShellLayout
        tl={tl}
        responsive={layout}
        renderToolWindow={renderToolWindow}
        renderEditor={() => (
          <EditorGroupRenderer
            groups={groups}
            rules={rules}
            templates={templates}
            pausedUids={pausedUids}
            renderTabBody={renderTabBody}
            renderLeafHeader={renderLeafHeader}
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
              <span className="rules-drag-preview-icon">{tabIcon(tab, rules, templates, pausedUids)}</span>
              <span className="rules-drag-preview-label">{renderTabLabel(tab)}</span>
            </div>
          );
        }}
      />

      <StatusBar tl={tl} />

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

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        groups={cmdGroups}
        sections={cmdSections}
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
  );
};

const RulesApp: React.FC = () => (
  <RuleProvider>
    <InspectorNavProvider>
      <RulesAppInner />
    </InspectorNavProvider>
  </RuleProvider>
);

export default RulesApp;
