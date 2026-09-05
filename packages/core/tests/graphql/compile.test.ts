/**
 * The compile — a GraphQL request into the HTTP request the executor
 * runs: POST, no params, the graphql body variant with the operation
 * pick, identity carried for the ancestor chain, the HTTP settings
 * knobs and the script pair verbatim, and an output that satisfies
 * the runtime request schema.
 */

import { type GraphqlRequestLike, toHttpRequest } from '@openheaders/core/graphql';
import { RequestSchema } from '@openheaders/core/schemas';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

const QUERY = 'query Users($first: Int) { users(first: $first) { totalCount } }\nquery Viewer { viewer { id } }';

function request(overrides: Partial<GraphqlRequestLike> = {}): GraphqlRequestLike {
  return {
    schemaVersion: 5,
    uid: 'gqrq0001',
    path: 'requests/users-gqrq0001',
    pathSegment: 'users-gqrq0001',
    name: 'Users',
    description: 'Lists users.',
    url: 'https://api.openheaders.io/graphql',
    query: QUERY,
    variables: '{"first": 5}',
    operationName: 'Users',
    headers: [{ uid: 'hdr00001', key: 'X-Trace', value: 'on', enabled: true }],
    auth: { type: 'bearer', token: '{{token}}' },
    specLink: { specUid: 'spec0001' },
    preRequestScript: 'oh.setHeader("X-Pre", "1");',
    postResponseScript: 'oh.test("ok", () => {});',
    timeoutMs: 30_000,
    followRedirects: false,
    proxyMode: 'direct',
    httpVersion: '2',
    ...overrides,
  };
}

describe('toHttpRequest', () => {
  it('compiles to a POST with the graphql body and no params', () => {
    const compiled = toHttpRequest(request());
    expect(compiled.method).toBe('POST');
    expect(compiled.url).toBe('https://api.openheaders.io/graphql');
    expect(compiled.params).toEqual([]);
    expect(compiled.body).toEqual({
      type: 'graphql',
      content: QUERY,
      graphqlVariables: '{"first": 5}',
      operationName: 'Users',
    });
  });

  it('carries identity, headers, auth, spec binding, scripts and the HTTP settings verbatim', () => {
    const compiled = toHttpRequest(request());
    expect(compiled).toMatchObject({
      schemaVersion: 5,
      uid: 'gqrq0001',
      path: 'requests/users-gqrq0001',
      pathSegment: 'users-gqrq0001',
      name: 'Users',
      description: 'Lists users.',
      headers: [{ uid: 'hdr00001', key: 'X-Trace', value: 'on', enabled: true }],
      auth: { type: 'bearer', token: '{{token}}' },
      specLink: { specUid: 'spec0001' },
      preRequestScript: 'oh.setHeader("X-Pre", "1");',
      postResponseScript: 'oh.test("ok", () => {});',
      timeoutMs: 30_000,
      followRedirects: false,
      proxyMode: 'direct',
      httpVersion: '2',
    });
    expect(Object.keys(compiled)).not.toContain('sslVerification');
  });

  it('lets the option override the stored operation pick and drops an empty one', () => {
    expect(toHttpRequest(request(), { operationName: 'Viewer' }).body).toMatchObject({ operationName: 'Viewer' });
    expect(toHttpRequest(request({ operationName: undefined })).body).not.toHaveProperty('operationName');
    expect(toHttpRequest(request(), { operationName: '' }).body).not.toHaveProperty('operationName');
  });

  it('omits absent optionals instead of writing undefined', () => {
    const compiled = toHttpRequest(
      request({
        pathSegment: undefined,
        description: undefined,
        variables: undefined,
        specLink: undefined,
        preRequestScript: undefined,
        postResponseScript: undefined,
        timeoutMs: undefined,
        followRedirects: undefined,
        proxyMode: undefined,
        httpVersion: undefined,
      }),
    );
    expect(Object.keys(compiled).sort()).toEqual([
      'auth',
      'body',
      'headers',
      'method',
      'name',
      'params',
      'path',
      'schemaVersion',
      'uid',
      'url',
    ]);
    expect(compiled.body).toEqual({ type: 'graphql', content: QUERY, operationName: 'Users' });
  });

  it('produces a request the runtime schema accepts', () => {
    expect(v.safeParse(RequestSchema, toHttpRequest(request())).success).toBe(true);
    expect(v.safeParse(RequestSchema, toHttpRequest(request({ auth: { type: 'inherit' } }))).success).toBe(true);
  });

  it('does not share the headers array with the input', () => {
    const input = request();
    const compiled = toHttpRequest(input);
    expect(compiled.headers).not.toBe(input.headers);
  });
});
