/**
 * BottomPanel — Traffic monitor, Console, Terminal tabs.
 *
 * Placeholder: shows the traffic tab structure.
 */

import { Typography, theme } from 'antd';

const { Text } = Typography;

export function BottomPanel() {
  const { token } = theme.useToken();

  return (
    <div className="v5-bottom-panel" style={{ background: token.colorBgContainer }}>
      <div
        className="v5-bottom-tabs"
        style={{
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <span
          className="v5-bottom-tab active"
          style={{ color: token.colorText, borderBottomColor: token.colorPrimary }}
        >
          Traffic
        </span>
        <span className="v5-bottom-tab" style={{ color: token.colorTextSecondary }}>
          Console
        </span>
        <span className="v5-bottom-tab" style={{ color: token.colorTextSecondary }}>
          Terminal
        </span>

        <span className="v5-live-indicator" style={{ color: token.colorTextSecondary }}>
          <span className="v5-dot v5-dot-blink" style={{ background: token.colorError }} />
          Live — 0 matched
        </span>
      </div>

      <div className="v5-bottom-content" style={{ color: token.colorTextTertiary }}>
        <Text type="secondary">Traffic from connected browser extensions will appear here.</Text>
      </div>
    </div>
  );
}
