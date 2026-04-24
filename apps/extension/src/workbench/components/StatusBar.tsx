/**
 * StatusBar — bottom bar with status info, theme dropdown, and a
 * LayoutOutlined menu that controls the tool-window shell.
 *
 * Every right-side affordance (version, theme switcher, panel toggles,
 * layout menu) is gated by a `workspaceLayout.footerShow*` setting so
 * the user can prune the footer from the Settings page. The layout
 * menu itself writes to the same `workspaceLayout.*` settings that
 * the Settings page exposes, so both surfaces stay in sync.
 */

import { BulbFilled, BulbOutlined, LayoutOutlined } from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import { Dropdown, type MenuProps, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { LayoutMenuIcon, RegionToggle, SidebarLayoutIcon } from '@/shared/dock-layout';
import { productStatusExtras, StatusPill } from '@/shared/status';
import { useInspectorNav } from '../hooks/useInspectorNav';
import type { ToolLayoutApi } from '../hooks/useToolLayout';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import { useSetting, useSettingValue } from '../settings/hooks';
import type { BottomPanelAlignmentSetting, SidebarLayoutVariantSetting } from '../settings/schema/workspace-layout';
import { DOCK_LABELS, TOOL_WINDOW_MAP } from '../tool-windows';
import BreadcrumbBar from './BreadcrumbBar';
import { renderWorkspacePrefix } from './workspace-prefix';

type ThemeMode = 'light' | 'dark' | 'auto';

declare const __APP_VERSION__: string;

interface StatusBarProps {
  tl: ToolLayoutApi;
  /** Active workspace — renders as the leading breadcrumb chip (icon + name). */
  workspace?: { name: string; icon?: string; color?: string };
  /** Breadcrumb path of the focused-leaf active tab (excluding workspace). */
  segments: string[];
  onRename?: (newName: string) => void;
  autoRenameKey?: string | null;
}

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; text: string; color: string }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, text: 'Light', color: '#faad14' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, text: 'Dark', color: '#722ed1' },
  auto: { icon: <span style={{ fontSize: 12 }}>&#x25D0;</span>, text: 'Auto', color: '#1890ff' },
};

