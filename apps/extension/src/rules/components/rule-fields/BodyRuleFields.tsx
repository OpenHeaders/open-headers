/**
 * BodyRuleFields — request/response body modification.
 */

import { Alert, Checkbox, Form, Input, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;
const { TextArea } = Input;

const BodyRuleFields: React.FC = () => {
  return (
    <div style={{ marginBottom: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Body modification intercepts fetch() and XMLHttpRequest calls. Works for API requests (REST, GraphQL). Static resource loads are not affected."
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <Form.Item
          name="bodyMatchType"
          label={<Text style={{ fontSize: 12 }}>Match type</Text>}
          style={{ marginBottom: 0 }}
        >
          <Select
            style={{ width: 130 }}
            options={[
              { value: 'contains', label: 'Contains' },
              { value: 'exact', label: 'Exact' },
              { value: 'regex', label: 'Regex' },
            ]}
          />
        </Form.Item>
        <Form.Item name="bodyIsRequest" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Request body</Checkbox>
        </Form.Item>
        <Form.Item name="bodyIsResponse" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Response body</Checkbox>
        </Form.Item>
      </div>

      <Form.Item
        name="bodyMatchPattern"
        label={<Text style={{ fontSize: 12 }}>Find pattern</Text>}
        style={{ marginBottom: 8 }}
      >
        <TextArea
          rows={2}
          placeholder="Text or pattern to find in the body"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Form.Item>

      <Form.Item
        name="bodyReplaceWith"
        label={<Text style={{ fontSize: 12 }}>Replace with</Text>}
        style={{ marginBottom: 0 }}
      >
        <TextArea rows={2} placeholder="Replacement text" style={{ fontFamily: 'monospace', fontSize: 12 }} />
      </Form.Item>
    </div>
  );
};

export default BodyRuleFields;
