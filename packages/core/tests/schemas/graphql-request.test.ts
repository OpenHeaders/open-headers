/**
 * The entity's contract with the compile: `GraphqlRequest` satisfies
 * `GraphqlRequestLike` structurally (a type-level pin — the build
 * fails the day the schema and the compile's field list drift), the
 * auth mask is the HTTP list plus `inherit`, and the proxy tie holds
 * at the persist boundary.
 */

import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { type GraphqlRequestLike, toHttpRequest } from '../../src/graphql';
import { GraphqlRequestSchema } from '../../src/schemas/graphql-request';
import { HTTP_INHERITABLE_SETTING_KEYS } from '../../src/schemas/inheritable-settings';
import type { GraphqlRequest } from '../../src/types';

const base: GraphqlRequest = {
  schemaVersion: 5,
  uid: 'gqrq0001',
  path: 'requests/viewer-gqrq0001',
  name: 'Viewer',
  url: 'https://api.openheaders.io/graphql',
  query: 'query { viewer { id } }',
  headers: [],
  auth: { type: 'inherit' },
};

describe('GraphqlRequestSchema', () => {
  it('satisfies the compile input structurally', () => {
    expectTypeOf<GraphqlRequest>().toMatchTypeOf<GraphqlRequestLike>();
    const request: GraphqlRequestLike = base;
    expect(toHttpRequest(request).method).toBe('POST');
  });

  it('carries every HTTP settings knob and nothing of another kind', () => {
    const entries = Object.keys(GraphqlRequestSchema.entries);
    for (const key of HTTP_INHERITABLE_SETTING_KEYS) expect(entries).toContain(key);
    for (const foreign of ['method', 'params', 'body', 'maxMessageBytes', 'keepAlive', 'autoReconnect']) {
      expect(entries).not.toContain(foreign);
    }
  });

  it('accepts every HTTP auth type plus inherit and refuses nothing the HTTP request takes', () => {
    for (const auth of [
      { type: 'none' },
      { type: 'inherit' },
      { type: 'basic', username: 'u', password: 'p' },
      { type: 'bearer', token: 't' },
      { type: 'api-key', key: 'X-Api-Key', value: 'v', in: 'header' },
      { type: 'digest', username: 'u', password: 'p' },
      { type: 'hawk', authId: 'id', authKey: 'k', algorithm: 'sha256' },
    ]) {
      expect(v.safeParse(GraphqlRequestSchema, { ...base, auth }).success).toBe(true);
    }
  });

  it('ties the proxy mode to the proxy URL at the persist boundary', () => {
    expect(v.safeParse(GraphqlRequestSchema, { ...base, proxyMode: 'url' }).success).toBe(false);
    expect(
      v.safeParse(GraphqlRequestSchema, { ...base, proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080' })
        .success,
    ).toBe(true);
  });
});
