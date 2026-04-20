/**
 * curl import — parser + tokenizer coverage.
 *
 * Each test drives a single-line or multi-line curl command through
 * `parseCurl` and asserts the produced V5 request fields plus the
 * shape of the `ImportReport` (drops/transforms) the user would see.
 */

import { describe, expect, it } from 'vitest';
import { CurlParseError, parseCurl, tokenize } from '../../src/import/curl';

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('curl -X GET https://api.openheaders.io')).toEqual([
      'curl',
      '-X',
      'GET',
      'https://api.openheaders.io',
    ]);
  });

  it('preserves single-quoted content literally', () => {
    expect(tokenize("curl -H 'X-Foo: bar baz'")).toEqual(['curl', '-H', 'X-Foo: bar baz']);
  });

  it('preserves double-quoted content and honors backslash escapes', () => {
    expect(tokenize('curl -H "X-Foo: \\"quoted\\""')).toEqual(['curl', '-H', 'X-Foo: "quoted"']);
  });

  it('supports backslash escape at shell level (outside quotes)', () => {
    expect(tokenize('curl -X POST http://example.com/with\\ space')).toEqual([
      'curl',
      '-X',
      'POST',
      'http://example.com/with space',
    ]);
  });

  it('collapses multi-line commands via line continuation', () => {
    const input = `curl -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"a":1}' \\
  https://api.openheaders.io/v1/things`;
    const tokens = tokenize(input);
    expect(tokens).toEqual([
      'curl',
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-d',
      '{"a":1}',
      'https://api.openheaders.io/v1/things',
    ]);
  });

  it('treats $\u0027...\u0027 (ANSI-C) as literal single-quoted content', () => {
    // Bash ANSI-C quoting is common in DevTools "Copy as cURL (bash)".
    expect(tokenize("curl -H $'X-Foo: bar'")).toEqual(['curl', '-H', 'X-Foo: bar']);
  });

  it('tolerates unterminated quotes', () => {
    // Truncated paste — produce a best-effort token instead of throwing.
    expect(tokenize("curl -H 'X-Foo: bar")).toEqual(['curl', '-H', 'X-Foo: bar']);
  });

  it('supports mixed quoting inside a single token', () => {
    expect(tokenize('curl -H "X-Foo: "\'bar\'')).toEqual(['curl', '-H', 'X-Foo: bar']);
  });

  it('handles adjacent whitespace without producing empty tokens', () => {
    expect(tokenize('curl    -X    GET    https://x.io')).toEqual(['curl', '-X', 'GET', 'https://x.io']);
  });
});

describe('parseCurl — method + URL', () => {
  it('parses a bare GET', () => {
    const { request } = parseCurl('curl https://api.openheaders.io/v1/ping');
    expect(request.method).toBe('GET');
    expect(request.url).toBe('https://api.openheaders.io/v1/ping');
    expect(request.headers).toEqual([]);
    expect(request.body).toEqual({ type: 'none' });
  });

  it('accepts the command without the leading "curl"', () => {
    const { request } = parseCurl('-X GET https://api.openheaders.io');
    expect(request.method).toBe('GET');
  });

  it('honors explicit -X', () => {
    const { request } = parseCurl('curl -X DELETE https://api.openheaders.io/v1/things/42');
    expect(request.method).toBe('DELETE');
  });

  it('honors --request alias', () => {
    const { request } = parseCurl('curl --request PATCH https://api.openheaders.io/v1/things/42');
    expect(request.method).toBe('PATCH');
  });

  it('defaults to POST when -d is present without -X', () => {
    const { request } = parseCurl('curl -d "a=1" https://api.openheaders.io/echo');
    expect(request.method).toBe('POST');
  });

  it('normalizes method casing', () => {
    const { request } = parseCurl('curl -X post https://api.openheaders.io');
    expect(request.method).toBe('POST');
  });

  it('reads --url as an alias', () => {
    const { request } = parseCurl('curl --url https://api.openheaders.io/v1/ping');
    expect(request.url).toBe('https://api.openheaders.io/v1/ping');
  });

  it('throws when no URL is present', () => {
    expect(() => parseCurl('curl -X GET')).toThrow(CurlParseError);
  });

  it('throws on empty input', () => {
    expect(() => parseCurl('   ')).toThrow(CurlParseError);
  });

  it('reports unknown method as drop and defaults to GET', () => {
    const { request, report } = parseCurl('curl -X QUERY https://api.openheaders.io');
    expect(request.method).toBe('GET');
    expect(report.drops.some((d) => d.reason.includes('Unknown HTTP method'))).toBe(true);
  });
});

