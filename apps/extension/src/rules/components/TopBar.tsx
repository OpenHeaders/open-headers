/**
 * TopBar — mirrors the desktop V5Shell TopBar.
 *
 * Layout: [Logo] [Title] [Rules badge] | [Search... (disabled)] | [Settings (disabled)]
 *
 * Back/forward navigation not applicable in extension context.
 */

import { SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { getBrowserAPI } from '@/types/browser';

const TopBar: React.FC = () => {
  const { token } = theme.useToken();

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
          src={getBrowserAPI().runtime.getURL('images/icon48.png')}
          alt="Open Headers"
          className="rules-topbar-logo"
        />
        <span className="rules-topbar-title">Open Headers</span>
        <span
          className="rules-topbar-chip"
          style={{
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: 11,
            fontWeight: 600,
            padding: '1px 8px',
            borderRadius: 4,
          }}
        >
          Rules
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, maxWidth: 420, justifyContent: 'center' }}>
        <Tooltip title="Command palette not available in extension">
          <Button
            className="rules-topbar-search"
            type="text"
            disabled
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Space size={4}>
              <SearchOutlined style={{ color: token.colorTextTertiary }} />
              <span style={{ color: token.colorTextTertiary }}>Search rules...</span>
            </Space>
          </Button>
        </Tooltip>
      </div>

      <div className="rules-topbar-right">
        <Tooltip title="Settings available in desktop app">
          <Button size="small" type="text" icon={<SettingOutlined />} disabled />
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar;
