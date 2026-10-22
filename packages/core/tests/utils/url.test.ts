import { describe, expect, it } from 'vitest';
import {
  appendQueryParams,
  buildUrlDisplay,
  parsePathParamNames,
  parseUrlQuery,
  splitUrlPath,
  substitutePathParams,
} from '../../src/utils/url';

describe('parseUrlQuery', () => {
  it('returns empty params when no separator is present', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path');
    expect(r.base).toBe('https://api.openheaders.io/path');
    expect(r.params).toEqual([]);
  });

  it('returns a single empty placeholder row when the separator is bare', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?');
    expect(r.base).toBe('https://api.openheaders.io/path');
    expect(r.params).toEqual([{ key: '', value: '' }]);
  });

  it('parses a single k=v pair', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?a=1');
    expect(r.params).toEqual([{ key: 'a', value: '1' }]);
  });

  it('parses multiple k=v pairs separated by &', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?a=1&b=two&c=3');
    expect(r.params).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: 'two' },
      { key: 'c', value: '3' },
    ]);
  });

  it('marks hasEquals on `?key=` so the trailing `=` survives round-trips', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?ok2=');
    expect(r.params).toEqual([{ key: 'ok2', value: '', hasEquals: true }]);
  });

  it('does NOT mark hasEquals on key-only `?flag`', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?flag');
    expect(r.params).toEqual([{ key: 'flag', value: '' }]);
  });

  it('preserves a trailing empty pair from a user-typed `&`', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?a=1&');
    expect(r.params).toEqual([
      { key: 'a', value: '1' },
      { key: '', value: '' },
    ]);
  });

  it('preserves interior empty pairs from `&&`', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?a=1&&b=2');
    expect(r.params).toEqual([
      { key: 'a', value: '1' },
      { key: '', value: '' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps template refs verbatim (no URL decoding)', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?token={{env.token}}');
    expect(r.params).toEqual([{ key: 'token', value: '{{env.token}}' }]);
  });

  it('does not split on `?` that sits inside a template block', () => {
    const r = parseUrlQuery('https://api.openheaders.io/{{env.weird?name}}/x?a=1');
    expect(r.base).toBe('https://api.openheaders.io/{{env.weird?name}}/x');
    expect(r.params).toEqual([{ key: 'a', value: '1' }]);
  });

  it('treats a value-only pair as { key: "", value, hasEquals: true }', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?=42');
    expect(r.params).toEqual([{ key: '', value: '42' }]);
  });

  it('preserves a value that contains `=` as part of the value', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?eq=a=b');
    expect(r.params).toEqual([{ key: 'eq', value: 'a=b' }]);
  });

  it('preserves a fragment that lands inside the query tail', () => {
    const r = parseUrlQuery('https://api.openheaders.io/path?a=1#frag');
    expect(r.params).toEqual([{ key: 'a', value: '1#frag' }]);
  });
});

