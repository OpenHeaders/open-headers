/**
 * V5Shell — the IDE-style three-panel layout.
 *
 * Replaces the flat-tab AppLayout with:
 *   TopBar | Sidebar | Editor + BottomPanel | Inspector | StatusBar
 *
 * All panels are resizable via allotment.
 * Panel visibility is toggled via keyboard shortcuts or status bar icons.
 */

import type { HeaderRule, Source } from '@openheaders/core';
import type { AllotmentHandle } from 'allotment';
import { Allotment } from 'allotment';
import { Modal, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorkspaceSwitchOverlay from '@/renderer/components/common/WorkspaceSwitchOverlay';
import { useWorkspaceSwitch } from '@/renderer/contexts';
import { useCollections, useEnvironments, useFolders, useHeaderRules, useSources, useWorkspaces } from '@/renderer/hooks/useCentralizedWorkspace';
import 'allotment/dist/style.css';
import { ActivityBar } from './ActivityBar';
import { BottomPanel } from './BottomPanel';
import { BreadcrumbBar } from './BreadcrumbBar';
import { CommandPalette } from './CommandPalette';
import { EditorVariablesProvider } from './contexts/EditorVariablesContext';
import { EditorArea } from './EditorArea';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { DEFAULT_LAYOUT, useLayoutPersistence } from './hooks/useLayoutPersistence';
import { useResolvedTabs } from './hooks/useResolvedTabs';
import { useTabs } from './hooks/useTabs';
import { Inspector } from './Inspector';
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
  const { environments, createEnvironment } = useEnvironments();
  const { collections, updateCollection: updateCollectionInV5 } = useCollections();
  const { folders, updateFolder: updateFolderInV5 } = useFolders();
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
  const envOrganization = layoutState.envOrganization;

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
  const setInspectorExpandedKeys = useCallback(
    (keys: string[]) => {
      setLayoutState((prev) => ({ ...prev, inspectorExpandedKeys: keys }));
    },
    [setLayoutState],
  );
  const setEnvOrganization = useCallback(
    (updater: typeof envOrganization | ((prev: typeof envOrganization) => typeof envOrganization)) => {
      setLayoutState((prev) => ({
        ...prev,
        envOrganization: typeof updater === 'function' ? updater(prev.envOrganization) : updater,
      }));
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
    markUnsaved,
    reorderTab,
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

  // Prompt for a single unsaved tab. Resolves: 'discard' | 'save' | 'cancel'
  const confirmUnsaved = useCallback(
    (tab: { id: string; label: string }): Promise<'discard' | 'save' | 'cancel'> =>
      new Promise((resolve) => {
        const modal = Modal.confirm({
          title: <span style={{ fontSize: 13, fontWeight: 600 }}>Save changes?</span>,
          width: 380,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>
              <strong>{tab.label}</strong> has unsaved changes. Save these changes to avoid losing your work.
            </p>
          ),
          footer: (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button
                type="button"
                style={{
                  padding: '5px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 5,
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                onClick={() => {
                  modal.destroy();
                  resolve('discard');
                }}
              >
                Don't save
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{
                    padding: '5px 16px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 5,
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                  onClick={() => {
                    modal.destroy();
                    resolve('cancel');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    padding: '5px 16px',
                    border: 'none',
                    borderRadius: 5,
                    background: '#ff7875',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    modal.destroy();
                    resolve('save');
                  }}
                >
                  Save changes
                </button>
              </div>
            </div>
          ),
          closable: true,
          onCancel: () => {
            modal.destroy();
            resolve('cancel');
          },
        });
      }),
    [],
  );

  // Close a single tab, prompting if unsaved
  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const rt = resolvedTabs.find((t) => t.id === tabId);
      if (!rt) return;
      if (!rt.unsaved) {
        closeTab(tabId);
        return;
      }
      const result = await confirmUnsaved({ id: rt.id, label: rt.resolvedLabel });
      if (result === 'save') editorSaveRef.current?.();
      if (result !== 'cancel') closeTab(tabId, true);
    },
    [resolvedTabs, closeTab, confirmUnsaved],
  );

  // Close multiple tabs, prompting for each dirty one sequentially
  const handleBatchClose = useCallback(
    async (tabIds: string[]) => {
      const clean = tabIds.filter((id) => {
        const t = resolvedTabs.find((tab) => tab.id === id);
        return t && !t.unsaved && !t.pinned;
      });
      for (const id of clean) closeTab(id, true);

      const dirty = tabIds.filter((id) => {
        const t = resolvedTabs.find((tab) => tab.id === id);
        return t && t.unsaved && !t.pinned;
      });
      for (const id of dirty) {
        const rt = resolvedTabs.find((t) => t.id === id);
        if (!rt) continue;
        const result = await confirmUnsaved({ id: rt.id, label: rt.resolvedLabel });
        if (result === 'cancel') return;
        if (result === 'save') editorSaveRef.current?.();
        closeTab(id, true);
      }
    },
    [resolvedTabs, closeTab, confirmUnsaved],
  );

  const handleCloseOther = useCallback(
    (tabId: string) => {
      const toClose = resolvedTabs.filter((t) => t.id !== tabId && !t.pinned).map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [resolvedTabs, handleBatchClose],
  );

  const handleCloseAll = useCallback(() => {
    const toClose = resolvedTabs.filter((t) => !t.pinned).map((t) => t.id);
    void handleBatchClose(toClose);
  }, [resolvedTabs, handleBatchClose]);

  const handleCloseUnmodified = useCallback(() => {
    const toClose = resolvedTabs.filter((t) => !t.unsaved && !t.pinned && t.type !== 'welcome').map((t) => t.id);
    for (const id of toClose) closeTab(id, true);
  }, [resolvedTabs, closeTab]);

  const handleCloseToLeft = useCallback(
    (tabId: string) => {
      const idx = resolvedTabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return;
      const toClose = resolvedTabs
        .slice(0, idx)
        .filter((t) => !t.pinned)
        .map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [resolvedTabs, handleBatchClose],
  );

  const handleCloseToRight = useCallback(
    (tabId: string) => {
      const idx = resolvedTabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return;
      const toClose = resolvedTabs
        .slice(idx + 1)
        .filter((t) => !t.pinned)
        .map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [resolvedTabs, handleBatchClose],
  );

  // Listen for "Variables in request" link clicks from TemplateInput popovers
  useEffect(() => {
    const handler = () => {
      setPanels((prev) => ({ ...prev, inspector: true }));
    };
    window.addEventListener('showVariablesPanel', handler);
    return () => window.removeEventListener('showVariablesPanel', handler);
  }, []);

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
    for (const envName of Object.keys(environments)) currentIds.add(`env-${envName}`);

    if (prevEntityIds.current.size > 0 && !workspaceJustChanged) {
      for (const tab of tabsRef.current) {
        if (
          tab.entityId &&
          !currentIds.has(tab.id) &&
          tab.type !== 'welcome' &&
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

  const openSettings = useCallback(() => {
    openTab({ id: 'settings', type: 'settings', label: 'Settings', icon: 'settings' });
  }, [openTab]);

  const createNewRule = useCallback(
    async (options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = new Set(rules.map((r) => r.name));
      let name = 'New Rule';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Rule (${counter})`;
        counter++;
      }
      const newRule: Partial<HeaderRule> = {
        type: 'header',
        name,
        description: '',
        isEnabled: true,
        domains: [],
        headerName: '',
        headerValue: '',
        tag: '',
        isResponse: false,
        isDynamic: false,
        sourceId: null,
        prefix: '',
        suffix: '',
        hasEnvVars: false,
        envVars: [],
        collectionId: options?.collectionId,
        folderId: options?.folderId,
      };
      const rule = await addRule(newRule);
      if (rule) {
        openTab({ id: `rule-${rule.id}`, type: 'rule', label: name, icon: 'rule', entityId: rule.id });
      }
    },
    [addRule, openTab, rules],
  );

  const createNewSource = useCallback(
    async (options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = new Set(sources.map((s) => s.sourceName));
      let name = 'New Request';
      let counter = 2;
      while (existingNames.has(name)) {
        name = `New Request (${counter})`;
        counter++;
      }
      const newSource: Source = {
        sourceId: '',
        sourceType: 'http',
        sourcePath: '',
        sourceMethod: 'GET',
        sourceName: name,
        sourceTag: '',
        sourceContent: null,
        requestOptions: { contentType: 'application/json' },
        jsonFilter: { enabled: false },
        refreshOptions: { enabled: false },
        activationState: 'inactive',
        collectionId: options?.collectionId,
        folderId: options?.folderId,
      };
      const source = await addSource(newSource);
      if (source) {
        openTab({
          id: `source-${source.sourceId}`,
          type: 'request',
          label: name,
          icon: 'GET',
          entityId: source.sourceId,
        });
      }
    },
    [addSource, openTab, sources],
  );

  const createNewEnvironment = useCallback(
    async (_options?: { collectionId?: string; folderId?: string }) => {
      const existingNames = Object.keys(environments);
      let name = 'New Environment';
      let counter = 2;
      while (existingNames.includes(name)) {
        name = `New Environment (${counter})`;
        counter++;
      }
      const success = await createEnvironment(name);
      if (success) {
        openTab({ id: `env-${name}`, type: 'environment', label: name, icon: 'environment', entityId: name });
      }
    },
    [environments, createEnvironment, openTab],
  );

  const togglePanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

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
    [panels.sidebar, activePanel, setActivePanel],
  );

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    // Restore all pane sizes to their preferredSize defaults
    outerAllotmentRef.current?.reset();
  }, [setLayoutState]);

  const swapSidebars = useCallback(() => {
    setSidebarsSwapped((v) => !v);
  }, []);

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
    [panels.bottomPanel, bottomPanelTab],
  );

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(
    () => ({
      onToggleSidebar: () => togglePanel('sidebar'),
      onToggleBottomPanel: () => togglePanel('bottomPanel'),
      onToggleInspector: () => togglePanel('inspector'),
      onCommandPalette: () => setCommandPaletteOpen(true),
      onOpenSettings: openSettings,
      onNewRequest: () => void createNewSource(),
      onNewRule: () => void createNewRule(),
      onSave: () => editorSaveRef.current?.(),
      onToggleWorkbench: () => togglePanel('workbench'),
      onToggleResponseLayout: () => setResponseSideBySide((v) => !v),
      onResetLayout: resetLayout,
      onSwapSidebars: swapSidebars,
    }),
    [togglePanel, openSettings, createNewSource, createNewRule, resetLayout, swapSidebars],
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
    for (const envName of Object.keys(environments)) {
      const envTabId = `env-${envName}`;
      items.push({
        id: envTabId,
        icon: '🌐',
        label: envName,
        scope: 'Environment',
        onSelect: () =>
          openTab({ id: envTabId, type: 'environment', label: envName, icon: 'environment', entityId: envName }),
      });
    }

    // Commands (always last, prefixed with > in search)
    items.push(
      {
        id: 'cmd-new-request',
        icon: '▶',
        label: 'New Request',
        shortcut: '⌘N',
        onSelect: () => void createNewSource(),
      },
      { id: 'cmd-new-rule', icon: '⚡', label: 'New Rule', shortcut: '⇧⌘N', onSelect: () => void createNewRule() },
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
    );

    return items;
  }, [sources, rules, environments, togglePanel, openSettings, openTab, createNewSource, createNewRule]);

  // Active resolved tab and breadcrumbs — derived from resolved tabs
  const activeResolvedTab = resolvedTabs.find((t) => t.id === activeTabId);
  const breadcrumbs = activeResolvedTab
    ? [{ label: workspaceName }, { label: activeResolvedTab.resolvedLabel }]
    : [{ label: workspaceName }];

  // Rename via breadcrumb — updates the source/rule name in the main process.
  // Tab labels and sidebar will auto-update via useResolvedTabs (derives from live data).
  const handleBreadcrumbRename = useCallback(
    (newName: string) => {
      if (!activeResolvedTab?.entityId) return;
      if (activeResolvedTab.type === 'request' || activeResolvedTab.type === 'collection') {
        void updateSource(activeResolvedTab.entityId, { sourceName: newName });
      } else if (activeResolvedTab.type === 'rule') {
        void updateRule(activeResolvedTab.entityId, { name: newName });
      } else if (activeResolvedTab.type === 'collection-overview') {
        void updateCollectionInV5(activeResolvedTab.entityId, { name: newName });
      } else if (activeResolvedTab.type === 'folder-overview') {
        void updateFolderInV5(activeResolvedTab.entityId, { name: newName });
      }
      setPendingRenameTabId(null);
    },
    [activeResolvedTab, updateSource, updateRule, updateCollectionInV5, updateFolderInV5],
  );

  return (
    <EditorVariablesProvider>
      <>
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
                    />
                  ) : (
                    <Sidebar
                      activePanel={activePanel}
                      onOpenTab={openTab}
                      onNewRequest={(opts) => void createNewSource(opts)}
                      onNewRule={(opts) => void createNewRule(opts)}
                      onNewEnvironment={(opts) => void createNewEnvironment(opts)}
                      expandedSections={sidebarExpandedSections}
                      onExpandedSectionsChange={setSidebarExpandedSections}
                      expandedCollections={sidebarExpandedCollections}
                      onExpandedCollectionsChange={setSidebarExpandedCollections}
                      activeTabId={activeTabId}
                      envOrganization={envOrganization}
                      onEnvOrganizationChange={setEnvOrganization}
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
                          onNewRequest={() => void createNewSource()}
                          onNewRule={() => void createNewRule()}
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
                              activeResolvedTab.type === 'rule')
                              ? handleBreadcrumbRename
                              : undefined
                          }
                          autoRenameKey={pendingRenameTabId === activeTabId ? pendingRenameTabId : null}
                        />
                        <EditorArea
                          tabs={resolvedTabs}
                          activeTab={activeResolvedTab}
                          onNewRequest={() => void createNewSource()}
                          onNewRule={() => void createNewRule()}
                          onDirtyChange={handleDirtyChange}
                          onSaveLabelChange={setEditorSaveLabel}
                          saveRef={editorSaveRef}
                          responseSideBySide={responseSideBySide}
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
                      expandedSections={sidebarExpandedSections}
                      onExpandedSectionsChange={setSidebarExpandedSections}
                      expandedCollections={sidebarExpandedCollections}
                      onExpandedCollectionsChange={setSidebarExpandedCollections}
                      activeTabId={activeTabId}
                      envOrganization={envOrganization}
                      onEnvOrganizationChange={setEnvOrganization}
                      activeWorkspaceId={activeWorkspaceId}
                      onPendingRename={setPendingRenameTabId}
                    />
                  ) : (
                    <Inspector
                      onClose={() => togglePanel('inspector')}
                      expandedKeys={inspectorExpandedKeys}
                      onExpandedKeysChange={setInspectorExpandedKeys}
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
        </div>

        {/* Workspace Switch Overlay — outside blurred shell */}
        <WorkspaceSwitchOverlay visible={switchState.switching} targetWorkspace={switchState.targetWorkspace} />
      </>
    </EditorVariablesProvider>
  );
}
