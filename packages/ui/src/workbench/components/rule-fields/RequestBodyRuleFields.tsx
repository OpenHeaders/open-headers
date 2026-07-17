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

import { Alert, Button, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import CodeEditor from '../shared/CodeEditor';
import { getDocId } from '../docs/doc-ids';
import DocInfo from '../shared/DocInfo';
import SectionInfo from '../shared/SectionInfo';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

// JSON format example — raw by design across the rule editors.
const PAYLOAD_EXAMPLE = '{"key": "value"}';

export const REQUEST_BODY_DYNAMIC_TEMPLATE = `function modifyRequestBody(args) {
  const { method, url, body, bodyAsJson } = args;
  // Change request body below depending upon request attributes received in args

  return body;
}`;

const RequestBodyRuleFields: React.FC = () => {
  const t = useT();
  const form = Form.useFormInstance();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.editors.rule.fields.actionsTitle')}
        </Text>
        <SectionInfo
          content={{
            kicker: t('workbench.editors.rule.fields.requestBody.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.requestBody.infoSummary'),
            description: t('workbench.editors.rule.fields.requestBody.infoDescription'),
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
        message={t('workbench.editors.rule.fields.requestBody.interceptsAlert')}
      />

      {/* Resource Type */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          {t('workbench.editors.rule.fields.requestBody.selectResourceType')}
        </Text>
        <EntityField path={paths.apiResourceType}>
          <Form.Item name="requestResourceType" style={{ marginBottom: 0 }}>
            <Radio.Group>
              <Radio value="rest">{t('workbench.editors.rule.fields.restApi')}</Radio>
              <Radio value="graphql">{t('workbench.editors.rule.fields.graphqlApi')}</Radio>
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
                  {t('workbench.editors.rule.fields.graphqlFilterLabel')}
                </Text>
                <DocInfo docId={getDocId('request-body-graphql', 'action')} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <EntityField path={paths.graphqlKey}>
                  <Form.Item name="requestGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder={t('workbench.editors.rule.fields.graphqlKeyPlaceholder')} />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlOperator}>
                  <Form.Item name="requestGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
                    <Select
                      size="small"
                      options={[
                        { value: 'Equals', label: t('workbench.editors.rule.fields.operatorEquals') },
                        { value: 'Contains', label: t('workbench.editors.rule.fields.operatorContains') },
                      ]}
                    />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlValue}>
                  <Form.Item name="requestGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder={t('workbench.editors.rule.fields.graphqlValuePlaceholder')} />
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
                  {t('workbench.editors.rule.fields.reset')}
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
            {t('workbench.editors.rule.fields.requestBody.bodyLabel')}
          </Text>
          <EntityField path={paths.requestBodyType}>
            <Form.Item name="requestBodyType" style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="static">{t('workbench.editors.rule.fields.staticData')}</Radio.Button>
                <Radio.Button value="dynamic">
                  {t('workbench.editors.rule.fields.dynamicJs')} <DocInfo docId={getDocId('request-body-dynamic', 'action')} />
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
                    {t('workbench.editors.rule.fields.requestBody.dynamicHintBefore')}{' '}
                    <code>{'{method, url, body, bodyAsJson}'}</code>{' '}
                    {t('workbench.editors.rule.fields.requestBody.dynamicHintAfter')}
                  </div>
                )}
                {isDynamic ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="requestDynamicBody" schemaPath={paths.requestBody} />
                    </div>
                    <EntityField path={paths.requestBody}>
                      <Form.Item name="requestDynamicBody" style={{ marginBottom: 0 }}>
                        <CodeEditor language="javascript" minHeight={240} valueDetection />
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
                        <CodeEditor language="json" placeholder={PAYLOAD_EXAMPLE} minHeight={160} valueDetection />
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
