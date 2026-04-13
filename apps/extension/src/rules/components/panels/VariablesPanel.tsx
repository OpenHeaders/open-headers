/**
 * VariablesPanel — right-pane placeholder for variable inspection.
 *
 * Desktop-only feature — rendered as an informational placeholder when
 * the user activates it from the right ActivityBar.
 */

import { CloseOutlined, CodeOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface VariablesPanelProps {
  onClose: () => void;
}

const VariablesPanel: React.FC<VariablesPanelProps> = ({ onClose }) => {
  const { token } = theme.useToken();

  return (
    <div
      className="rules-right-panel rules-right-panel--variables"
      style={{ background: token.colorBgLayout, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        className="rules-right-panel-header"
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CodeOutlined />
          Variables
        </Text>
        <CloseOutlined
          style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }}
          onClick={onClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose();
          }}
          aria-label="Close Variables panel"
        />
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          gap: 8,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Variable inspection will be available when connected to the desktop app.
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Use {'{{variable_name}}'} syntax in rule values to reference variables.
        </Text>
      </div>
    </div>
  );
};

export default VariablesPanel;
