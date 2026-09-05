/**
 * GraphqlRequest sync round-trip: seed → materialize → project, plus
 * the update-batch shapes — scalar `setField` leaves, per-leaf
 * flatten-diff for `auth` / `specLink`, and minimum set-diff
 * envelopes for the set-modeled `headers` path.
 */

import { describe, expect, it } from 'vitest';
import {
  GRAPHQL_REQUEST_ENTITY_TYPE,
  GRAPHQL_REQUEST_HEADERS_PATH,
  InMemoryDocumentStore,
  type MutatorContext,
} from '../../src/sync';
import {
  buildGraphqlAddBatch,
  buildGraphqlUpdateBatch,
  type GraphqlLiveFieldValue,
  type GraphqlRequestMutationPayload,
} from '../../src/sync-builders/mutations/graphql-request-mutations';
import { projectGraphqlRequest } from '../../src/sync-builders/projections/graphql-request-projection';
import type { GraphqlRequest } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const graphqlSchemas = new Map([[GRAPHQL_REQUEST_ENTITY_TYPE, { setPaths: [GRAPHQL_REQUEST_HEADERS_PATH] }]]);

const noSets = () => [];

function applyBatch(store: InMemoryDocumentStore, payload: GraphqlRequestMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

function liveField(store: InMemoryDocumentStore, uid: string): GraphqlLiveFieldValue {
  return (_uid, path) => {
    const m = store.materializeOne(GRAPHQL_REQUEST_ENTITY_TYPE, uid);
    const r = m ? projectGraphqlRequest(m) : null;
    if (!r) return undefined;
    return r[path as keyof GraphqlRequest];
  };
}

function materialized(store: InMemoryDocumentStore, uid: string): GraphqlRequest {
  const m = store.materializeOne(GRAPHQL_REQUEST_ENTITY_TYPE, uid);
  const r = m ? projectGraphqlRequest(m) : null;
  if (!r) throw new Error('graphql request did not materialize');
  return r;
}

const seed: GraphqlRequest = {
  schemaVersion: 5,
  uid: 'gqrq0001',
  path: 'requests/viewer-gqrq0001',
  name: 'Viewer',
  url: 'https://api.openheaders.io/graphql',
  query: 'query Viewer { viewer { id } }',
  variables: '{}',
  operationName: 'Viewer',
  headers: [
    { uid: 'gqhd0001', key: 'X-Tenant', value: 'openheaders', enabled: true },
    { uid: 'gqhd0002', key: 'X-Trace', value: 'on' },
  ],
  auth: { type: 'inherit' },
  specLink: { specUid: 'spec0001' },
};

describe('graphql request seed → project round-trip', () => {
  it('materializes the seeded entity back to the persisted shape', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(store, buildGraphqlAddBatch(seed, ctx(1_000), null));
    expect(materialized(store, 'gqrq0001')).toEqual(seed);
  });

  it('materializes an empty headers set as [] (schema-aware set path)', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(store, buildGraphqlAddBatch({ ...seed, headers: [] }, ctx(1_000), null));
    expect(materialized(store, 'gqrq0001').headers).toEqual([]);
  });

  it('emits one addToSet per header row with the row uid as itemId', () => {
    const payload = buildGraphqlAddBatch(seed, ctx(1_000), null);
    const adds = payload.batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds.map((m) => (m.body.kind === 'addToSet' ? m.body.itemId : ''))).toEqual(['gqhd0001', 'gqhd0002']);
    const create = payload.batch.mutations[0];
    expect(create.body.kind).toBe('create');
    if (create.body.kind === 'create') {
      expect((create.body.payload as Record<string, unknown>).headers).toBeUndefined();
    }
  });

  it('round-trips the HTTP script pair as top-level scalars', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    const seeded: GraphqlRequest = { ...seed, preRequestScript: 'pre();', postResponseScript: 'post();' };
    applyBatch(store, buildGraphqlAddBatch(seeded, ctx(1_000), null));
    expect(materialized(store, 'gqrq0001')).toEqual(seeded);
  });

  it('projects null for a foreign entity type', () => {
    expect(projectGraphqlRequest({ type: 'request', id: 'x', data: {}, fieldOrigins: {} })).toBeNull();
  });
});

