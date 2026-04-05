/**
 * BottomPanel — Traffic monitor, Console, Terminal tabs.
 */

import { Typography, theme } from 'antd';

const { Text } = Typography;

interface BottomPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const TABS = [
  { key: 'traffic', label: 'Traffic' },
  { key: 'console', label: 'Console' },
  { key: 'terminal', label: 'Terminal' },
];

export function BottomPanel({ activeTab = 'traffic', onTabChange }: BottomPanelProps) {
  const { token } = theme.useToken();

  return (
    <div className="v5-bottom-panel" style={{ background: token.colorBgLayout }}>
      <div
        className="v5-bottom-tabs"
        style={{
          background: token.colorBgLayout,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {TABS.map((tab) => (
          <span
            key={tab.key}
            className={`v5-bottom-tab ${activeTab === tab.key ? 'active' : ''}`}
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
          <span className="v5-live-indicator" style={{ color: token.colorTextSecondary }}>
            <span className="v5-dot v5-dot-blink" style={{ background: token.colorError }} />
            Live — 0 matched
          </span>
        )}
      </div>

      <div className="v5-bottom-content" style={{ color: token.colorTextTertiary }}>
        {activeTab === 'traffic' && (
          <Text type="secondary">Traffic from connected browser extensions will appear here.</Text>
        )}
        {activeTab === 'console' && (
          <Text type="secondary">No logs yet. Send a request to view its details in the console.</Text>
        )}
        {activeTab === 'terminal' && <Text type="secondary">Terminal coming soon.</Text>}
      </div>
    </div>
  );
}
