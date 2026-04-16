import { BulbFilled, BulbOutlined, LayoutOutlined } from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import { Dropdown, type MenuProps, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useSetting } from '@/rules/settings/hooks';
import type { DockLayoutApi } from '@/shared/dock-layout';
import { DOCK_LABELS, DockSlotIcon, LayoutMenuIcon, SidebarLayoutIcon } from '@/shared/dock-layout';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from '../data/tool-windows';

type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; text: string; color: string }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, text: 'Light', color: '#faad14' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, text: 'Dark', color: '#722ed1' },
  auto: { icon: <span style={{ fontSize: 12 }}>{'\u25D0'}</span>, text: 'Auto', color: '#1890ff' },
};

function RegionToggle({
  title,
  ariaTitle,
  active,
  position,
  onClick,
}: {
  title: React.ReactNode;
  ariaTitle: string;
  active: boolean;
  position: 'left' | 'bottom' | 'right';
  onClick: () => void;
}) {
  const { token } = theme.useToken();
  const fillColor = active ? token.colorTextSecondary : 'none';
  const strokeColor = token.colorTextTertiary;

  return (
    <Tooltip title={title} placement="top">
      <div
        className="rules-panel-toggle"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClick();
        }}
        role="button"
        tabIndex={0}
      >
        <svg viewBox="0 0 16 13" width={16} height={13} role="img">
          <title>{ariaTitle}</title>
          <rect x="0.5" y="0.5" width="15" height="12" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={1} />
          {position === 'left' && (
            <>
              <rect
                x="0.5"
                y="0.5"
                width="4.5"
                height="12"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="5" y1="0.5" x2="5" y2="12.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
          {position === 'bottom' && (
            <>
              <rect
                x="0.5"
                y="8.5"
                width="15"
                height="4"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="0.5" y1="8.5" x2="15.5" y2="8.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
          {position === 'right' && (
            <>
              <rect
                x="11"
                y="0.5"
                width="4.5"
                height="12"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="11" y1="0.5" x2="11" y2="12.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
        </svg>
      </div>
    </Tooltip>
  );
}

interface PanelStatusBarProps {
  tl: DockLayoutApi<PanelToolWindowId>;
  requestCount: number;
  totalSize: string;
  finishTime: string;
  tabCount: number;
}

const PanelStatusBar: React.FC<PanelStatusBarProps> = ({ tl, requestCount, totalSize, finishTime, tabCount }) => {
  const { token } = theme.useToken();
  const { themeMode, setThemeMode } = useTheme();

  const [bottomFullWidth, setBottomFullWidth] = useSetting('workspaceLayout.bottomPanelFullWidth');
  const [showLabels, setShowLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const [sidebarLayout, setSidebarLayout] = useSetting('workspaceLayout.sidebarLayout');
  const toggleLabels = useCallback(() => setShowLabels(!showLabels), [showLabels, setShowLabels]);

  const menuIconWrap = (node: React.ReactNode) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
      {node}
    </span>
  );

  const menuLabel = (checked: boolean, text: React.ReactNode) => (
    <Space size={6}>
      <span style={{ width: 12, display: 'inline-block' }}>{checked ? '\u2713' : ''}</span>
      {text}
    </Space>
  );

  type SidebarLayoutVariantSetting = 'proportional' | 'compact' | 'stacked';

  const layoutMenu: MenuProps['items'] = [
    {
      key: 'bottom-full',
      icon: menuIconWrap(<LayoutMenuIcon kind={bottomFullWidth ? 'bottom-full' : 'bottom-nested'} />),
      label: menuLabel(bottomFullWidth, 'Bottom panel full width'),
      onClick: () => setBottomFullWidth(!bottomFullWidth),
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
      label: 'Sidebar Layout',
      children: (
        [
          { key: 'proportional', label: 'Proportional (even halves)' },
          { key: 'compact', label: 'Compact (bottom pinned)' },
          { key: 'stacked', label: 'Stacked (all at top)' },
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
      label: 'Restore Hidden Sidebar Tools',
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
                      {'\u2192'} {DOCK_LABELS[def.defaultSlot]}
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
        <span className="rules-statusbar-item">{totalSize} transferred</span>
        {finishTime && <span className="rules-statusbar-item">Finish: {finishTime}</span>}
        {tabCount > 0 && (
          <span className="rules-statusbar-item">
            {tabCount} tab{tabCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="rules-statusbar-right">
        <Dropdown
          menu={{
            items: (['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => ({
              key: mode,
              label: (
                <Space size={4}>
                  {THEME_DISPLAY[mode].icon}
                  <span>{THEME_DISPLAY[mode].text}</span>
                  {themeMode === mode && <span style={{ marginLeft: 4 }}>{'\u2713'}</span>}
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
        <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
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
        </div>
        <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
        <Dropdown menu={{ items: layoutMenu }} placement="topRight" trigger={['click']}>
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
      </div>
    </div>
  );
};

export default PanelStatusBar;
