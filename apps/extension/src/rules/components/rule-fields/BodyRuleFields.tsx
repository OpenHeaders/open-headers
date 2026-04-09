/**
 * BodyRuleFields — Modify Request Body rule configuration.
 *
 * Matches the familiar body-rule editor UX:
 *   - Resource Type selector: REST API / GraphQL API
 *   - GraphQL Operation filter (when GraphQL selected)
 *   - Static Data / Dynamic (JavaScript) toggle
 *   - Code editor for body content
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Radio, Select, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import CodeEditor from '../CodeEditor';

const { Text } = Typography;

const DYNAMIC_TEMPLATE = `function modifyRequestBody(args) {
  const { method, url, body, bodyAsJson } = args;
  // Change request body below depending upon request attributes received in args

  return body;
}`;

const BodyRuleFields: React.FC = () => {
  const form = Form.useFormInstance();
  const bodyType = Form.useWatch('bodyModType');
  const resourceType = Form.useWatch('bodyResourceType');
  const prevBodyTypeRef = useRef(bodyType);

  // Prefill dynamic template on first switch; swap between separate fields
  useEffect(() => {
    if (bodyType === prevBodyTypeRef.current) return;
    if (bodyType === 'dynamic') {
      const dynamicContent = form.getFieldValue('bodyDynamicContent') as string;
      if (!dynamicContent?.trim()) {
        form.setFieldValue('bodyDynamicContent', DYNAMIC_TEMPLATE);
      }
    }
    prevBodyTypeRef.current = bodyType;
  }, [bodyType, form]);

  return (
    <div style={{ marginBottom: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Override request body with static or programmatic data. Intercepts fetch() and XMLHttpRequest calls for REST or GraphQL API requests."
      />

      {/* Resource Type */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Select Resource Type
        </Text>
        <Form.Item name="bodyResourceType" style={{ marginBottom: 0 }}>
          <Radio.Group>
            <Radio value="rest">REST API</Radio>
            <Radio value="graphql">GraphQL API</Radio>
          </Radio.Group>
        </Form.Item>
      </div>

      {/* GraphQL Operation filter */}
      {resourceType === 'graphql' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              GraphQL Operation (Request Payload Filter)
            </Text>
            <Tooltip title="Filter by GraphQL operation name in the request payload. Leave empty to match all operations.">
              <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }} />
            </Tooltip>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Form.Item name="bodyGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
              <Input size="small" placeholder="Key e.g. operationName" />
            </Form.Item>
            <Form.Item name="bodyGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
              <Select
                size="small"
                options={[
                  { value: 'Equals', label: 'Equals' },
                  { value: 'Contains', label: 'Contains' },
                ]}
              />
            </Form.Item>
            <Form.Item name="bodyGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
              <Input size="small" placeholder="value e.g. getUsers" />
            </Form.Item>
            <Button
              type="link"
              size="small"
              onClick={() => {
                form.setFieldsValue({
                  bodyGraphqlKey: undefined,
                  bodyGraphqlOperator: 'Equals',
                  bodyGraphqlValue: undefined,
                });
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* Body content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Request Body
          </Text>
          <Form.Item name="bodyModType" style={{ marginBottom: 0 }}>
            <Radio.Group size="small">
              <Radio.Button value="static">Static Data</Radio.Button>
              <Radio.Button value="dynamic">
                Dynamic (JavaScript){' '}
                <Tooltip title="Write a function that receives the request body and context, then return the modified body">
                  <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }} />
                </Tooltip>
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
        </div>

        {bodyType === 'dynamic' && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--ant-color-text-secondary)',
              lineHeight: 1.5,
              marginBottom: 8,
              padding: '6px 8px',
              background: 'var(--ant-color-fill-quaternary)',
              borderRadius: 4,
            }}
          >
            Your function receives <code>{'{method, url, body, bodyAsJson}'}</code> and should return the modified body.
            Return a string or an object (auto-serialized to JSON).
          </div>
        )}

        {bodyType === 'dynamic' ? (
          <Form.Item name="bodyDynamicContent" style={{ marginBottom: 0 }}>
            <CodeEditor language="javascript" minHeight={240} />
          </Form.Item>
        ) : (
          <Form.Item name="bodyStaticContent" style={{ marginBottom: 0 }}>
            <CodeEditor language="json" placeholder={'{"key": "value"}'} minHeight={160} />
          </Form.Item>
        )}
      </div>
    </div>
  );
};

export default BodyRuleFields;