describe('parseCurl — query params', () => {
  it('extracts query params from the URL and drops them from url', () => {
    const { request } = parseCurl('curl https://api.openheaders.io/search?q=hello&lang=en');
    expect(request.url).toBe('https://api.openheaders.io/search');
    expect(request.params).toEqual([
      { key: 'q', value: 'hello' },
      { key: 'lang', value: 'en' },
    ]);
  });

  it('decodes percent-encoded query values', () => {
    const { request } = parseCurl('curl https://api.openheaders.io/search?q=hello%20world');
    expect(request.params[0]).toEqual({ key: 'q', value: 'hello world' });
  });

  it('tolerates a fragment after the query', () => {
    const { request } = parseCurl('curl https://api.openheaders.io/x?a=1#section');
    expect(request.url).toBe('https://api.openheaders.io/x');
    expect(request.params).toEqual([{ key: 'a', value: '1' }]);
  });
});

describe('parseCurl — headers', () => {
  it('parses repeated -H flags', () => {
    const { request } = parseCurl("curl -H 'X-Client: oh' -H 'Accept: application/json' https://api.openheaders.io");
    expect(request.headers).toEqual([
      { key: 'X-Client', value: 'oh' },
      { key: 'Accept', value: 'application/json' },
    ]);
  });

  it('records malformed header value (no colon) as a drop', () => {
    const { request, report } = parseCurl("curl -H 'no-colon-here' https://api.openheaders.io");
    expect(request.headers).toEqual([]);
    expect(report.drops.some((d) => d.reason.includes('Malformed -H value'))).toBe(true);
  });
});

describe('parseCurl — body data', () => {
  it('sets body.type=text for plain -d without Content-Type', () => {
    const { request } = parseCurl("curl -d 'a=1&b=2' https://api.openheaders.io/echo");
    expect(request.body).toEqual({ type: 'text', content: 'a=1&b=2' });
  });

  it('promotes body to type=json when Content-Type is application/json', () => {
    const { request } = parseCurl(
      "curl -H 'Content-Type: application/json' -d '{\"a\":1}' https://api.openheaders.io/v1",
    );
    expect(request.body).toEqual({ type: 'json', content: '{"a":1}' });
  });

  it('uses body.type=form when Content-Type is application/x-www-form-urlencoded', () => {
    const { request } = parseCurl(
      "curl -H 'Content-Type: application/x-www-form-urlencoded' -d 'a=1' https://api.openheaders.io",
    );
    expect(request.body).toEqual({ type: 'form', content: 'a=1' });
  });

  it('joins multiple -d parts with &', () => {
    const { request } = parseCurl("curl -d 'a=1' -d 'b=2' https://api.openheaders.io/echo");
    expect(request.body).toEqual({ type: 'text', content: 'a=1&b=2' });
  });

  it('keeps --data-raw joined with newline (preserves JSON-ish bodies verbatim)', () => {
    const { request } = parseCurl('curl --data-raw \'{"a":1}\' --data-raw \'{"b":2}\' https://api.openheaders.io');
    expect(request.body).toEqual({ type: 'text', content: '{"a":1}\n{"b":2}' });
  });

  it('handles --data-binary', () => {
    const { request } = parseCurl(
      "curl --data-binary '<xml>hi</xml>' -H 'Content-Type: application/xml' https://api.openheaders.io",
    );
    expect(request.body.type).toBe('text');
    expect(request.body.content).toBe('<xml>hi</xml>');
  });
});

describe('parseCurl — auth', () => {
  it('maps -u to basic auth', () => {
    const { request } = parseCurl("curl -u 'alice:s3cret' https://api.openheaders.io");
    expect(request.auth).toEqual({ type: 'basic', username: 'alice', password: 's3cret' });
  });

  it('maps -u without colon to basic auth with blank password', () => {
    const { request } = parseCurl("curl -u 'alice' https://api.openheaders.io");
    expect(request.auth).toEqual({ type: 'basic', username: 'alice', password: '' });
  });

  it('promotes Authorization: Bearer header to auth.bearer and removes the header', () => {
    const { request, report } = parseCurl("curl -H 'Authorization: Bearer abc123' https://api.openheaders.io");
    expect(request.auth).toEqual({ type: 'bearer', token: 'abc123' });
    expect(request.headers.find((h) => h.key === 'Authorization')).toBeUndefined();
    expect(report.transforms.some((t) => t.to === 'auth.bearer')).toBe(true);
  });

  it('promotes Authorization: Basic base64(user:pass) to auth.basic', () => {
    const encoded = 'Basic ' + Buffer.from('alice:pw').toString('base64');
    const { request } = parseCurl(`curl -H 'Authorization: ${encoded}' https://api.openheaders.io`);
    expect(request.auth).toEqual({ type: 'basic', username: 'alice', password: 'pw' });
  });

  it('keeps an unparseable Authorization header as a raw header (no silent drop)', () => {
    const { request } = parseCurl("curl -H 'Authorization: Scheme xyz' https://api.openheaders.io");
    expect(request.auth).toEqual({ type: 'none' });
    expect(request.headers).toEqual([{ key: 'Authorization', value: 'Scheme xyz' }]);
  });

  it('prefers -u over an Authorization header (explicit wins)', () => {
    const { request } = parseCurl(
      "curl -u 'explicit:explicit-pw' -H 'Authorization: Bearer xyz' https://api.openheaders.io",
    );
    expect(request.auth).toEqual({ type: 'basic', username: 'explicit', password: 'explicit-pw' });
    // The header stays on the request because -u took the auth slot —
    // transforming it anyway would silently drop an explicit header.
    expect(request.headers).toEqual([{ key: 'Authorization', value: 'Bearer xyz' }]);
  });
});

