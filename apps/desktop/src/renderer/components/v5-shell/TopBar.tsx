/**
 * TopBar — workspace selector, navigation, search, environment, settings.
 *
 * Layout: [Logo] [Workspace ▼] [◀][▶] | [⌘K Search...] | [Env ▼] [⚙] [≡]
 */

import { LeftOutlined, MenuOutlined, RightOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, theme } from 'antd';
import appIcon from '@/renderer/images/icon128.png';

interface TopBarProps {
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onCommandPalette?: () => void;
}

export function TopBar({
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  onCommandPalette,
}: TopBarProps) {
  const { token } = theme.useToken();

  const isDarwin = window.electronAPI?.platform === 'darwin';

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

        <Button size="small" type="text" className="v5-topbar-chip">
          Personal Workspace ▾
        </Button>

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
        <Button size="small" type="text" className="v5-topbar-chip">
          <span className="v5-dot" style={{ background: token.colorSuccess }} />
          Development ▾
        </Button>
        <Tooltip title="Settings (⌘,)">
          <Button size="small" type="text" icon={<SettingOutlined />} />
        </Tooltip>
        <Button size="small" type="text" icon={<MenuOutlined />} />
      </div>
    </div>
  );
}
