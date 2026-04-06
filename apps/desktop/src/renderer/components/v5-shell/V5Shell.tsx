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
import { useEnvironments, useHeaderRules, useSources, useWorkspaces } from '@/renderer/hooks/useCentralizedWorkspace';
import 'allotment/dist/style.css';
import { BottomPanel } from './BottomPanel';
import { BreadcrumbBar } from './BreadcrumbBar';
import { CommandPalette } from './CommandPalette';
import { EditorVariablesProvider } from './contexts/EditorVariablesContext';
import { EditorArea } from './EditorArea';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { DEFAULT_LAYOUT, useLayoutPersistence } from './hooks/useLayoutPersistence';
import type { Tab } from './hooks/useTabs';
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
  const { sources, addSource } = useSources();
  const { rules, addRule } = useHeaderRules();
  const { environments, createEnvironment } = useEnvironments();
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
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (!tab.unsaved) {
        closeTab(tabId);
        return;
      }
      const result = await confirmUnsaved(tab);
      if (result === 'save') editorSaveRef.current?.();
      if (result !== 'cancel') closeTab(tabId, true);
    },
    [tabs, closeTab, confirmUnsaved],
  );

  // Close multiple tabs, prompting for each dirty one sequentially
  const handleBatchClose = useCallback(
    async (tabIds: string[]) => {
      // Close clean tabs immediately
      const clean = tabIds.filter((id) => {
        const t = tabs.find((tab) => tab.id === id);
        return t && !t.unsaved && !t.pinned;
      });
      for (const id of clean) closeTab(id, true);

      // Process dirty tabs one by one
      const dirty = tabIds.filter((id) => {
        const t = tabs.find((tab) => tab.id === id);
        return t && t.unsaved && !t.pinned;
      });
      for (const id of dirty) {
        const tab = tabs.find((t) => t.id === id);
        if (!tab) continue;
        const result = await confirmUnsaved(tab);
        if (result === 'cancel') return; // abort remaining
        if (result === 'save') editorSaveRef.current?.();
        closeTab(id, true);
      }
    },
    [tabs, closeTab, confirmUnsaved],
  );

  const handleCloseOther = useCallback(
    (tabId: string) => {
      const toClose = tabs.filter((t) => t.id !== tabId && !t.pinned).map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [tabs, handleBatchClose],
  );

  const handleCloseAll = useCallback(() => {
    const toClose = tabs.filter((t) => !t.pinned).map((t) => t.id);
    void handleBatchClose(toClose);
  }, [tabs, handleBatchClose]);

  const handleCloseUnmodified = useCallback(() => {
    // Only close clean, unpinned tabs — no prompts needed
    const toClose = tabs.filter((t) => !t.unsaved && !t.pinned && t.type !== 'welcome').map((t) => t.id);
    for (const id of toClose) closeTab(id, true);
  }, [tabs, closeTab]);

  const handleCloseToLeft = useCallback(
    (tabId: string) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return;
      const toClose = tabs
        .slice(0, idx)
        .filter((t) => !t.pinned)
        .map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [tabs, handleBatchClose],
  );

  const handleCloseToRight = useCallback(
    (tabId: string) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return;
      const toClose = tabs
        .slice(idx + 1)
        .filter((t) => !t.pinned)
        .map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [tabs, handleBatchClose],
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
        if (tab.entityId && !currentIds.has(tab.id) && tab.type !== 'welcome' && tab.type !== 'settings') {
          closeTab(tab.id);
        }
      }
    }
    prevEntityIds.current = currentIds;
  }, [rules, sources, environments, closeTab, activeWorkspaceId]);

  const openSettings = useCallback(() => {
    openTab({ id: 'settings', type: 'settings', label: 'Settings', icon: 'settings' });
  }, [openTab]);

  const createNewRule = useCallback(async () => {
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
    };
    const rule = await addRule(newRule);
    if (rule) {
      openTab({ id: `rule-${rule.id}`, type: 'rule', label: name, icon: 'rule', entityId: rule.id });
    }
  }, [addRule, openTab, rules]);

  const createNewSource = useCallback(async () => {
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
  }, [addSource, openTab, sources]);

  const createNewEnvironment = useCallback(async () => {
    // Generate unique name
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
  }, [environments, createEnvironment, openTab]);

  const togglePanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

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

  // Tab tooltip: show URL for requests, header name for rules, name for environments
  const getTabTooltip = useCallback(
    (tab: Tab): string => {
      if ((tab.type === 'request' || tab.type === 'collection') && tab.entityId) {
        const source = sources.find((s) => s.sourceId === tab.entityId);
        return source?.sourcePath || 'Untitled request';
      }
      if (tab.type === 'rule' && tab.entityId) {
        const rule = rules.find((r) => r.id === tab.entityId);
        return rule?.headerName || 'Untitled rule';
      }
      if (tab.type === 'environment') {
        return tab.label;
      }
      return tab.label;
    },
    [sources, rules],
  );

  // Breadcrumbs for active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const breadcrumbs = activeTab ? [{ label: workspaceName }, { label: activeTab.label }] : [{ label: workspaceName }];

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
            {/* Resizable panels — always render all panes, toggle with visible */}
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
                    onPanelChange={setActivePanel}
                    onOpenTab={openTab}
                    onNewRequest={() => void createNewSource()}
                    onNewRule={() => void createNewRule()}
                    onNewEnvironment={() => void createNewEnvironment()}
                    expandedSections={sidebarExpandedSections}
                    onExpandedSectionsChange={setSidebarExpandedSections}
                    expandedCollections={sidebarExpandedCollections}
                    onExpandedCollectionsChange={setSidebarExpandedCollections}
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
                        tabs={tabs}
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
                        getTabTooltip={getTabTooltip}
                      />
                      <BreadcrumbBar
                        segments={breadcrumbs}
                        isDirty={editorDirty}
                        onSave={() => editorSaveRef.current?.()}
                        saveLabel={editorSaveLabel}
                      />
                      <EditorArea
                        tabs={tabs}
                        activeTab={activeTab}
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
                    onPanelChange={setActivePanel}
                    onOpenTab={openTab}
                    onNewRequest={() => void createNewSource()}
                    onNewRule={() => void createNewRule()}
                    onNewEnvironment={() => void createNewEnvironment()}
                    expandedSections={sidebarExpandedSections}
                    onExpandedSectionsChange={setSidebarExpandedSections}
                    expandedCollections={sidebarExpandedCollections}
                    onExpandedCollectionsChange={setSidebarExpandedCollections}
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
