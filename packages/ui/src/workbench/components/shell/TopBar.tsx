/**
 * TopBar — workspace chrome with command palette, env selector, and the
 * layout-control cluster (panel toggles + layout menu) sitting just left
 * of the settings gear.
 *
 * Layout: [Logo] [Title + Workspace] | [⌘K Search] | [Env] [Layout cluster] [Settings]
 */

import { InfoCircleOutlined, LayoutOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { Collection, Environment, ExtensionWorkspace } from '@openheaders/core/types';
import { Button, Dropdown, type MenuProps, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import {
  dockSlotLabelKey,
  LayoutMenuIcon,
  RegionToggle,
  resolveToolWindowLabel,
  SidebarLayoutIcon,
} from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import { hostAssets } from '@openheaders/core/assets';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ToolLayoutApi, WorkbenchViewState } from '../../hooks/useToolLayout';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { useEnvSwitcher } from '../../services/env-switcher';
import { useSetting, useSettingValue } from '../../settings/hooks';
import type {
  BottomPanelAlignmentSetting,
  BottomPanelSplitSetting,
  SidebarLayoutVariantSetting,
} from '../../settings/schema/workspace-layout';
import { TOOL_WINDOW_MAP } from '../../tool-windows';
import EnvironmentSelector from './EnvironmentSelector';
import { SettingsGearMenu } from '@openheaders/ui/shared/settings-menu';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';

interface TopBarProps {
  tl: ToolLayoutApi;
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
  onCommandPalette?: () => void;
  onOpenSettings?: (target?: { settingKey?: string; categoryId?: string }) => void;
  workspaces: ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  onSwitchWorkspace: (id: string, opts?: { makeActive?: boolean }) => void;
  onSetActiveWorkspace: (id: string) => Promise<boolean>;
  onOpenWorkspaceManager: () => void;
  onOpenBackendSettings: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: () => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onCreateEnvironment: () => void;
  onOpenEnvironment: (uid: string) => void;
  onOpenWorkspaceVariables: () => void;
  onOpenCollectionVariables: () => void;
  onOpenVault: () => void;
  onOpenLiveVariables: () => void;
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
  onOpenBackendSettings,
  onExportWorkspace,
  onImportWorkspace,
  environments,
  activeEnvironmentId,
  onCreateEnvironment,
  onOpenEnvironment,
  onOpenWorkspaceVariables,
  onOpenCollectionVariables,
  onOpenVault,
  onOpenLiveVariables,
  activeCollectionId,
  allCollections,
  onSetCollectionPinnedEnvs,
}) => {
  const { token } = theme.useToken();
  const t = useT();
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
  const [bottomPanelSplit, setBottomPanelSplit] = useSetting('workspaceLayout.bottomPanelSplit');
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
      {/* visibility (not conditional render) keeps the glyph's line box when
          unchecked, so the row height and text position never shift. */}
      <span style={{ width: 12, display: 'inline-block', visibility: checked ? 'visible' : 'hidden' }}>✓</span>
      {text}
    </Space>
  );

  const alignmentGlyph = (a: BottomPanelAlignmentSetting) =>
    a === 'justify' ? 'bottom-full' : a === 'left' ? 'bottom-left' : a === 'right' ? 'bottom-right' : 'bottom-nested';

  const splitGlyph = (s: BottomPanelSplitSetting) => (s === 'rows' ? 'bottom-split-rows' : 'bottom-split-columns');

  const layoutMenu: MenuProps['items'] = [
    {
      key: 'bottom-layout',
      icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(bottomPanelAlignment)} />),
      label: t('workbench.shell.topbar.layout.bottomLayout'),
      children: [
        ...(
          [
            { key: 'center', label: t('workbench.shell.topbar.layout.alignCenter') },
            { key: 'left', label: t('workbench.shell.topbar.layout.alignLeft') },
            { key: 'right', label: t('workbench.shell.topbar.layout.alignRight') },
            { key: 'justify', label: t('workbench.shell.topbar.layout.alignJustify') },
          ] as { key: BottomPanelAlignmentSetting; label: string }[]
        ).map((opt) => ({
          key: `bottom-${opt.key}`,
          icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
          label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
          onClick: () => setBottomPanelAlignment(opt.key),
        })),
        { type: 'divider' as const },
        ...(
          [
            { key: 'columns', label: t('workbench.shell.topbar.layout.splitColumns') },
            { key: 'rows', label: t('workbench.shell.topbar.layout.splitRows') },
          ] as { key: BottomPanelSplitSetting; label: string }[]
        ).map((opt) => ({
          key: `split-${opt.key}`,
          icon: menuIconWrap(<LayoutMenuIcon kind={splitGlyph(opt.key)} />),
          label: menuLabel(bottomPanelSplit === opt.key, opt.label),
          onClick: () => setBottomPanelSplit(opt.key),
        })),
      ],
    },
    {
      key: 'show-labels',
      icon: menuIconWrap(<LayoutMenuIcon kind={showLabelsSetting ? 'show-labels' : 'hide-labels'} />),
      label: menuLabel(showLabelsSetting, t('workbench.shell.topbar.layout.showToolWindowNames')),
      onClick: () => setShowLabels(!showLabelsSetting),
    },
    {
      key: 'sidebar-layout',
      icon: menuIconWrap(<SidebarLayoutIcon variant={sidebarLayout} />),
      label: t('workbench.shell.topbar.layout.activityBarLayout'),
      children: (
        [
          { key: 'proportional', label: t('workbench.shell.topbar.layout.sidebarProportional') },
          { key: 'compact', label: t('workbench.shell.topbar.layout.sidebarCompact') },
          { key: 'stacked', label: t('workbench.shell.topbar.layout.sidebarStacked') },
          { key: 'dynamic', label: t('workbench.shell.topbar.layout.sidebarDynamic') },
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
      icon: menuIconWrap(<LayoutMenuIcon kind="layout-default" />),
      label: (
        <Space size={6}>
          <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {perTab.isDonor
              ? t('workbench.shell.topbar.layout.defaultLayoutDonor', { unit: instanceLabel() })
              : t('workbench.shell.topbar.layout.inheritsDefault')}
          </span>
          <Tooltip
            trigger={['hover', 'click']}
            title={
              perTab.isDonor
                ? t('workbench.shell.topbar.layout.donorTooltip', {
                    unit: instanceLabel(),
                    units: instanceLabelPlural(),
                  })
                : t('workbench.shell.topbar.layout.nonDonorTooltip', {
                    unit: instanceLabel(),
                    units: instanceLabelPlural(),
                  })
            }
          >
            <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      disabled: true,
    },
    {
      key: 'reset-layout',
      icon: menuIconWrap(<ReloadOutlined style={{ fontSize: 12 }} />),
      label: t('workbench.shell.topbar.layout.resetToDefaults'),
      onClick: () => perTab.resetToDefaults(),
    },
    { type: 'divider' },
    {
      key: 'restore',
      icon: menuIconWrap(<LayoutMenuIcon kind="restore-hidden" />),
      label: t('workbench.shell.topbar.layout.restoreHidden'),
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
                    <span>{resolveToolWindowLabel(def, t)}</span>
                    <span style={{ color: token.colorTextTertiary, fontSize: 10 }}>
                      → {t(dockSlotLabelKey(def.defaultSlot, bottomPanelSplit))}
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
          src={hostAssets.resolveUrl('images/logo-pixel.svg')}
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
          onOpenBackendSettings={onOpenBackendSettings}
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
              {t('workbench.shell.topbar.search')}
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
          onOpenLiveVariables={onOpenLiveVariables}
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
                title={
                  <ShortcutHintTitle label={toggleLeftSidebarLabel}>
                    {t('workbench.shell.topbar.toggle.leftSidebar')}
                  </ShortcutHintTitle>
                }
                ariaTitle={t('workbench.shell.topbar.toggle.leftSidebar')}
                active={tl.isRegionOpen('left')}
                position="left"
                onClick={() => tl.toggleRegion('left')}
              />
              <RegionToggle
                title={
                  <ShortcutHintTitle label={toggleBottomPanelLabel}>
                    {t('workbench.shell.topbar.toggle.bottomPanel')}
                  </ShortcutHintTitle>
                }
                ariaTitle={t('workbench.shell.topbar.toggle.bottomPanel')}
                active={tl.isRegionOpen('bottom')}
                position="bottom"
                onClick={() => tl.toggleRegion('bottom')}
              />
              <RegionToggle
                title={
                  <ShortcutHintTitle label={toggleRightSidebarLabel}>
                    {t('workbench.shell.topbar.toggle.rightSidebar')}
                  </ShortcutHintTitle>
                }
                ariaTitle={t('workbench.shell.topbar.toggle.rightSidebar')}
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
                  items: [
                    ...(
                      [
                        { key: 'center', label: t('workbench.shell.topbar.layout.alignCenter') },
                        { key: 'left', label: t('workbench.shell.topbar.layout.alignLeft') },
                        { key: 'right', label: t('workbench.shell.topbar.layout.alignRight') },
                        { key: 'justify', label: t('workbench.shell.topbar.layout.alignJustify') },
                      ] as { key: BottomPanelAlignmentSetting; label: string }[]
                    ).map((opt) => ({
                      key: `topbar-bottom-${opt.key}`,
                      icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
                      label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
                      onClick: () => setBottomPanelAlignment(opt.key),
                    })),
                    { type: 'divider' as const },
                    ...(
                      [
                        { key: 'columns', label: t('workbench.shell.topbar.layout.splitColumns') },
                        { key: 'rows', label: t('workbench.shell.topbar.layout.splitRows') },
                      ] as { key: BottomPanelSplitSetting; label: string }[]
                    ).map((opt) => ({
                      key: `topbar-split-${opt.key}`,
                      icon: menuIconWrap(<LayoutMenuIcon kind={splitGlyph(opt.key)} />),
                      label: menuLabel(bottomPanelSplit === opt.key, opt.label),
                      onClick: () => setBottomPanelSplit(opt.key),
                    })),
                  ],
                }}
              >
                <Tooltip
                  title={
                    bottomPanelAlignment === 'center'
                      ? t('workbench.shell.topbar.bottomAlign.center')
                      : bottomPanelAlignment === 'left'
                        ? t('workbench.shell.topbar.bottomAlign.left')
                        : bottomPanelAlignment === 'right'
                          ? t('workbench.shell.topbar.bottomAlign.right')
                          : t('workbench.shell.topbar.bottomAlign.justify')
                  }
                  placement="bottom"
                  open={bottomAlignDropdownOpen ? false : undefined}
                >
                  <div
                    className="rules-panel-toggle"
                    role="button"
                    tabIndex={0}
                    aria-label={t('workbench.shell.topbar.bottomAlign.chooseAria')}
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
              <Tooltip title={t('workbench.shell.topbar.layoutOptions')} open={layoutMenuOpen ? false : undefined}>
                <div
                  className="rules-topbar-item rules-layout-toggle"
                  role="button"
                  tabIndex={0}
                  aria-label={t('workbench.shell.topbar.layoutOptions')}
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
        {onOpenSettings && <SettingsGearMenu onOpenSettings={onOpenSettings} openSettingsLabel={openSettingsLabel} />}
      </div>
    </div>
  );
};

export default TopBar;