const StatusBar: React.FC<StatusBarProps> = ({ tl, workspace, segments, onRename, autoRenameKey }) => {
  const { token } = theme.useToken();
  const { themeMode, setThemeMode } = useTheme();
  // Mirror TopBar: the footer's left padding expands/contracts with the
  // activity bar so the breadcrumb starts at the same X as "Open Headers"
  // above it, regardless of whether tool-window labels are on.
  const showToolWindowLabels = useSettingValue('workspaceLayout.showToolWindowLabels');
  const activityBarWidth = showToolWindowLabels ? 64 : 36;
  const { openDocs } = useInspectorNav();
  const toggleSidebarLabel = useShortcutLabel('toggle-sidebar');
  const toggleBottomLabel = useShortcutLabel('toggle-bottom');
  const toggleInspectorLabel = useShortcutLabel('toggle-inspector');

  // Footer visibility + shell-behavior settings. The layout menu writes
  // directly to the shell-behavior settings, so ShellLayout and the
  // Settings page see the same values immediately.
  const showVersion = useSettingValue('workspaceLayout.footerShowVersion');
  const showThemeSwitcher = useSettingValue('workspaceLayout.footerShowThemeSwitcher');
  const showPanelToggles = useSettingValue('workspaceLayout.footerShowPanelToggles');
  const showLayoutMenu = useSettingValue('workspaceLayout.footerShowLayoutMenu');
  const [bottomPanelAlignment, setBottomPanelAlignment] = useSetting('workspaceLayout.bottomPanelAlignment');
  const [showLabels, setShowLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const [sidebarLayout, setSidebarLayout] = useSetting('workspaceLayout.sidebarLayout');
  const toggleLabels = useCallback(() => setShowLabels(!showLabels), [showLabels, setShowLabels]);

  // The layout menu stays open across item clicks so the user can A/B
  // different combinations without reopening. antd's Dropdown signals
  // menu-item vs trigger clicks via `info.source` — we only close on
  // trigger / outside-click, never on `menu`.
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const handleLayoutOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setLayoutMenuOpen(nextOpen);
    // Reset submenu keys when the Dropdown closes so the next open
    // starts clean (no auto-expanded submenus).
    if (!nextOpen) setMenuOpenKeys([]);
  };

  // Submenu open state, controlled so we can keep a submenu expanded
  // across an item click (antd's default is to collapse on click).
  // Default [] means hover-to-expand behaves normally.
  // The footer bottom-panel-alignment dropdown:
  // - Forces the tooltip closed when open (otherwise both pop up on the
  //   same click and overlap).
  // - Stays open when the user clicks a menu item (antd signals that via
  //   `info.source === 'menu'`) so they can A/B alignments in place,
  //   matching the main layout dropdown's behavior.
  const [bottomAlignDropdownOpen, setBottomAlignDropdownOpen] = useState(false);
  const handleBottomAlignOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setBottomAlignDropdownOpen(nextOpen);
  };

  const [menuOpenKeys, setMenuOpenKeys] = useState<string[]>([]);
  const handleMenuClick: NonNullable<MenuProps['onClick']> = ({ keyPath }) => {
    // keyPath is [leafKey, parentSubmenuKey, ...grandparents]. If the
    // click was inside a submenu, antd will fire onOpenChange right
    // after to close it — we re-add the parent key on the next frame
    // so the submenu stays visible for A/B comparison.
    if (keyPath.length > 1) {
      const parentKey = keyPath[1];
      requestAnimationFrame(() => {
        setMenuOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
      });
    }
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

  // Map alignment value → the matching LayoutMenuIcon glyph so both the
  // submenu and the footer quick-toggle stay visually in sync.
  const alignmentGlyph = (a: BottomPanelAlignmentSetting) =>
    a === 'justify'
      ? 'bottom-full'
      : a === 'left'
        ? 'bottom-left'
        : a === 'right'
          ? 'bottom-right'
          : 'bottom-nested';

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
      icon: menuIconWrap(<LayoutMenuIcon kind={showLabels ? 'show-labels' : 'hide-labels'} />),
      label: menuLabel(showLabels, 'Show Tool Window Names'),
      onClick: toggleLabels,
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
      className="rules-statusbar"
      style={
        {
          background: token.colorBgLayout,
          color: token.colorTextSecondary,
          '--ab-width': `${activityBarWidth}px`,
        } as React.CSSProperties
      }
    >
      <div className="rules-statusbar-left">
        <BreadcrumbBar
          leadingNode={
            workspace ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {renderWorkspacePrefix(
                  { icon: workspace.icon, color: workspace.color },
                  token,
                  { size: 14 },
                )}
                <span
                  style={{
                    color: token.colorTextTertiary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {workspace.name}
                </span>
              </span>
            ) : undefined
          }
          segments={segments}
          onRename={onRename}
          autoRenameKey={autoRenameKey}
        />
      </div>

      <div className="rules-statusbar-right">
        <StatusPill
          density="compact"
          label="System status"
          renderSubsystemExtras={productStatusExtras}
          onOpenDocs={openDocs}
        />
        <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
        {showThemeSwitcher && (
          <>
            <Dropdown
              menu={{
                items: (['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => ({
                  key: mode,
                  label: (
                    <Space size={4}>
                      {THEME_DISPLAY[mode].icon}
                      <span>{THEME_DISPLAY[mode].text}</span>
                      {themeMode === mode && <span style={{ marginLeft: 4 }}>&#x2713;</span>}
                    </Space>
                  ),
                  onClick: () => setThemeMode(mode),
                })) as MenuProps['items'],
              }}
              placement="topRight"
              trigger={['click']}
            >
              <div
                className="rules-statusbar-item"
                role="button"
                tabIndex={0}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: THEME_DISPLAY[themeMode as ThemeMode]?.color,
                }}
              >
                {THEME_DISPLAY[themeMode as ThemeMode]?.icon}
                <span style={{ fontSize: 10 }}>{THEME_DISPLAY[themeMode as ThemeMode]?.text}</span>
              </div>
            </Dropdown>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
          </>
        )}
        {showPanelToggles && (
          <>
            <div className="rules-panel-toggles">
              <RegionToggle
                title={<ShortcutHintTitle label={toggleSidebarLabel}>Left sidebar</ShortcutHintTitle>}
                ariaTitle="Left sidebar"
                active={tl.isRegionOpen('left')}
                position="left"
                onClick={() => tl.toggleRegion('left')}
              />
              <RegionToggle
                title={<ShortcutHintTitle label={toggleBottomLabel}>Bottom panel</ShortcutHintTitle>}
                ariaTitle="Bottom panel"
                active={tl.isRegionOpen('bottom')}
                position="bottom"
                onClick={() => tl.toggleRegion('bottom')}
              />
              <RegionToggle
                title={<ShortcutHintTitle label={toggleInspectorLabel}>Right sidebar</ShortcutHintTitle>}
                ariaTitle="Right sidebar"
                active={tl.isRegionOpen('right')}
                position="right"
                onClick={() => tl.toggleRegion('right')}
              />
              <Dropdown
                placement="topRight"
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
                    key: `footer-bottom-${opt.key}`,
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
                  placement="top"
                  // Force closed while the Dropdown is open; undefined
                  // lets antd handle hover normally when it isn't.
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
            <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
          </>
        )}
        {showLayoutMenu && (
          <Dropdown
            menu={{
              items: layoutMenu,
              openKeys: menuOpenKeys,
              onOpenChange: setMenuOpenKeys,
              onClick: handleMenuClick,
            }}
            placement="topRight"
            trigger={['click']}
            open={layoutMenuOpen}
            onOpenChange={handleLayoutOpenChange}
          >
            <div
              className="rules-statusbar-item rules-layout-toggle"
              role="button"
              tabIndex={0}
              aria-label="Layout options"
              style={{ cursor: 'pointer', padding: '0 4px' }}
            >
              <LayoutOutlined style={{ fontSize: 13 }} />
            </div>
          </Dropdown>
        )}
        {showVersion && (
          <>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
            <span className="rules-statusbar-item" style={{ fontSize: 10, color: token.colorTextTertiary }}>
              v{__APP_VERSION__}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
