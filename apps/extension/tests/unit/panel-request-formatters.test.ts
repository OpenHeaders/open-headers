import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';
import { formatCurl, formatFetch, formatRequestHeaders, formatResponseHeaders } from '@/panel/data/request-formatters';
import type { InspectorRequest } from '@/panel/data/types';

function makeRequest(
  overrides: Partial<InspectorHarEntry['request']> = {},
  response?: InspectorHarEntry['response'],
): InspectorRequest {
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: {
      method: 'GET',
      url: 'https://api.openheaders.io/v2/config',
      headers: [],
      queryString: [],
      ...overrides,
    },
    response: response ?? {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 0, mimeType: 'application/json' },
    },
  };
  return {
    id: 'fixture',
    harEntry: har,
    method: har.request?.method ?? 'GET',
    url: har.request?.url ?? '',
    timestamp: Date.parse(har.startedDateTime),
    statusCode: har.response?.status,
    statusText: har.response?.statusText,
    mimeType: har.response?.content?.mimeType,
    fires: [],
    arrivalIndex: 0,
    displayId: 1,
  };
}

describe('formatCurl', () => {
  it('emits a GET with the URL only when there are no headers or body', () => {
    const req = makeRequest();
    const out = formatCurl(req);
    expect(out).toBe("curl 'https://api.openheaders.io/v2/config'");
  });

  it('includes -X <method> for non-GET requests', () => {
    const req = makeRequest({ method: 'DELETE' });
    expect(formatCurl(req)).toContain("-X 'DELETE'");
  });

  it('drops forbidden / pseudo-header request headers (Host, :authority, Content-Length)', () => {
    const req = makeRequest({
      headers: [
        { name: 'Host', value: 'api.openheaders.io' },
        { name: ':authority', value: 'api.openheaders.io' },
        { name: 'Content-Length', value: '0' },
        { name: 'Accept', value: 'application/json' },
      ],
    });
    const out = formatCurl(req);
    expect(out).not.toContain('Host:');
    expect(out).not.toContain(':authority');
    expect(out).not.toContain('Content-Length');
    expect(out).toContain("'Accept: application/json'");
  });

  it('escapes single quotes in headers using POSIX quoting', () => {
    const req = makeRequest({
      headers: [{ name: 'Cookie', value: "session='abc'" }],
    });
    const out = formatCurl(req);
    // single quote inside single-quoted string: closed, \\ escaped, reopened
    expect(out).toContain("'Cookie: session='\\''abc'\\'''");
  });

  it('adds --data-raw for POST bodies', () => {
    const req = makeRequest({
      method: 'POST',
      postData: { mimeType: 'application/json', text: '{"a":1}' },
    });
    expect(formatCurl(req)).toContain('--data-raw \'{"a":1}\'');
  });
});

describe('formatFetch', () => {
  it('returns a minimal fetch call when the request is a bare GET', () => {
    const req = makeRequest();
    expect(formatFetch(req)).toBe('fetch("https://api.openheaders.io/v2/config")');
  });

  it('serializes method + headers + body when present', () => {
    const req = makeRequest({
      method: 'POST',
      headers: [{ name: 'Accept', value: 'application/json' }],
      postData: { mimeType: 'application/json', text: '{"a":1}' },
    });
    const out = formatFetch(req);
    expect(out).toContain('"method": "POST"');
    expect(out).toContain('"Accept": "application/json"');
    expect(out).toContain('"body": "{\\"a\\":1}"');
  });

  it('filters pseudo-headers from the fetch headers object', () => {
    const req = makeRequest({
      headers: [
        { name: ':authority', value: 'api.openheaders.io' },
        { name: 'X-Custom', value: 'value' },
      ],
    });
    const out = formatFetch(req);
    expect(out).not.toContain(':authority');
    expect(out).toContain('"X-Custom": "value"');
  });
});

describe('formatRequestHeaders / formatResponseHeaders', () => {
  it('joins headers in "Name: value" lines for the request', () => {
    const req = makeRequest({
      headers: [
        { name: 'Accept', value: 'application/json' },
        { name: 'X-Foo', value: 'bar' },
      ],
    });
    expect(formatRequestHeaders(req)).toBe('Accept: application/json\nX-Foo: bar');
  });

  it('joins headers for the response', () => {
    const req = makeRequest(
      {},
      {
        status: 200,
        statusText: 'OK',
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-Request-Id', value: 'abc' },
        ],
        content: { size: 0, mimeType: 'application/json' },
      },
    );
    expect(formatResponseHeaders(req)).toBe('Content-Type: application/json\nX-Request-Id: abc');
  });

  it('returns empty string when there are no headers', () => {
    const req = makeRequest();
    expect(formatResponseHeaders(req)).toBe('');
  });
});
