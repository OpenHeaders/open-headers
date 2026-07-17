/**
 * ResponseRuleFields — Modify Response rule configuration.
 *
 * Two independent axes (a 2×2):
 *   Response source — a two-mode Segmented:
 *     Mock   ('mock')    — respond without calling the server; the request
 *                          never leaves the browser.
 *     Modify ('network') — call the server, then change the reply before
 *                          the page sees it.
 *   Body type — how the body is produced:
 *     Static Data — a literal response body (JSON, HTML, etc.)
 *     Dynamic (JavaScript) — mock builds the body via buildResponse(),
 *       network transforms the real one via modifyResponse().
 *
 * Status code, Content-Type and Response Headers are relevant in both
 * source modes — synthetic values when mocking, overrides merged onto
 * the real reply when calling the network. The live status line under
 * the source toggle reframes them per mode.
 *
 * Conditional blocks read their trigger value via `Form.Item shouldUpdate`
 * render props, not `Form.useWatch`. The useWatch subscription model has a
 * first-render timing race in this layout (already called out in
 * RuleEditor.tsx for HeaderRuleFields) that leaves Radio.Groups visibly
 * "stuck". shouldUpdate reads the current form value synchronously via
 * `getFieldValue`, so it is immune to that race.
 *
 * The dynamic-template prefill side effect lives in the parent editor's
 * `onValuesChange`, which sees the responseBodyType / responseSource
 * change via `changedValues` the moment the Radio flips — no parallel
 * hook needed here.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { AutoComplete, Button, Form, Input, Radio, Segmented, Select, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import CodeEditor from '../shared/CodeEditor';
import FormatAwareBodyEditor from './FormatAwareBodyEditor';
import { getDocId } from '../docs/doc-ids';
import DocInfo from '../shared/DocInfo';
import SectionInfo from '../shared/SectionInfo';
import { TemplateInput } from '../template-input';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';
import { CONTENT_TYPE_OPTIONS, STATUS_CODES } from './status-codes';

const { Text } = Typography;

// JSON format example — raw by design across the rule editors.
const RESPONSE_BODY_EXAMPLE = '{"message": "custom response", "data": []}';

// network + dynamic — the real response is fetched, then transformed.
export const RESPONSE_MODIFY_TEMPLATE = `function modifyResponse(args) {
  const { method, url, response, responseType, requestHeaders, requestData, responseJSON } = args;
  // Change response below depending upon request attributes received in args

  return response;
}`;

// mock + dynamic — no network call; the body is synthesized from request
// context. Status, Content-Type and headers come from the fields above.
export const RESPONSE_BUILD_TEMPLATE = `function buildResponse({ method, url, requestBody }) {
  // Build and return the response body below depending upon the request

  return {};
}`;

const ResponseRuleFields: React.FC = () => {
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
            kicker: t('workbench.editors.rule.fields.response.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.response.infoSummary'),
            description: t('workbench.editors.rule.fields.response.infoDescription'),
          }}
          docId={() => {
            const bodyType = form.getFieldValue('responseBodyType');
            return getDocId(bodyType === 'dynamic' ? 'response-dynamic' : 'response-static', 'action');
          }}
        />
      </div>
      {/* Response source — a two-mode Segmented (mock vs modify). The labels
          carry the explanation; the caption below reframes per mode. */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            {t('workbench.editors.rule.fields.response.sourceLabel')}
          </Text>
          <SectionInfo
            content={{
              kicker: t('workbench.editors.rule.fields.response.kicker'),
              title: t('workbench.editors.rule.fields.response.sourceLabel'),
              summary: t('workbench.editors.rule.fields.response.sourceInfoSummary'),
              description: t('workbench.editors.rule.fields.response.sourceInfoDescription'),
            }}
          />
        </div>
        <EntityField path={paths.responseSource}>
          <Form.Item name="responseSource" style={{ marginBottom: 0 }}>
            <Segmented
              size="small"
              options={[
                { value: 'mock', label: t('workbench.editors.rule.fields.response.sourceMock') },
                { value: 'network', label: t('workbench.editors.rule.fields.response.sourceNetwork') },
              ]}
            />
          </Form.Item>
        </EntityField>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.responseSource !== cur.responseSource}>
          {({ getFieldValue }) => {
            const isNetwork = getFieldValue('responseSource') === 'network';
            return (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ant-color-text-secondary)',
                  lineHeight: 1.5,
                  marginTop: 6,
                }}
              >
                {isNetwork
                  ? t('workbench.editors.rule.fields.response.sourceNoteNetwork')
                  : t('workbench.editors.rule.fields.response.sourceNoteMock')}
              </div>
            );
          }}
        </Form.Item>
      </div>

      {/* Resource Type · Status Code · Content-Type — one compact row.
          Content-Type is the header controlling how the browser parses the
          body; defaults to application/json. When calling the network,
          status/CT override the real reply only when set. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: '0 0 140px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12 }}>
              {t('workbench.editors.rule.fields.response.resourceType')}
            </Text>
            <SectionInfo
              content={{
                kicker: t('workbench.editors.rule.fields.response.kicker'),
                title: t('workbench.editors.rule.fields.response.resourceType'),
                summary: t('workbench.editors.rule.fields.response.resourceTypeInfoSummary'),
                description: t('workbench.editors.rule.fields.response.resourceTypeInfoDescription'),
              }}
              docId={getDocId('response-graphql', 'action')}
            />
          </div>
          <EntityField path={paths.apiResourceType}>
            <Form.Item name="responseResourceType" style={{ marginBottom: 0 }}>
              <Select
                options={[
                  { value: 'rest', label: t('workbench.editors.rule.fields.restApi') },
                  { value: 'graphql', label: t('workbench.editors.rule.fields.graphqlApi') },
                ]}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </EntityField>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12 }}>
              {t('workbench.editors.rule.fields.response.statusCode')}
            </Text>
            <SectionInfo
              content={{
                kicker: t('workbench.editors.rule.fields.response.kicker'),
                title: t('workbench.editors.rule.fields.response.statusCode'),
                summary: t('workbench.editors.rule.fields.response.statusCodeInfoSummary'),
                description: t('workbench.editors.rule.fields.response.statusCodeInfoDescription'),
              }}
              docId={getDocId('response-static', 'action')}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <EntityField path={paths.responseStatusCode}>
              <Form.Item name="responseStatusCode" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
                <Select
                  allowClear={{ clearIcon: <span style={{ fontSize: 12, padding: '0 4px' }}>✕</span> }}
                  showSearch
                  placeholder={t('workbench.editors.rule.fields.response.keepOriginalStatus')}
                  options={[{ value: 0, label: t('workbench.editors.rule.fields.response.keepOriginalStatus') }, ...STATUS_CODES]}
                  style={{ width: '100%' }}
                  filterOption={(input, option) => {
                    const label = String(option?.label ?? '');
                    return label.toLowerCase().includes(input.toLowerCase());
                  }}
                />
              </Form.Item>
            </EntityField>
            <ScalarConflictChip formName="responseStatusCode" schemaPath={paths.responseStatusCode} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12 }}>
              {t('workbench.editors.rule.fields.response.contentType')}
            </Text>
            <SectionInfo
              content={{
                kicker: t('workbench.editors.rule.fields.response.kicker'),
                title: t('workbench.editors.rule.fields.response.contentType'),
                summary: t('workbench.editors.rule.fields.response.contentTypeInfoSummary'),
                description: t('workbench.editors.rule.fields.response.contentTypeInfoDescription'),
              }}
              docId={getDocId('response-static', 'action')}
            />
          </div>
          <EntityField path={paths.responseContentType}>
            <Form.Item name="responseContentType" style={{ marginBottom: 0 }}>
              <AutoComplete
                options={CONTENT_TYPE_OPTIONS}
                placeholder="application/json"
                style={{ width: '100%' }}
                filterOption={(input, option) => {
                  const value = String(option?.value ?? '');
                  return value.toLowerCase().includes(input.toLowerCase());
                }}
              />
            </Form.Item>
          </EntityField>
        </div>
      </div>

      {/* GraphQL Operation filter — shown only when resourceType === 'graphql'. */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.responseResourceType !== cur.responseResourceType}>
        {({ getFieldValue }) => {
          if (getFieldValue('responseResourceType') !== 'graphql') return null;
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('workbench.editors.rule.fields.graphqlFilterLabel')}
                </Text>
                <DocInfo docId={getDocId('response-graphql', 'action')} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <EntityField path={paths.graphqlKey}>
                  <Form.Item name="responseGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder={t('workbench.editors.rule.fields.graphqlKeyPlaceholder')} />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlOperator}>
                  <Form.Item name="responseGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
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
                  <Form.Item name="responseGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder={t('workbench.editors.rule.fields.graphqlValuePlaceholder')} />
                  </Form.Item>
                </EntityField>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    form.setFieldsValue({
                      responseGraphqlKey: undefined,
                      responseGraphqlOperator: 'Equals',
                      responseGraphqlValue: undefined,
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

      {/* Response Headers — additional headers applied alongside Content-Type.
          Stored in the schema as a Record<string, string>; the form-state
          shape is an array of {name, value} rows so Form.List can manage
          add/remove. Conversion happens in RuleEditor's load + save paths.
          Empty rows are dropped on save. When calling the network, these
          merge over the real reply's headers; an empty map keeps the
          server's. */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            {t('workbench.editors.rule.fields.response.headersLabel')}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.editors.rule.fields.optionalTag')}
          </Text>
          <SectionInfo
            content={{
              kicker: t('workbench.editors.rule.fields.response.kicker'),
              title: t('workbench.editors.rule.fields.response.headersLabel'),
              summary: t('workbench.editors.rule.fields.response.headersInfoSummary'),
              description: t('workbench.editors.rule.fields.response.headersInfoDescription'),
            }}
            docId={getDocId('response-static', 'action')}
          />
        </div>
        <Form.List name="responseHeaderRows">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Form.Item
                  noStyle
                  key={field.key}
                  shouldUpdate={(prev, cur) =>
                    prev.responseHeaderRows?.[field.name]?.name !== cur.responseHeaderRows?.[field.name]?.name
                  }
                >
                  {({ getFieldValue }) => {
                    // Response headers are schema-keyed by header name
                    // (`Record<string,string>`), so the current `name`
                    // value IS the row identity. Two surfaces editing
                    // "X-Foo" agree on the path; a half-typed "X-Fo"
                    // produces a transient path until the names converge.
                    const headerName = String(getFieldValue(['responseHeaderRows', field.name, 'name']) ?? '');
                    const wrap = (leaf: 'name' | 'value', child: React.ReactNode) =>
                      headerName ? <EntityField path={paths.responseHeader(headerName, leaf)}>{child}</EntityField> : child;
                    return (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        {wrap(
                          'name',
                          <Form.Item
                            {...field}
                            name={[field.name, 'name']}
                            style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                          >
                            <Input size="small" placeholder={t('workbench.editors.rule.fields.response.headerNamePlaceholder')} />
                          </Form.Item>,
                        )}
                        {wrap(
                          'value',
                          <Form.Item
                            {...field}
                            name={[field.name, 'value']}
                            style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
                          >
                            <TemplateInput
                              size="small"
                              placeholder={t('workbench.editors.rule.fields.response.headerValuePlaceholder')}
                              wrap
                              maxRows={4}
                              resizable
                              allowClear
                            />
                          </Form.Item>,
                        )}
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined style={{ fontSize: 10 }} />}
                          onClick={() => remove(field.name)}
                          style={{ color: 'var(--ant-color-text-tertiary)', flexShrink: 0 }}
                        />
                      </div>
                    );
                  }}
                </Form.Item>
              ))}
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => add({ name: '', value: '' })}
                style={{ fontSize: 12 }}
              >
                {t('workbench.editors.rule.fields.response.addHeader')}
              </Button>
            </>
          )}
        </Form.List>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ fontSize: 12 }}>
              {t('workbench.editors.rule.fields.response.bodyLabel')}
            </Text>
            <SectionInfo
              content={{
                kicker: t('workbench.editors.rule.fields.response.kicker'),
                title: t('workbench.editors.rule.fields.response.bodyLabel'),
                summary: t('workbench.editors.rule.fields.response.bodyInfoSummary'),
                description: t('workbench.editors.rule.fields.response.bodyInfoDescription'),
              }}
              docId={() => {
                const bodyType = form.getFieldValue('responseBodyType');
                return getDocId(bodyType === 'dynamic' ? 'response-dynamic' : 'response-static', 'action');
              }}
            />
          </div>
          <EntityField path={paths.responseBodyType}>
            <Form.Item name="responseBodyType" style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="static">
                  {t('workbench.editors.rule.fields.staticData')} <DocInfo docId={getDocId('response-static', 'action')} />
                </Radio.Button>
                <Radio.Button value="dynamic">
                  {t('workbench.editors.rule.fields.dynamicJs')} <DocInfo docId={getDocId('response-dynamic', 'action')} />
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          </EntityField>
        </div>

        {/* Dynamic info banner + the static/dynamic CodeEditor swap — both
            depend on responseBodyType, and the banner copy also depends on
            responseSource, so they live in one shouldUpdate block. */}
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) =>
            prev.responseBodyType !== cur.responseBodyType || prev.responseSource !== cur.responseSource
          }
        >
          {({ getFieldValue }) => {
            const isDynamic = getFieldValue('responseBodyType') === 'dynamic';
            const isNetwork = getFieldValue('responseSource') === 'network';
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
                    {isNetwork ? (
                      <>
                        {t('workbench.editors.rule.fields.response.dynNetworkBefore')} <code>modifyResponse()</code>{' '}
                        {t('workbench.editors.rule.fields.response.dynNetworkAfter')}
                      </>
                    ) : (
                      <>
                        {t('workbench.editors.rule.fields.response.dynMockBefore')} <code>buildResponse()</code>{' '}
                        {t('workbench.editors.rule.fields.response.dynMockMid')}{' '}
                        <code>{'{method, url, requestBody}'}</code>{' '}
                        {t('workbench.editors.rule.fields.response.dynMockAfter')}
                      </>
                    )}
                  </div>
                )}
                {isDynamic ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="responseDynamicBody" schemaPath={paths.responseBody} />
                    </div>
                    <EntityField path={paths.responseBody}>
                      <Form.Item name="responseDynamicBody" style={{ marginBottom: 0 }}>
                        <CodeEditor language="javascript" minHeight={240} valueDetection />
                      </Form.Item>
                    </EntityField>
                  </>
                ) : (
                  <EntityField path={paths.responseBody}>
                    <Form.Item name="responseStaticBody" style={{ marginBottom: 0 }}>
                      <FormatAwareBodyEditor
                        placeholder={RESPONSE_BODY_EXAMPLE}
                        minHeight={160}
                        valueDetection
                        extra={<ScalarConflictChip formName="responseStaticBody" schemaPath={paths.responseBody} />}
                      />
                    </Form.Item>
                  </EntityField>
                )}
              </>
            );
          }}
        </Form.Item>
      </div>
    </div>
  );
};

export default ResponseRuleFields;
