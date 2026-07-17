/**
 * GrpcRequest sync round-trip: seed → materialize → project, plus the
 * update-batch shapes — scalar `setField` leaves, per-leaf flatten-diff
 * for `method` / `auth` / `specLink`, and minimum set-diff envelopes
 * for `metadata` rows.
 */

import { describe, expect, it } from 'vitest';
import {
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_METADATA_PATH,
  InMemoryDocumentStore,
  type MutatorContext,
} from '../../src/sync';
import {
  buildGrpcAddBatch,
  buildGrpcUpdateBatch,
  type GrpcLiveFieldValue,
  type GrpcRequestMutationPayload,
} from '../../src/sync-builders/mutations/grpc-request-mutations';
import { projectGrpcRequest } from '../../src/sync-builders/projections/grpc-request-projection';
import type { GrpcRequest } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const grpcSchemas = new Map([[GRPC_REQUEST_ENTITY_TYPE, { setPaths: [GRPC_REQUEST_METADATA_PATH] }]]);

const noSets = () => [];

function applyBatch(store: InMemoryDocumentStore, payload: GrpcRequestMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

function liveField(store: InMemoryDocumentStore, uid: string): GrpcLiveFieldValue {
  return (_uid, path) => {
    const m = store.materializeOne(GRPC_REQUEST_ENTITY_TYPE, uid);
    const r = m ? projectGrpcRequest(m) : null;
    if (!r) return undefined;
    if (path === 'method') return r.method;
    if (path === 'auth') return r.auth;
    if (path === 'specLink') return r.specLink;
    return undefined;
  };
}

function materialized(store: InMemoryDocumentStore, uid: string): GrpcRequest {
  const m = store.materializeOne(GRPC_REQUEST_ENTITY_TYPE, uid);
  const r = m ? projectGrpcRequest(m) : null;
  if (!r) throw new Error('grpc request did not materialize');
  return r;
}

const seed: GrpcRequest = {
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Create Book',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'CreateBook' },
  message: '{"title": "The Library"}',
  metadata: [
    { uid: 'meta0001', key: 'x-api-key', value: '{{vault.api_key}}', enabled: true },
    { uid: 'meta0002', key: 'x-trace', value: 'on' },
  ],
  specLink: { specUid: 'spec0001' },
};

describe('grpc request seed → project round-trip', () => {
  it('materializes the seeded entity back to the persisted shape', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));
    expect(materialized(store, 'grpc0001')).toEqual(seed);
  });

  it('materializes an empty metadata set as [] (schema-aware set path)', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch({ ...seed, metadata: [] }, ctx(1_000)));
    expect(materialized(store, 'grpc0001').metadata).toEqual([]);
  });

  it('emits one addToSet per metadata row with the row uid as itemId', () => {
    const payload = buildGrpcAddBatch(seed, ctx(1_000));
    const adds = payload.batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds.map((m) => (m.body.kind === 'addToSet' ? m.body.itemId : ''))).toEqual(['meta0001', 'meta0002']);
    // The create shell must not carry the set-modeled field — a
    // numeric-indexed flatten would compete with the addToSet entries.
    const create = payload.batch.mutations[0];
    expect(create.body.kind).toBe('create');
    if (create.body.kind === 'create') {
      expect((create.body.payload as Record<string, unknown>).metadata).toBeUndefined();
    }
  });

  it('projects null for a foreign entity type', () => {
    expect(projectGrpcRequest({ type: 'request', id: 'x', data: {}, fieldOrigins: {} })).toBeNull();
  });
});

describe('grpc request update batches', () => {
  it('persists scalar edits (url, tls, message) as setField leaves', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildGrpcUpdateBatch(
        'grpc0001',
        { url: 'grpc-staging.openheaders.io:8443', tls: false, message: '{}' },
        ctx(2_000),
        noSets,
        liveField(store, 'grpc0001'),
      ),
    );

    const after = materialized(store, 'grpc0001');
    expect(after.url).toBe('grpc-staging.openheaders.io:8443');
    expect(after.tls).toBe(false);
    expect(after.message).toBe('{}');
  });

  it('routes method changes through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));

    const payload = buildGrpcUpdateBatch(
      'grpc0001',
      { method: { service: 'library.v1.Library', rpc: 'ListBooks' } },
      ctx(2_000),
      noSets,
      liveField(store, 'grpc0001'),
    );
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(paths).not.toContain('method');
    expect(paths).toContain('method.rpc');

    applyBatch(store, payload);
    expect(materialized(store, 'grpc0001').method).toEqual({ service: 'library.v1.Library', rpc: 'ListBooks' });
  });

  it('routes the bearer credential through the per-leaf flatten-diff and clears it to none', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));

    const setBearer = buildGrpcUpdateBatch(
      'grpc0001',
      { auth: { type: 'bearer', token: '{{vault.api_token}}' } },
      ctx(2_000),
      noSets,
      liveField(store, 'grpc0001'),
    );
    const paths = setBearer.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(paths).not.toContain('auth');
    expect(paths).toContain('auth.token');
    applyBatch(store, setBearer);
    expect(materialized(store, 'grpc0001').auth).toEqual({ type: 'bearer', token: '{{vault.api_token}}' });

    // Clearing lands as the concrete none shape (the editor's law) —
    // the flatten-diff tombstones the token leaf.
    applyBatch(
      store,
      buildGrpcUpdateBatch('grpc0001', { auth: { type: 'none' } }, ctx(3_000), noSets, liveField(store, 'grpc0001')),
    );
    expect(materialized(store, 'grpc0001').auth).toEqual({ type: 'none' });
  });

  it('persists the sslVerification knob as a scalar setField leaf', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildGrpcUpdateBatch('grpc0001', { sslVerification: false }, ctx(2_000), noSets, liveField(store, 'grpc0001')),
    );
    expect(materialized(store, 'grpc0001').sslVerification).toBe(false);
  });

  it('persists a spec re-link through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildGrpcUpdateBatch(
        'grpc0001',
        { specLink: { specUid: 'spec0002' } },
        ctx(2_000),
        noSets,
        liveField(store, 'grpc0001'),
      ),
    );
    expect(materialized(store, 'grpc0001').specLink).toEqual({ specUid: 'spec0002' });
  });

  it('emits minimum set-diff envelopes for metadata row edits', () => {
    const store = new InMemoryDocumentStore(grpcSchemas);
    applyBatch(store, buildGrpcAddBatch(seed, ctx(1_000)));

    // Live reader over the materialized set — ordered (itemId, orderKey, item).
    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(GRPC_REQUEST_ENTITY_TYPE, uid, setPath);
      const rows = materialized(store, uid).metadata;
      const byUid = new Map(rows.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [
      { uid: 'meta0001', key: 'x-api-key', value: 'rotated', enabled: true }, // content edit
      { uid: 'meta0003', key: 'x-new', value: 'v3' }, // added
      // meta0002 removed
    ];
    const payload = buildGrpcUpdateBatch(
      'grpc0001',
      { metadata: next },
      ctx(2_000),
      liveSets,
      liveField(store, 'grpc0001'),
    );
    const kinds = payload.batch.mutations.map((m) => m.body.kind);
    expect(kinds).toContain('addToSet');
    expect(kinds).toContain('removeFromSet');

    applyBatch(store, payload);
    expect(materialized(store, 'grpc0001').metadata).toEqual(next);
  });
});