describe('buildUrlDisplay', () => {
  it('returns the base alone when params is empty', () => {
    expect(buildUrlDisplay('https://api.openheaders.io/path', [])).toBe('https://api.openheaders.io/path');
  });

  it('keeps a trailing `?` when an empty placeholder row is present', () => {
    expect(buildUrlDisplay('https://api.openheaders.io/path', [{ key: '', value: '' }])).toBe(
      'https://api.openheaders.io/path?',
    );
  });

  it('emits `key=` when hasEquals is set and value is empty', () => {
    expect(buildUrlDisplay('https://api.openheaders.io/path', [{ key: 'ok2', value: '', hasEquals: true }])).toBe(
      'https://api.openheaders.io/path?ok2=',
    );
  });

  it('emits key-only shape when hasEquals is absent and value is empty', () => {
    expect(buildUrlDisplay('https://api.openheaders.io/path', [{ key: 'flag', value: '' }])).toBe(
      'https://api.openheaders.io/path?flag',
    );
  });

  it('preserves a trailing `&` when the last row is an empty pair', () => {
    expect(
      buildUrlDisplay('https://api.openheaders.io/path', [
        { key: 'a', value: '1' },
        { key: '', value: '' },
      ]),
    ).toBe('https://api.openheaders.io/path?a=1&');
  });

  it('preserves interior `&&` when an empty pair sits between real ones', () => {
    expect(
      buildUrlDisplay('https://api.openheaders.io/path', [
        { key: 'a', value: '1' },
        { key: '', value: '' },
        { key: 'b', value: '2' },
      ]),
    ).toBe('https://api.openheaders.io/path?a=1&&b=2');
  });

  it('omits disabled rows but keeps the separator when others remain', () => {
    expect(
      buildUrlDisplay('https://api.openheaders.io/path', [
        { key: 'a', value: '1', enabled: false },
        { key: 'b', value: '2' },
      ]),
    ).toBe('https://api.openheaders.io/path?b=2');
  });

  it('collapses to just the base when every row is disabled', () => {
    expect(
      buildUrlDisplay('https://api.openheaders.io/path', [
        { key: 'a', value: '1', enabled: false },
        { key: 'b', value: '2', enabled: false },
      ]),
    ).toBe('https://api.openheaders.io/path');
  });

  it('preserves template refs verbatim (no URL encoding at display time)', () => {
    expect(buildUrlDisplay('https://api.openheaders.io/path', [{ key: 'token', value: '{{env.token}}' }])).toBe(
      'https://api.openheaders.io/path?token={{env.token}}',
    );
  });
});

describe('parseUrlQuery ↔ buildUrlDisplay round-trip', () => {
  const cases: string[] = [
    'https://api.openheaders.io/path',
    'https://api.openheaders.io/path?',
    'https://api.openheaders.io/path?a=1',
    'https://api.openheaders.io/path?a=1&b=2',
    'https://api.openheaders.io/path?token={{env.token}}',
    'https://api.openheaders.io/path?flag',
    'https://api.openheaders.io/path?ok2=',
    'https://api.openheaders.io/path?ok1=yes&ok2',
    'https://api.openheaders.io/path?ok1=yes&ok2=',
    'https://api.openheaders.io/path?=42',
    'https://api.openheaders.io/path?eq=a=b',
    'https://api.openheaders.io/path?a=1&',
    'https://api.openheaders.io/path?a=1&&b=2',
    'https://{{env.host}}.openheaders.io/path?x={{env.x}}&y=2',
  ];

  it.each(cases)('round-trips %s', (input) => {
    const parsed = parseUrlQuery(input);
    expect(buildUrlDisplay(parsed.base, parsed.params)).toBe(input);
  });
});

describe('appendQueryParams (wire-side)', () => {
  it('returns the url unchanged when params is empty', () => {
    expect(appendQueryParams('https://api.openheaders.io/path', [])).toBe('https://api.openheaders.io/path');
  });

  it('skips empty-key rows', () => {
    expect(appendQueryParams('https://api.openheaders.io/path', [{ key: '', value: 'v' }])).toBe(
      'https://api.openheaders.io/path',
    );
  });

  it('skips disabled rows', () => {
    expect(
      appendQueryParams('https://api.openheaders.io/path', [
        { key: 'a', value: '1', enabled: false },
        { key: 'b', value: '2' },
      ]),
    ).toBe('https://api.openheaders.io/path?b=2');
  });

  it('URL-encodes keys and values', () => {
    expect(appendQueryParams('https://api.openheaders.io/path', [{ key: 'a key', value: 'a value & more' }])).toBe(
      'https://api.openheaders.io/path?a%20key=a%20value%20%26%20more',
    );
  });

  it('uses & as the separator when the base already has a ?', () => {
    expect(appendQueryParams('https://api.openheaders.io/path?existing=1', [{ key: 'new', value: '2' }])).toBe(
      'https://api.openheaders.io/path?existing=1&new=2',
    );
  });
});

