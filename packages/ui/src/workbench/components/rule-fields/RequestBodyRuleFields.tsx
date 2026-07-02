/**
 * RequestBodyRuleFields — Modify Request Body rule configuration.
 *
 * Layout:
 *   - Resource Type selector: REST API / GraphQL API
 *   - GraphQL Operation filter — when GraphQL is selected, fires only
 *     on requests whose JSON payload's configured field matches the
 *     user's value (Equals or Contains). Honored by the fetch/XHR
 *     monkey-patch in `content-scripts.ts` for both static and dynamic
 *     request-body rules.
 *   - Static Data / Dynamic (JavaScript) toggle
 *   - Code editor for request body content
 *
 * Conditional blocks read their trigger value via `Form.Item shouldUpdate`
 * render props, not `Form.useWatch`. The useWatch subscription model has a
 * first-render timing race in this layout (already called out in
 * RuleEditor.tsx for HeaderRuleFields) that leaves Radio.Groups visibly
 * "stuck". shouldUpdate reads the current form value synchronously via
 * `getFieldValue`, so it is immune to that race and rerenders on the exact
 * field changes it declares.
 *
 * The dynamic-template prefill side effect lives in the parent editor's
 * `onValuesChange`, which sees the requestBodyType change via `changedValues`
 * the moment the Radio flips — no parallel hook needed here.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import CodeEditor from '../shared/CodeEditor';
import { getDocId } from '../docs/doc-ids';
import SectionInfo from '../shared/SectionInfo';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

export const REQUEST_BODY_DYNAMIC_TEMPLATE = `function modifyRequestBody(args) {
  const { method, url, body, bodyAsJson } = args;
  // Change request body below depending upon request attributes received in args

  return body;
}`;

const RequestBodyRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();
  const form = Form.useFormInstance();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <SectionInfo
          content={{
            kicker: 'Request Body Rule',
            title: 'Actions',
            summary: 'Replaces the body of matching requests before they are sent.',
            description: 'Static data swaps in a fixed payload; Dynamic runs JavaScript against the original body.',
          }}
          docId={() => {
            const bodyType = form.getFieldValue('requestBodyType');
            return getDocId(bodyType === 'dynamic' ? 'request-body-dynamic' : 'request-body-static', 'action');
          }}
        />
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Intercepts fetch() and XMLHttpRequest calls for REST or GraphQL API requests."
      />

      {/* Resource Type */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Select Resource Type
        </Text>
        <EntityField path={paths.apiResourceType}>
          <Form.Item name="requestResourceType" style={{ marginBottom: 0 }}>
            <Radio.Group>
              <Radio value="rest">REST API</Radio>
              <Radio value="graphql">GraphQL API</Radio>
            </Radio.Group>
          </Form.Item>
        </EntityField>
      </div>

      {/* GraphQL Operation filter — shown only when resourceType === 'graphql'. */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.requestResourceType !== cur.requestResourceType}>
        {({ getFieldValue }) => {
          if (getFieldValue('requestResourceType') !== 'graphql') return null;
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  GraphQL Operation (Request Payload Filter)
                </Text>
                <InfoCircleOutlined
                  style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                  onClick={() => openDocs(getDocId('request-body-graphql', 'action'))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <EntityField path={paths.graphqlKey}>
                  <Form.Item name="requestGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="Key e.g. operationName" />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlOperator}>
                  <Form.Item name="requestGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
                    <Select
                      size="small"
                      options={[
                        { value: 'Equals', label: 'Equals' },
                        { value: 'Contains', label: 'Contains' },
                      ]}
                    />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlValue}>
                  <Form.Item name="requestGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="value e.g. getUsers" />
                  </Form.Item>
                </EntityField>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    form.setFieldsValue({
                      requestGraphqlKey: undefined,
                      requestGraphqlOperator: 'Equals',
                      requestGraphqlValue: undefined,
                    });
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          );
        }}
      </Form.Item>

      {/* Body content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Request Body
          </Text>
          <EntityField path={paths.requestBodyType}>
            <Form.Item name="requestBodyType" style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="static">Static Data</Radio.Button>
                <Radio.Button value="dynamic">
                  Dynamic (JavaScript){' '}
                  <InfoCircleOutlined
                    style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDocs(getDocId('request-body-dynamic', 'action'));
                    }}
                  />
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          </EntityField>
        </div>

        {/* Dynamic info banner + the static/dynamic CodeEditor swap — both
            depend on requestBodyType, so they live in one shouldUpdate block. */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.requestBodyType !== cur.requestBodyType}>
          {({ getFieldValue }) => {
            const isDynamic = getFieldValue('requestBodyType') === 'dynamic';
            return (
              <>
                {isDynamic && (
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
                    Your function receives <code>{'{method, url, body, bodyAsJson}'}</code> and should return the
                    modified body. Return a string or an object (auto-serialized to JSON).
                  </div>
                )}
                {isDynamic ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="requestDynamicBody" schemaPath={paths.requestBody} />
                    </div>
                    <EntityField path={paths.requestBody}>
                      <Form.Item name="requestDynamicBody" style={{ marginBottom: 0 }}>
                        <CodeEditor language="javascript" minHeight={240} />
                      </Form.Item>
                    </EntityField>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="requestStaticBody" schemaPath={paths.requestBody} />
                    </div>
                    <EntityField path={paths.requestBody}>
                      <Form.Item name="requestStaticBody" style={{ marginBottom: 0 }}>
                        <CodeEditor language="json" placeholder={'{"key": "value"}'} minHeight={160} />
                      </Form.Item>
                    </EntityField>
                  </>
                )}
              </>
            );
          }}
        </Form.Item>
      </div>
    </div>
  );
};

export default RequestBodyRuleFields;