describe('graphql request update batches', () => {
  it('persists scalar edits (url, query, variables, operationName) as setField leaves', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(store, buildGraphqlAddBatch(seed, ctx(1_000), null));

    applyBatch(
      store,
      buildGraphqlUpdateBatch(
        'gqrq0001',
        {
          url: 'https://staging.openheaders.io/graphql',
          query: 'query Notes { notes { id } }',
          variables: '{"first": 5}',
          operationName: 'Notes',
        },
        ctx(2_000),
        noSets,
        liveField(store, 'gqrq0001'),
      ),
    );

    const after = materialized(store, 'gqrq0001');
    expect(after.url).toBe('https://staging.openheaders.io/graphql');
    expect(after.query).toBe('query Notes { notes { id } }');
    expect(after.variables).toBe('{"first": 5}');
    expect(after.operationName).toBe('Notes');
  });

  it('tombstones a cleared scalar only when the pre-image carries a value', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(store, buildGraphqlAddBatch(seed, ctx(1_000), null));

    const clear = buildGraphqlUpdateBatch(
      'gqrq0001',
      { operationName: undefined, timeoutMs: undefined },
      ctx(2_000),
      noSets,
      liveField(store, 'gqrq0001'),
    );
    expect(clear.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'unsetField', type: GRAPHQL_REQUEST_ENTITY_TYPE, id: 'gqrq0001', path: 'operationName' },
    ]);
    applyBatch(store, clear);
    expect(materialized(store, 'gqrq0001').operationName).toBeUndefined();
  });

  it('routes an auth edit through the per-leaf flatten-diff and tombstones the token on the switch back to inherit', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(
      store,
      buildGraphqlAddBatch({ ...seed, auth: { type: 'bearer', token: '{{token}}' } }, ctx(1_000), null),
    );

    const edit = buildGraphqlUpdateBatch(
      'gqrq0001',
      { auth: { type: 'bearer', token: '{{rotated}}' } },
      ctx(2_000),
      noSets,
      liveField(store, 'gqrq0001'),
    );
    const editPaths = edit.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(editPaths).not.toContain('auth');
    expect(editPaths).toContain('auth.token');
    applyBatch(store, edit);
    expect(materialized(store, 'gqrq0001').auth).toEqual({ type: 'bearer', token: '{{rotated}}' });

    applyBatch(
      store,
      buildGraphqlUpdateBatch(
        'gqrq0001',
        { auth: { type: 'inherit' } },
        ctx(3_000),
        noSets,
        liveField(store, 'gqrq0001'),
      ),
    );
    expect(materialized(store, 'gqrq0001').auth).toEqual({ type: 'inherit' });
  });

  it('persists a spec re-link through the per-leaf flatten-diff and clears it on explicit undefined', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(store, buildGraphqlAddBatch(seed, ctx(1_000), null));

    applyBatch(
      store,
      buildGraphqlUpdateBatch(
        'gqrq0001',
        { specLink: { specUid: 'spec0002' } },
        ctx(2_000),
        noSets,
        liveField(store, 'gqrq0001'),
      ),
    );
    expect(materialized(store, 'gqrq0001').specLink).toEqual({ specUid: 'spec0002' });

    applyBatch(
      store,
      buildGraphqlUpdateBatch('gqrq0001', { specLink: undefined }, ctx(3_000), noSets, liveField(store, 'gqrq0001')),
    );
    expect(materialized(store, 'gqrq0001').specLink).toBeUndefined();
  });

  it('diffs the headers set to minimum envelopes — one add, one remove, untouched rows silent', () => {
    const store = new InMemoryDocumentStore(graphqlSchemas);
    applyBatch(store, buildGraphqlAddBatch(seed, ctx(1_000), null));
    // Live reader over the materialized set — ordered (itemId, orderKey, item).
    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(GRAPHQL_REQUEST_ENTITY_TYPE, uid, setPath);
      const byUid = new Map(materialized(store, uid).headers.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const payload = buildGraphqlUpdateBatch(
      'gqrq0001',
      {
        headers: [
          { uid: 'gqhd0001', key: 'X-Tenant', value: 'openheaders', enabled: true },
          { uid: 'gqhd0003', key: 'Accept', value: 'application/json' },
        ],
      },
      ctx(2_000),
      liveSets,
      liveField(store, 'gqrq0001'),
    );
    const kinds = payload.batch.mutations.map((m) => m.body.kind);
    expect(kinds).toContain('addToSet');
    expect(kinds).toContain('removeFromSet');
    applyBatch(store, payload);
    expect(materialized(store, 'gqrq0001').headers.map((h) => h.uid)).toEqual(['gqhd0001', 'gqhd0003']);
  });
});
