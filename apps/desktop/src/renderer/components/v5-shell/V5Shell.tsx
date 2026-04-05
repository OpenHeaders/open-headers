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

  // Close tab with unsaved changes modal (matching MVP design)
  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      if (tab.unsaved) {
        const modal = Modal.confirm({
          title: 'Do you want to Save?',
          width: 520,
          content: (
            <p>
              This tab <strong>{tab.label}</strong> has unsaved changes which will be lost if you choose to close it.
              Save these changes to avoid losing your work.
            </p>
          ),
          footer: (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button
                type="button"
                style={{
                  padding: '8px 24px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                onClick={() => {
                  modal.destroy();
                  closeTab(tabId, true);
                }}
              >
                Don't save
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 24px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                  onClick={() => modal.destroy()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 24px',
                    border: 'none',
                    borderRadius: 6,
                    background: '#ff7875',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    editorSaveRef.current?.();
                    modal.destroy();
                    closeTab(tabId, true);
                  }}
                >
                  Save changes
                </button>
              </div>
            </div>
          ),
          closable: true,
          onCancel: () => modal.destroy(),
        });
      } else {
        closeTab(tabId);
      }
    },
    [tabs, closeTab],
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
  // Skip during workspace transitions — sources/rules reset temporarily when switching.
  const prevEntityIds = useRef<Set<string>>(new Set());
  const prevWorkspaceForCleanup = useRef(activeWorkspaceId);
  useEffect(() => {
    const workspaceJustChanged = prevWorkspaceForCleanup.current !== activeWorkspaceId;
    prevWorkspaceForCleanup.current = activeWorkspaceId;

    const currentIds = new Set<string>();
    for (const r of rules) currentIds.add(`rule-${r.id}`);
    for (const s of sources) currentIds.add(`source-${s.sourceId}`);
    for (const envName of Object.keys(environments)) currentIds.add(`env-${envName}`);

    // Only run cleanup after initial load (prevIds is populated) and not during workspace switch
    if (prevEntityIds.current.size > 0 && !workspaceJustChanged) {
      for (const tab of tabs) {
        if (tab.entityId && !currentIds.has(tab.id) && tab.type !== 'welcome' && tab.type !== 'settings') {
          closeTab(tab.id);
        }
      }
    }
    prevEntityIds.current = currentIds;
  }, [rules, sources, environments, tabs, closeTab, activeWorkspaceId]);

  const openSettings = useCallback(() => {
    openTab({ id: 'settings', type: 'settings', label: 'Settings', icon: 'settings' });
  }, [openTab]);

  const createNewRule = useCallback(async () => {
    const now = new Date().toISOString();
    const id = Date.now().toString();
    const newRule: Partial<HeaderRule> = {
      id,
      type: 'header',
      name: 'New Rule',
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
      createdAt: now,
      updatedAt: now,
    };
    const success = await addRule(newRule);
    if (success) {
      openTab({ id: `rule-${id}`, type: 'rule', label: 'New Rule', icon: 'rule', entityId: id });
    }
  }, [addRule, openTab]);

  const createNewSource = useCallback(async () => {
    const id = Date.now().toString();
    const newSource: Source = {
      sourceId: id,
      sourceType: 'http',
      sourcePath: '',
      sourceMethod: 'GET',
      sourceName: 'New Request',
      sourceTag: '',
      sourceContent: null,
      requestOptions: { contentType: 'application/json' },
      jsonFilter: { enabled: false },
      refreshOptions: { enabled: false },
      activationState: 'inactive',
    };
    const result = await addSource(newSource);
    if (result) {
      openTab({
        id: `source-${id}`,
        type: 'request',
        label: 'New Request',
        icon: 'GET',
        entityId: id,
      });
    }
  }, [addSource, openTab]);

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
                  <Inspector onClose={() => togglePanel('inspector')} expandedKeys={inspectorExpandedKeys} onExpandedKeysChange={setInspectorExpandedKeys} />
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
                      />
                      <BreadcrumbBar
                        segments={breadcrumbs}
                        isDirty={editorDirty}
                        onSave={() => editorSaveRef.current?.()}
                      />
                      <EditorArea
                        tabs={tabs}
                        activeTab={activeTab}
                        onNewRequest={() => void createNewSource()}
                        onNewRule={() => void createNewRule()}
                        onDirtyChange={handleDirtyChange}
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
                  <Inspector onClose={() => togglePanel('inspector')} expandedKeys={inspectorExpandedKeys} onExpandedKeysChange={setInspectorExpandedKeys} />
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
