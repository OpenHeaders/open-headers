/**
 * WebSocketRequest sync round-trip: seed → materialize → project, plus
 * the update-batch shapes — scalar `setField` leaves, per-leaf
 * flatten-diff for `subprotocols` / `specLink`, and minimum set-diff
 * envelopes for `headers` / `params` rows.
 */

import { describe, expect, it } from 'vitest';
import {
  InMemoryDocumentStore,
  type MutatorContext,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EVENTS_PATH,
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
} from '../../src/sync';
import {
  buildWebSocketAddBatch,
  buildWebSocketUpdateBatch,
  type WebSocketLiveFieldValue,
  type WebSocketRequestMutationPayload,
} from '../../src/sync-builders/mutations/websocket-request-mutations';
import { projectWebSocketRequest } from '../../src/sync-builders/projections/websocket-request-projection';
import type { WebSocketRequest } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const wsSchemas = new Map([
  [
    WEBSOCKET_REQUEST_ENTITY_TYPE,
    { setPaths: [WEBSOCKET_REQUEST_HEADERS_PATH, WEBSOCKET_REQUEST_PARAMS_PATH, WEBSOCKET_REQUEST_EVENTS_PATH] },
  ],
]);

const noSets = () => [];

function applyBatch(store: InMemoryDocumentStore, payload: WebSocketRequestMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

function liveField(store: InMemoryDocumentStore, uid: string): WebSocketLiveFieldValue {
  return (_uid, path) => {
    const m = store.materializeOne(WEBSOCKET_REQUEST_ENTITY_TYPE, uid);
    const r = m ? projectWebSocketRequest(m) : null;
    if (!r) return undefined;
    if (path === 'subprotocols') return r.subprotocols;
    if (path === 'specLink') return r.specLink;
    if (path === 'auth') return r.auth;
    return undefined;
  };
}

function materialized(store: InMemoryDocumentStore, uid: string): WebSocketRequest {
  const m = store.materializeOne(WEBSOCKET_REQUEST_ENTITY_TYPE, uid);
  const r = m ? projectWebSocketRequest(m) : null;
  if (!r) throw new Error('websocket request did not materialize');
  return r;
}

const seed: WebSocketRequest = {
  schemaVersion: 5,
  uid: 'wsrq0001',
  path: 'requests/live-events-wsrq0001',
  name: 'Live Events',
  url: 'wss://events.openheaders.io/live',
  flavor: 'raw',
  subprotocols: ['graphql-ws'],
  headers: [
    { uid: 'wshd0001', key: 'x-api-key', value: '{{vault.api_key}}', enabled: true },
    { uid: 'wshd0002', key: 'x-trace', value: 'on' },
  ],
  params: [{ uid: 'wspm0001', key: 'tenant', value: 'openheaders', enabled: true }],
  message: '{"event": "subscribe"}',
  messageFormat: 'json',
  specLink: { specUid: 'spec0001' },
};

describe('websocket request seed → project round-trip', () => {
  it('materializes the seeded entity back to the persisted shape', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch(seed, ctx(1_000)));
    expect(materialized(store, 'wsrq0001')).toEqual(seed);
  });

  it('materializes empty header + param sets as [] (schema-aware set paths)', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch({ ...seed, headers: [], params: [] }, ctx(1_000)));
    expect(materialized(store, 'wsrq0001').headers).toEqual([]);
    expect(materialized(store, 'wsrq0001').params).toEqual([]);
  });

  it('emits one addToSet per header/param row with the row uid as itemId', () => {
    const payload = buildWebSocketAddBatch(seed, ctx(1_000));
    const adds = payload.batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds.map((m) => (m.body.kind === 'addToSet' ? m.body.itemId : ''))).toEqual([
      'wshd0001',
      'wshd0002',
      'wspm0001',
    ]);
    // The create shell must not carry the set-modeled fields — a
    // numeric-indexed flatten would compete with the addToSet entries.
    const create = payload.batch.mutations[0];
    expect(create.body.kind).toBe('create');
    if (create.body.kind === 'create') {
      expect((create.body.payload as Record<string, unknown>).headers).toBeUndefined();
      expect((create.body.payload as Record<string, unknown>).params).toBeUndefined();
    }
  });

  it('round-trips the auth block and events rows (events as a set path)', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    const seeded: WebSocketRequest = {
      ...seed,
      flavor: 'socketio',
      auth: { type: 'bearer', token: '{{vault.ws_token}}' },
      events: [
        { uid: 'wsev0001', name: 'price-update', listen: true },
        { uid: 'wsev0002', name: 'heartbeat', listen: false, description: 'server keepalive' },
      ],
    };
    applyBatch(store, buildWebSocketAddBatch(seeded, ctx(1_000)));
    expect(materialized(store, 'wsrq0001')).toEqual(seeded);
  });

  it('projects null for a foreign entity type', () => {
    expect(projectWebSocketRequest({ type: 'request', id: 'x', data: {}, fieldOrigins: {} })).toBeNull();
  });
});

