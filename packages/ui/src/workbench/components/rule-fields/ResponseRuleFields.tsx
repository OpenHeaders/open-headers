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
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import CodeEditor from '../shared/CodeEditor';
import { getDocId } from '../docs/doc-ids';
import DocInfo from '../shared/DocInfo';
import SectionInfo from '../shared/SectionInfo';
import { TemplateInput } from '../template-input';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';
import { CONTENT_TYPE_OPTIONS, STATUS_CODES } from './status-codes';

const { Text } = Typography;

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
            kicker: 'Response Rule',
            title: 'Actions',
            summary: 'Serves a substitute response for matching requests instead of what the server returned.',
            description: 'Static data serves a fixed payload; Dynamic runs JavaScript against the original response.',
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
            Response source
          </Text>
          <SectionInfo
            content={{
              kicker: 'Response Rule',
              title: 'Response source',
              summary: 'Acts on fetch() and XMLHttpRequest responses for REST or GraphQL API requests.',
              description:
                "Mock serves your body without calling the server; Modify sends the real request and edits the reply before the page sees it.",
            }}
          />
        </div>
        <EntityField path={paths.responseSource}>
          <Form.Item name="responseSource" style={{ marginBottom: 0 }}>
            <Segmented
              size="small"
              options={[
                { value: 'mock', label: '⚡ Mock — no request sent' },
                { value: 'network', label: "🌐 Modify — edit the server's reply" },
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
                  ? 'The real request is sent; your changes are applied to the reply before the page sees it.'
                  : 'The request never leaves the browser — the page gets your response directly.'}
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
              Resource Type
            </Text>
            <SectionInfo
              content={{
                kicker: 'Response Rule',
                title: 'Resource Type',
                summary: 'Which API payload shape the rule targets — REST or GraphQL.',
                description:
                  'GraphQL unlocks an operation filter below, so the rule can match a single operation inside a shared endpoint.',
              }}
              docId={getDocId('response-graphql', 'action')}
            />
          </div>
          <EntityField path={paths.apiResourceType}>
            <Form.Item name="responseResourceType" style={{ marginBottom: 0 }}>
              <Select
                options={[
                  { value: 'rest', label: 'REST API' },
                  { value: 'graphql', label: 'GraphQL API' },
                ]}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </EntityField>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12 }}>
              Status Code
            </Text>
            <SectionInfo
              content={{
                kicker: 'Response Rule',
                title: 'Status Code',
                summary: 'The HTTP status served with your response.',
                description:
                  "Pick a code to serve, or keep the original one from the server's reply when calling the server.",
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
                  placeholder="Keep original status code"
                  options={[{ value: 0, label: 'Keep original status code' }, ...STATUS_CODES]}
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
              Content-Type
            </Text>
            <SectionInfo
              content={{
                kicker: 'Response Rule',
                title: 'Content-Type',
                summary: 'The Content-Type header served with the body — controls how the browser parses it.',
                description:
                  "Type any value; the suggestions are a convenience. When calling the server, it overrides the real reply's Content-Type only when set.",
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
                  GraphQL Operation (Request Payload Filter)
                </Text>
                <DocInfo docId={getDocId('response-graphql', 'action')} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <EntityField path={paths.graphqlKey}>
                  <Form.Item name="responseGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="Key e.g. operationName" />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlOperator}>
                  <Form.Item name="responseGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
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
                  <Form.Item name="responseGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="value e.g. getUsers" />
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
                  Reset
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
            Response Headers
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            (optional)
          </Text>
          <SectionInfo
            content={{
              kicker: 'Response Rule',
              title: 'Response Headers',
              summary: 'Extra headers served alongside Content-Type.',
              description:
                "When calling the server these merge over the real reply's headers; when mocking they become the reply's headers. Empty rows are dropped on save.",
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
                            <Input size="small" placeholder="Header name (e.g. X-Custom)" />
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
                              placeholder="Header value"
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
                Add header
              </Button>
            </>
          )}
        </Form.List>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ fontSize: 12 }}>
              Response Body
            </Text>
            <SectionInfo
              content={{
                kicker: 'Response Rule',
                title: 'Response Body',
                summary: 'The payload served to the page for matching requests.',
                description:
                  'Static Data serves a fixed body; Dynamic (JavaScript) builds or transforms it at request time.',
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
                  Static Data <DocInfo docId={getDocId('response-static', 'action')} />
                </Radio.Button>
                <Radio.Button value="dynamic">
                  Dynamic (JavaScript) <DocInfo docId={getDocId('response-dynamic', 'action')} />
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
                        The real request is made first. Your <code>modifyResponse()</code> function receives the response
                        and request context, then returns the modified response. Return a string or an object
                        (auto-serialized to JSON).
                      </>
                    ) : (
                      <>
                        No request is sent. Your <code>buildResponse()</code> function receives{' '}
                        <code>{'{method, url, requestBody}'}</code> and returns the response body. Return a string or an
                        object (auto-serialized to JSON).
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
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="responseStaticBody" schemaPath={paths.responseBody} />
                    </div>
                    <EntityField path={paths.responseBody}>
                      <Form.Item name="responseStaticBody" style={{ marginBottom: 0 }}>
                        <CodeEditor
                          language="json"
                          placeholder={'{"message": "custom response", "data": []}'}
                          minHeight={160}
                          valueDetection
                        />
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

export default ResponseRuleFields;
