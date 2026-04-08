import { Form, Input, Radio, Select } from 'antd';
import type React from 'react';

const InjectRuleFields: React.FC = () => {
  return (
    <>
      <Form.Item name="injectType" label="Type">
        <Radio.Group>
          <Radio.Button value="script">JavaScript</Radio.Button>
          <Radio.Button value="css">CSS</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="injectCode"
        label="Code"
      >
        <Input.TextArea
          placeholder="Enter JavaScript or CSS code..."
          autoSize={{ minRows: 6, maxRows: 20 }}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Form.Item>

      <Form.Item name="injectPosition" label="Run at">
        <Select style={{ width: 200 }}>
          <Select.Option value="head">Document Start (head)</Select.Option>
          <Select.Option value="body-start">Document End (body start)</Select.Option>
          <Select.Option value="body-end">Document Idle (body end)</Select.Option>
        </Select>
      </Form.Item>
    </>
  );
};

export default InjectRuleFields;
