import type { V5 } from '@openheaders/core/types';
import { Form, Input, Radio } from 'antd';
import type React from 'react';

const HeaderRuleFields: React.FC = () => {
  const operation = Form.useWatch('headerOperation');

  return (
    <>
      <Form.Item
        name="headerName"
        label="Header Name"
        rules={[{ required: true, message: 'Header name is required' }]}
      >
        <Input placeholder="e.g. Authorization, X-Custom-Header" />
      </Form.Item>

      <Form.Item name="headerOperation" label="Operation">
        <Radio.Group>
          <Radio.Button value="override">Override</Radio.Button>
          <Radio.Button value="add">Add</Radio.Button>
          <Radio.Button value="remove">Remove</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {operation !== 'remove' && (
        <Form.Item
          name="staticValue"
          label="Value"
          rules={[{ required: true, message: 'Value is required' }]}
        >
          <Input.TextArea
            placeholder="e.g. Bearer my-token, {{API_KEY}}"
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
        </Form.Item>
      )}

      <Form.Item name="isResponse" label="Apply to">
        <Radio.Group>
          <Radio.Button value={false}>Request</Radio.Button>
          <Radio.Button value={true}>Response</Radio.Button>
        </Radio.Group>
      </Form.Item>
    </>
  );
};

export default HeaderRuleFields;
