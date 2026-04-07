/**
 * V5Shell — the IDE-style three-panel layout.
 *
 * Replaces the flat-tab AppLayout with:
 *   TopBar | Sidebar | Editor + BottomPanel | Inspector | StatusBar
 *
 * All panels are resizable via allotment.
 * Panel visibility is toggled via keyboard shortcuts or status bar icons.
 */

import type { AllotmentHandle } from 'allotment';
import { Allotment } from 'allotment';
import { theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorkspaceSwitchOverlay from '@/renderer/components/common/WorkspaceSwitchOverlay';
import { useWorkspaceSwitch } from '@/renderer/contexts';
import {
  useCollections,
  useEnvironments,
  useFolders,
  useHeaderRules,
  useSources,
  useWorkspaces,
} from '@/renderer/hooks/useCentralizedWorkspace';
import 'allotment/dist/style.css';
import { ActivityBar } from './ActivityBar';
import { BottomPanel } from './BottomPanel';
import { BreadcrumbBar } from './BreadcrumbBar';
import { CommandPalette } from './CommandPalette';
import { EditorVariablesProvider } from './contexts/EditorVariablesContext';
import { EditorArea } from './EditorArea';
import { useDraftSave } from './hooks/useDraftSave';
import { useEntityCreation } from './hooks/useEntityCreation';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { DEFAULT_LAYOUT, useLayoutPersistence } from './hooks/useLayoutPersistence';
import { useResolvedTabs } from './hooks/useResolvedTabs';
import { useSidebarExpansion } from './hooks/useSidebarExpansion';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabs } from './hooks/useTabs';
import { Inspector } from './Inspector';
import { SaveToCollectionModal } from './modals/SaveToCollectionModal';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';
import './v5-shell.less';

export type ActivityPanel = 'items' | 'recordings' | 'history' | 'files';

interface PanelVisibility {
  sidebar: boolean;
  workbench: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}

