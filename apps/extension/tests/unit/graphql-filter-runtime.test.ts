/**
 * GraphQL operation filter — runtime contract for body and mock rules.
 *
 * Asserts that the fetch/XHR monkey-patches installed by
 * content-scripts.ts honor `action.graphqlFilter` when
 * `action.resourceType === 'graphql'`:
 *
 *   - Filter MATCHES → rule fires (body/mock applied).
 *   - Filter does NOT match (wrong key, wrong value, non-string field,
 *     non-JSON body, missing body) → rule passes through untouched.
 *   - resourceType === 'rest' (or filter omitted) → no payload check;
 *     rule fires on every URL match like before.
 *
 * Covers all four code paths: static body, dynamic body, static mock,
 * dynamic mock.
 */

import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildBodyInjection, buildMockInjection, type FuncInjection } from '@/background/content-scripts';

interface OrigEnv {
  fetch: typeof window.fetch;
  xhrOpen: typeof XMLHttpRequest.prototype.open;
  xhrSend: typeof XMLHttpRequest.prototype.send;
}

let orig: OrigEnv;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  orig = {
    fetch: window.fetch,
    xhrOpen: XMLHttpRequest.prototype.open,
    xhrSend: XMLHttpRequest.prototype.send,
  };
  // Stub fetch so non-overridden requests resolve to a sentinel — lets
  // tests assert "passed through" vs "overridden" deterministically.
  // The patch chain captures `window.fetch` as `origFetch` at install
  // time, so the spy stays the deepest call site no matter how many
  // wrappers stack on top. Assert via `fetchSpy.mock.calls`.
  fetchSpy = vi.fn().mockResolvedValue(new Response('PASSTHROUGH', { status: 200 }));
  window.fetch = fetchSpy as unknown as typeof window.fetch;
});

function lastFetchBody(): string | undefined {
  const last = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  if (!last) return undefined;
  const init = last[1] as RequestInit | undefined;
  return init?.body as string | undefined;
}

afterEach(() => {
  window.fetch = orig.fetch;
  XMLHttpRequest.prototype.open = orig.xhrOpen;
  XMLHttpRequest.prototype.send = orig.xhrSend;
});

function bodyRule(opts: {
  bodyType: V5.BodyModType;
  body: string;
  resourceType: V5.BodyResourceType;
  graphqlFilter?: V5.BodyAction['graphqlFilter'];
}): V5.BodyRule {
  return {
    schemaVersion: 5,
    uid: 'bdy00001',
    path: 'rules/body',
    name: 'Body',
    type: 'body',
    enabled: true,
    conditions: [{ uid: 'tcd00036', type: 'request-domains', values: ['openheaders.io'] }],
    action: {
      bodyType: opts.bodyType,
      body: opts.body,
      resourceType: opts.resourceType,
      graphqlFilter: opts.graphqlFilter,
    },
  };
}

function mockRule(opts: {
  bodyType: V5.MockBodyType;
  responseBody: string;
  resourceType?: V5.BodyResourceType;
  graphqlFilter?: V5.MockAction['graphqlFilter'];
}): V5.MockRule {
  return {
    schemaVersion: 5,
    uid: 'mck00001',
    path: 'rules/mock',
    name: 'Mock',
    type: 'mock',
    enabled: true,
    conditions: [{ uid: 'tcd00037', type: 'request-domains', values: ['openheaders.io'] }],
    action: {
      statusCode: 201,
      responseHeaders: {},
      responseBody: opts.responseBody,
      contentType: 'application/json',
      bodyType: opts.bodyType,
      resourceType: opts.resourceType ?? 'rest',
      graphqlFilter: opts.graphqlFilter,
    },
  };
}

/** Install the monkey-patches by invoking the func directly (the same
 *  thing chrome.scripting.executeScript does in production). */
function installFunc(injection: FuncInjection): void {
  (injection.func as (cfg: unknown) => void)(injection.args[0]);
}

function installInline(code: string): void {
  // eslint-disable-next-line no-new-func
  new Function(code)();
}

const URL = 'https://openheaders.io/graphql';

