/**
 * Inspector — right sidebar with Docs + Variables tabs.
 *
 * Docs: persistent documentation panel with conditions reference,
 *       header operations guide, templates info, and limitations.
 * Variables: placeholder for future variable inspection.
 */

import { BookOutlined, CloseOutlined, CodeOutlined } from '@ant-design/icons';
import { Tabs, Typography, theme } from 'antd';
import type React from 'react';
import { useInspectorNav } from '../hooks/useInspectorNav';
import InspectorDocs from './InspectorDocs';

const { Text } = Typography;

interface InspectorProps {
  onClose: () => void;
}

const Inspector: React.FC<InspectorProps> = ({ onClose }) => {
  const { token } = theme.useToken();
  const { activeTab, setActiveTab } = useInspectorNav();

  return (
    <div
      className="rules-inspector"
      style={{ background: token.colorBgLayout, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Tabs
          size="small"
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={[
            {
              key: 'docs',
              label: (
                <span style={{ fontSize: 12 }}>
                  <BookOutlined style={{ marginRight: 4 }} />
                  Docs
                </span>
              ),
            },
            {
              key: 'variables',
              label: (
                <span style={{ fontSize: 12 }}>
                  <CodeOutlined style={{ marginRight: 4 }} />
                  Variables
                </span>
              ),
            },
          ]}
        />
        <CloseOutlined style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }} onClick={onClose} />
      </div>

      {/* Content — both always mounted to preserve scroll position */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', display: activeTab === 'docs' ? 'block' : 'none' }}>
          <InspectorDocs />
        </div>
        <div
          style={{
            height: '100%',
            display: activeTab === 'variables' ? 'flex' : 'none',
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
    </div>
  );
};

export default Inspector;
