/**
 * The reverse bridge — HTTP request (graphql body mode) → GraphQL
 * request content: the document / variables / operation pick as the
 * entity's own fields, headers / auth / docs / specLink / the script
 * pair / the settings knobs verbatim, the enabled query rows folded
 * into the URL with disabled rows dropped and noted, a non-POST source
 * noted; a non-graphql body refused. Pinned against the compile: the
 * two bridges round-trip.
 */

import { fromHttpRequest, isConvertibleToGraphql, toHttpRequest } from '@openheaders/core/graphql';
import type { Request } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'req00001',
    path: 'requests/api/notes-req00001',
    name: 'Notes',
    method: 'POST',
    url: 'https://api.openheaders.io/graphql',
    headers: [{ uid: 'hdr00001', key: 'X-Trace', value: '{{trace}}' }],
    params: [],
    auth: { type: 'bearer', token: 'probe-token' },
    body: {
      type: 'graphql',
      content: 'query A { a } query B { b }',
      graphqlVariables: '{"first": 2}',
      operationName: 'B',
    },
    description: 'The notes query.',
    specLink: { specUid: 'spc00001' },
    preRequestScript: 'oh.request.headers.set("X-Pre", "1");',
    postResponseScript: 'oh.test("ok", () => {});',
    timeoutMs: 5000,
    followRedirects: false,
    ...overrides,
  };
}

describe('fromHttpRequest', () => {
  it('carries the body, headers, auth, docs, specLink, scripts and settings onto the content', () => {
    const result = fromHttpRequest(makeRequest());
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.notes).toEqual([]);
    expect(result.content).toEqual({
      description: 'The notes query.',
      url: 'https://api.openheaders.io/graphql',
      query: 'query A { a } query B { b }',
      variables: '{"first": 2}',
      operationName: 'B',
      headers: [{ uid: 'hdr00001', key: 'X-Trace', value: '{{trace}}' }],
      auth: { type: 'bearer', token: 'probe-token' },
      specLink: { specUid: 'spc00001' },
      timeoutMs: 5000,
      followRedirects: false,
      preRequestScript: 'oh.request.headers.set("X-Pre", "1");',
      postResponseScript: 'oh.test("ok", () => {});',
    });
  });

  it('folds the enabled query rows into the URL (templates verbatim) and notes the disabled ones dropped', () => {
    const result = fromHttpRequest(
      makeRequest({
        params: [
          { uid: 'prm00001', key: 'tenant', value: '{{tenant}}' },
          { uid: 'prm00002', key: 'debug', value: '1', enabled: false },
          { uid: 'prm00003', key: 'flag', value: '', hasEquals: true },
        ],
      }),
    );
    expect(result?.content.url).toBe('https://api.openheaders.io/graphql?tenant={{tenant}}&flag=');
    expect(result?.notes).toEqual([
      { kind: 'params-folded', count: 2 },
      { kind: 'disabled-params-dropped', count: 1 },
    ]);
  });

  it('notes a non-POST source method and refuses a non-graphql body', () => {
    const noted = fromHttpRequest(makeRequest({ method: 'GET' }));
    expect(noted?.notes).toEqual([{ kind: 'method-changed', method: 'GET' }]);
    expect(fromHttpRequest(makeRequest({ body: { type: 'json', content: '{}' } }))).toBeNull();
    expect(isConvertibleToGraphql(makeRequest())).toBe(true);
    expect(isConvertibleToGraphql(makeRequest({ body: { type: 'none' } }))).toBe(false);
  });

  it('round-trips through the compile: fromHttpRequest(toHttpRequest(g)) yields g’s content', () => {
    const graphql = {
      schemaVersion: 5 as const,
      uid: 'gql00001',
      path: 'requests/api/viewer-gql00001',
      name: 'Viewer',
      url: 'https://api.openheaders.io/graphql',
      query: 'query Viewer { viewer { id } }',
      variables: '{}',
      headers: [],
      auth: { type: 'inherit' as const },
      timeoutMs: 1000,
    };
    const compiled = toHttpRequest(graphql);
    const back = fromHttpRequest(compiled);
    expect(back?.notes).toEqual([]);
    expect(back?.content).toEqual({
      url: graphql.url,
      query: graphql.query,
      variables: '{}',
      headers: [],
      auth: { type: 'inherit' },
      timeoutMs: 1000,
    });
  });
});