describe('static body — graphql operation filter', () => {
  it('overrides when filter matches operationName (Equals)', async () => {
    const rule = bodyRule({
      bodyType: 'static',
      body: '{"replaced":true}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    installFunc(buildBodyInjection(rule) as FuncInjection);

    await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'getUsers', query: 'query getUsers { users { id } }' }),
    });
    expect(lastFetchBody()).toBe('{"replaced":true}');
  });

  it('passes through when operationName does not match', async () => {
    const rule = bodyRule({
      bodyType: 'static',
      body: '{"replaced":true}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    installFunc(buildBodyInjection(rule) as FuncInjection);

    const original = JSON.stringify({ operationName: 'getPosts', query: '...' });
    await window.fetch(URL, { method: 'POST', body: original });
    expect(lastFetchBody()).toBe(original);
  });

  it('matches with Contains operator on query substring', async () => {
    const rule = bodyRule({
      bodyType: 'static',
      body: '{"replaced":true}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'query', operator: 'Contains', value: 'users {' },
    });
    installFunc(buildBodyInjection(rule) as FuncInjection);

    await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { users { id name } }' }),
    });
    expect(lastFetchBody()).toBe('{"replaced":true}');
  });

  it('passes through when body is not valid JSON', async () => {
    const rule = bodyRule({
      bodyType: 'static',
      body: '{"replaced":true}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    installFunc(buildBodyInjection(rule) as FuncInjection);

    const original = 'not-json-at-all';
    await window.fetch(URL, { method: 'POST', body: original });
    expect(lastFetchBody()).toBe(original);
  });

  it('still overrides on REST (non-graphql) regardless of body shape', async () => {
    const rule = bodyRule({
      bodyType: 'static',
      body: '{"replaced":true}',
      resourceType: 'rest',
    });
    installFunc(buildBodyInjection(rule) as FuncInjection);

    await window.fetch(URL, { method: 'POST', body: 'anything' });
    expect(lastFetchBody()).toBe('{"replaced":true}');
  });
});

describe('dynamic body — graphql operation filter', () => {
  it('runs modifyRequestBody only when filter matches', async () => {
    const rule = bodyRule({
      bodyType: 'dynamic',
      body: 'function modifyRequestBody(args){ return JSON.stringify({ swapped: true }); }',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    const inj = buildBodyInjection(rule);
    expect(inj.kind).toBe('inline-script');
    if (inj.kind !== 'inline-script') return;
    installInline(inj.code);

    // Matching call → body swapped.
    await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'getUsers' }),
    });
    expect(lastFetchBody()).toBe('{"swapped":true}');

    // Non-matching call → body untouched.
    const nonMatching = JSON.stringify({ operationName: 'getPosts' });
    await window.fetch(URL, { method: 'POST', body: nonMatching });
    expect(lastFetchBody()).toBe(nonMatching);
  });
});

describe('static mock — graphql operation filter', () => {
  it('mocks when filter matches', async () => {
    const rule = mockRule({
      bodyType: 'static',
      responseBody: '{"mocked":true}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    installFunc(buildMockInjection(rule) as FuncInjection);

    const res = await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'getUsers' }),
    });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('{"mocked":true}');
  });

  it('passes through when filter does not match', async () => {
    const rule = mockRule({
      bodyType: 'static',
      responseBody: '{"mocked":true}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    installFunc(buildMockInjection(rule) as FuncInjection);

    const res = await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'getPosts' }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('PASSTHROUGH');
  });
});

describe('dynamic mock — graphql operation filter', () => {
  it('only invokes modifyResponse when filter matches', async () => {
    const rule = mockRule({
      bodyType: 'dynamic',
      responseBody: 'function modifyResponse(args){ return JSON.stringify({ wrapped: args.responseJSON }); }',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'getUsers' },
    });
    const inj = buildMockInjection(rule);
    expect(inj.kind).toBe('inline-script');
    if (inj.kind !== 'inline-script') return;

    // Stub fetch with a JSON response so modifyResponse has data to wrap.
    window.fetch = vi.fn().mockResolvedValue(
      new Response('{"users":[{"id":1}]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    installInline(inj.code);

    const matched = await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'getUsers' }),
    });
    expect(await matched.text()).toBe('{"wrapped":{"users":[{"id":1}]}}');

    // Non-matching: function does NOT run; original response passes through.
    const passed = await window.fetch(URL, {
      method: 'POST',
      body: JSON.stringify({ operationName: 'getPosts' }),
    });
    expect(await passed.text()).toBe('{"users":[{"id":1}]}');
  });
});
