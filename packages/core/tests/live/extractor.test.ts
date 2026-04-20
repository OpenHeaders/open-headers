import { describe, expect, it } from 'vitest';
import { applyExtractor, type StepResponse } from '../../src/live/extractor';
import type { Extractor } from '../../src/types/v5/live';

function makeResponse(overrides: Partial<StepResponse> = {}): StepResponse {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/auth/token',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'X-Request-Id', value: 'req-abc-123' },
    ],
    body: JSON.stringify({
      access_token: 'eyJhbGciOi-token',
      expires_in: 300,
      refresh_token: 'rt-98765',
      nested: { deeply: { value: 'hello' } },
      arr: ['zero', 'one', 'two'],
      mixed: [{ name: 'first' }, { name: 'second' }],
      nullish: null,
      bool: true,
      count: 42,
    }),
    ...overrides,
  };
}

describe('applyExtractor — json-path', () => {
  it('extracts a top-level string', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.access_token' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'eyJhbGciOi-token' });
  });

  it('extracts a number as its string repr', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.expires_in' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: '300' });
  });

  it('extracts a nested field via multiple dots', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.nested.deeply.value' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'hello' });
  });

  it('extracts an array element by index', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.arr[1]' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'one' });
  });

  it('extracts a mixed index + prop path', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.mixed[1].name' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'second' });
  });

  it('stringifies null as "null"', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.nullish' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'null' });
  });

  it('stringifies boolean as "true"/"false"', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.bool' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'true' });
  });

  it('returns the whole body (JSON-stringified) for $', () => {
    const ex: Extractor = { kind: 'json-path', path: '$' };
    const result = applyExtractor(ex, makeResponse());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('"access_token"');
  });

  it('reports no-match for a missing top-level key', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.nonexistent' };
    const r = applyExtractor(ex, makeResponse());
    expect(r).toMatchObject({ ok: false, kind: 'no-match' });
  });

  it('reports no-match when path traverses a null mid-way', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.nullish.foo' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'no-match' });
  });

  it('reports no-match for an out-of-bounds array index', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.arr[99]' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'no-match' });
  });

  it('reports invalid-json when the body is not JSON', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.x' };
    expect(applyExtractor(ex, makeResponse({ body: '<html>oops</html>' }))).toMatchObject({
      ok: false,
      kind: 'invalid-json',
    });
  });

  it('reports invalid-path for a path not starting with $', () => {
    const ex: Extractor = { kind: 'json-path', path: 'foo.bar' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'invalid-path' });
  });

  it('reports invalid-path for non-numeric index', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.arr[abc]' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'invalid-path' });
  });

  it('reports no-match for property access on a non-object', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.count.value' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'no-match' });
  });

  it('reports no-match for index access on a non-array', () => {
    const ex: Extractor = { kind: 'json-path', path: '$.count[0]' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'no-match' });
  });
});

describe('applyExtractor — header', () => {
  it('case-insensitive header lookup', () => {
    const ex: Extractor = { kind: 'header', name: 'content-type' };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'application/json' });
  });

  it('returns the first header when multiple are present', () => {
    const ex: Extractor = { kind: 'header', name: 'Set-Cookie' };
    const resp = makeResponse({
      headers: [
        { key: 'Set-Cookie', value: 'session=abc; Path=/' },
        { key: 'Set-Cookie', value: 'csrf=xyz; Path=/' },
      ],
    });
    expect(applyExtractor(ex, resp)).toEqual({ ok: true, value: 'session=abc; Path=/' });
  });

  it('reports no-match when the header is absent', () => {
    const ex: Extractor = { kind: 'header', name: 'Missing-Header' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'no-match' });
  });
});

describe('applyExtractor — body-regex', () => {
  it('returns the whole match with default group 0', () => {
    const ex: Extractor = { kind: 'body-regex', pattern: 'token":\\s*"([^"]+)' };
    const result = applyExtractor(ex, makeResponse());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.includes('token')).toBe(true);
  });

  it('returns a specific group when `group` is set', () => {
    const ex: Extractor = { kind: 'body-regex', pattern: '"access_token":\\s*"([^"]+)"', group: 1 };
    expect(applyExtractor(ex, makeResponse())).toEqual({ ok: true, value: 'eyJhbGciOi-token' });
  });

  it('reports invalid-regex for a syntactically bad pattern', () => {
    const ex: Extractor = { kind: 'body-regex', pattern: '([a-z' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'invalid-regex' });
  });

  it('reports no-match when the pattern does not match', () => {
    const ex: Extractor = { kind: 'body-regex', pattern: 'this-will-not-match' };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'no-match' });
  });

  it('reports invalid-group when the group index is out of bounds', () => {
    const ex: Extractor = { kind: 'body-regex', pattern: 'access_token', group: 7 };
    expect(applyExtractor(ex, makeResponse())).toMatchObject({ ok: false, kind: 'invalid-group' });
  });
});

describe('applyExtractor — whole-body + status-code', () => {
  it('whole-body returns the raw text body', () => {
    const ex: Extractor = { kind: 'whole-body' };
    const resp = makeResponse({ body: 'plain text payload' });
    expect(applyExtractor(ex, resp)).toEqual({ ok: true, value: 'plain text payload' });
  });

  it('status-code returns the decimal string', () => {
    const ex: Extractor = { kind: 'status-code' };
    expect(applyExtractor(ex, makeResponse({ status: 401 }))).toEqual({ ok: true, value: '401' });
  });
});