describe('websocket request update batches', () => {
  it('persists scalar edits (url, message, messageFormat) as setField leaves', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildWebSocketUpdateBatch(
        'wsrq0001',
        { url: 'ws://localhost.openheaders.io:8080/live', message: 'ping', messageFormat: 'text' },
        ctx(2_000),
        noSets,
        liveField(store, 'wsrq0001'),
      ),
    );

    const after = materialized(store, 'wsrq0001');
    expect(after.url).toBe('ws://localhost.openheaders.io:8080/live');
    expect(after.message).toBe('ping');
    expect(after.messageFormat).toBe('text');
  });

  it('routes subprotocol changes through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch(seed, ctx(1_000)));

    const payload = buildWebSocketUpdateBatch(
      'wsrq0001',
      { subprotocols: ['graphql-ws', 'soap'] },
      ctx(2_000),
      noSets,
      liveField(store, 'wsrq0001'),
    );
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(paths).not.toContain('subprotocols');
    expect(paths).toContain('subprotocols.1');

    applyBatch(store, payload);
    expect(materialized(store, 'wsrq0001').subprotocols).toEqual(['graphql-ws', 'soap']);
  });

  it('shrinks the subprotocol list by tombstoning vanished indexes', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch({ ...seed, subprotocols: ['a', 'b'] }, ctx(1_000)));

    applyBatch(
      store,
      buildWebSocketUpdateBatch('wsrq0001', { subprotocols: ['a'] }, ctx(2_000), noSets, liveField(store, 'wsrq0001')),
    );
    expect(materialized(store, 'wsrq0001').subprotocols).toEqual(['a']);
  });

  it('persists a spec re-link through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildWebSocketUpdateBatch(
        'wsrq0001',
        { specLink: { specUid: 'spec0002' } },
        ctx(2_000),
        noSets,
        liveField(store, 'wsrq0001'),
      ),
    );
    expect(materialized(store, 'wsrq0001').specLink).toEqual({ specUid: 'spec0002' });
  });

  it('emits minimum set-diff envelopes for header row edits', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch(seed, ctx(1_000)));

    // Live reader over the materialized set — ordered (itemId, orderKey, item).
    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(WEBSOCKET_REQUEST_ENTITY_TYPE, uid, setPath);
      const entity = materialized(store, uid);
      const rows = setPath === WEBSOCKET_REQUEST_HEADERS_PATH ? entity.headers : entity.params;
      const byUid = new Map(rows.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [
      { uid: 'wshd0001', key: 'x-api-key', value: 'rotated', enabled: true }, // content edit
      { uid: 'wshd0003', key: 'x-new', value: 'v3' }, // added
      // wshd0002 removed
    ];
    const payload = buildWebSocketUpdateBatch(
      'wsrq0001',
      { headers: next },
      ctx(2_000),
      liveSets,
      liveField(store, 'wsrq0001'),
    );
    const kinds = payload.batch.mutations.map((m) => m.body.kind);
    expect(kinds).toContain('addToSet');
    expect(kinds).toContain('removeFromSet');

    applyBatch(store, payload);
    expect(materialized(store, 'wsrq0001').headers).toEqual(next);
    // The params set is untouched by a headers-only patch.
    expect(materialized(store, 'wsrq0001').params).toEqual(seed.params);
  });

  it('routes an auth-block edit through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch({ ...seed, auth: { type: 'none' } }, ctx(1_000)));

    const payload = buildWebSocketUpdateBatch(
      'wsrq0001',
      { auth: { type: 'bearer', token: 'tok-123' } },
      ctx(2_000),
      noSets,
      liveField(store, 'wsrq0001'),
    );
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(paths).not.toContain('auth');
    expect(paths).toContain('auth.type');
    expect(paths).toContain('auth.token');

    applyBatch(store, payload);
    expect(materialized(store, 'wsrq0001').auth).toEqual({ type: 'bearer', token: 'tok-123' });
  });

  it('emits minimum set-diff envelopes for events-row edits', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(
      store,
      buildWebSocketAddBatch({ ...seed, events: [{ uid: 'wsev0001', name: 'price-update' }] }, ctx(1_000)),
    );

    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(WEBSOCKET_REQUEST_ENTITY_TYPE, uid, setPath);
      const entity = materialized(store, uid);
      const byUid = new Map((entity.events ?? []).map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [
      { uid: 'wsev0001', name: 'price-update', listen: false }, // content edit
      { uid: 'wsev0003', name: 'trade' }, // added
    ];
    const payload = buildWebSocketUpdateBatch(
      'wsrq0001',
      { events: next },
      ctx(2_000),
      liveSets,
      liveField(store, 'wsrq0001'),
    );
    applyBatch(store, payload);
    expect(materialized(store, 'wsrq0001').events).toEqual(next);
    // The header/param sets are untouched by an events-only patch.
    expect(materialized(store, 'wsrq0001').headers).toEqual(seed.headers);
  });

  it('replaces param rows including the hasEquals round-trip marker', () => {
    const store = new InMemoryDocumentStore(wsSchemas);
    applyBatch(store, buildWebSocketAddBatch(seed, ctx(1_000)));

    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(WEBSOCKET_REQUEST_ENTITY_TYPE, uid, setPath);
      const entity = materialized(store, uid);
      const rows = setPath === WEBSOCKET_REQUEST_HEADERS_PATH ? entity.headers : entity.params;
      const byUid = new Map(rows.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [{ uid: 'wspm0002', key: 'flag', value: '', hasEquals: true }];
    applyBatch(
      store,
      buildWebSocketUpdateBatch('wsrq0001', { params: next }, ctx(2_000), liveSets, liveField(store, 'wsrq0001')),
    );
    expect(materialized(store, 'wsrq0001').params).toEqual(next);
  });
});
