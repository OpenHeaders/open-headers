/**
 * TopBar — mirrors the desktop V5Shell TopBar.
 *
 * Layout: [Logo] [Title] [Rules badge] | [⌘K Search...] | [Settings]
 */

import { SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { getBrowserAPI } from '@/types/browser';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';

interface TopBarProps {
  onCommandPalette?: () => void;
  onOpenSettings?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onCommandPalette, onOpenSettings }) => {
  const { token } = theme.useToken();
  const commandPaletteLabel = useShortcutLabel('command-palette');
  const openSettingsLabel = useShortcutLabel('open-settings');

  return (
    <div
      className="rules-topbar"
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="rules-topbar-left">
        <img
          src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
          alt="Open Headers"
          className="rules-topbar-logo"
        />
        <span className="rules-topbar-title">Open Headers</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, maxWidth: 420, justifyContent: 'center' }}>
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
            <span style={{ color: token.colorTextTertiary }}>Search or run a command...</span>
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

      <div className="rules-topbar-right">
        <Tooltip title={<ShortcutHintTitle label={openSettingsLabel}>Settings</ShortcutHintTitle>}>
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar;
