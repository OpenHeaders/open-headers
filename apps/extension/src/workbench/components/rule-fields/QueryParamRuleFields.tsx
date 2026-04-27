/**
 * QueryParamRuleFields — inline param modification rows.
 *
 * Each row: [Operation dropdown] [Param Name] [Value] [Delete]
 * Operations: Add / Replace, Remove, Remove All
 */

import { CloseOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Select, Typography } from 'antd';
import type React from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';
import { TemplateInput } from '../template-input';

const { Text } = Typography;

const QueryParamRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId('query-param', 'action'))}
        />
      </div>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.queryParams !== cur.queryParams}>
        {({ getFieldValue }) => {
          const rows = (getFieldValue('queryParams') as Array<{ operation: string }> | undefined) ?? [];
          const hasRemoveAll = rows.some((p) => p.operation === 'remove-all');
          const hasOtherOps = rows.some((p) => p.operation !== 'remove-all');
          if (!(hasRemoveAll && hasOtherOps)) return null;
          return (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8, fontSize: 12 }}
              message="Remove All will strip the entire query string. Other operations in this rule will be ignored. Use a separate rule to add params after removal."
            />
          );
        }}
      </Form.Item>
      <Form.List name="queryParams" initialValue={[{ param: '', value: '', operation: 'add' }]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <div key={field.key} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <Form.Item
                  {...field}
                  name={[field.name, 'operation']}
                  style={{ marginBottom: 0, width: 125, flexShrink: 0 }}
                >
                  <Select
                    size="small"
                    options={[
                      // Same casing + same "Add / Replace" wording as
                      // header rules so the cross-rule UX stays consistent.
                      // "Replace Only" disambiguates from header "Add / Replace"
                      // — query-param's `'override'` skips URLs that don't
                      // already carry the param, while header `'override'`
                      // always sets.
                      { value: 'add', label: 'Add / Replace' },
                      { value: 'override', label: 'Replace Only' },
                      { value: 'remove', label: 'Remove' },
                      { value: 'remove-all', label: 'Remove All' },
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
                    return (
                      <InfoCircleOutlined
                        style={{
                          fontSize: 10,
                          color: 'var(--ant-color-text-quaternary)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        onClick={() =>
                          openDocs(
                            getDocId(
                              op === 'remove-all'
                                ? 'qp-remove-all'
                                : op === 'remove'
                                  ? 'qp-remove'
                                  : op === 'override'
                                    ? 'qp-override'
                                    : 'qp-add',
                              'action',
                            ),
                          )
                        }
                      />
                    );
                  }}
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
                        <Form.Item {...field} name={[field.name, 'param']} style={{ marginBottom: 0, flex: 1 }}>
                          <Input size="small" placeholder="Param Name" />
                        </Form.Item>
                        {op !== 'remove' && (
                          <Form.Item {...field} name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
                            <TemplateInput size="small" placeholder="Param Value" />
                          </Form.Item>
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
              Add Action
            </Button>
          </>
        )}
      </Form.List>
    </div>
  );
};

export default QueryParamRuleFields;
