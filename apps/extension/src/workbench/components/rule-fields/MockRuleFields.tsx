/**
 * MockRuleFields — Modify API Response rule configuration.
 *
 * Two modes:
 *   Static Data — user provides a literal response body (JSON, HTML, etc.)
 *   Dynamic (JavaScript) — user writes a modifyResponse() function that
 *     receives request context and returns the modified response.
 *
 * Conditional blocks read their trigger value via `Form.Item shouldUpdate`
 * render props, not `Form.useWatch`. The useWatch subscription model has a
 * first-render timing race in this layout (already called out in
 * RuleEditor.tsx for HeaderRuleFields) that leaves Radio.Groups visibly
 * "stuck". shouldUpdate reads the current form value synchronously via
 * `getFieldValue`, so it is immune to that race.
 *
 * The dynamic-template prefill side effect lives in the parent editor's
 * `onValuesChange`, which sees the mockBodyType change via `changedValues`
 * the moment the Radio flips — no parallel hook needed here.
 */

import { CloseOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import CodeEditor from '../CodeEditor';
import { getDocId } from '../InspectorDocs';
import { TemplateInput } from '../template-input';
import ScalarConflictChip from '@/shared/conflicts/ScalarConflictChip';

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

export const MOCK_DYNAMIC_TEMPLATE = `function modifyResponse(args) {
  const { method, url, response, responseType, requestHeaders, requestData, responseJSON } = args;
  // Change response below depending upon request attributes received in args

  return response;
}`;

const MockRuleFields: React.FC = () => {
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
            const bodyType = form.getFieldValue('mockBodyType');
            openDocs(getDocId(bodyType === 'dynamic' ? 'mock-dynamic' : 'mock-static', 'action'));
          }}
        />
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Intercepts fetch() and XMLHttpRequest calls and returns your custom response."
      />

      {/* Resource Type */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Select Resource Type
        </Text>
        <EntityField path={paths.bodyResourceType}>
          <Form.Item name="mockResourceType" style={{ marginBottom: 0 }}>
            <Radio.Group>
              <Radio value="rest">REST API</Radio>
              <Radio value="graphql">GraphQL API</Radio>
            </Radio.Group>
          </Form.Item>
        </EntityField>
      </div>

      {/* GraphQL Operation filter — shown only when resourceType === 'graphql'. */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.mockResourceType !== cur.mockResourceType}>
        {({ getFieldValue }) => {
          if (getFieldValue('mockResourceType') !== 'graphql') return null;
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
                <EntityField path={paths.graphqlKey}>
                  <Form.Item name="mockGraphqlKey" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="Key e.g. operationName" />
                  </Form.Item>
                </EntityField>
                <EntityField path={paths.graphqlOperator}>
                  <Form.Item name="mockGraphqlOperator" style={{ marginBottom: 0, width: 120 }}>
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
                  <Form.Item name="mockGraphqlValue" style={{ marginBottom: 0, flex: 1 }}>
                    <Input size="small" placeholder="value e.g. getUsers" />
                  </Form.Item>
                </EntityField>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    form.setFieldsValue({
                      mockGraphqlKey: undefined,
                      mockGraphqlOperator: 'Equals',
                      mockGraphqlValue: undefined,
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
          <EntityField path={paths.mockStatusCode}>
            <Form.Item name="mockStatusCode" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
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
          <ScalarConflictChip formName="mockStatusCode" schemaPath={paths.mockStatusCode} />
        </div>
      </div>

      {/* Content-Type — a single header that controls how the browser parses
          the synthetic body. Defaults to application/json (the dominant API
          mocking case). AutoComplete: typed value passes through verbatim,
          the suggestions are convenience, not a constraint. */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Content-Type
        </Text>
        <EntityField path={paths.mockContentType}>
          <Form.Item name="mockContentType" style={{ marginBottom: 0 }}>
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
          Empty rows are dropped on save. */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Response Headers
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            (optional)
          </Text>
        </div>
        <Form.List name="mockResponseHeaders">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Form.Item
                  noStyle
                  key={field.key}
                  shouldUpdate={(prev, cur) =>
                    prev.mockResponseHeaders?.[field.name]?.name !== cur.mockResponseHeaders?.[field.name]?.name
                  }
                >
                  {({ getFieldValue }) => {
                    // Mock response headers are schema-keyed by header name
                    // (`Record<string,string>`), so the current `name`
                    // value IS the row identity. Two surfaces editing
                    // "X-Foo" agree on the path; a half-typed "X-Fo"
                    // produces a transient path until the names converge.
                    const headerName = String(getFieldValue(['mockResponseHeaders', field.name, 'name']) ?? '');
                    const wrap = (leaf: 'name' | 'value', child: React.ReactNode) =>
                      headerName ? <EntityField path={paths.mockHeader(headerName, leaf)}>{child}</EntityField> : child;
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
                            <TemplateInput size="small" placeholder="Header value" />
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
          <EntityField path={paths.mockBodyType}>
            <Form.Item name="mockBodyType" style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="static">Static Data</Radio.Button>
                <Radio.Button value="dynamic">
                  Dynamic (JavaScript){' '}
                  <InfoCircleOutlined
                    style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDocs(getDocId('mock-dynamic', 'action'));
                    }}
                  />
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          </EntityField>
        </div>

        {/* Dynamic info banner + the static/dynamic CodeEditor swap — both
            depend on mockBodyType, so they live in one shouldUpdate block. */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.mockBodyType !== cur.mockBodyType}>
          {({ getFieldValue }) => {
            const isDynamic = getFieldValue('mockBodyType') === 'dynamic';
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
                    The real request is made first. Your function receives the response and request context, then
                    returns the modified response. Return a string or an object (auto-serialized to JSON).
                  </div>
                )}
                {isDynamic ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="mockDynamicBody" schemaPath={paths.mockResponseBody} />
                    </div>
                    <EntityField path={paths.mockResponseBody}>
                      <Form.Item name="mockDynamicBody" style={{ marginBottom: 0 }}>
                        <CodeEditor language="javascript" minHeight={240} />
                      </Form.Item>
                    </EntityField>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <ScalarConflictChip formName="mockStaticBody" schemaPath={paths.mockResponseBody} />
                    </div>
                    <EntityField path={paths.mockResponseBody}>
                      <Form.Item name="mockStaticBody" style={{ marginBottom: 0 }}>
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

export default MockRuleFields;
