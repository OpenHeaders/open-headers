/**
 * `api-request-handoff` — the devpanel → workbench "Create API request"
 * seed builder. The structural conversion is core's HAR importer; these
 * tests pin the panel-side policy on top of it: replay-hostile header
 * filtering (transport, sec-*, cookie), auth promotion surviving the
 * filter, query-param split, JSON pretty-printing, the GraphQL body
 * upgrade (single-op only), and the no-HAR fallback.
 */

import { buildRequestSeedFromLifecycle } from '@openheaders/ui/panel/data/api-request-handoff';
import { describe, expect, it } from 'vitest';
import { makeLifecycle } from '../__factories__/lifecycle';

const API_URL = 'https://api.openheaders.io/v1/things?page=2&sort=asc';

function capturedLifecycle() {
  return makeLifecycle({
    url: API_URL,
    method: 'POST',
    harOverrides: {
      method: 'POST',
      requestHeaders: [
        { name: 'host', value: 'api.openheaders.io' },
        { name: 'connection', value: 'keep-alive' },
        { name: 'content-length', value: '16' },
        { name: 'cookie', value: 'session=abc' },
        { name: 'sec-ch-ua', value: '"Chromium";v="140"' },
        { name: 'sec-fetch-mode', value: 'cors' },
        { name: 'content-type', value: 'application/json' },
        { name: 'x-custom', value: 'yes' },
        { name: 'authorization', value: 'Bearer tok123' },
      ],
      postDataText: '{"name":"hello"}',
      postDataMime: 'application/json',
    },
  });
}

describe('buildRequestSeedFromLifecycle', () => {
  it('converts the captured HAR into a structured seed', () => {
    const seed = buildRequestSeedFromLifecycle(capturedLifecycle());
    expect(seed.method).toBe('POST');
    expect(seed.url).toBe('https://api.openheaders.io/v1/things');
    expect(seed.name).toBe('POST api.openheaders.io/v1/things');
    expect(seed.params.map((p) => [p.key, p.value])).toEqual([
      ['page', '2'],
      ['sort', 'asc'],
    ]);
  });

  it('filters replay-hostile headers and promotes Authorization to bearer auth', () => {
    const seed = buildRequestSeedFromLifecycle(capturedLifecycle());
    expect(seed.headers.map((h) => h.key)).toEqual(['content-type', 'x-custom']);
    expect(seed.auth).toEqual({ type: 'bearer', token: 'tok123' });
  });

  it('pretty-prints a JSON body', () => {
    const seed = buildRequestSeedFromLifecycle(capturedLifecycle());
    expect(seed.body).toEqual({ type: 'json', content: '{\n  "name": "hello"\n}' });
  });

  it('upgrades a single-operation GraphQL JSON body to the graphql body mode', () => {
    const lc = makeLifecycle({
      url: 'https://api.openheaders.io/graphql',
      method: 'POST',
      harOverrides: {
        method: 'POST',
        requestHeaders: [{ name: 'content-type', value: 'application/json' }],
        postDataText: '{"query":"query Q { me { id } }","variables":{"a":1}}',
        postDataMime: 'application/json',
      },
    });
    const seed = buildRequestSeedFromLifecycle(lc);
    expect(seed.body).toEqual({
      type: 'graphql',
      content: 'query Q { me { id } }',
      graphqlVariables: '{\n  "a": 1\n}',
    });
  });

  it('keeps batched GraphQL operations as raw JSON', () => {
    const lc = makeLifecycle({
      url: 'https://api.openheaders.io/graphql',
      method: 'POST',
      harOverrides: {
        method: 'POST',
        requestHeaders: [{ name: 'content-type', value: 'application/json' }],
        postDataText: '[{"query":"query A { a }"},{"query":"query B { b }"}]',
        postDataMime: 'application/json',
      },
    });
    const seed = buildRequestSeedFromLifecycle(lc);
    expect(seed.body.type).toBe('json');
  });

  it('falls back to url + method + cooked headers when no HAR has landed', () => {
    const lc = {
      ...makeLifecycle({ url: API_URL, method: 'PUT', har: [null] }),
      requestHeaders: [
        { name: 'x-trace', value: 't1' },
        { name: 'sec-fetch-site', value: 'same-origin' },
      ],
    };
    const seed = buildRequestSeedFromLifecycle(lc);
    expect(seed.method).toBe('PUT');
    expect(seed.url).toBe('https://api.openheaders.io/v1/things');
    expect(seed.params.map((p) => p.key)).toEqual(['page', 'sort']);
    expect(seed.headers.map((h) => h.key)).toEqual(['x-trace']);
    expect(seed.body).toEqual({ type: 'none' });
    expect(seed.auth).toEqual({ type: 'none' });
  });
});
