/**
 * TopBar — workspace selector, navigation, search, environment, settings.
 *
 * Layout: [Logo] [Workspace ▼] [◀][▶] | [⌘K Search...] | [Env ▼] [⚙] [≡]
 */

import {
  DownloadOutlined,
  ExportOutlined,
  ImportOutlined,
  LeftOutlined,
  MenuOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Space, Tooltip, theme } from 'antd';
import appIcon from '@/renderer/images/icon128.png';

interface TopBarProps {
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onCommandPalette?: () => void;
  onOpenSettings?: () => void;
}

export function TopBar({
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  onCommandPalette,
  onOpenSettings,
}: TopBarProps) {
  const { token } = theme.useToken();
  const isDarwin = window.electronAPI?.platform === 'darwin';
  const appVersion = window.startupData?.version ?? '';

  // App menu items
  const appMenuItems: MenuProps['items'] = [
    { key: 'export', icon: <ExportOutlined />, label: 'Export', onClick: () => {} },
    { key: 'import', icon: <ImportOutlined />, label: 'Import', onClick: () => {} },
    { type: 'divider' },
    {
      key: 'check-updates',
      icon: <DownloadOutlined />,
      label: 'Check for Updates',
      onClick: () => window.electronAPI?.checkForUpdates?.(true),
    },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', onClick: onOpenSettings },
  ];

  return (
    <div
      className={`v5-topbar ${isDarwin ? 'v5-topbar-darwin' : ''}`}
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-topbar-left">
        <img src={appIcon} alt="Open Headers" className="v5-topbar-logo" />
        <span className="v5-topbar-title">Open Headers</span>
        {appVersion && (
          <span style={{ fontSize: 10, color: token.colorTextTertiary, fontWeight: 400 }}>v{appVersion}</span>
        )}

        <Tooltip title="Back (⌘[)">
          <Button size="small" type="text" icon={<LeftOutlined />} disabled={!canGoBack} onClick={onGoBack} />
        </Tooltip>
        <Tooltip title="Forward (⌘])">
          <Button size="small" type="text" icon={<RightOutlined />} disabled={!canGoForward} onClick={onGoForward} />
        </Tooltip>
      </div>

      <Button
        className="v5-topbar-search"
        type="text"
        onClick={onCommandPalette}
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Space size={4}>
          <SearchOutlined style={{ color: token.colorTextTertiary }} />
          <span style={{ color: token.colorTextTertiary }}>Search or run a command...</span>
          <kbd className="v5-kbd" style={{ background: token.colorBgElevated, color: token.colorTextTertiary }}>
            ⌘K
          </kbd>
        </Space>
      </Button>

      <div className="v5-topbar-right">
        <Tooltip title="Settings (⌘,)">
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
        <Dropdown menu={{ items: appMenuItems }} trigger={['click']} placement="bottomRight">
          <Button size="small" type="text" icon={<MenuOutlined />} />
        </Dropdown>
      </div>
    </div>
  );
}
