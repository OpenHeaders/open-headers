/**
 * ResponseRuleFields — Modify Response rule configuration.
 *
 * Two independent axes (a 2×2):
 *   Response source — does the request reach the server?
 *     No  ('mock')    — respond without calling the server; the request
 *                       never leaves the browser.
 *     Yes ('network') — call the server, then change the reply before the
 *                       page sees it.
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

import { CloseOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import CodeEditor from '../shared/CodeEditor';
import { getDocId } from '../docs/doc-ids';
import { TemplateInput } from '../template-input';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

const STATUS_CODES = [
  {
    label: '1xx INFORMATIONAL',
    options: [
      { value: 100, label: '100 - Continue' },
      { value: 101, label: '101 - Switching Protocols' },
      { value: 102, label: '102 - Processing' },
      { value: 103, label: '103 - Early Hints' },
    ],
  },
  {
    label: '2xx SUCCESS',
    options: [
      { value: 200, label: '200 - OK' },
      { value: 201, label: '201 - Created' },
      { value: 202, label: '202 - Accepted' },
      { value: 203, label: '203 - Non-Authoritative Information' },
      { value: 204, label: '204 - No Content' },
      { value: 205, label: '205 - Reset Content' },
      { value: 206, label: '206 - Partial Content' },
      { value: 207, label: '207 - Multi-Status' },
      { value: 208, label: '208 - Already Reported' },
      { value: 226, label: '226 - IM Used' },
    ],
  },
  {
    label: '3xx REDIRECTION',
    options: [
      { value: 300, label: '300 - Multiple Choices' },
      { value: 301, label: '301 - Moved Permanently' },
      { value: 302, label: '302 - Found' },
      { value: 303, label: '303 - See Other' },
      { value: 304, label: '304 - Not Modified' },
      { value: 305, label: '305 - Use Proxy' },
      { value: 307, label: '307 - Temporary Redirect' },
      { value: 308, label: '308 - Permanent Redirect' },
    ],
  },
  {
    label: '4xx CLIENT ERROR',
    options: [
      { value: 400, label: '400 - Bad Request' },
      { value: 401, label: '401 - Unauthorized' },
      { value: 402, label: '402 - Payment Required' },
      { value: 403, label: '403 - Forbidden' },
      { value: 404, label: '404 - Not Found' },
      { value: 405, label: '405 - Method Not Allowed' },
      { value: 406, label: '406 - Not Acceptable' },
      { value: 407, label: '407 - Proxy Authentication Required' },
      { value: 408, label: '408 - Request Timeout' },
      { value: 409, label: '409 - Conflict' },
      { value: 410, label: '410 - Gone' },
      { value: 411, label: '411 - Length Required' },
      { value: 412, label: '412 - Precondition Failed' },
      { value: 413, label: '413 - Payload Too Large' },
      { value: 414, label: '414 - URI Too Long' },
      { value: 415, label: '415 - Unsupported Media Type' },
      { value: 416, label: '416 - Range Not Satisfiable' },
      { value: 417, label: '417 - Expectation Failed' },
      { value: 418, label: "418 - I'm a Teapot" },
      { value: 421, label: '421 - Misdirected Request' },
      { value: 422, label: '422 - Unprocessable Entity' },
      { value: 423, label: '423 - Locked' },
      { value: 424, label: '424 - Failed Dependency' },
      { value: 425, label: '425 - Too Early' },
      { value: 426, label: '426 - Upgrade Required' },
      { value: 428, label: '428 - Precondition Required' },
      { value: 429, label: '429 - Too Many Requests' },
      { value: 431, label: '431 - Request Header Fields Too Large' },
      { value: 451, label: '451 - Unavailable For Legal Reasons' },
    ],
  },
  {
    label: '5xx SERVER ERROR',
    options: [
      { value: 500, label: '500 - Internal Server Error' },
      { value: 501, label: '501 - Not Implemented' },
      { value: 502, label: '502 - Bad Gateway' },
      { value: 503, label: '503 - Service Unavailable' },
      { value: 504, label: '504 - Gateway Timeout' },
      { value: 505, label: '505 - HTTP Version Not Supported' },
      { value: 506, label: '506 - Variant Also Negotiates' },
      { value: 507, label: '507 - Insufficient Storage' },
      { value: 508, label: '508 - Loop Detected' },
      { value: 510, label: '510 - Not Extended' },
      { value: 511, label: '511 - Network Authentication Required' },
    ],
  },
];

// Common Content-Type values surfaced as autocomplete suggestions. Users
// can type any value freely; this is a convenience, not a constraint.
// Order: most-likely-first (JSON dominates API mocking).
const CONTENT_TYPE_OPTIONS = [
  { value: 'application/json' },
  { value: 'application/xml' },
  { value: 'application/javascript' },
  { value: 'application/octet-stream' },
  { value: 'text/plain' },
  { value: 'text/html' },
  { value: 'text/css' },
  { value: 'text/csv' },
  { value: 'image/png' },
  { value: 'image/jpeg' },
  { value: 'image/svg+xml' },
];

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
  const { openDocs } = useInspectorNav();
  const form = Form.useFormInstance();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => {
            const bodyType = form.getFieldValue('responseBodyType');
            openDocs(getDocId(bodyType === 'dynamic' ? 'response-dynamic' : 'response-static', 'action'));
          }}
        />
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Acts on fetch() and XMLHttpRequest responses for REST or GraphQL API requests."
      />

      {/* Response source — does the request reach the server? Leads with the
          network question so users pick by behavior, not by jargon. The live
          status line below reframes the status/CT/header fields per mode. */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Response source — does the request reach the server?
        </Text>
        <EntityField path={paths.responseSource}>
          <Form.Item name="responseSource" style={{ marginBottom: 0 }}>
            <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Radio value="mock">
                <Text style={{ fontSize: 12 }}>No</Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                  — respond without calling the server · the request never leaves the browser · also called "mock"
                </Text>
              </Radio>
              <Radio value="network">
                <Text style={{ fontSize: 12 }}>Yes</Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                  — call the server, then change the response · the real request is sent; you modify what comes back
                </Text>
              </Radio>
            </Radio.Group>
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
                  ? '🌐 The request is sent, then your changes are applied to the reply.'
                  : '⚡ No request is sent — the page gets your response directly.'}
              </div>
            );
          }}
        </Form.Item>
      </div>

      {/* Resource Type */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Select Resource Type
        </Text>
        <EntityField path={paths.apiResourceType}>
          <Form.Item name="responseResourceType" style={{ marginBottom: 0 }}>
            <Radio.Group>
              <Radio value="rest">REST API</Radio>
              <Radio value="graphql">GraphQL API</Radio>
            </Radio.Group>
          </Form.Item>
        </EntityField>
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
                <InfoCircleOutlined
                  style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                  onClick={() => openDocs(getDocId('response-graphql', 'action'))}
                />
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

      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Response Status Code
        </Text>
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

      {/* Content-Type — a single header that controls how the browser parses
          the body. Defaults to application/json (the dominant API mocking
          case). When calling the network, it overrides the real reply's CT
          only if set. AutoComplete: typed value passes through verbatim,
          the suggestions are convenience, not a constraint. */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Content-Type
        </Text>
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
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '' })}>
                Add Header
              </Button>
            </>
          )}
        </Form.List>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Response Body
          </Text>
          <EntityField path={paths.responseBodyType}>
            <Form.Item name="responseBodyType" style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="static">Static Data</Radio.Button>
                <Radio.Button value="dynamic">
                  Dynamic (JavaScript){' '}
                  <InfoCircleOutlined
                    style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDocs(getDocId('response-dynamic', 'action'));
                    }}
                  />
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
                        <CodeEditor language="javascript" minHeight={240} />
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
