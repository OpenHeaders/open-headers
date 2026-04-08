/**
 * QueryParamRuleFields — param entries + inline Tag.
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Radio, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const QueryParamRuleFields: React.FC = () => {
  return (
    <>
      {/* Tag inline at top */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Form.Item name="tag" style={{ marginBottom: 0, width: 180 }}>
          <Input placeholder="Tag (optional)" maxLength={20} />
        </Form.Item>
      </div>

      {/* Param entries */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Query Parameters
          </Text>
        </div>
        <Form.List name="queryParams" initialValue={[{ param: '', value: '', operation: 'add' }]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    marginBottom: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                    background: 'var(--ant-color-fill-quaternary, #fafafa)',
                  }}
                >
                  <Form.Item {...field} name={[field.name, 'param']} style={{ marginBottom: 0, flex: '0 0 160px' }}>
                    <Input placeholder="Param name" />
                  </Form.Item>

                  <Form.Item {...field} name={[field.name, 'operation']} style={{ marginBottom: 0 }}>
                    <Radio.Group size="small" optionType="button" buttonStyle="solid">
                      <Radio.Button value="add">Add</Radio.Button>
                      <Radio.Button value="override">Override</Radio.Button>
                      <Radio.Button value="remove">Remove</Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) =>
                      prev.queryParams?.[field.name]?.operation !== cur.queryParams?.[field.name]?.operation
                    }
                  >
                    {({ getFieldValue }) => {
                      const op = getFieldValue(['queryParams', field.name, 'operation']);
                      if (op === 'remove') return null;
                      return (
                        <Form.Item {...field} name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
                          <Input placeholder="Value" />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>

                  {fields.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                      size="small"
                      style={{ marginTop: 1 }}
                    />
                  )}
                </div>
              ))}
              <Button
                type="dashed"
                onClick={() => add({ param: '', value: '', operation: 'add' })}
                icon={<PlusOutlined />}
                size="small"
                style={{ borderRadius: 6 }}
              >
                Add parameter
              </Button>
            </>
          )}
        </Form.List>
      </div>
    </>
  );
};

export default QueryParamRuleFields;
