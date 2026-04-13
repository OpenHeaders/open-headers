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
import type { InputRef } from 'antd';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import { computeBreadcrumbs } from './breadcrumbs';
import { findLeaf } from './editor-groups';
import BottomPanel from './components/BottomPanel';
import BreadcrumbBar from './components/BreadcrumbBar';
import CollectionOverview from './components/CollectionOverview';
import CommandPalette from './components/CommandPalette';
import EditorGroupRenderer from './components/EditorGroupRenderer';
import EmptyState from './components/EmptyState';
import FolderOverview from './components/FolderOverview';
import DocsPanel from './components/panels/DocsPanel';
import VariablesPanel from './components/panels/VariablesPanel';
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
import { useCommandPaletteData } from './hooks/useCommandPaletteData';
import { useEditorGroups } from './hooks/useEditorGroups';
import { useFocusRegion } from './hooks/useFocusRegion';
import { useInitialHashRoute } from './hooks/useInitialHashRoute';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { type ResponsiveLayout, useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useSaveToCollectionFlow } from './hooks/useSaveToCollectionFlow';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabOpeners } from './hooks/useTabOpeners';
import { useTabSyncEffects } from './hooks/useTabSyncEffects';
import { useToolLayout } from './hooks/useToolLayout';
import { useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
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

const RulesAppWorkspace: React.FC<RulesAppWorkspaceProps> = ({ layout }) => {
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const {
    rules,
    isStatusLoaded,
    deleteLocalRule,
    updateLocalRule,
    localCollections,
    localCollectionTrees,
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

  // Shell root ref for the focus-region tracker.
  const shellRef = useRef<HTMLDivElement>(null);
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
      const isFocused = tl.state.focusedRegion === region;
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
    localCollections,
    allTabs,
    createLocalRule,
    createLocalCollection,
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
  } = openers;

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
    if (activeTabId) handleCloseTab(activeTabId);
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
      if (!prev) {
        const tryFocus = (attempts: number) => {
          const firstItem = document.querySelector(
            '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:not(.ant-dropdown-menu-item-disabled)',
          ) as HTMLElement | null;
          if (firstItem) {
            firstItem.focus();
          } else if (attempts > 0) {
            requestAnimationFrame(() => tryFocus(attempts - 1));
          }
        };
        requestAnimationFrame(() => tryFocus(5));
      }
      return !prev;
    });
  }, []);

  // ── Command palette data ──────────────────────────────────────
  const { groups: cmdGroups, sections: cmdSections } = useCommandPaletteData({
    rules,
    templates,
    localCollectionTrees,
    templateCollectionTrees,
    openEditTab,
    openCreateTab,
    openTemplateEditTab,
    onOpenCreateMenu: openCreateMenu,
    onTogglePanel: togglePanel,
    onShowShortcuts: handleShowShortcuts,
  });

  // ── Global keyboard shortcuts ─────────────────────────────────
  useWorkspaceShortcuts({
    onToggleSidebar: () => togglePanel('sidebar'),
    onToggleBottomPanel: () => togglePanel('bottomPanel'),
    onToggleInspector: () => togglePanel('inspector'),
    onCloseTab: handleCloseActiveTab,
    onPrevTab: handlePrevTab,
    onNextTab: handleNextTab,
    onSave: handleSave,
    onNewRule: openCreateMenu,
    onFocusFilter: () => {
      if (!tl.isRegionOpen('left')) togglePanel('sidebar');
      sidebarFilterRef.current?.focus();
    },
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShowShortcuts: handleShowShortcuts,
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
      openFolderOverview,
      openRuleFlow,
      openTestRunsPanel,
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
      <TopBar onCommandPalette={() => setCommandPaletteOpen(true)} />

      <ShellLayout
        tl={tl}
        responsive={layout}
        renderToolWindow={renderToolWindow}
        renderEditor={() => (
          <EditorGroupRenderer
            groups={groups}
            rules={rules}
            templates={templates}
            renderTabBody={renderTabBody}
            renderLeafHeader={renderLeafHeader}
            renderEmpty={renderEmpty}
            onCreateRule={openCreateTab}
            createMenuOpen={createMenuOpen}
            onCreateMenuOpenChange={setCreateMenuOpen}
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
              <span className="rules-drag-preview-icon">{tabIcon(tab, rules, templates)}</span>
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
