/**
 * DocsPanel — one of the two right-side panels in the workspace shell.
 *
 * Owns the header (title + close button) and hosts the existing
 * InspectorDocs renderer for the actual content. Previously this lived
 * inside the tabbed Inspector component; with the right ActivityBar
 * owning panel selection, the tabs are gone and each right panel is
 * its own top-level view.
 */

import { BookOutlined, CloseOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type React from 'react';
import InspectorDocs from '../InspectorDocs';

const { Text } = Typography;

interface DocsPanelProps {
  onClose: () => void;
}

const DocsPanel: React.FC<DocsPanelProps> = ({ onClose }) => {
  const { token } = theme.useToken();

  return (
    <div
      className="rules-right-panel rules-right-panel--docs"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
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
          <BookOutlined />
          Docs
        </Text>
        <CloseOutlined
          style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }}
          onClick={onClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose();
          }}
          aria-label="Close Docs panel"
        />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <InspectorDocs />
      </div>
    </div>
  );
};

export default DocsPanel;
