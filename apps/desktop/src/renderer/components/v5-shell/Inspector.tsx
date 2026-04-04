/**
 * Inspector — right sidebar with context-sensitive tabs.
 *
 * Placeholder: shows Variables / Linked Rules / Code Gen tab structure.
 */

import { Typography, theme } from 'antd';

const { Text } = Typography;

export function Inspector() {
  const { token } = theme.useToken();

  return (
    <div className="v5-inspector" style={{ background: token.colorBgContainer }}>
      <div
        className="v5-inspector-header"
        style={{
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <div className="v5-inspector-title">
          <Text strong style={{ fontSize: 12 }}>
            Inspector
          </Text>
        </div>
        <div className="v5-inspector-tabs">
          <span
            className="v5-inspector-tab active"
            style={{ color: token.colorText, borderBottomColor: token.colorPrimary }}
          >
            Variables
          </span>
          <span className="v5-inspector-tab" style={{ color: token.colorTextSecondary }}>
            Linked Rules
          </span>
          <span className="v5-inspector-tab" style={{ color: token.colorTextSecondary }}>
            Code Gen
          </span>
        </div>
      </div>

      <div className="v5-inspector-content" style={{ color: token.colorTextTertiary }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Select a request or rule to inspect its variables.
        </Text>
      </div>

      <div
        className="v5-inspector-footer"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
          color: token.colorTextTertiary,
        }}
      >
        <Text type="secondary" style={{ fontSize: 10 }}>
          Resolution: Vault &rarr; Environment &rarr; Collection &rarr; Globals
        </Text>
      </div>
    </div>
  );
}