describe('parseCurl — drops (logged, not silent)', () => {
  it('reconciles -F into a multipart body with placeholder FileRefs', () => {
    const { request, report } = parseCurl(
      "curl -F 'upload=@file.png' -F 'caption=hello world' https://api.openheaders.io",
    );
    expect(request.body.type).toBe('multipart');
    expect(request.body.multipartParts).toEqual([
      {
        kind: 'file',
        name: 'upload',
        fileRefs: [
          {
            fileId: expect.stringMatching(/^placeholder:/),
            hash: expect.stringMatching(/^placeholder:/),
            filename: 'file.png',
            size: 0,
            mimeType: undefined,
          },
        ],
      },
      { kind: 'text', name: 'caption', value: 'hello world' },
    ]);
    expect(report.transforms.some((t) => t.to.startsWith('multipart.file') && t.tracking === '#todo-file-blobs')).toBe(
      true,
    );
  });

  it('records --cookie as a drop', () => {
    const { report } = parseCurl("curl --cookie 'session=xyz' https://api.openheaders.io");
    expect(report.drops.some((d) => d.path === 'flag:--cookie')).toBe(true);
  });

  it('records -k (insecure) as a drop', () => {
    const { report } = parseCurl('curl -k https://api.openheaders.io');
    expect(report.drops.some((d) => d.path === 'flag:-k')).toBe(true);
  });

  it('records unknown flags and consumes an adjacent value', () => {
    const { report } = parseCurl('curl --mystery value https://api.openheaders.io');
    expect(report.drops.some((d) => d.path === 'flag:--mystery')).toBe(true);
    expect(report.drops.find((d) => d.path === 'flag:--mystery')?.reason).toContain('with value: value');
  });

  it('tolerates noop flags without drops', () => {
    const { report } = parseCurl('curl -s -L --compressed https://api.openheaders.io');
    expect(report.drops).toEqual([]);
  });
});

describe('parseCurl — report shape', () => {
  it('produces a report with source=curl + zero-state summary by default', () => {
    const { report } = parseCurl('curl https://api.openheaders.io/ping');
    expect(report.source).toBe('curl');
    expect(report.summary).toEqual({ imported: 1, dropped: 0, transformed: 0 });
    expect(report.schemaVersion).toBe(5);
    // sourceHash is filled in by the caller — parser leaves it blank.
    expect(report.sourceHash).toBe('');
  });

  it('increments summary counters as drops/transforms land', () => {
    const { report } = parseCurl("curl -k -F 'up=@x.png' -H 'Authorization: Bearer abc' https://api.openheaders.io");
    expect(report.summary.dropped).toBeGreaterThanOrEqual(1); // -k
    // Bearer promotion + -F file placeholder both land as transforms.
    expect(report.summary.transformed).toBeGreaterThanOrEqual(2);
  });
});

describe('parseCurl — realistic DevTools paste', () => {
  it('handles the canonical "Copy as cURL (bash)" layout', () => {
    // Synthesizes the DevTools output: multi-line, ANSI-C quoting,
    // mixed single/double quotes, realistic header set.
    const input = String.raw`curl 'https://api.openheaders.io/v1/things?page=2' \
  -X 'POST' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer xyz.abc.123' \
  -H 'content-type: application/json' \
  --data-raw '{"name":"hello"}' \
  --compressed`;

    const { request, report } = parseCurl(input);
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.openheaders.io/v1/things');
    expect(request.params).toEqual([{ key: 'page', value: '2' }]);
    expect(request.auth).toEqual({ type: 'bearer', token: 'xyz.abc.123' });
    // Authorization was promoted, so the remaining headers carry
    // content-type + accept but NOT authorization.
    const keys = request.headers.map((h) => h.key.toLowerCase());
    expect(keys).toContain('accept');
    expect(keys).toContain('content-type');
    expect(keys).not.toContain('authorization');
    expect(request.body).toEqual({ type: 'json', content: '{"name":"hello"}' });
    // Transform (auth promotion) logged; zero drops for this clean input.
    expect(report.summary.transformed).toBe(1);
    expect(report.drops).toEqual([]);
  });
});
