/**
 * DelayRuleFields — delay rule configuration.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Form, InputNumber, Typography } from 'antd';
import type React from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';

const { Text } = Typography;

const DelayRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId('delay', 'action'))}
        />
      </div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="In browser extension, delay is capped at 5,000ms for XHR/Fetch. Static resources are not affected. The desktop app has no restrictions."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          Delay
        </Text>
        <Form.Item name="delayMs" style={{ marginBottom: 0 }}>
          <InputNumber min={0} max={5000} step={100} addonAfter="ms" style={{ width: 160 }} placeholder="1000" />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Max 5,000 ms
        </Text>
      </div>
    </div>
  );
};

export default DelayRuleFields;
