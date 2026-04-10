/**
 * MockRuleFields — Modify API Response rule configuration.
 *
 * Two modes:
 *   Static Data — user provides a literal response body (JSON, HTML, etc.)
 *   Dynamic (JavaScript) — user writes a modifyResponse() function that
 *     receives request context and returns the modified response.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Form, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';
import CodeEditor from '../CodeEditor';

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

const DYNAMIC_TEMPLATE = `function modifyResponse(args) {
  const { method, url, response, responseType, requestHeaders, requestData, responseJSON } = args;
  // Change response below depending upon request attributes received in args

  return response;
}`;

const MockRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();
  const form = Form.useFormInstance();
  const bodyType = Form.useWatch('mockBodyType');
  const prevBodyTypeRef = useRef(bodyType);

  // Prefill dynamic template on first switch
  useEffect(() => {
    if (bodyType === prevBodyTypeRef.current) return;
    if (bodyType === 'dynamic') {
      const dynamicContent = form.getFieldValue('mockDynamicBody') as string;
      if (!dynamicContent?.trim()) {
        form.setFieldValue('mockDynamicBody', DYNAMIC_TEMPLATE);
      }
    }
    prevBodyTypeRef.current = bodyType;
  }, [bodyType, form]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId(bodyType === 'dynamic' ? 'mock-dynamic' : 'mock-static', 'action'))}
        />
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Intercepts fetch() and XMLHttpRequest calls and returns your custom response."
      />

      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Response Status Code
        </Text>
        <Form.Item name="mockStatusCode" style={{ marginBottom: 0 }}>
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
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>
            Response Body
          </Text>
          <Form.Item name="mockBodyType" style={{ marginBottom: 0 }}>
            <Radio.Group size="small">
              <Radio.Button value="static">Static Data</Radio.Button>
              <Radio.Button value="dynamic">
                Dynamic (JavaScript){' '}
                <InfoCircleOutlined
                  style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); openDocs(getDocId('mock-dynamic', 'action')); }}
                />
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
            The real request is made first. Your function receives the response and request context, then returns the
            modified response. Return a string or an object (auto-serialized to JSON).
          </div>
        )}

        {bodyType === 'dynamic' ? (
          <Form.Item name="mockDynamicBody" style={{ marginBottom: 0 }}>
            <CodeEditor language="javascript" minHeight={240} />
          </Form.Item>
        ) : (
          <Form.Item name="mockStaticBody" style={{ marginBottom: 0 }}>
            <CodeEditor language="json" placeholder={'{"message": "custom response", "data": []}'} minHeight={160} />
          </Form.Item>
        )}
      </div>
    </div>
  );
};

export default MockRuleFields;
