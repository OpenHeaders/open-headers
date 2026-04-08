/**
 * BlockRuleFields — info panel + inline Tag.
 * Block rules only need domains + tag.
 */

import { StopOutlined } from '@ant-design/icons';
import { Form, Input, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const BlockRuleFields: React.FC = () => {
  return (
    <>
      {/* Tag inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Form.Item name="tag" style={{ marginBottom: 0, width: 180 }}>
          <Input placeholder="Tag (optional)" maxLength={20} />
        </Form.Item>
      </div>

      {/* Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          background: 'var(--ant-color-fill-quaternary, #fafafa)',
          marginBottom: 16,
        }}
      >
        <StopOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 16, marginTop: 2 }} />
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>
            Block requests
          </Text>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Requests matching the domains below will be blocked. The browser will show a network error to the page.
          </Text>
        </div>
      </div>
    </>
  );
};

export default BlockRuleFields;
