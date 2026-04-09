/**
 * DelayRuleFields — delay rule configuration.
 */

import { Alert, Form, InputNumber, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const DelayRuleFields: React.FC = () => {
  return (
    <div style={{ marginBottom: 16 }}>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="In browser extension, delay is capped automatically to avoid browsing performance degradation. For XHR/Fetch, max delay is 5,000 ms. Static resource loads (images, scripts, stylesheets) are not affected. You can use the Desktop App which has no such restrictions."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          Delay
        </Text>
        <Form.Item name="delayMs" style={{ marginBottom: 0 }}>
          <InputNumber min={0} max={5000} step={100} addonAfter="ms" style={{ width: 160 }} placeholder="1000" />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Max 5,000 ms
        </Text>
      </div>
    </div>
  );
};

export default DelayRuleFields;
