import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Radio, Space } from 'antd';
import type React from 'react';

const QueryParamRuleFields: React.FC = () => {
  return (
    <Form.List name="queryParams" initialValue={[{ param: '', value: '', operation: 'add' }]}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }} wrap>
              <Form.Item
                {...field}
                name={[field.name, 'param']}
                rules={[{ required: true, message: 'Param name required' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="Param name" style={{ width: 160 }} />
              </Form.Item>

              <Form.Item
                {...field}
                name={[field.name, 'operation']}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group size="small">
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
                    <Form.Item
                      {...field}
                      name={[field.name, 'value']}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="Value" style={{ width: 180 }} />
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
                />
              )}
            </Space>
          ))}
          <Button type="dashed" onClick={() => add({ param: '', value: '', operation: 'add' })} icon={<PlusOutlined />} size="small">
            Add parameter
          </Button>
        </>
      )}
    </Form.List>
  );
};

export default QueryParamRuleFields;