export function V5Shell() {
  const { token } = theme.useToken();
  const { workspaces, activeWorkspaceId } = useWorkspaces();
  const { sources, addSource, updateSource } = useSources();
  const { rules, addRule, updateRule } = useHeaderRules();
  const { environments, activeEnvironment, switchEnvironment, createEnvironment, updateEnvironment } =
    useEnvironments();
  const { collections, addCollection, updateCollection: updateCollectionInV5 } = useCollections();
  const { folders, addFolder, updateFolder: updateFolderInV5 } = useFolders();
  const { switchState } = useWorkspaceSwitch();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const workspaceName = activeWorkspace?.name ?? 'Workspace';
  const { layoutState, setLayoutState } = useLayoutPersistence();
  const panels = layoutState.panels;
  const responseSideBySide = layoutState.responseSideBySide;
  const sidebarsSwapped = layoutState.sidebarsSwapped;
  const bottomPanelTab = layoutState.bottomPanelTab;
  const activePanel = layoutState.sidebarActivePanel as ActivityPanel;
  const sidebarExpandedSections = layoutState.sidebarExpandedSections;
  const sidebarExpandedCollections = layoutState.sidebarExpandedCollections;
  const inspectorExpandedKeys = layoutState.inspectorExpandedKeys;
  const setPanels = useCallback(
    (updater: PanelVisibility | ((prev: PanelVisibility) => PanelVisibility)) => {
      setLayoutState((prev) => ({
        ...prev,
        panels: typeof updater === 'function' ? updater(prev.panels) : updater,
      }));
    },
    [setLayoutState],
  );
  const setResponseSideBySide = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setLayoutState((prev) => ({
        ...prev,
        responseSideBySide: typeof updater === 'function' ? updater(prev.responseSideBySide) : updater,
      }));
    },
    [setLayoutState],
  );
  const setSidebarsSwapped = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setLayoutState((prev) => ({
        ...prev,
        sidebarsSwapped: typeof updater === 'function' ? updater(prev.sidebarsSwapped) : updater,
      }));
    },
    [setLayoutState],
  );
  const setBottomPanelTab = useCallback(
    (tab: string) => {
      setLayoutState((prev) => ({ ...prev, bottomPanelTab: tab }));
    },
    [setLayoutState],
  );
  const setActivePanel = useCallback(
    (panel: ActivityPanel) => {
      setLayoutState((prev) => ({ ...prev, sidebarActivePanel: panel }));
    },
    [setLayoutState],
  );
  const setSidebarExpandedSections = useCallback(
    (sections: string[]) => {
      setLayoutState((prev) => ({ ...prev, sidebarExpandedSections: sections }));
    },
    [setLayoutState],
  );
  const setSidebarExpandedCollections = useCallback(
    (collections: string[]) => {
      setLayoutState((prev) => ({ ...prev, sidebarExpandedCollections: collections }));
    },
    [setLayoutState],
  );
  // Sidebar tree expansion — shared hook provides typed methods
  const sidebarExpansion = useSidebarExpansion(sidebarExpandedCollections, setSidebarExpandedCollections);

  const setInspectorExpandedKeys = useCallback(
    (keys: string[]) => {
      setLayoutState((prev) => ({ ...prev, inspectorExpandedKeys: keys }));
    },
    [setLayoutState],
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorSaveLabel, setEditorSaveLabel] = useState<string | null>(null);
  const editorSaveRef = useRef<(() => void) | null>(null);
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);
  const outerAllotmentRef = useRef<AllotmentHandle>(null);

  // Tab management
  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    switchTab,
    togglePin,
    updateTab,
    markUnsaved,
    reorderTab,
    recentlyClosed,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  } = useTabs(activeWorkspaceId);

  // Derive live labels/icons/tooltips from entity data — single source of truth
  const resolvedTabs = useResolvedTabs(tabs, sources, rules, environments, collections, folders);

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setEditorDirty(dirty);
      if (activeTabId) markUnsaved(activeTabId, dirty);
    },
    [activeTabId, markUnsaved],
  );

  // Tab close operations (unsaved confirmation, batch close, etc.)
  const {
    handleCloseTab,
    handleCloseOther,
    handleCloseAll,
    handleCloseUnmodified,
    handleCloseToLeft,
    handleCloseToRight,
  } = useTabLifecycle({ resolvedTabs, closeTab, switchTab, editorSaveRef });

  // Listen for "Variables in request" link clicks from TemplateInput popovers
  useEffect(() => {
    const handler = () => {
      setPanels((prev) => ({ ...prev, inspector: true }));
    };
    window.addEventListener('showVariablesPanel', handler);
    return () => window.removeEventListener('showVariablesPanel', handler);
  }, [setPanels]);

  // Auto-close tabs when their backing entity is deleted.
  // Uses a ref for tabs so this effect only fires on entity/workspace changes,
  // not on tab additions — avoids race where a new tab is opened before its
  // entity state has synced from main process.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const prevEntityIds = useRef<Set<string>>(new Set());
  const prevWorkspaceForCleanup = useRef(activeWorkspaceId);
  useEffect(() => {
    const workspaceJustChanged = prevWorkspaceForCleanup.current !== activeWorkspaceId;
    prevWorkspaceForCleanup.current = activeWorkspaceId;

    const currentIds = new Set<string>();
    for (const r of rules) currentIds.add(`rule-${r.id}`);
    for (const s of sources) currentIds.add(`source-${s.sourceId}`);
    for (const env of environments) currentIds.add(`env-${env.id}`);

    if (prevEntityIds.current.size > 0 && !workspaceJustChanged) {
      for (const tab of tabsRef.current) {
        if (
          tab.entityId &&
          !tab.draft &&
          !currentIds.has(tab.id) &&
          tab.type !== 'overview' &&
          tab.type !== 'settings' &&
          tab.type !== 'collection-overview' &&
          tab.type !== 'folder-overview'
        ) {
          closeTab(tab.id);
        }
      }
    }
    prevEntityIds.current = currentIds;
  }, [rules, sources, environments, closeTab, activeWorkspaceId]);

  // Auto-switch environment when opening an item in a collection with a pinned environment
  const prevTabForEnvSwitch = useRef(activeTabId);
  useEffect(() => {
    if (prevTabForEnvSwitch.current === activeTabId) return;
    prevTabForEnvSwitch.current = activeTabId;
    if (!activeTabId) return;

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab?.entityId) return;

    // Find the entity's collectionId
    let collectionId: string | undefined;
    if (activeTab.type === 'request' || activeTab.type === 'collection') {
      collectionId = sources.find((s) => s.sourceId === activeTab.entityId)?.collectionId;
    } else if (activeTab.type === 'rule') {
      collectionId = rules.find((r) => r.id === activeTab.entityId)?.collectionId;
    } else if (activeTab.type === 'collection-overview') {
      collectionId = activeTab.entityId;
    }

    if (!collectionId) return;
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection?.pinnedEnvironmentId) return;

    // Only switch if the pinned env exists and differs from current
    const pinnedEnvExists = environments.some((e) => e.id === collection.pinnedEnvironmentId);
    if (pinnedEnvExists && collection.pinnedEnvironmentId !== activeEnvironment) {
      void switchEnvironment(collection.pinnedEnvironmentId);
    }
  }, [activeTabId, tabs, sources, rules, collections, environments, activeEnvironment, switchEnvironment]);

  // Entity creation (persisted — for sidebar context actions)
  const {
    openOverview,
    openSettings,
    openWorkspaceVariables,
    createNewSource,
    createNewRule,
    createNewEnvironment,
    createAndActivateEnvironment,
    openActiveEnvironment,
  } = useEntityCreation({
    sources,
    rules,
    environments,
    activeEnvironment,
    addSource,
    addRule,
    createEnvironment,
    switchEnvironment,
    openTab,
    setPendingRenameTabId,
  });

  // Draft creation + save-to-collection modal
  const { createDraftSource, createDraftRule, createDraftEnvironment, handleSaveDraft, saveModalProps } = useDraftSave({
    sources,
    rules,
    environments,
    tabs,
    addSource,
    addRule,
    createEnvironment,
    closeTab,
    openTab,
    ensureSidebarExpanded: sidebarExpansion.ensureExpanded,
  });

  const togglePanel = useCallback(
    (panel: keyof PanelVisibility) => {
      setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
    },
    [setPanels],
  );

  // Activity bar toggle: click same panel = hide sidebar, different = switch, hidden = show
  const handleActivityPanelToggle = useCallback(
    (panel: ActivityPanel) => {
      if (panels.sidebar && activePanel === panel) {
        setPanels((prev) => ({ ...prev, sidebar: false }));
      } else {
        setActivePanel(panel);
        setPanels((prev) => ({ ...prev, sidebar: true }));
      }
    },
    [panels.sidebar, activePanel, setActivePanel, setPanels],
  );

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    // Restore all pane sizes to their preferredSize defaults
    outerAllotmentRef.current?.reset();
  }, [setLayoutState]);

  const swapSidebars = useCallback(() => {
    setSidebarsSwapped((v) => !v);
  }, [setSidebarsSwapped]);

  const openBottomTab = useCallback(
    (tab: string) => {
      if (panels.bottomPanel && bottomPanelTab === tab) {
        // Already on this tab — close the panel
        setPanels((prev) => ({ ...prev, bottomPanel: false }));
      } else {
        // Open panel and switch to tab
        setBottomPanelTab(tab);
        setPanels((prev) => ({ ...prev, bottomPanel: true }));
      }
    },
    [
      panels.bottomPanel,
      bottomPanelTab, // Open panel and switch to tab
      setBottomPanelTab,
      setPanels,
    ],
  );

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(
    () => ({
      onToggleSidebar: () => togglePanel('sidebar'),
      onToggleBottomPanel: () => togglePanel('bottomPanel'),
      onToggleInspector: () => togglePanel('inspector'),
      onCommandPalette: () => setCommandPaletteOpen(true),
      onOpenSettings: openSettings,
      onNewRequest: createDraftSource,
      onNewRule: createDraftRule,
      onSave: () => editorSaveRef.current?.(),
      onToggleWorkbench: () => togglePanel('workbench'),
      onToggleResponseLayout: () => setResponseSideBySide((v) => !v),
      onResetLayout: resetLayout,
      onSwapSidebars: swapSidebars,
    }),
    [togglePanel, openSettings, createDraftSource, createDraftRule, resetLayout, swapSidebars, setResponseSideBySide],
  );
  useKeyboardShortcuts(shortcutHandlers);

  // Command palette items — real data + static commands
  const commandItems = useMemo(() => {
    const items = [];

    // Sources
    for (const source of sources) {
      const sourceTabId = `source-${source.sourceId}`;
      items.push({
        id: sourceTabId,
        icon: '🔗',
        label: source.sourceName || source.sourcePath || 'Untitled Source',
        scope: source.sourceTag || 'Source',
        onSelect: () =>
          openTab({
            id: sourceTabId,
            type: 'request',
            label: source.sourceName || source.sourcePath || 'Untitled Source',
            icon: source.sourceMethod || 'GET',
            entityId: source.sourceId,
          }),
      });
    }

    // Rules
    for (const rule of rules) {
      const ruleTabId = `rule-${rule.id}`;
      items.push({
        id: ruleTabId,
        icon: '⚡',
        label: rule.name || rule.headerName,
        scope: rule.isEnabled ? 'Rule (active)' : 'Rule (disabled)',
        onSelect: () =>
          openTab({
            id: ruleTabId,
            type: 'rule',
            label: rule.name || rule.headerName,
            icon: 'rule',
            entityId: rule.id,
          }),
      });
    }

    // Environments
    for (const env of environments) {
      const envTabId = `env-${env.id}`;
      items.push({
        id: envTabId,
        icon: '🌐',
        label: env.name,
        scope: 'Environment',
        onSelect: () =>
          openTab({ id: envTabId, type: 'environment', label: env.name, icon: 'environment', entityId: env.id }),
      });
    }

    // Commands (always last, prefixed with > in search)
    items.push(
      {
        id: 'cmd-new-request',
        icon: '▶',
        label: 'New Request',
        shortcut: '⌘N',
        onSelect: createDraftSource,
      },
      { id: 'cmd-new-rule', icon: '⚡', label: 'New Rule', shortcut: '⇧⌘N', onSelect: createDraftRule },
      { id: 'cmd-new-env', icon: '🌐', label: 'New Environment', onSelect: createDraftEnvironment },
      {
        id: 'cmd-toggle-sidebar',
        icon: '▶',
        label: 'Toggle Sidebar',
        shortcut: '⌘B',
        onSelect: () => togglePanel('sidebar'),
      },
      {
        id: 'cmd-toggle-bottom',
        icon: '▶',
        label: 'Toggle Bottom Panel',
        shortcut: '⌘J',
        onSelect: () => togglePanel('bottomPanel'),
      },
      {
        id: 'cmd-toggle-inspector',
        icon: '▶',
        label: 'Toggle Inspector',
        shortcut: '⌥⌘\\',
        onSelect: () => togglePanel('inspector'),
      },
      { id: 'cmd-import', icon: '📋', label: 'Import from Postman / Bruno / Insomnia', onSelect: () => {} },
      { id: 'cmd-settings', icon: '⚙', label: 'Open Settings', shortcut: '⌘,', onSelect: openSettings },
      {
        id: 'cmd-workspace-variables',
        icon: '🌐',
        label: 'Open Workspace Variables',
        onSelect: openWorkspaceVariables,
      },
    );

    return items;
  }, [
    sources,
    rules,
    environments,
    togglePanel,
    openSettings,
    openWorkspaceVariables,
    openTab,
    createDraftSource,
    createDraftRule,
    createDraftEnvironment,
  ]);

  // Derive the collection the active tab belongs to (for pinned env feature)
  const activeCollection = useMemo(() => {
    if (!activeTabId) return null;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.entityId) return null;

    let collectionId: string | undefined;
    if (tab.type === 'request' || tab.type === 'collection') {
      collectionId = sources.find((s) => s.sourceId === tab.entityId)?.collectionId;
    } else if (tab.type === 'rule') {
      collectionId = rules.find((r) => r.id === tab.entityId)?.collectionId;
    } else if (tab.type === 'collection-overview') {
      collectionId = tab.entityId;
    }

    return collectionId ? (collections.find((c) => c.id === collectionId) ?? null) : null;
  }, [activeTabId, tabs, sources, rules, collections]);

  const handlePinEnvironment = useCallback(
    (collectionId: string, envId: string | null) => {
      void updateCollectionInV5(collectionId, { pinnedEnvironmentId: envId ?? undefined });
    },
    [updateCollectionInV5],
  );

  // Active resolved tab and breadcrumbs — derived from resolved tabs
  const activeResolvedTab = resolvedTabs.find((t) => t.id === activeTabId);
  const breadcrumbs = activeResolvedTab
    ? [{ label: workspaceName }, { label: activeResolvedTab.resolvedLabel }]
    : [{ label: workspaceName }];

  // Rename via breadcrumb — updates the source/rule name in the main process.
  // Tab labels and sidebar will auto-update via useResolvedTabs (derives from live data).
  const handleBreadcrumbRename = useCallback(
    (newName: string) => {
      if (!activeResolvedTab) return;

      // Draft tabs — update the tab label and draft data locally
      if (activeResolvedTab.draft) {
        const draftData = { ...(activeResolvedTab.draftData ?? {}) };
        if (activeResolvedTab.type === 'request') {
          draftData.sourceName = newName;
        } else {
          draftData.name = newName;
        }
        updateTab(activeResolvedTab.id, { label: newName, draftData });
        setPendingRenameTabId(null);
        return;
      }

      if (!activeResolvedTab.entityId) return;
      if (activeResolvedTab.type === 'request' || activeResolvedTab.type === 'collection') {
        void updateSource(activeResolvedTab.entityId, { sourceName: newName });
      } else if (activeResolvedTab.type === 'rule') {
        void updateRule(activeResolvedTab.entityId, { name: newName });
      } else if (activeResolvedTab.type === 'collection-overview') {
        void updateCollectionInV5(activeResolvedTab.entityId, { name: newName });
      } else if (activeResolvedTab.type === 'folder-overview') {
        void updateFolderInV5(activeResolvedTab.entityId, { name: newName });
      } else if (activeResolvedTab.type === 'environment') {
        void updateEnvironment(activeResolvedTab.entityId, { name: newName });
      }
      setPendingRenameTabId(null);
    },
    [activeResolvedTab, updateTab, updateSource, updateRule, updateCollectionInV5, updateFolderInV5, updateEnvironment],
  );

  return (
    <EditorVariablesProvider>
      <div
        className="v5-shell"
        style={{
          background: token.colorBgLayout,
          ...(switchState.switching ? { filter: 'blur(2px)', pointerEvents: 'none' } : {}),
        }}
      >
        {/* Top Bar */}
        <TopBar
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onGoBack={goBack}
          onGoForward={goForward}
          onCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenSettings={openSettings}
        />

        {/* Main content area */}
        <div className="v5-main">
          {/* Activity Bar — permanent vertical strip */}
          <ActivityBar
            activePanel={activePanel}
            sidebarVisible={panels.sidebar}
            onPanelToggle={handleActivityPanelToggle}
            onOpenSettings={openSettings}
          />

          {/* Resizable panels */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Allotment ref={outerAllotmentRef} proportionalLayout={false}>
              {/* Left pane — content swaps based on sidebarsSwapped */}
              <Allotment.Pane
                preferredSize={sidebarsSwapped ? 300 : 250}
                minSize={sidebarsSwapped ? 220 : 180}
                maxSize={panels.workbench ? (sidebarsSwapped ? 500 : 400) : Infinity}
                visible={sidebarsSwapped ? panels.inspector : panels.sidebar}
              >
                {sidebarsSwapped ? (
                  <Inspector
                    onClose={() => togglePanel('inspector')}
                    expandedKeys={inspectorExpandedKeys}
                    onExpandedKeysChange={setInspectorExpandedKeys}
                    activeTabType={activeResolvedTab?.type}
                    onOpenEnvironment={openActiveEnvironment}
                    onOpenWorkspaceVariables={openWorkspaceVariables}
                  />
                ) : (
                  <Sidebar
                    activePanel={activePanel}
                    onOpenTab={openTab}
                    onNewRequest={(opts) => void createNewSource(opts)}
                    onNewRule={(opts) => void createNewRule(opts)}
                    onNewEnvironment={(opts) => void createNewEnvironment(opts)}
                    onNewDraftEnvironment={createDraftEnvironment}
                    onOpenWorkspaceVariables={openWorkspaceVariables}
                    expandedSections={sidebarExpandedSections}
                    onExpandedSectionsChange={setSidebarExpandedSections}
                    expandedKeys={sidebarExpansion.expandedKeys}
                    ensureExpanded={sidebarExpansion.ensureExpanded}
                    toggleExpand={sidebarExpansion.toggleExpand}
                    setAllExpanded={sidebarExpansion.setAll}
                    activeTabId={activeTabId}
                    activeWorkspaceId={activeWorkspaceId}
                    onPendingRename={setPendingRenameTabId}
                  />
                )}
              </Allotment.Pane>

              {/* Center: Editor + Bottom Panel */}
              <Allotment.Pane visible={panels.workbench}>
                <Allotment vertical proportionalLayout={false}>
                  {/* Editor Area */}
                  <Allotment.Pane>
                    <div className="v5-editor-area" style={{ background: token.colorBgContainer }}>
                      <TabBar
                        tabs={resolvedTabs}
                        activeTabId={activeTabId}
                        onSwitch={switchTab}
                        onClose={handleCloseTab}
                        onTogglePin={togglePin}
                        onReorder={reorderTab}
                        onCloseOther={handleCloseOther}
                        onCloseAll={handleCloseAll}
                        onCloseUnmodified={handleCloseUnmodified}
                        onCloseToLeft={handleCloseToLeft}
                        onCloseToRight={handleCloseToRight}
                        onNewRequest={createDraftSource}
                        onNewRule={createDraftRule}
                        environments={environments}
                        activeEnvironment={activeEnvironment}
                        onSwitchEnvironment={switchEnvironment}
                        activeCollection={activeCollection}
                        onPinEnvironment={handlePinEnvironment}
                        onNewEnvironment={() => void createAndActivateEnvironment()}
                        onNewDraftEnvironment={createDraftEnvironment}
                        onToggleInspector={() => togglePanel('inspector')}
                        recentlyClosed={recentlyClosed}
                        onReopenTab={(tab) => openTab(tab)}
                      />
                      <BreadcrumbBar
                        segments={breadcrumbs}
                        isDirty={editorDirty}
                        onSave={() => editorSaveRef.current?.()}
                        saveLabel={editorSaveLabel}
                        onRename={
                          activeResolvedTab &&
                          (activeResolvedTab.type === 'request' ||
                            activeResolvedTab.type === 'collection' ||
                            activeResolvedTab.type === 'collection-overview' ||
                            activeResolvedTab.type === 'folder-overview' ||
                            activeResolvedTab.type === 'rule' ||
                            activeResolvedTab.type === 'environment')
                            ? handleBreadcrumbRename
                            : undefined
                        }
                        autoRenameKey={pendingRenameTabId === activeTabId ? pendingRenameTabId : null}
                      />
                      <EditorArea
                        tabs={resolvedTabs}
                        activeTab={activeResolvedTab}
                        onNewRequest={createDraftSource}
                        onNewRule={createDraftRule}
                        onNewEnvironment={createDraftEnvironment}
                        onOpenOverview={openOverview}
                        onDirtyChange={handleDirtyChange}
                        onSaveLabelChange={setEditorSaveLabel}
                        saveRef={editorSaveRef}
                        responseSideBySide={responseSideBySide}
                        workspaceName={workspaceName}
                        onSaveDraft={handleSaveDraft}
                      />
                    </div>
                  </Allotment.Pane>

                  {/* Bottom Panel */}
                  <Allotment.Pane preferredSize={200} minSize={100} maxSize={500} visible={panels.bottomPanel}>
                    <BottomPanel activeTab={bottomPanelTab} onTabChange={setBottomPanelTab} />
                  </Allotment.Pane>
                </Allotment>
              </Allotment.Pane>

              {/* Right pane — content swaps based on sidebarsSwapped */}
              <Allotment.Pane
                preferredSize={sidebarsSwapped ? 250 : 300}
                minSize={sidebarsSwapped ? 180 : 220}
                maxSize={panels.workbench ? (sidebarsSwapped ? 400 : 500) : Infinity}
                visible={sidebarsSwapped ? panels.sidebar : panels.inspector}
              >
                {sidebarsSwapped ? (
                  <Sidebar
                    activePanel={activePanel}
                    onOpenTab={openTab}
                    onNewRequest={(opts) => void createNewSource(opts)}
                    onNewRule={(opts) => void createNewRule(opts)}
                    onNewEnvironment={(opts) => void createNewEnvironment(opts)}
                    onNewDraftEnvironment={createDraftEnvironment}
                    onOpenWorkspaceVariables={openWorkspaceVariables}
                    expandedSections={sidebarExpandedSections}
                    onExpandedSectionsChange={setSidebarExpandedSections}
                    expandedKeys={sidebarExpansion.expandedKeys}
                    ensureExpanded={sidebarExpansion.ensureExpanded}
                    toggleExpand={sidebarExpansion.toggleExpand}
                    setAllExpanded={sidebarExpansion.setAll}
                    activeTabId={activeTabId}
                    activeWorkspaceId={activeWorkspaceId}
                    onPendingRename={setPendingRenameTabId}
                  />
                ) : (
                  <Inspector
                    onClose={() => togglePanel('inspector')}
                    expandedKeys={inspectorExpandedKeys}
                    onExpandedKeysChange={setInspectorExpandedKeys}
                    activeTabType={activeResolvedTab?.type}
                    onOpenEnvironment={openActiveEnvironment}
                    onOpenWorkspaceVariables={openWorkspaceVariables}
                  />
                )}
              </Allotment.Pane>
            </Allotment>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          panels={panels}
          onTogglePanel={togglePanel}
          onOpenBottomTab={openBottomTab}
          responseSideBySide={responseSideBySide}
          onToggleResponseLayout={() => setResponseSideBySide((v) => !v)}
          onResetLayout={resetLayout}
          sidebarsSwapped={sidebarsSwapped}
          onSwapSidebars={swapSidebars}
        />

        {/* Command Palette */}
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} items={commandItems} />

        {/* Save to Collection Modal */}
        <SaveToCollectionModal
          {...saveModalProps}
          collections={collections}
          folders={folders}
          sources={sources}
          workspaceName={workspaceName}
          onCreateCollection={async (name, section) => {
            const col = await addCollection({ name, section });
            if (col) sidebarExpansion.ensureExpanded(`col-${col.id}`);
            return col;
          }}
          onCreateFolder={async (name, collectionId, parentFolderId) => {
            const fol = await addFolder({
              name,
              collectionId,
              section: saveModalProps.section,
              parentFolderId: parentFolderId ?? null,
            });
            if (fol) {
              const keys = [`col-${collectionId}`, `folder-${fol.id}`];
              if (parentFolderId) keys.push(`folder-${parentFolderId}`);
              sidebarExpansion.ensureExpanded(...keys);
            }
            return fol;
          }}
        />
      </div>

      {/* Workspace Switch Overlay — outside blurred shell */}
      <WorkspaceSwitchOverlay visible={switchState.switching} targetWorkspace={switchState.targetWorkspace} />
    </EditorVariablesProvider>
  );
}
