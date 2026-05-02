/**
 * BodyRuleFields — Modify Request Body rule configuration.
 *
 * Layout:
 *   - Resource Type selector: REST API / GraphQL API
 *   - GraphQL Operation filter — when GraphQL is selected, fires only
 *     on requests whose JSON payload's configured field matches the
 *     user's value (Equals or Contains). Honored by the fetch/XHR
 *     monkey-patch in `content-scripts.ts` for both static and dynamic
 *     body rules.
 *   - Static Data / Dynamic (JavaScript) toggle
 *   - Code editor for body content
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
 * `onValuesChange`, which sees the bodyModType change via `changedValues`
 * the moment the Radio flips — no parallel hook needed here.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { RULE_FIELD } from '@/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import CodeEditor from '../CodeEditor';
import { getDocId } from '../InspectorDocs';
import { RuleField } from './RuleField';
import ScalarConflictChip from './ScalarConflictChip';
import type { ConflictBridge } from './use-rule-conflicts';

const { Text } = Typography;

export const BODY_DYNAMIC_TEMPLATE = `function modifyRequestBody(args) {
  const { method, url, body, bodyAsJson } = args;
  // Change request body below depending upon request attributes received in args

  return body;
}`;

interface BodyRuleFieldsProps {
  conflicts?: ConflictBridge;
}

const BodyRuleFields: React.FC<BodyRuleFieldsProps> = ({ conflicts }) => {
  const { openDocs } = useInspectorNav();
  const form = Form.useFormInstance();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => {
            const bodyType = form.getFieldValue('bodyModType');
            openDocs(getDocId(bodyType === 'dynamic' ? 'body-dynamic' : 'body-static', 'action'));
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
        <RuleField path={RULE_FIELD.bodyResourceType}>
          <Form.Item name="bodyResourceType" style={{ marginBottom: 0 }}>
            <Radio.Group>
              <Radio value="rest">REST API</Radio>
              <Radio value="graphql">GraphQL API</Radio>
            </Radio.Group>
          </Form.Item>
        </RuleField>
      </div>

      {/* GraphQL Operation filter — shown only when resourceType === 'graphql'. */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.bodyResourceType !== cur.bodyResourceType}>
        {({ getFieldValue }) => {
          if (getFieldValue('bodyResourceType') !== 'graphql') return null;
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  GraphQL Operation (Request Payload Filter)
                </Text>
                <InfoCircleOutlined
                  style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                  onClick={() => openDocs(getDocId('body-graphql', 'action'))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <RuleField path={RULE_FIELD.graphqlKey}>
                  <Form.Item name="bodyGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="Key e.g. operationName" />
                  </Form.Item>
                </RuleField>
                <RuleField path={RULE_FIELD.graphqlOperator}>
                  <Form.Item name="bodyGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
                    <Select
                      size="small"
                      options={[
                        { value: 'Equals', label: 'Equals' },
                        { value: 'Contains', label: 'Contains' },
                      ]}
                    />
                  </Form.Item>
                </RuleField>
                <RuleField path={RULE_FIELD.graphqlValue}>
                  <Form.Item name="bodyGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="value e.g. getUsers" />
                  </Form.Item>
                </RuleField>
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
          );
        }}
      </Form.Item>

      {/* Body content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Request Body
          </Text>
          <RuleField path={RULE_FIELD.bodyType}>
            <Form.Item name="bodyModType" style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="static">Static Data</Radio.Button>
                <Radio.Button value="dynamic">
                  Dynamic (JavaScript){' '}
                  <InfoCircleOutlined
                    style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDocs(getDocId('body-dynamic', 'action'));
                    }}
                  />
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          </RuleField>
        </div>

        {/* Dynamic info banner + the static/dynamic CodeEditor swap — both
            depend on bodyModType, so they live in one shouldUpdate block. */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.bodyModType !== cur.bodyModType}>
          {({ getFieldValue }) => {
            const isDynamic = getFieldValue('bodyModType') === 'dynamic';
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
                      <ScalarConflictChip
                        formName="bodyDynamicContent"
                        schemaPath={RULE_FIELD.body}
                        conflicts={conflicts}
                      />
                    </div>
                    <RuleField path={RULE_FIELD.body}>
                      <Form.Item name="bodyDynamicContent" style={{ marginBottom: 0 }}>
                        <CodeEditor language="javascript" minHeight={240} />
                      </Form.Item>
                    </RuleField>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip
                        formName="bodyStaticContent"
                        schemaPath={RULE_FIELD.body}
                        conflicts={conflicts}
                      />
                    </div>
                    <RuleField path={RULE_FIELD.body}>
                      <Form.Item name="bodyStaticContent" style={{ marginBottom: 0 }}>
                        <CodeEditor language="json" placeholder={'{"key": "value"}'} minHeight={160} />
                      </Form.Item>
                    </RuleField>
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

export default BodyRuleFields;
