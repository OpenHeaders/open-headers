/**
 * TopBar — workspace chrome with command palette, env selector, and the
 * layout-control cluster (panel toggles + layout menu) sitting just left
 * of the settings gear.
 *
 * Layout: [Logo] [Title + Workspace] | [⌘K Search] | [Env] [Layout cluster] [Settings]
 */

import { LayoutOutlined, ReloadOutlined, SearchOutlined, SettingOutlined, ShareAltOutlined } from '@ant-design/icons';
import type { Collection, Environment, ExtensionWorkspace } from '@openheaders/core/types';
import { Button, Dropdown, type MenuProps, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { LayoutMenuIcon, RegionToggle, SidebarLayoutIcon } from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import { getBrowserAPI } from '@/types/browser';
import type { ToolLayoutApi, WorkbenchViewState } from '../hooks/useToolLayout';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import { useEnvSwitcher } from '../services/env-switcher';
import { useSetting, useSettingValue } from '../settings/hooks';
import type { BottomPanelAlignmentSetting, SidebarLayoutVariantSetting } from '../settings/schema/workspace-layout';
import { DOCK_LABELS, TOOL_WINDOW_MAP } from '../tool-windows';
import EnvironmentSelector from './EnvironmentSelector';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface TopBarProps {
  tl: ToolLayoutApi;
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
  onCommandPalette?: () => void;
  onOpenSettings?: () => void;
  workspaces: ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  onSwitchWorkspace: (id: string, opts?: { makeActive?: boolean }) => void;
  onSetActiveWorkspace: (id: string) => Promise<boolean>;
  onOpenWorkspaceManager: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: () => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onCreateEnvironment: () => void;
  onOpenEnvironment: (uid: string) => void;
  onOpenWorkspaceVariables: () => void;
  onOpenCollectionVariables: () => void;
  onOpenVault: () => void;
  activeCollectionId: string | null;
  allCollections: Collection[];
  onSetCollectionPinnedEnvs: (collectionUid: string, pinnedIds: string[], defaultId: string | null) => Promise<boolean>;
}

const TopBar: React.FC<TopBarProps> = ({
  tl,
  perTab,
  onCommandPalette,
  onOpenSettings,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onSetActiveWorkspace,
  onOpenWorkspaceManager,
  onExportWorkspace,
  onImportWorkspace,
  environments,
  activeEnvironmentId,
  onCreateEnvironment,
  onOpenEnvironment,
  onOpenWorkspaceVariables,
  onOpenCollectionVariables,
  onOpenVault,
  activeCollectionId,
  allCollections,
  onSetCollectionPinnedEnvs,
}) => {
  const { token } = theme.useToken();
  const { pickActiveEnvironment } = useEnvSwitcher();
  const commandPaletteLabel = useShortcutLabel('command-palette');
  const openSettingsLabel = useShortcutLabel('open-settings');
  const toggleLeftSidebarLabel = useShortcutLabel('toggle-left-sidebar');
  const toggleBottomPanelLabel = useShortcutLabel('toggle-bottom-panel');
  const toggleRightSidebarLabel = useShortcutLabel('toggle-right-sidebar');

  // Mirror the live per-rail activity-bar widths onto the topbar's
  // outer grid tracks so the logo centers over the left bar, the
  // product name starts at the left dock edge, and the settings icon
  // centers over the right bar — independent of which docks are open
  // and of how the user has resized either rail. In icon-only mode
  // the bars are pinned to 36px regardless of the stored width.
  const showLabels = useSettingValue('workspaceLayout.showToolWindowLabels');
  const barWidthLeft = useSettingValue('workspaceLayout.activityBarWidthLeft');
  const barWidthRight = useSettingValue('workspaceLayout.activityBarWidthRight');
  const activityBarWidthLeft = showLabels ? barWidthLeft : 36;
  const activityBarWidthRight = showLabels ? barWidthRight : 36;

  const showPanelToggles = useSettingValue('workspaceLayout.topbarShowPanelToggles');
  const showLayoutMenu = useSettingValue('workspaceLayout.topbarShowLayoutMenu');
  const [bottomPanelAlignment, setBottomPanelAlignment] = useSetting('workspaceLayout.bottomPanelAlignment');
  const [showLabelsSetting, setShowLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const [sidebarLayout, setSidebarLayout] = useSetting('workspaceLayout.sidebarLayout');

  // The layout menu stays open across item clicks so the user can A/B
  // different combinations without reopening. antd's Dropdown signals
  // menu-item vs trigger clicks via `info.source` — we only close on
  // trigger / outside-click, never on `menu`.
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [menuOpenKeys, setMenuOpenKeys] = useState<string[]>([]);
  const handleLayoutOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setLayoutMenuOpen(nextOpen);
    if (!nextOpen) setMenuOpenKeys([]);
  };
  const handleMenuClick: NonNullable<MenuProps['onClick']> = ({ keyPath }) => {
    if (keyPath.length > 1) {
      const parentKey = keyPath[1];
      requestAnimationFrame(() => {
        setMenuOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
      });
    }
  };

  const [bottomAlignDropdownOpen, setBottomAlignDropdownOpen] = useState(false);
  const handleBottomAlignOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setBottomAlignDropdownOpen(nextOpen);
  };

  const menuIconWrap = (node: React.ReactNode) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 18,
      }}
    >
      {node}
    </span>
  );

  const menuLabel = (checked: boolean, text: React.ReactNode) => (
    <Space size={6}>
      <span style={{ width: 12, display: 'inline-block' }}>{checked ? '✓' : ''}</span>
      {text}
    </Space>
  );

  const alignmentGlyph = (a: BottomPanelAlignmentSetting) =>
    a === 'justify' ? 'bottom-full' : a === 'left' ? 'bottom-left' : a === 'right' ? 'bottom-right' : 'bottom-nested';

  const layoutMenu: MenuProps['items'] = [
    {
      key: 'bottom-alignment',
      icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(bottomPanelAlignment)} />),
      label: 'Bottom Panel Alignment',
      children: (
        [
          { key: 'center', label: 'Center (nested)' },
          { key: 'left', label: 'Left' },
          { key: 'right', label: 'Right' },
          { key: 'justify', label: 'Justify (full width)' },
        ] as { key: BottomPanelAlignmentSetting; label: string }[]
      ).map((opt) => ({
        key: `bottom-${opt.key}`,
        icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
        label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
        onClick: () => setBottomPanelAlignment(opt.key),
      })),
    },
    {
      key: 'show-labels',
      icon: menuIconWrap(<LayoutMenuIcon kind={showLabelsSetting ? 'show-labels' : 'hide-labels'} />),
      label: menuLabel(showLabelsSetting, 'Show Tool Window Names'),
      onClick: () => setShowLabels(!showLabelsSetting),
    },
    {
      key: 'sidebar-layout',
      icon: menuIconWrap(<SidebarLayoutIcon variant={sidebarLayout} />),
      label: 'Activity Bar Layout',
      children: (
        [
          { key: 'proportional', label: 'Proportional (even halves)' },
          { key: 'compact', label: 'Compact (bottom pinned)' },
          { key: 'stacked', label: 'Stacked (all at top)' },
          { key: 'dynamic', label: 'Dynamic (follows panel heights)' },
        ] as { key: SidebarLayoutVariantSetting; label: string }[]
      ).map((opt) => ({
        key: `sidebar-${opt.key}`,
        icon: menuIconWrap(<SidebarLayoutIcon variant={opt.key} />),
        label: menuLabel(sidebarLayout === opt.key, opt.label),
        onClick: () => setSidebarLayout(opt.key),
      })),
    },
    { type: 'divider' },
    {
      key: 'inheritance-info',
      icon: menuIconWrap(<ShareAltOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />),
      label: (
        <span style={{ fontSize: 11, color: token.colorTextSecondary, whiteSpace: 'normal', lineHeight: 1.4 }}>
          {perTab.isDonor
            ? `This ${instanceLabel()} is the default — new ${instanceLabelPlural()} inherit this layout.`
            : `Another ${instanceLabel()} is the default — new ${instanceLabelPlural()} inherit from there.`}
        </span>
      ),
      disabled: true,
    },
    {
      key: 'reset-layout',
      icon: menuIconWrap(<ReloadOutlined style={{ fontSize: 12 }} />),
      label: 'Reset layout to defaults',
      onClick: () => perTab.resetToDefaults(),
    },
    { type: 'divider' },
    {
      key: 'restore',
      icon: menuIconWrap(<LayoutMenuIcon kind="restore-hidden" />),
      label: 'Restore Hidden Activity Bar Tools',
      disabled: tl.state.hidden.length === 0,
      children:
        tl.state.hidden.length === 0
          ? undefined
          : tl.state.hidden.map((id) => {
              const def = TOOL_WINDOW_MAP[id];
              return {
                key: `restore-${id}`,
                icon: menuIconWrap(def.icon),
                label: (
                  <Space size={6}>
                    <span>{def.label}</span>
                    <span style={{ color: token.colorTextTertiary, fontSize: 10 }}>
                      → {DOCK_LABELS[def.defaultSlot]}
                    </span>
                  </Space>
                ),
                onClick: () => tl.restoreWindow(id),
              };
            }),
    },
  ];

  return (
    <div
      className="rules-topbar"
      style={
        {
          background: token.colorBgLayout,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          // Drives the grid column widths in rules.less — keeps the
          // topbar's outer slots exactly aligned with the activity bars.
          '--ab-width-left': `${activityBarWidthLeft}px`,
          '--ab-width-right': `${activityBarWidthRight}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="rules-topbar-logo-slot"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <img
          src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
          alt="Open Headers"
          className="rules-topbar-logo"
        />
      </div>
      <div className="rules-topbar-left">
        <span className="rules-topbar-title rules-topbar-title-full">Open Headers</span>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitch={onSwitchWorkspace}
          setActiveWorkspace={onSetActiveWorkspace}
          onOpenManager={onOpenWorkspaceManager}
          onExport={onExportWorkspace}
          onImport={onImportWorkspace}
        />
      </div>

      <div aria-hidden />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
        <Button
          className="rules-topbar-search"
          type="text"
          onClick={onCommandPalette}
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space size={4}>
            <SearchOutlined style={{ color: token.colorTextTertiary }} />
            <span className="rules-topbar-search-label" style={{ color: token.colorTextTertiary }}>
              Search or run a command...
            </span>
            <kbd
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: token.colorBgElevated,
                color: token.colorTextTertiary,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {commandPaletteLabel}
            </kbd>
          </Space>
        </Button>
      </div>

      <div aria-hidden />

      <div className="rules-topbar-right">
        <EnvironmentSelector
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onSwitch={pickActiveEnvironment}
          onCreateEnvironment={onCreateEnvironment}
          onOpenEnvironment={onOpenEnvironment}
          onOpenWorkspaceVariables={onOpenWorkspaceVariables}
          onOpenCollectionVariables={onOpenCollectionVariables}
          onOpenVault={onOpenVault}
          activeCollectionId={activeCollectionId}
          activeCollectionPinnedEnvIds={
            allCollections.find((c) => c.uid === activeCollectionId)?.pinnedEnvironmentIds ?? []
          }
          activeCollectionDefaultEnvId={
            allCollections.find((c) => c.uid === activeCollectionId)?.defaultEnvironmentId ?? null
          }
          onSetCollectionPinnedEnvs={onSetCollectionPinnedEnvs}
        />
        {showPanelToggles && (
          <>
            <div
              className="rules-topbar-divider rules-topbar-divider-toggles"
              style={{ background: token.colorBorder }}
            />
            <div className="rules-panel-toggles">
              <RegionToggle
                title={<ShortcutHintTitle label={toggleLeftSidebarLabel}>Left sidebar</ShortcutHintTitle>}
                ariaTitle="Left sidebar"
                active={tl.isRegionOpen('left')}
                position="left"
                onClick={() => tl.toggleRegion('left')}
              />
              <RegionToggle
                title={<ShortcutHintTitle label={toggleBottomPanelLabel}>Bottom panel</ShortcutHintTitle>}
                ariaTitle="Bottom panel"
                active={tl.isRegionOpen('bottom')}
                position="bottom"
                onClick={() => tl.toggleRegion('bottom')}
              />
              <RegionToggle
                title={<ShortcutHintTitle label={toggleRightSidebarLabel}>Right sidebar</ShortcutHintTitle>}
                ariaTitle="Right sidebar"
                active={tl.isRegionOpen('right')}
                position="right"
                onClick={() => tl.toggleRegion('right')}
              />
              <Dropdown
                placement="bottomRight"
                trigger={['click']}
                open={bottomAlignDropdownOpen}
                onOpenChange={handleBottomAlignOpenChange}
                menu={{
                  items: (
                    [
                      { key: 'center', label: 'Center (nested)' },
                      { key: 'left', label: 'Left' },
                      { key: 'right', label: 'Right' },
                      { key: 'justify', label: 'Justify (full width)' },
                    ] as { key: BottomPanelAlignmentSetting; label: string }[]
                  ).map((opt) => ({
                    key: `topbar-bottom-${opt.key}`,
                    icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
                    label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
                    onClick: () => setBottomPanelAlignment(opt.key),
                  })),
                }}
              >
                <Tooltip
                  title={
                    bottomPanelAlignment === 'center'
                      ? 'Bottom panel: center (nested)'
                      : bottomPanelAlignment === 'left'
                        ? 'Bottom panel: left-aligned'
                        : bottomPanelAlignment === 'right'
                          ? 'Bottom panel: right-aligned'
                          : 'Bottom panel: full width'
                  }
                  placement="bottom"
                  open={bottomAlignDropdownOpen ? false : undefined}
                >
                  <div
                    className="rules-panel-toggle"
                    role="button"
                    tabIndex={0}
                    aria-label="Choose bottom panel alignment"
                  >
                    <LayoutMenuIcon kind={alignmentGlyph(bottomPanelAlignment)} size={16} />
                  </div>
                </Tooltip>
              </Dropdown>
            </div>
          </>
        )}
        {showLayoutMenu && (
          <>
            <div className="rules-topbar-divider" style={{ background: token.colorBorder }} />
            <Dropdown
              menu={{
                items: layoutMenu,
                openKeys: menuOpenKeys,
                onOpenChange: setMenuOpenKeys,
                onClick: handleMenuClick,
              }}
              placement="bottomRight"
              trigger={['click']}
              open={layoutMenuOpen}
              onOpenChange={handleLayoutOpenChange}
            >
              <Tooltip title="Layout options">
                <div
                  className="rules-topbar-item rules-layout-toggle"
                  role="button"
                  tabIndex={0}
                  aria-label="Layout options"
                  style={{ cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  <LayoutOutlined style={{ fontSize: 13 }} />
                </div>
              </Tooltip>
            </Dropdown>
          </>
        )}
      </div>
      <div
        className="rules-topbar-settings-slot"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Tooltip title={<ShortcutHintTitle label={openSettingsLabel}>Settings</ShortcutHintTitle>}>
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar;
