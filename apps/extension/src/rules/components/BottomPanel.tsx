/**
 * BottomPanel — Traffic, Console, Terminal tabs (all disabled/placeholder).
 *
 * Mirrors desktop v5-shell/BottomPanel.tsx exactly.
 * Panels show "Available in desktop app" messages for future enablement.
 */

import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

const TABS = [
  { key: 'traffic', label: 'Traffic' },
  { key: 'console', label: 'Console' },
  { key: 'terminal', label: 'Terminal' },
];

interface BottomPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ activeTab = 'traffic', onTabChange }) => {
  const { token } = theme.useToken();

  return (
    <div className="rules-bottom-panel" style={{ background: token.colorBgLayout }}>
      <div
        className="rules-bottom-tabs"
        style={{
          background: token.colorBgLayout,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {TABS.map((tab) => (
          <span
            key={tab.key}
            className={`rules-bottom-tab ${activeTab === tab.key ? 'active' : ''}`}
            style={
              activeTab === tab.key
                ? { color: token.colorText, borderBottomColor: token.colorPrimary }
                : { color: token.colorTextSecondary }
            }
            onClick={() => onTabChange?.(tab.key)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onTabChange?.(tab.key);
            }}
          >
            {tab.label}
          </span>
        ))}

        {activeTab === 'traffic' && (
          <span className="rules-live-indicator" style={{ color: token.colorTextSecondary }}>
            <span className="rules-dot rules-dot-blink" style={{ background: token.colorTextTertiary }} />
            Offline
          </span>
        )}
      </div>

      <div className="rules-bottom-content" style={{ color: token.colorTextTertiary }}>
        {activeTab === 'traffic' && (
          <Text type="secondary">Traffic monitoring available in desktop app.</Text>
        )}
        {activeTab === 'console' && (
          <Text type="secondary">Console available in desktop app.</Text>
        )}
        {activeTab === 'terminal' && (
          <Text type="secondary">Terminal available in desktop app.</Text>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
