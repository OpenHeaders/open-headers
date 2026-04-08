/**
 * HeaderRuleFields — exact desktop "Add Header Rule" modal layout.
 *
 * Row 1: Header Name | Request/Response toggle | Tag (optional)  — ALL inline
 * Row 2: Operation select | Value input  — compact Space.Compact
 */

import { Form, Input, Radio, Select, Space } from 'antd';
import type React from 'react';

const HeaderRuleFields: React.FC = () => {
  const operation = Form.useWatch('headerOperation');

  return (
    <>
      {/* Row 1: Header Name + Request/Response + Tag — all inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Form.Item name="headerName" style={{ marginBottom: 0, flex: 1 }}>
          <Input placeholder="Header Name" />
        </Form.Item>

        <Form.Item name="isResponse" style={{ marginBottom: 0 }}>
          <Radio.Group optionType="button" buttonStyle="solid" size="small">
            <Radio.Button value={false}>Request</Radio.Button>
            <Radio.Button value={true}>Response</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="tag" style={{ marginBottom: 0, width: 180 }}>
          <Input placeholder="Tag (optional)" maxLength={20} />
        </Form.Item>
      </div>

      {/* Row 2: Operation + Value — compact inline */}
      <Space.Compact block style={{ marginBottom: 16 }}>
        <Form.Item name="headerOperation" style={{ marginBottom: 0 }}>
          <Select
            style={{ width: 120 }}
            options={[
              { value: 'override', label: 'Override' },
              { value: 'add', label: 'Add' },
              { value: 'remove', label: 'Remove' },
            ]}
          />
        </Form.Item>

        {operation !== 'remove' && (
          <Form.Item name="staticValue" style={{ flex: 1, marginBottom: 0 }}>
            <Input placeholder="Header Value (e.g., Bearer {{API_TOKEN}})" />
          </Form.Item>
        )}
      </Space.Compact>
    </>
  );
};

export default HeaderRuleFields;
