/**
 * V5Shell — the IDE-style three-panel layout.
 *
 * Replaces the flat-tab AppLayout with:
 *   TopBar | ActivityBar + Sidebar | Editor + BottomPanel | Inspector | StatusBar
 *
 * All panels are resizable via allotment.
 * Panel visibility is toggled via keyboard shortcuts or status bar icons.
 */

import { Allotment } from 'allotment';
import { theme } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import WorkspaceSwitchOverlay from '@/renderer/components/common/WorkspaceSwitchOverlay';
import { useWorkspaceSwitch } from '@/renderer/contexts';
import { useEnvironments, useHeaderRules, useSources, useWorkspaces } from '@/renderer/hooks/useCentralizedWorkspace';
import 'allotment/dist/style.css';
import { ActivityBar } from './ActivityBar';
import { BottomPanel } from './BottomPanel';
import { BreadcrumbBar } from './BreadcrumbBar';
import { CommandPalette } from './CommandPalette';
import { EditorArea } from './EditorArea';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
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
  bottomPanel: boolean;
  inspector: boolean;
}

export function V5Shell() {
  const { token } = theme.useToken();
  const { workspaces, activeWorkspaceId } = useWorkspaces();
  const { sources } = useSources();
  const { rules } = useHeaderRules();
  const { environments } = useEnvironments();
  const { switchState } = useWorkspaceSwitch();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const workspaceName = activeWorkspace?.name ?? 'Workspace';
  const [activePanel, setActivePanel] = useState<ActivityPanel>('items');
  const [panels, setPanels] = useState<PanelVisibility>({
    sidebar: true,
    bottomPanel: true,
    inspector: false,
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Tab management
  const { tabs, activeTabId, openTab, closeTab, switchTab, togglePin, canGoBack, canGoForward, goBack, goForward } =
    useTabs(activeWorkspaceId);

  const openSettings = useCallback(() => {
    openTab({ id: 'settings', type: 'settings', label: 'Settings', icon: 'settings' });
  }, [openTab]);

  const togglePanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(
    () => ({
      onToggleSidebar: () => togglePanel('sidebar'),
      onToggleBottomPanel: () => togglePanel('bottomPanel'),
      onToggleInspector: () => togglePanel('inspector'),
      onCommandPalette: () => setCommandPaletteOpen(true),
      onOpenSettings: openSettings,
    }),
    [togglePanel, openSettings],
  );
  useKeyboardShortcuts(shortcutHandlers);

  // Command palette items — real data + static commands
  const commandItems = useMemo(() => {
    const items = [];

    // Sources
    for (const source of sources) {
      items.push({
        id: `source-${source.sourceId}`,
        icon: '🔗',
        label: source.sourceName || source.sourcePath || 'Untitled Source',
        scope: source.sourceTag || 'Source',
        onSelect: () => {},
      });
    }

    // Rules
    for (const rule of rules) {
      items.push({
        id: `rule-${rule.id}`,
        icon: '⚡',
        label: rule.name || rule.headerName,
        scope: rule.isEnabled ? 'Rule (active)' : 'Rule (disabled)',
        onSelect: () => {},
      });
    }

    // Environments
    for (const envName of Object.keys(environments)) {
      items.push({
        id: `env-${envName}`,
        icon: '🌐',
        label: envName,
        scope: 'Environment',
        onSelect: () => {},
      });
    }

    // Commands (always last, prefixed with > in search)
    items.push(
      { id: 'cmd-new-request', icon: '▶', label: 'New Request', shortcut: '⌘N', onSelect: () => {} },
      { id: 'cmd-new-rule', icon: '⚡', label: 'New Rule', shortcut: '⇧⌘N', onSelect: () => {} },
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
  }, [sources, rules, environments, togglePanel, openSettings]);

  // Breadcrumbs for active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const breadcrumbs = activeTab ? [{ label: workspaceName }, { label: activeTab.label }] : [{ label: workspaceName }];

  return (
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
          {/* Activity Bar (always visible) */}
          <ActivityBar activePanel={activePanel} onPanelChange={setActivePanel} />

          {/* Resizable panels */}
          <Allotment proportionalLayout={false}>
            {/* Left Sidebar */}
            {panels.sidebar && (
              <Allotment.Pane preferredSize={230} minSize={180} maxSize={400}>
                <Sidebar activePanel={activePanel} onOpenTab={openTab} />
              </Allotment.Pane>
            )}

            {/* Center: Editor + Bottom Panel */}
            <Allotment.Pane>
              <Allotment vertical proportionalLayout={false}>
                {/* Editor Area */}
                <Allotment.Pane>
                  <div className="v5-editor-area" style={{ background: token.colorBgContainer }}>
                    <TabBar
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onSwitch={switchTab}
                      onClose={closeTab}
                      onTogglePin={togglePin}
                    />
                    <BreadcrumbBar segments={breadcrumbs} />
                    <EditorArea activeTab={activeTab} />
                  </div>
                </Allotment.Pane>

                {/* Bottom Panel */}
                {panels.bottomPanel && (
                  <Allotment.Pane preferredSize={200} minSize={100} maxSize={500}>
                    <BottomPanel />
                  </Allotment.Pane>
                )}
              </Allotment>
            </Allotment.Pane>

            {/* Right Sidebar (Inspector) */}
            {panels.inspector && (
              <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
                <Inspector />
              </Allotment.Pane>
            )}
          </Allotment>
        </div>

        {/* Status Bar */}
        <StatusBar panels={panels} onTogglePanel={togglePanel} />

        {/* Command Palette */}
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} items={commandItems} />
      </div>

      {/* Workspace Switch Overlay — outside blurred shell */}
      <WorkspaceSwitchOverlay visible={switchState.switching} targetWorkspace={switchState.targetWorkspace} />
    </>
  );
}
