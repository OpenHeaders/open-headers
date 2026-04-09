/**
 * QueryParamRuleFields — inline param modification rows.
 *
 * Each row: [Operation dropdown] [Param Name] [Value] [Delete]
 * Operations: Add/Replace, Remove, Remove All
 *
 * Remove All can coexist with Add/Replace entries — semantics:
 * strip all params first, then apply the add/replace operations.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const QueryParamRuleFields: React.FC = () => {
  const queryParams = Form.useWatch('queryParams') as Array<{ operation: string }> | undefined;
  const hasRemoveAll = queryParams?.some((p) => p.operation === 'remove-all') ?? false;
  const hasOtherOps = queryParams?.some((p) => p.operation !== 'remove-all') ?? false;

  return (
    <div style={{ marginBottom: 16 }}>
      {hasRemoveAll && hasOtherOps && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8, fontSize: 12 }}
          message="REMOVE ALL will strip the entire query string. Other operations in this rule will be ignored. Use a separate rule to add params after removal."
        />
      )}
      <Form.List name="queryParams" initialValue={[{ param: '', value: '', operation: 'add' }]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <div
                key={field.key}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Form.Item
                  {...field}
                  name={[field.name, 'operation']}
                  style={{ marginBottom: 0, width: 150, flexShrink: 0 }}
                >
                  <Select
                    size="small"
                    options={[
                      { value: 'add', label: 'ADD / REPLACE' },
                      { value: 'remove', label: 'REMOVE' },
                      { value: 'remove-all', label: 'REMOVE ALL' },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev.queryParams?.[field.name]?.operation !== cur.queryParams?.[field.name]?.operation
                  }
                >
                  {({ getFieldValue }) => {
                    const op = getFieldValue(['queryParams', field.name, 'operation']);
                    if (op === 'remove-all') {
                      return (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Removes all query parameters from the URL
                        </Text>
                      );
                    }
                    return (
                      <>
                        <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                          Param
                        </Text>
                        <Form.Item {...field} name={[field.name, 'param']} style={{ marginBottom: 0, flex: 1 }}>
                          <Input size="small" placeholder="Param Name" />
                        </Form.Item>
                        {op !== 'remove' && (
                          <>
                            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                              Value
                            </Text>
                            <Form.Item {...field} name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
                              <Input size="small" placeholder="Param Value" />
                            </Form.Item>
                          </>
                        )}
                      </>
                    );
                  }}
                </Form.Item>

                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 10 }} />}
                  onClick={() => remove(field.name)}
                  style={{ color: 'var(--ant-color-text-tertiary)', flexShrink: 0 }}
                />
              </div>
            ))}
            <Button
              type="dashed"
              onClick={() => add({ param: '', value: '', operation: 'add' })}
              icon={<PlusOutlined />}
              size="small"
            >
              Add Modification
            </Button>
          </>
        )}
      </Form.List>
    </div>
  );
};

export default QueryParamRuleFields;
