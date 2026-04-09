/**
 * InjectRuleFields — type toggle, position, code.
 */

import { Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const InjectRuleFields: React.FC = () => {
  return (
    <>
      {/* Row 1: Type toggle + Position — all inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Form.Item name="injectType" style={{ marginBottom: 0 }}>
          <Radio.Group optionType="button" buttonStyle="solid" size="small">
            <Radio.Button value="script">JavaScript</Radio.Button>
            <Radio.Button value="css">CSS</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="injectPosition" style={{ marginBottom: 0, width: 220 }}>
          <Select>
            <Select.Option value="head">Document Start (head)</Select.Option>
            <Select.Option value="body-start">Document End (body start)</Select.Option>
            <Select.Option value="body-end">Document Idle (body end)</Select.Option>
          </Select>
        </Form.Item>
      </div>

      {/* Code editor */}
      <Form.Item
        name="injectCode"
        label={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Code
          </Text>
        }
        style={{ marginBottom: 16 }}
      >
        <Input.TextArea
          placeholder="Enter JavaScript or CSS code..."
          autoSize={{ minRows: 8, maxRows: 24 }}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: 8,
            padding: '10px 14px',
          }}
        />
      </Form.Item>
    </>
  );
};

export default InjectRuleFields;
