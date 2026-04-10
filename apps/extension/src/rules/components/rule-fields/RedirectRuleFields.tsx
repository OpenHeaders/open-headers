/**
 * RedirectRuleFields — redirect target configuration.
 *
 * The "If request" matching is handled by the shared ConditionEditor.
 * This component only handles where to redirect to:
 *   - Another URL (extension-supported)
 *   - Local file (desktop-only, shown disabled)
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Form, Input, Radio, Tooltip, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const RedirectRuleFields: React.FC = () => {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          Redirects to
        </Text>
        <Tooltip title="The destination URL. With URL Regex conditions, use \1, \2 etc. to reference capture groups.">
          <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }} />
        </Tooltip>
      </div>

      <div style={{ marginBottom: 10 }}>
        <Radio.Group value="url" size="small">
          <Radio.Button value="url">Another URL</Radio.Button>
          <Tooltip title="Available in desktop app">
            <Radio.Button value="local" disabled>
              Local file
            </Radio.Button>
          </Tooltip>
        </Radio.Group>
      </div>

      <Form.Item name="redirectTo" style={{ marginBottom: 0 }}>
        <Input placeholder="e.g. https://openheaders.io/redirected" />
      </Form.Item>
    </div>
  );
};

export default RedirectRuleFields;
