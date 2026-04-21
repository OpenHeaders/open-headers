/**
 * BlockRuleFields — info panel for block rules.
 * Block rules only need conditions — no action configuration.
 */

import { InfoCircleOutlined, StopOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type React from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';

const { Text } = Typography;

const BlockRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId('block', 'action'))}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          background: 'var(--ant-color-fill-quaternary, #fafafa)',
        }}
      >
        <StopOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 16, marginTop: 2 }} />
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>
            Block requests
          </Text>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Requests matching the conditions below will be blocked. The browser will show a network error to the page.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default BlockRuleFields;
