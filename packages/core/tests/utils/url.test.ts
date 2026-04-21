import { describe, expect, it } from 'vitest';
import { appendQueryParams, buildUrlDisplay, parseUrlQuery } from '../../src/utils/url';

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
