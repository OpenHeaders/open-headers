/**
 * `compileGraphqlRequest` — the ONE compile a GraphQL request goes
 * through on the executing host: the entity becomes the HTTP POST the
 * pipeline runs (same identity, the graphql body variant), and the
 * operation pick follows the census's rule — nothing on the wire for a
 * single operation, the requested name when the document holds it, the
 * first named otherwise, the live override winning over the stored
 * pick, and an unparseable document sending as written.
 */

import type { GraphqlRequest } from '@openheaders/core/types';
import { compileGraphqlRequest } from '@openheaders/oracle/live/graphql-exec/execute';
import { describe, expect, it } from 'vitest';

function entity(overrides: Partial<GraphqlRequest> = {}): GraphqlRequest {
  return {
    schemaVersion: 5,
    uid: 'gql-1',
    path: 'requests/api-col1/viewer-gql-1',
    name: 'Viewer',
    url: 'https://api.openheaders.io/graphql',
    query: 'query Viewer { viewer { id } }',
    headers: [{ uid: 'h1', key: 'X-Trace', value: '1' }],
    auth: { type: 'inherit' },
    ...overrides,
  };
}

const TWO_OPERATIONS = 'query A { echo(text: "a") } query B { echo(text: "b") }';

describe('compileGraphqlRequest', () => {
  it('compiles to the HTTP POST with the same identity and the graphql body variant', () => {
    const compiled = compileGraphqlRequest(entity({ variables: '{"first": 1}', timeoutMs: 5000 }));
    expect(compiled.method).toBe('POST');
    expect(compiled.uid).toBe('gql-1');
    expect(compiled.path).toBe('requests/api-col1/viewer-gql-1');
    expect(compiled.url).toBe('https://api.openheaders.io/graphql');
    expect(compiled.headers).toEqual([{ uid: 'h1', key: 'X-Trace', value: '1' }]);
    expect(compiled.params).toEqual([]);
    expect(compiled.auth).toEqual({ type: 'inherit' });
    expect(compiled.timeoutMs).toBe(5000);
    expect(compiled.body).toEqual({
      type: 'graphql',
      content: 'query Viewer { viewer { id } }',
      graphqlVariables: '{"first": 1}',
    });
  });

  it('puts no operationName on the wire for a single operation, even when one is stored', () => {
    const compiled = compileGraphqlRequest(entity({ operationName: 'Viewer' }));
    expect(compiled.body).toEqual({ type: 'graphql', content: 'query Viewer { viewer { id } }' });
  });

  it('forwards the stored pick when the document holds several operations', () => {
    const compiled = compileGraphqlRequest(entity({ query: TWO_OPERATIONS, operationName: 'B' }));
    expect(compiled.body).toEqual({ type: 'graphql', content: TWO_OPERATIONS, operationName: 'B' });
  });

  it('falls back to the first named operation when the stored pick is stale', () => {
    const compiled = compileGraphqlRequest(entity({ query: TWO_OPERATIONS, operationName: 'Gone' }));
    expect(compiled.body).toEqual({ type: 'graphql', content: TWO_OPERATIONS, operationName: 'A' });
  });

  it('lets the live override win over the stored pick', () => {
    const compiled = compileGraphqlRequest(entity({ query: TWO_OPERATIONS, operationName: 'A' }), {
      operationName: 'B',
    });
    expect(compiled.body).toEqual({ type: 'graphql', content: TWO_OPERATIONS, operationName: 'B' });
  });

  it('sends an unparseable document as written, the requested name riding through', () => {
    const compiled = compileGraphqlRequest(entity({ query: 'query {', operationName: 'X' }));
    expect(compiled.body).toEqual({ type: 'graphql', content: 'query {', operationName: 'X' });
  });
});
