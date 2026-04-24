import { BulbFilled, BulbOutlined, LayoutOutlined } from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import { Dropdown, type MenuProps, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import type { DockLayoutApi } from '@/shared/dock-layout';
import { DOCK_LABELS, DockSlotIcon, LayoutMenuIcon, RegionToggle, SidebarLayoutIcon } from '@/shared/dock-layout';
import { useSetting, useSettingValue } from '@/workbench/settings/hooks';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from '../data/tool-windows';

type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; text: string; color: string }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, text: 'Light', color: '#faad14' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, text: 'Dark', color: '#722ed1' },
  auto: { icon: <span style={{ fontSize: 12 }}>{'◐'}</span>, text: 'Auto', color: '#1890ff' },
};

interface PanelStatusBarProps {
  tl: DockLayoutApi<PanelToolWindowId>;
  requestCount: number;
  transferredSize: string;
  resourceSize: string;
  finishTime: string;
  dclMs?: number;
  loadMs?: number;
  tabCount: number;
}

function formatTiming(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const PanelStatusBar: React.FC<PanelStatusBarProps> = ({
  tl,
  requestCount,
  transferredSize,
  resourceSize,
  finishTime,
  dclMs,
  loadMs,
  tabCount,
}) => {
  const { token } = theme.useToken();
  const { themeMode, setThemeMode } = useTheme();

  const showThemeSwitcher = useSettingValue('devpanelLayout.footerShowThemeSwitcher');
  const showPanelToggles = useSettingValue('devpanelLayout.footerShowPanelToggles');
  const showLayoutMenu = useSettingValue('devpanelLayout.footerShowLayoutMenu');
  const [bottomPanelAlignment, setBottomPanelAlignment] = useSetting('devpanelLayout.bottomPanelAlignment');
  const [showLabels, setShowLabels] = useSetting('devpanelLayout.showToolWindowLabels');
  const [sidebarLayout, setSidebarLayout] = useSetting('devpanelLayout.sidebarLayout');
  const toggleLabels = useCallback(() => setShowLabels(!showLabels), [showLabels, setShowLabels]);

  // Keep the layout Dropdown open across item clicks so the user can A/B
  // combinations; close only on trigger re-click or outside-click.
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const handleLayoutOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setLayoutMenuOpen(nextOpen);
    if (!nextOpen) setMenuOpenKeys([]);
  };

  const [menuOpenKeys, setMenuOpenKeys] = useState<string[]>([]);
  const handleMenuClick: NonNullable<MenuProps['onClick']> = ({ keyPath }) => {
    if (keyPath.length > 1) {
      const parentKey = keyPath[1];
      requestAnimationFrame(() => {
        setMenuOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
      });
    }
  };

  // Controlled state for the footer's quick alignment picker — mirrors
  // the workspace footer so users can A/B alignments without the menu
  // auto-closing on each selection.
  const [bottomAlignDropdownOpen, setBottomAlignDropdownOpen] = useState(false);
  const handleBottomAlignOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setBottomAlignDropdownOpen(nextOpen);
  };

  const menuIconWrap = (node: React.ReactNode) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
      {node}
    </span>
  );

  const menuLabel = (checked: boolean, text: React.ReactNode) => (
    <Space size={6}>
      <span style={{ width: 12, display: 'inline-block' }}>{checked ? '✓' : ''}</span>
      {text}
    </Space>
  );

  type SidebarLayoutVariantSetting = 'proportional' | 'compact' | 'stacked' | 'dynamic';
  type BottomPanelAlignmentSetting = 'center' | 'left' | 'right' | 'justify';

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
              const def = PANEL_TOOL_WINDOW_MAP[id];
              return {
                key: `restore-${id}`,
                icon: menuIconWrap(<DockSlotIcon slot={def.defaultSlot} size={20} />),
                label: (
                  <Space size={6}>
                    <span>{def.label}</span>
                    <span style={{ color: token.colorTextTertiary, fontSize: 10 }}>
                      {'→'} {DOCK_LABELS[def.defaultSlot]}
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
      style={{
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorTextSecondary,
      }}
    >
      <div className="rules-statusbar-left">
        <span className="rules-statusbar-item">
          {requestCount} request{requestCount === 1 ? '' : 's'}
        </span>
        <span className="rules-statusbar-item">
          {transferredSize} transferred
          {resourceSize && resourceSize !== transferredSize ? ` / ${resourceSize} resources` : ''}
        </span>
        {finishTime && <span className="rules-statusbar-item">Finish: {finishTime}</span>}
        {formatTiming(dclMs) && (
          <span className="rules-statusbar-item" style={{ color: '#1a73e8' }} title="DOMContentLoaded">
            DOMContentLoaded: {formatTiming(dclMs)}
          </span>
        )}
        {formatTiming(loadMs) && (
          <span className="rules-statusbar-item" style={{ color: '#d93025' }} title="Load event">
            Load: {formatTiming(loadMs)}
          </span>
        )}
        {tabCount > 0 && (
          <span className="rules-statusbar-item">
            {tabCount} tab{tabCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="rules-statusbar-right">
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
                      {themeMode === mode && <span style={{ marginLeft: 4 }}>{'✓'}</span>}
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
            {(showPanelToggles || showLayoutMenu) && (
              <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
            )}
          </>
        )}
        {showPanelToggles && (
          <>
            <div className="rules-panel-toggles">
              <RegionToggle
                title="Left sidebar"
                ariaTitle="Left sidebar"
                active={tl.isRegionOpen('left')}
                position="left"
                onClick={() => tl.toggleRegion('left')}
              />
              <RegionToggle
                title="Bottom panel"
                ariaTitle="Bottom panel"
                active={tl.isRegionOpen('bottom')}
                position="bottom"
                onClick={() => tl.toggleRegion('bottom')}
              />
              <RegionToggle
                title="Right sidebar"
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
            {showLayoutMenu && (
              <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
            )}
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
      </div>
    </div>
  );
};

export default PanelStatusBar;