describe('splitUrlPath', () => {
  it('returns the whole URL as the authority when it has no path', () => {
    expect(splitUrlPath('ws://events.openheaders.io:3000')).toEqual({
      authority: 'ws://events.openheaders.io:3000',
      path: '',
    });
  });

  it('splits at the first slash past the scheme, path verbatim', () => {
    expect(splitUrlPath('wss://events.openheaders.io/admin/room/')).toEqual({
      authority: 'wss://events.openheaders.io',
      path: '/admin/room/',
    });
    expect(splitUrlPath('ws://events.openheaders.io/')).toEqual({ authority: 'ws://events.openheaders.io', path: '/' });
  });

  it('never splits inside a template block and handles a scheme-less template host', () => {
    expect(splitUrlPath('ws://{{env.host/with/slash}}/chat')).toEqual({
      authority: 'ws://{{env.host/with/slash}}',
      path: '/chat',
    });
    expect(splitUrlPath('{{host}}/admin')).toEqual({ authority: '{{host}}', path: '/admin' });
    expect(splitUrlPath('{{host}}')).toEqual({ authority: '{{host}}', path: '' });
  });
});

describe('parsePathParamNames', () => {
  it('reads a `:name` segment of the path', () => {
    expect(parsePathParamNames('https://api.openheaders.io/spacecrafts/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('https://api.openheaders.io/users/:userId/posts/:postId')).toEqual([
      { name: 'userId', suffix: '' },
      { name: 'postId', suffix: '' },
    ]);
  });

  it('never reads the authority — a port, an IPv6 literal, a host template, a scheme-less host', () => {
    expect(parsePathParamNames('http://localhost:8080/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('https://[::1]/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('{{host}}/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('{{baseUrl}}/users/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('openheaders.io/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('https://:tenant.openheaders.io/x')).toEqual([]);
    expect(parsePathParamNames('http+unix://%2Fvar%2Frun%2Fdocker.sock/containers/:id')).toEqual([
      { name: 'id', suffix: '' },
    ]);
  });

  it('a colon that is not the first character of its segment is a literal', () => {
    expect(parsePathParamNames('https://api.openheaders.io/v1/files:batchGet')).toEqual([]);
    expect(parsePathParamNames('https://api.openheaders.io/something:else/ok:id')).toEqual([]);
  });

  it('a template after the colon is a literal — only an identifier names a parameter', () => {
    expect(parsePathParamNames('https://api.openheaders.io/:{{name}}')).toEqual([]);
    expect(parsePathParamNames('https://api.openheaders.io/:')).toEqual([]);
    expect(parsePathParamNames('https://api.openheaders.io/:9')).toEqual([]);
  });

  it('the identifier ends at the first character outside its class; the rest of the segment is a literal suffix', () => {
    expect(parsePathParamNames('https://api.openheaders.io/spacecrafts/:id.json')).toEqual([
      { name: 'id', suffix: '.json' },
    ]);
    expect(parsePathParamNames('https://api.openheaders.io/:file.:ext')).toEqual([{ name: 'file', suffix: '.:ext' }]);
    expect(parsePathParamNames('https://api.openheaders.io/:id{{ext}}')).toEqual([{ name: 'id', suffix: '{{ext}}' }]);
    expect(parsePathParamNames('https://api.openheaders.io/:edge:case:something{{baseUrl}}')).toEqual([
      { name: 'edge', suffix: ':case:something{{baseUrl}}' },
    ]);
    expect(parsePathParamNames('https://api.openheaders.io/:my-id_2')).toEqual([{ name: 'my-id_2', suffix: '' }]);
  });

  it('one entry per distinct name, in path order; names are case-sensitive', () => {
    expect(parsePathParamNames('https://api.openheaders.io/:id/x/:id')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('https://api.openheaders.io/:Id/:id')).toEqual([
      { name: 'Id', suffix: '' },
      { name: 'id', suffix: '' },
    ]);
  });

  it('the query and the fragment are cut off before the scan', () => {
    expect(parsePathParamNames('https://api.openheaders.io/x?time=12:30')).toEqual([]);
    expect(parsePathParamNames('https://api.openheaders.io/x#:frag')).toEqual([]);
    expect(parsePathParamNames('https://api.openheaders.io/:id?x=:y')).toEqual([{ name: 'id', suffix: '' }]);
    expect(parsePathParamNames('https://api.openheaders.io/:id?x={{a}}/:z')).toEqual([{ name: 'id', suffix: '' }]);
  });

  it('a URL with no path names nothing', () => {
    expect(parsePathParamNames('https://api.openheaders.io')).toEqual([]);
    expect(parsePathParamNames('{{host}}')).toEqual([]);
    expect(parsePathParamNames('')).toEqual([]);
  });
});

describe('substitutePathParams', () => {
  const valuesOf =
    (rows: Record<string, string>) =>
    (name: string): string | null =>
      rows[name] ?? null;
  const other = (text: string): string =>
    text.replaceAll('{{host}}', 'api.openheaders.io').replaceAll('{{ext}}', '.xml');

  it('replaces each named segment with its value and resolves every other span', () => {
    expect(substitutePathParams('https://{{host}}/users/:id/posts', valuesOf({ id: '42' }), other)).toBe(
      'https://api.openheaders.io/users/42/posts',
    );
    expect(
      substitutePathParams(
        'https://{{host}}/users/:userId/posts/:postId',
        valuesOf({ userId: '7', postId: '9' }),
        other,
      ),
    ).toBe('https://api.openheaders.io/users/7/posts/9');
  });

  it('encodes the value as ONE segment', () => {
    expect(substitutePathParams('https://{{host}}/f/:name', valuesOf({ name: 'a/b?c#d' }), other)).toBe(
      'https://api.openheaders.io/f/a%2Fb%3Fc%23d',
    );
    expect(substitutePathParams('https://{{host}}/f/:name', valuesOf({ name: 'ü' }), other)).toBe(
      'https://api.openheaders.io/f/%C3%BC',
    );
    expect(substitutePathParams('https://{{host}}/f/:name', valuesOf({ name: 'a%2Fb' }), other)).toBe(
      'https://api.openheaders.io/f/a%252Fb',
    );
  });

  it('a resolved value is data, never syntax', () => {
    expect(substitutePathParams('https://{{host}}/f/:name', valuesOf({ name: ':x' }), other)).toBe(
      'https://api.openheaders.io/f/%3Ax',
    );
  });

  it('re-attaches the literal suffix after the value, templates in it resolved', () => {
    expect(substitutePathParams('https://{{host}}/s/:id.json', valuesOf({ id: '42' }), other)).toBe(
      'https://api.openheaders.io/s/42.json',
    );
    expect(substitutePathParams('https://{{host}}/s/:id{{ext}}', valuesOf({ id: '42' }), other)).toBe(
      'https://api.openheaders.io/s/42.xml',
    );
    expect(substitutePathParams('https://{{host}}/:file.:ext', valuesOf({ file: 'a' }), other)).toBe(
      'https://api.openheaders.io/a.:ext',
    );
  });

  it('substitutes every occurrence of a duplicate name', () => {
    expect(substitutePathParams('https://{{host}}/:id/x/:id', valuesOf({ id: '42' }), other)).toBe(
      'https://api.openheaders.io/42/x/42',
    );
  });

  it('keeps a name no row answers as written', () => {
    expect(substitutePathParams('https://{{host}}/:id/:other', valuesOf({ id: '42' }), other)).toBe(
      'https://api.openheaders.io/42/:other',
    );
  });

  it('never touches the authority, the query or the fragment', () => {
    expect(substitutePathParams('http://localhost:8080/:id?t=12:30#:f', valuesOf({ id: '42' }), other)).toBe(
      'http://localhost:8080/42?t=12:30#:f',
    );
    expect(substitutePathParams('https://{{host}}/files:batchGet', valuesOf({ batchGet: 'x' }), other)).toBe(
      'https://api.openheaders.io/files:batchGet',
    );
  });

  it('a URL with no path resolves whole', () => {
    expect(substitutePathParams('{{host}}', valuesOf({}), other)).toBe('api.openheaders.io');
  });
});
