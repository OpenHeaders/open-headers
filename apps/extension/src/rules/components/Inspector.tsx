/**
 * Inspector — right sidebar (Variables panel placeholder).
 *
 * Mirrors desktop v5-shell/Inspector.tsx structure but with placeholder content.
 * Ready for future variable inspection support.
 */

import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { Input, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface InspectorProps {
  onClose: () => void;
}

const Inspector: React.FC<InspectorProps> = ({ onClose }) => {
  const { token } = theme.useToken();

  return (
    <div className="rules-inspector" style={{ background: token.colorBgLayout }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 14 }}>
          Variables
        </Text>
        <CloseOutlined style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }} onClick={onClose} />
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
        <Input
          placeholder="Filter variables"
          allowClear
          size="small"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          disabled
        />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          Variable inspection will be available when connected to the desktop app.
        </Text>
        <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          Use {'{{variable_name}}'} syntax in rule values to reference variables.
        </Text>
      </div>
    </div>
  );
};

export default Inspector;
