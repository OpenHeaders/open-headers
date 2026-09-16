// @vitest-environment jsdom
/**
 * useGraphqlSchema — the introspection rides the QUERY'S PLACE: the
 * hook's `introspect()` hands the query's resolved target to the same
 * `executeGraphqlRequest` route the Query button uses, so a delegated
 * query introspects through the place that opens its socket; a query
 * whose socket opens here names no place. The local-plane cache is
 * stubbed — the contract under test is the send's frame.
 */

import { INTROSPECTION_QUERY } from '@openheaders/core/graphql';
import type { ExecutedRequestSnapshot, GraphqlRequest } from '@openheaders/core/types';
import { draftFromGraphqlRequest } from '@openheaders/ui/workbench/components/graphql-request-editor/draft';
import { useGraphqlSchema } from '@openheaders/ui/workbench/components/graphql-request-editor/use-graphql-schema';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/graphql-request-editor/graphql-schema-cache', () => ({
  readIntrospectionCache: async () => null,
  writeIntrospectionCache: async () => undefined,
}));

const ENTITY: GraphqlRequest = {
  schemaVersion: 5,
  uid: 'gqrq0001',
  path: 'requests/viewer-gqrq0001',
  name: 'Viewer',
  url: 'https://api.openheaders.io/graphql',
  query: 'query Viewer { viewer { id } }',
  variables: '{"first": 10}',
  operationName: 'Viewer',
  headers: [],
  auth: { type: 'inherit' },
};

const FAILED: ExecutedRequestSnapshot = {
  status: 0,
  statusText: '',
  url: ENTITY.url,
  headers: [],
  body: '',
  bodyTruncated: false,
  bodyBytes: 0,
  durationMs: 1,
  error: 'refused',
  scriptResult: null,
} as ExecutedRequestSnapshot;

type ExecuteGraphql = (input: {
  draft: GraphqlRequest;
  executionPlace?: { backendId: string };
}) => Promise<ExecutedRequestSnapshot | null>;

function renderSchema(executionPlace: { backendId: string } | null) {
  const executeGraphql = vi.fn<ExecuteGraphql>(async () => FAILED);
  const hook = renderHook(() =>
    useGraphqlSchema({
      entity: ENTITY,
      draft: draftFromGraphqlRequest(ENTITY),
      workspaceId: 'ws0001',
      binding: { kind: 'unlinked' },
      executionPlace,
      executeGraphql,
    }),
  );
  return { hook, executeGraphql };
}

describe('useGraphqlSchema — the introspection rides the query’s place', () => {
  it('hands the query’s target to the send, with the introspection document as the query', async () => {
    const { hook, executeGraphql } = renderSchema({ backendId: 'be-desktop' });
    await act(async () => {
      await hook.result.current.introspect();
    });
    expect(executeGraphql).toHaveBeenCalledTimes(1);
    const input = executeGraphql.mock.calls[0]?.[0];
    expect(input?.executionPlace).toEqual({ backendId: 'be-desktop' });
    expect(input?.draft.query).toBe(INTROSPECTION_QUERY);
    // The variables and the operation name never ride the introspection.
    expect(input !== undefined && 'variables' in input.draft).toBe(false);
    expect(input !== undefined && 'operationName' in input.draft).toBe(false);
  });

  it('names no place when the query’s socket opens here', async () => {
    const { hook, executeGraphql } = renderSchema(null);
    await act(async () => {
      await hook.result.current.introspect();
    });
    const input = executeGraphql.mock.calls[0]?.[0];
    expect(input).toBeDefined();
    expect(input !== undefined && 'executionPlace' in input).toBe(false);
  });
});
