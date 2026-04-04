/**
 * TopBar — workspace selector, navigation, search, environment, settings.
 *
 * Layout: [Logo] [Workspace ▼] [◀][▶] | [⌘K Search...] | [Env ▼] [⚙] [≡]
 */

import {
  CheckOutlined,
  LeftOutlined,
  MenuOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  SyncOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Space, Tooltip, theme } from 'antd';
import { useEnvironments, useWorkspaces } from '@/renderer/hooks/useCentralizedWorkspace';
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
  const { workspaces, activeWorkspaceId, switchWorkspace, syncStatus } = useWorkspaces();
  const { environments, activeEnvironment, switchEnvironment } = useEnvironments();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const workspaceName = activeWorkspace?.name ?? 'Workspace';
  const isSyncing = syncStatus[activeWorkspaceId]?.syncing;

  const isDarwin = window.electronAPI?.platform === 'darwin';

  // Workspace dropdown menu
  const workspaceMenuItems = workspaces.map((ws) => {
    const isActive = ws.id === activeWorkspaceId;
    const wsIcon = ws.type === 'git' ? <TeamOutlined key="icon" /> : <UserOutlined key="icon" />;
    const wsSyncInfo = syncStatus[ws.id];

    return {
      key: ws.id,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {wsIcon}
            <span>{ws.name}</span>
            {ws.type === 'git' && wsSyncInfo?.syncing && <SyncOutlined spin style={{ fontSize: 12 }} />}
          </Space>
          {isActive && <CheckOutlined style={{ color: token.colorPrimary }} />}
        </Space>
      ),
      onClick: () => {
        if (!isActive) void switchWorkspace(ws.id);
      },
    };
  });

  // Environment dropdown menu
  const envNames = Object.keys(environments);
  const environmentMenuItems = envNames.map((name) => {
    const isActive = name === activeEnvironment;
    const varCount = Object.keys(environments[name] || {}).length;

    return {
      key: name,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <span>{name}</span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>({varCount} vars)</span>
          </Space>
          {isActive && <CheckOutlined style={{ color: token.colorPrimary }} />}
        </Space>
      ),
      onClick: () => {
        if (!isActive) void switchEnvironment(name);
      },
    };
  });

  return (
    <div
      className={`v5-topbar ${isDarwin ? 'v5-topbar-darwin' : ''}`}
      style={{
        background: token.colorBgElevated,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-topbar-left">
        <img src={appIcon} alt="Open Headers" className="v5-topbar-logo" />
        <span className="v5-topbar-title">Open Headers</span>

        <Dropdown menu={{ items: workspaceMenuItems }} trigger={['click']} placement="bottomLeft">
          <Button size="small" type="text" className="v5-topbar-chip">
            {activeWorkspace?.type === 'git' ? (
              <TeamOutlined style={{ fontSize: 11 }} />
            ) : (
              <UserOutlined style={{ fontSize: 11 }} />
            )}
            {workspaceName}
            {isSyncing && <SyncOutlined spin style={{ fontSize: 10 }} />}▾
          </Button>
        </Dropdown>

        <div className="v5-topbar-divider" style={{ background: token.colorBorderSecondary }} />

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
        <Dropdown menu={{ items: environmentMenuItems }} trigger={['click']} placement="bottomRight">
          <Button size="small" type="text" className="v5-topbar-chip">
            <span className="v5-dot" style={{ background: token.colorSuccess }} />
            {activeEnvironment || 'Default'} ▾
          </Button>
        </Dropdown>
        <Tooltip title="Settings (⌘,)">
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
        <Button size="small" type="text" icon={<MenuOutlined />} />
      </div>
    </div>
  );
}
