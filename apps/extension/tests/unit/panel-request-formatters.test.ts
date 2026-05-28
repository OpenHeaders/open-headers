import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import {
  formatCurl,
  formatFetch,
  formatRequestHeaders,
  formatResponseHeaders,
} from '@openheaders/ui/panel/data/request-formatters';
import { describe, expect, it } from 'vitest';

function makeLifecycle(
  overrides: Partial<InspectorHarEntry['request']> = {},
  response?: InspectorHarEntry['response'],
): RequestLifecycle {
  const method = overrides.method ?? 'GET';
  const url = overrides.url ?? 'https://api.openheaders.io/v2/config';
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    time: 0,
    request: {
      method,
      url,
      httpVersion: '',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
      ...overrides,
    },
    response: response ?? {
      status: 200,
      statusText: 'OK',
      httpVersion: '',
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: 'application/json' },
      headersSize: -1,
      bodySize: -1,
    },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
  };
  return {
    tabId: 1,
    requestId: 'fixture',
    url,
    method,
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: Date.parse(har.startedDateTime),
    hopStartedAtMs: Date.parse(har.startedDateTime),
    statusCode: har.response?.status,
    statusText: har.response?.statusText,
    har: [har],
    harBodyByHop: [],
  };
}

describe('formatCurl', () => {
  it('emits a GET with the URL only when there are no headers or body', () => {
    expect(formatCurl(makeLifecycle())).toBe("curl 'https://api.openheaders.io/v2/config'");
  });

  it('includes -X <method> for non-GET requests', () => {
    expect(formatCurl(makeLifecycle({ method: 'DELETE' }))).toContain("-X 'DELETE'");
  });

  it('drops forbidden / pseudo-header request headers (Host, :authority, Content-Length)', () => {
    const out = formatCurl(
      makeLifecycle({
        headers: [
          { name: 'Host', value: 'api.openheaders.io' },
          { name: ':authority', value: 'api.openheaders.io' },
          { name: 'Content-Length', value: '0' },
          { name: 'Accept', value: 'application/json' },
        ],
      }),
    );
    expect(out).not.toContain('Host:');
    expect(out).not.toContain(':authority');
    expect(out).not.toContain('Content-Length');
    expect(out).toContain("'Accept: application/json'");
  });

  it('escapes single quotes in headers using POSIX quoting', () => {
    const out = formatCurl(
      makeLifecycle({
        headers: [{ name: 'Cookie', value: "session='abc'" }],
      }),
    );
    expect(out).toContain("'Cookie: session='\\''abc'\\'''");
  });

  it('adds --data-raw for POST bodies', () => {
    const out = formatCurl(
      makeLifecycle({
        method: 'POST',
        postData: { mimeType: 'application/json', text: '{"a":1}' },
      }),
    );
    expect(out).toContain('--data-raw \'{"a":1}\'');
  });
});

describe('formatFetch', () => {
  it('returns a minimal fetch call when the request is a bare GET', () => {
    expect(formatFetch(makeLifecycle())).toBe('fetch("https://api.openheaders.io/v2/config")');
  });

  it('serializes method + headers + body when present', () => {
    const out = formatFetch(
      makeLifecycle({
        method: 'POST',
        headers: [{ name: 'Accept', value: 'application/json' }],
        postData: { mimeType: 'application/json', text: '{"a":1}' },
      }),
    );
    expect(out).toContain('"method": "POST"');
    expect(out).toContain('"Accept": "application/json"');
    expect(out).toContain('"body": "{\\"a\\":1}"');
  });

  it('filters pseudo-headers from the fetch headers object', () => {
    const out = formatFetch(
      makeLifecycle({
        headers: [
          { name: ':authority', value: 'api.openheaders.io' },
          { name: 'X-Custom', value: 'value' },
        ],
      }),
    );
    expect(out).not.toContain(':authority');
    expect(out).toContain('"X-Custom": "value"');
  });
});

describe('formatRequestHeaders / formatResponseHeaders', () => {
  it('joins headers in "Name: value" lines for the request', () => {
    const out = formatRequestHeaders(
      makeLifecycle({
        headers: [
          { name: 'Accept', value: 'application/json' },
          { name: 'X-Foo', value: 'bar' },
        ],
      }),
    );
    expect(out).toBe('Accept: application/json\nX-Foo: bar');
  });

  it('joins headers for the response', () => {
    const out = formatResponseHeaders(
      makeLifecycle(
        {},
        {
          status: 200,
          statusText: 'OK',
          httpVersion: '',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'X-Request-Id', value: 'abc' },
          ],
          cookies: [],
          content: { size: 0, mimeType: 'application/json' },
          headersSize: -1,
          bodySize: -1,
        },
      ),
    );
    expect(out).toBe('Content-Type: application/json\nX-Request-Id: abc');
  });

  it('returns empty string when there are no headers', () => {
    expect(formatResponseHeaders(makeLifecycle())).toBe('');
  });
});
